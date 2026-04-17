import { Env } from '../index';
import { fetchPage, extractDomain, parseMarkdown, parseHtmlContent, extractTitleFromText, isNoiseTitle } from '../services/jina';
import { generateSummary, generateTitle } from '../services/minimax';
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
    const { url, content, contentType } = body;

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
      try {
        parsed = await fetchPage(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('403') || message.includes('401')) {
          return new Response(
            JSON.stringify({ error: 'This page is blocked or requires authentication', code: 'FETCH_FORBIDDEN' }),
            { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        if (message.includes('404')) {
          return new Response(
            JSON.stringify({ error: 'This page could not be found', code: 'FETCH_NOT_FOUND' }),
            { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        if (message.includes('429')) {
          return new Response(
            JSON.stringify({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' }),
            { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        return new Response(
          JSON.stringify({ error: "Couldn't access this page. It might be private or blocked.", code: 'FETCH_FAILED' }),
          { status: 422, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Generate AI summary
    let summaryResult;
    try {
      summaryResult = await generateSummary(env, parsed.content);
    } catch (err) {
      console.error('AI summary failed:', err);
      return new Response(
        JSON.stringify({ error: 'Summary generation failed. The link was still saved.', code: 'AI_FAILED' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if title is noise, if so generate a new one
    let finalTitle = parsed.title;
    if (isNoiseTitle(finalTitle)) {
      try {
        const titleResult = await generateTitle(env, parsed.content);
        finalTitle = titleResult.title;
      } catch (err) {
        console.error('AI title generation failed:', err);
        // Keep the original title even if it's noise
      }
    }

    // Extract domain
    const source = extractDomain(url);

    // Save to Supabase — include user_id for RLS
    const item = await insertItem(env, {
      url,
      title: finalTitle,
      summary: summaryResult.summary,
      source,
      tags: summaryResult.tags,
      content_text: parsed.content.substring(0, 2000),
      user_id: user.id,
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
        created_at: item.created_at,
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
