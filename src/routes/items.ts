import { Env } from '../index';
import { fetchItems } from '../services/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function handleGetItems(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const category = url.searchParams.get('category') || undefined;

  try {
    const { items, total } = await fetchItems(env, { limit, offset, category });

    // Transform to include category name directly
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
        total,
        has_more: offset + items.length < total,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Error fetching items:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch items' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
