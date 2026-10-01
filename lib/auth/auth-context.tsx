'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '@/types';
import { getUsers, getUserById, initializeStore, subscribeToStore } from '@/lib/data/store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: UserProfile | null;
  usersList: UserProfile[];
  isAdmin: boolean;
  isLoading: boolean;
  authError: string | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  retryAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'officeflow_auth_user_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadCurrentUser = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      initializeStore();
      const currentUsers = getUsers();
      setUsersList(currentUsers);

      // Check Supabase session if configured with timeout
      if (isSupabaseConfigured() && supabase) {
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: null }), 2000)
          );

          const { data } = await Promise.race([sessionPromise, timeoutPromise]);
          if (data?.session?.user?.email) {
            const matched = currentUsers.find(
              (u) => u.email.toLowerCase() === data.session.user.email?.toLowerCase()
            );
            if (matched && matched.is_active) {
              setUser(matched);
              if (typeof window !== 'undefined') {
                localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
              }
              setIsLoading(false);
              return;
            }
          }
        } catch (supabaseErr) {
          console.warn('Supabase session check error:', supabaseErr);
        }
      }

      // Check local storage saved session
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
      if (savedUserId) {
        const found = currentUsers.find((u) => u.id === savedUserId);
        if (found && found.is_active) {
          setUser(found);
          setIsLoading(false);
          return;
        }
      }

      // Unauthenticated: No default fallback
      setUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading authentication session';
      setAuthError(msg);
      console.warn('Auth loading caught error:', msg);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();

    // Listen to Supabase auth state if configured
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user?.email) {
            const currentUsers = getUsers();
            const matched = currentUsers.find(
              (u) => u.email.toLowerCase() === session.user.email?.toLowerCase()
            );
            if (matched && matched.is_active) {
              setUser(matched);
              if (typeof window !== 'undefined') {
                localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
              }
            }
          }
        });
        authSubscription = authListener.subscription;
      } catch (err) {
        console.warn('Supabase onAuthStateChange error:', err);
      }
    }

    const unsubscribeStore = subscribeToStore(() => {
      const updated = getUsers();
      setUsersList(updated);
      setUser((prevUser) => {
        if (!prevUser) return null;
        const refreshed = updated.find((u) => u.id === prevUser.id);
        return refreshed || prevUser;
      });
    });

    return () => {
      authSubscription?.unsubscribe();
      unsubscribeStore();
    };
  }, []);

  const login = async (email: string, _password?: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    const targetEmail = email.trim().toLowerCase();

    // Check Supabase Auth if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: _password || 'password123',
        });
        if (error) {
          console.warn('Supabase auth attempt:', error.message);
        }
      } catch (err) {
        console.warn('Supabase auth catch:', err);
      }
    }

    const matchedUser = usersList.find((u) => u.email.toLowerCase() === targetEmail);

    if (!matchedUser) {
      setIsLoading(false);
      return {
        success: false,
        message: 'No account found with this email. Try pachamuthu@officeflow.local or dinesh@officeflow.local',
      };
    }

    if (!matchedUser.is_active) {
      setIsLoading(false);
      return {
        success: false,
        message: 'This employee account is deactivated. Contact office admin.',
      };
    }

    setUser(matchedUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, matchedUser.id);
    }
    setIsLoading(false);
    return { success: true, message: `Welcome back, ${matchedUser.full_name}!` };
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.signOut().catch(console.warn);
    }
  };

  const switchUser = (userId: string) => {
    const target = getUserById(userId);
    if (target) {
      setUser(target);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEY, target.id);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        usersList,
        isAdmin: user?.role === 'admin',
        isLoading,
        authError,
        login,
        logout,
        switchUser,
        retryAuth: loadCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
