import { Env } from '../index';
import { updateItem } from '../services/supabase';
import { requireUser } from '../services/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function handleCategories(env: Env): Promise<Response> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/categories?order=name.asc`, {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    const categories = await response.json();

    return new Response(
      JSON.stringify({ categories }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch categories', code: 'FETCH_FAILED' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function handleUpdateItem(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  // Authenticate user
  const authResult = await requireUser(request, env);
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  try {
    const body = await request.json();
    const { category, tags } = body;

    // Get token for Supabase requests
    const authHeader = request.headers.get('Authorization');
    const userToken = authHeader?.slice(7).trim();

    // Validate: must provide at least one update
    if (category === undefined && tags === undefined) {
      return new Response(
        JSON.stringify({ error: 'No updates provided', code: 'NO_UPDATES' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const updated = await updateItem(env, id, { category, tags }, userToken);

    return new Response(
      JSON.stringify({
        id: updated.id,
        category: updated.category?.name || null,
        category_color: updated.category?.color || null,
        tags: updated.tags,
        updated_at: updated.created_at,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error updating item:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update item', code: 'UPDATE_FAILED' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
