import { Env } from '../index';
import { searchItems } from '../services/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20');

  if (!query.trim()) {
    return new Response(
      JSON.stringify({ items: [], query: '' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const items = await searchItems(env, query, limit);

    // Transform to include category info
    const transformedItems = items.map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      summary: item.summary,
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
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
