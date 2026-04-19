import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

let supabase: SupabaseClient;

export function initSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabase;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
}

export async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
  const client = getSupabase();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'noox://login-callback',
    },
  });
  return { error };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error: Error | null }> {
  const client = getSupabase();
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  return { error };
}

export async function signUp(
  email: string,
  password: string
): Promise<{ error: Error | null }> {
  const client = getSupabase();
  const { error } = await client.auth.signUp({
    email,
    password,
  });
  return { error };
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  await client.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabase();
  const { data } = await client.auth.getSession();
  return data.session;
}

export async function getUser(): Promise<User | null> {
  const client = getSupabase();
  const { data } = await client.auth.getUser();
  return data.user;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token || null;
}

// Listen to auth state changes
// In Supabase v2, returns { data: { subscription } } - no manual unsubscribe needed
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { data: { subscription: unknown } } {
  const client = getSupabase();
  return client.auth.onAuthStateChange(callback);
}

// Dev token helper (used when Supabase session is not available)
let devToken: string | null = null;
export function setDevToken(token: string | null) { devToken = token; }
export function getDevToken(): string | null { return devToken; }
