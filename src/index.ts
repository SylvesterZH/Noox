import { handleSave } from './routes/save';
import { handleGetItems } from './routes/items';
import { handleSearch } from './routes/search';
import { handleCategories, handleUpdateItem } from './routes/categories';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MINIMAX_API_KEY: string;
  MINIMAX_BASE_URL: string;
  MINIMAX_MODEL: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Route matching
    if (path === '/api/save' && method === 'POST') {
      return await handleSave(request, env);
    }

    if (path === '/api/items' && method === 'GET') {
      return await handleGetItems(request, env);
    }

    if (path === '/api/search' && method === 'GET') {
      return await handleSearch(request, env);
    }

    if (path === '/api/categories' && method === 'GET') {
      return await handleCategories(env);
    }

    if (path.match(/^\/api\/items\/([^/]+)$/) && method === 'PATCH') {
      const id = path.match(/^\/api\/items\/([^/]+)$/)![1];
      return await handleUpdateItem(request, env, id);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('Worker error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
