import { Env } from '../index';

export interface User {
  id: string;
  email?: string;
}

/**
 * Validate Supabase session token and return the authenticated user.
 * Returns null if no valid token is provided (unauthenticated).
 * Throws if token is invalid/malformed.
 */
export async function getUser(request: Request, env: Env): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    // Verify the JWT with Supabase's GoTrue endpoint
    // This also returns user info from the token
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      // Token invalid or expired
      return null;
    }

    const userData = await response.json();
    return {
      id: userData.id,
      email: userData.email,
    };
  } catch {
    return null;
  }
}

/**
 * Require a valid authenticated user. Returns a Response with 401 if not authenticated.
 */
export async function requireUser(request: Request, env: Env): Promise<{ user: User } | Response> {
  const user = await getUser(request, env);
  if (!user) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
  return { user };
}
