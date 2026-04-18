import { SaveResponse, ItemsResponse, SearchResponse, CategoriesResponse } from '../types';
import { getAccessToken, getDevToken } from './supabase';

const API_BASE = 'https://api.nooxhub.com/api';

async function getAuthHeader(): Promise<Record<string, string>> {
  // Try Supabase session token first, fall back to dev token
  const token = await getAccessToken() || getDevToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function saveUrl(
  url: string,
  options?: {
    content?: string;
    contentType?: 'html' | 'text' | 'markdown';
    resolvedUrl?: string; // Final URL after short URL redirect
  }
): Promise<SaveResponse> {
  const authHeaders = await getAuthHeader();
  const body: Record<string, string> = { url };
  if (options?.content) {
    body.content = options.content;
    body.contentType = options.contentType || 'text';
  }
  if (options?.resolvedUrl) {
    body.resolvedUrl = options.resolvedUrl;
  }
  const res = await fetch(`${API_BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    const error = new Error(err.error || 'Failed to save');
    (error as any).code = err.code;
    throw error;
  }
  return res.json();
}

export async function getItems(params: {
  limit?: number;
  offset?: number;
  category?: string;
} = {}): Promise<ItemsResponse> {
  const { limit = 20, offset = 0, category } = params;
  let url = `${API_BASE}/items?limit=${limit}&offset=${offset}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  const authHeaders = await getAuthHeader();
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export async function searchItems(query: string, limit = 20): Promise<SearchResponse> {
  const authHeaders = await getAuthHeader();
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getCategories(): Promise<CategoriesResponse> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function updateItem(
  id: string,
  updates: { category?: string; tags?: string[] }
): Promise<void> {
  const authHeaders = await getAuthHeader();
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update item');
}

export async function deleteItem(id: string): Promise<void> {
  const authHeaders = await getAuthHeader();
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (!res.ok) throw new Error('Failed to delete item');
}
