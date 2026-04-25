import { Env } from '../index';
import { fetchPage, extractDomain, parseMarkdown, parseHtmlContent, extractTitleFromText, isNoiseTitle } from '../services/jina';
import { generateSummary, generateUnifiedSummary, generateTitle, generateOverview, generateDetails } from '../services/minimax';
import { insertItem, checkDuplicate } from '../services/supabase';
import { requireUser } from '../services/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handleSave(request: Request, env: Env): Promise<Response> {
  // Authenticate user
  const authResult = await requireUser(request, env);
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  try {
    const body = await request.json();
    const { url, content, contentType, resolvedUrl } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required', code: 'INVALID_URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    try {
      new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format', code: 'INVALID_URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate protocol (prevent local/internal network access)
    const parsedUrl = new URL(url);
    const blockedProtocols = ['file:', 'ftp:', 'data:'];
    if (blockedProtocols.includes(parsedUrl.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Protocol not allowed', code: 'INVALID_URL' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check for duplicate (per user)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.slice(7).trim();
    const existing = await checkDuplicate(env, url, user.id, token);
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'This link is already saved', code: 'DUPLICATE' }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse content: client-provided or fetch via Jina
    let parsed;
    if (content) {
      // Client provided content - parse it
      if (contentType === 'html') {
        parsed = parseHtmlContent(content);
      } else if (contentType === 'markdown') {
        parsed = parseMarkdown(content);
      } else {
        // Assume plain text
        parsed = {
          title: extractTitleFromText(content) || 'Untitled',
          content: content.substring(0, 2000),
          description: content.substring(0, 300),
        };
      }

      // If title is noise, try to extract from first meaningful line
      if (isNoiseTitle(parsed.title)) {
        const lines = content.split('\n').filter(l => l.trim().length > 10);
        for (const line of lines) {
          const candidate = line.trim().substring(0, 100);
          if (!isNoiseTitle(candidate)) {
            parsed.title = candidate;
            break;
          }
        }
      }
    } else {
      // Fetch page content via Jina (server-side fallback)
      // Use resolvedUrl if provided (for short URL redirects), otherwise use original url
      const fetchUrl = resolvedUrl || url;
      try {
        parsed = await fetchPage(fetchUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // 451 = Unavailable For Legal Reasons (content blocked)
        // For blocked/private pages, we still save the URL with minimal data
        if (message.includes('451') || message.includes('403') || message.includes('401') || message.includes('404')) {
          // Save with empty/minimal content - the user can try to refresh later
          parsed = {
            title: extractDomain(fetchUrl),
            content: '',
            description: '',
          };
        } else if (message.includes('429')) {
          return new Response(
            JSON.stringify({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' }),
            { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        } else {
          // For other fetch failures, save with domain as title
          parsed = {
            title: extractDomain(fetchUrl),
            content: '',
            description: '',
          };
        }
      }
    }

    // Generate AI summary — skip if no content available
    let summaryResult;
    let unifiedResult = { title: parsed.title, overview: '', details: [] as string[] };
    if (!parsed.content || parsed.content.trim().length === 0) {
      // No content to summarize (blocked/private page) — save with empty summaries
      summaryResult = { summary: '', tags: [] };
    } else {
      try {
        // Generate brief summary and unified details in parallel
        const [summaryRes, unifiedRes] = await Promise.all([
          generateSummary(env, parsed.content),
          generateUnifiedSummary(env, parsed.content),
        ]);
        summaryResult = summaryRes;
        unifiedResult = unifiedRes;
      } catch (err) {
        console.error('AI summary failed:', err);
        return new Response(
          JSON.stringify({ error: 'Summary generation failed. The link was still saved.', code: 'AI_FAILED' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    const detailedSummaryResult = {
      overview: unifiedResult.overview,
      details: unifiedResult.details,
    };

    let finalTitle = parsed.title;
    // Use the AI generated title if the original was noise OR if the AI generated a valid non-empty title and the original is generic
    if (unifiedResult.title && unifiedResult.title !== 'Untitled' && unifiedResult.title !== finalTitle) {
       if (isNoiseTitle(finalTitle) || finalTitle === extractDomain(url)) {
           finalTitle = unifiedResult.title;
       }
    }

    // Extract domain
    const source = extractDomain(url);

    // Save to Supabase — include user_id for RLS
    console.log('[save] detailedSummaryResult:', JSON.stringify(detailedSummaryResult));
    const item = await insertItem(env, {
      url,
      title: finalTitle,
      summary: summaryResult.summary,
      source,
      tags: summaryResult.tags,
      content_text: parsed.content.substring(0, 2000),
      user_id: user.id,
      detailed_summary: detailedSummaryResult,
    }, token);

    return new Response(
      JSON.stringify({
        id: item.id,
        url: item.url,
        title: item.title,
        summary: item.summary,
        source: item.source,
        tags: item.tags,
        category: null,
        detailed_summary: item.detailed_summary,
        created_at: item.created_at,
        // DEBUG: include parsed detailedSummaryResult to verify parsing
        _debug_detailed: detailedSummaryResult,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Save error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Failed to save link', code: 'SAVE_FAILED', detail: message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
