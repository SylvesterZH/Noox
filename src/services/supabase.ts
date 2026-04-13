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
  created_at: string;
}

export async function fetchItems(
  env: Env,
  options: { limit?: number; offset?: number; category?: string } = {}
): Promise<{ items: Item[]; total: number }> {
  const { limit = 20, offset = 0, category } = options;

  let query = `${env.SUPABASE_URL}/rest/v1/items?select=*,category:categories(name,color)&order=created_at.desc&limit=${limit}&offset=${offset}`;

  if (category) {
    query += `&category.name=ilike.${encodeURIComponent(category)}`;
  }

  const response = await fetch(query, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.statusText}`);
  }

  const items = await response.json();

  // Get total count
  const countUrl = `${env.SUPABASE_URL}/rest/v1/items?select=id`;
  const countResponse = await fetch(countUrl, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
      Prefer: 'count=exact',
    },
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
  }
): Promise<Item> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error(`Failed to insert item: ${response.statusText}`);
  }

  const items = await response.json();
  return items[0];
}

export async function updateItem(
  env: Env,
  id: string,
  updates: { category?: string; tags?: string[] }
): Promise<Item> {
  // First get category_id if category name is provided
  let categoryId = undefined;
  if (updates.category) {
    const catResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/categories?name=ilike.${encodeURIComponent(updates.category)}`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
          apikey: env.SUPABASE_ANON_KEY,
        },
      }
    );
    const categories = await catResponse.json();
    if (categories.length > 0) {
      categoryId = categories[0].id;
    }
  }

  const updateData: Record<string, unknown> = {};
  if (categoryId) updateData.category_id = categoryId;
  if (updates.tags) updateData.tags = updates.tags;

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    throw new Error(`Failed to update item: ${response.statusText}`);
  }

  const items = await response.json();
  return items[0];
}

export async function searchItems(
  env: Env,
  query: string,
  limit: number = 20
): Promise<Item[]> {
  // Use full-text search via Supabase
  const searchQuery = encodeURIComponent(query);
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/items?select=*,category:categories(name,color)&or=(title.ilike.%25${searchQuery}%25,summary.ilike.%25${searchQuery}%25,content_text.ilike.%25${searchQuery}%25)&limit=${limit}&order=created_at.desc`,
    {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search items: ${response.statusText}`);
  }

  return response.json();
}

export async function checkDuplicate(env: Env, url: string): Promise<Item | null> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/items?url=eq.${encodeURIComponent(url)}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    }
  );

  if (!response.ok) return null;

  const items = await response.json();
  return items.length > 0 ? items[0] : null;
}
