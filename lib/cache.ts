/**
 * Simple cache utility using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item } from '../types';

const ITEMS_CACHE_KEY = '@noox_items_cache';

export interface CacheData {
  items: Item[];
  timestamp: number;
}

export async function getCachedItems(): Promise<Item[] | null> {
  try {
    const raw = await AsyncStorage.getItem(ITEMS_CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    return data.items;
  } catch {
    return null;
  }
}

export async function setCachedItems(items: Item[]): Promise<void> {
  try {
    const data: CacheData = { items, timestamp: Date.now() };
    await AsyncStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache write failed, ignore
  }
}

export async function clearItemsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ITEMS_CACHE_KEY);
  } catch {}
}