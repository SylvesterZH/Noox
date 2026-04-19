export interface Item {
  id: string;
  url: string;
  title: string;
  summary: string;
  source: string;
  category: string | null;
  category_color: string | null;
  tags: string[];
  created_at: string;
  thumbnail_url?: string; // Optional image preview from content extraction
}

export interface Category {
  id: string;
  name: string;
  color: string;
  is_preset: boolean;
}

export interface SaveResponse {
  id: string;
  url: string;
  title: string;
  summary: string;
  source: string;
  tags: string[];
  category: string | null;
  created_at: string;
}

export interface ItemsResponse {
  items: Item[];
  total: number;
  has_more: boolean;
}

export interface SearchResponse {
  items: Item[];
  query: string;
}

export interface CategoriesResponse {
  categories: Category[];
}
