import { Env } from '../index';
import { fetchItems, deleteItem } from '../services/supabase';
import { requireUser } from '../services/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handleGetItems(request: Request, env: Env): Promise<Response> {
  // Authenticate user
  const authResult = await requireUser(request, env);
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  // Get token for Supabase requests
  const authHeader = request.headers.get('Authorization');
  const userToken = authHeader?.slice(7).trim();

  const url = new URL(request.url);
  // Parse with validation - default to 20, max 50, min 1
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');

  const parsedLimit = rawLimit ? parseInt(rawLimit) : NaN;
  const parsedOffset = rawOffset ? parseInt(rawOffset) : NaN;

  const limit = isNaN(parsedLimit) ? 20 : Math.min(Math.max(1, parsedLimit), 50);
  const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;
  const category = url.searchParams.get('category') || undefined;

  try {
    const { items, total } = await fetchItems(env, { limit, offset, category }, userToken);

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
      JSON.stringify({ error: 'Failed to fetch items', code: 'FETCH_FAILED' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function handleDeleteItem(request: Request, env: Env, id: string): Promise<Response> {
  const authResult = await requireUser(request, env);
  if (authResult instanceof Response) return authResult;

  try {
    const authHeader = request.headers.get('Authorization');
    const userToken = authHeader?.slice(7).trim();
    await deleteItem(env, id, userToken);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error deleting item:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete item', code: 'DELETE_FAILED' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
