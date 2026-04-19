import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  initSupabase,
  signInWithPassword,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
  onAuthStateChange,
} from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initSupabase();

    // Rely solely on onAuthStateChange for session restoration (Supabase v2 handles this)
    // This avoids racing with getSession() which may return null before AsyncStorage restore
    const { data } = onAuthStateChange((event, sessionData) => {
      setSession(sessionData);
      setUser(sessionData?.user ?? null);
      // Initial session check complete on first INITIAL_SESSION event
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    return signInWithPassword(email, password);
  };

  const signUp = async (email: string, password: string) => {
    return supabaseSignUp(email, password);
  };

  const signOut = async () => {
    await supabaseSignOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
