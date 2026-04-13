import { Env } from '../index';
import { fetchPage, extractDomain } from '../services/jina';
import { generateSummary } from '../services/minimax';
import { insertItem, checkDuplicate } from '../services/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handleSave(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    try {
      new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check for duplicate
    const existing = await checkDuplicate(env, url);
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'This link is already saved', code: 'DUPLICATE' }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Fetch page content via Jina
    const parsed = await fetchPage(url);

    // Generate AI summary
    const { summary, tags } = await generateSummary(env, parsed.content);

    // Extract domain
    const source = extractDomain(url);

    // Save to Supabase
    const item = await insertItem(env, {
      url,
      title: parsed.title,
      summary,
      source,
      tags,
      content_text: parsed.content.substring(0, 2000),
    });

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
    return new Response(
      JSON.stringify({ error: 'Failed to save link', code: 'SAVE_FAILED' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
