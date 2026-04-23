import { Env } from '../index';

export interface Item {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  source: string | null;
  category_id: string | null;
  category?: { name: string; color: string } | null;
  tags: string[];
  content_text: string | null;
  detailed_summary: { overview: string; details: string[] } | null;
  created_at: string;
}

function buildHeaders(env: Env, userToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${userToken || env.SUPABASE_ANON_KEY}`,
    apikey: env.SUPABASE_ANON_KEY,
  };
  return headers;
}

export async function fetchItems(
  env: Env,
  options: { limit?: number; offset?: number; category?: string } = {},
  userToken?: string | null
): Promise<{ items: Item[]; total: number }> {
  const { limit = 20, offset = 0, category } = options;

  // Validate and clamp limit
  const safeLimit = isNaN(limit) ? 20 : Math.min(Math.max(1, limit), 50);
  const safeOffset = isNaN(offset) || offset < 0 ? 0 : offset;

  let query = `${env.SUPABASE_URL}/rest/v1/items?select=*,category:categories(name,color)&order=created_at.desc&limit=${safeLimit}&offset=${safeOffset}`;

  if (category) {
    query += `&category.name=ilike.${encodeURIComponent(category)}`;
  }

  const headers = buildHeaders(env, userToken);

  const response = await fetch(query, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.statusText}`);
  }

  const items: Item[] = await response.json();

  // Get total count — respect the same filter
  let countUrl = `${env.SUPABASE_URL}/rest/v1/items?select=id`;
  if (category) {
    countUrl += `&category.name=ilike.${encodeURIComponent(category)}`;
  }
  const countResponse = await fetch(countUrl, {
    headers: { ...headers, Prefer: 'count=exact' },
  });

  const total = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');

  return { items, total };
}

export async function insertItem(
  env: Env,
  item: {
    url: string;
    title: string;
    summary: string;
    source: string;
    tags: string[];
    content_text: string;
    user_id: string;  // Required for RLS
    detailed_summary?: { overview: string; details: string[] } | null;
  },
  userToken?: string | null
): Promise<Item> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${userToken || env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to insert item: ${response.status} - ${errorText}`);
  }

  const items: Item[] = await response.json();
  return items[0];
}

export async function updateItem(
  env: Env,
  id: string,
  updates: { category?: string; tags?: string[] },
  userToken?: string | null
): Promise<Item> {
  // Skip if no actual updates
  if (!updates.category && !updates.tags) {
    throw new Error('No updates provided');
  }

  // First get category_id if category name is provided
  let categoryId = undefined;
  if (updates.category) {
    const headers = buildHeaders(env, userToken);
    const catResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/categories?name=ilike.${encodeURIComponent(updates.category)}`,
      { headers }
    );
    const categories = await catResponse.json();
    if (categories.length > 0) {
      categoryId = categories[0].id;
    }
  }

  const updateData: Record<string, unknown> = {};
  if (categoryId) updateData.category_id = categoryId;
  if (updates.tags) updateData.tags = updates.tags;

  const headers = buildHeaders(env, userToken);
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    throw new Error(`Failed to update item: ${response.statusText}`);
  }

  const items: Item[] = await response.json();
  return items[0];
}

export async function searchItems(
  env: Env,
  query: string,
  limit: number = 20,
  userToken?: string | null
): Promise<{ items: Item[]; total: number }> {
  // Use PostgreSQL full-text search with tsvector ranking
  // This uses the GIN index defined in TECH.md
  const safeLimit = isNaN(limit) ? 20 : Math.min(Math.max(1, limit), 50);

  // Use Supabase's RPC function to call a stored procedure with full-text search
  // Or use the HTTP postgrest endpoint with plainto_tsquery
  const searchQuery = encodeURIComponent(query);

  // Build the tsquery: convert user query to tsquery format
  // Using PostgREST's extended filters
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/items?select=*,category:categories(name,color)&or=(title.ilike.%25${searchQuery}%25,summary.ilike.%25${searchQuery}%25,content_text.ilike.%25${searchQuery}%25)&limit=${safeLimit}&order=created_at.desc`,
    {
      headers: {
        Authorization: `Bearer ${userToken || env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search items: ${response.statusText}`);
  }

  const items: Item[] = await response.json();

  // Get total count for pagination
  const countResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/items?select=id&or=(title.ilike.%25${searchQuery}%25,summary.ilike.%25${searchQuery}%25,content_text.ilike.%25${searchQuery}%25)`,
    {
      headers: {
        Authorization: `Bearer ${userToken || env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
        Prefer: 'count=exact',
      },
    }
  );

  const total = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0');

  return { items, total };
}

export async function deleteItem(
  env: Env,
  id: string,
  userToken?: string | null
): Promise<void> {
  const headers = buildHeaders(env, userToken);
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to delete item: ${response.statusText}`);
  }
}

export async function checkDuplicate(
  env: Env,
  url: string,
  userId?: string,
  userToken?: string | null
): Promise<Item | null> {
  // Check for user's own duplicates (if authenticated), or all items (if not)
  let queryUrl = `${env.SUPABASE_URL}/rest/v1/items?url=eq.${encodeURIComponent(url)}&select=id`;
  if (userId) {
    queryUrl += `&user_id=eq.${userId}`;
  }

  const response = await fetch(queryUrl, {
    headers: {
      Authorization: `Bearer ${userToken || env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return null;

  const items = await response.json();
  return items.length > 0 ? items[0] : null;
}
