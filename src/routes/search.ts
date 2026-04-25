import { Env } from '../index';
import { searchItems } from '../services/supabase';
import { requireUser } from '../services/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  // Authenticate user
  const authResult = await requireUser(request, env);
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');

  const parsedLimit = rawLimit ? parseInt(rawLimit) : NaN;
  const parsedOffset = rawOffset ? parseInt(rawOffset) : NaN;

  const limit = isNaN(parsedLimit) ? 20 : Math.min(Math.max(1, parsedLimit), 50);
  const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

  // Get token for Supabase requests
  const authHeader = request.headers.get('Authorization');
  const userToken = authHeader?.slice(7).trim();

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ items: [], query: '', total: 0, has_more: false }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const { items, total } = await searchItems(env, query, limit, userToken);

    // Transform to include category info
    const transformedItems = items.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      summary: item.summary,
      detailed_summary: item.detailed_summary,
      source: item.source,
      category: item.category?.name || null,
      category_color: item.category?.color || null,
      tags: item.tags,
      created_at: item.created_at,
    }));

    return new Response(
      JSON.stringify({
        items: transformedItems,
        query,
        total,
        has_more: offset + items.length < total,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed', code: 'SEARCH_FAILED' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
