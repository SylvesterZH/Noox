import { Env } from '../index';
import { updateItem, searchItems } from '../services/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      JSON.stringify({ error: 'Failed to fetch categories' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function handleUpdateItem(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  try {
    const body = await request.json();
    const { category, tags } = body;

    const updated = await updateItem(env, id, { category, tags });

    return new Response(JSON.stringify({ success: true, item: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error updating item:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update item' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
