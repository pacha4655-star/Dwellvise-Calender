'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  logout: () => Promise<void>;
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

  const fetchProfileForAuthUser = useCallback(
    async (authUserId: string, authUserEmail?: string | null): Promise<UserProfile | null> => {
      if (!supabase || !isSupabaseConfigured()) return null;

      try {
        const emailFilter = authUserEmail ? `email.ilike.${authUserEmail}` : '';
        const orFilter = emailFilter
          ? `id.eq.${authUserId},auth_user_id.eq.${authUserId},${emailFilter}`
          : `id.eq.${authUserId},auth_user_id.eq.${authUserId}`;

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(orFilter)
          .maybeSingle();

        if (error) {
          console.warn('Profile fetch warning:', error.message);
          return null;
        }

        return (data as UserProfile) || null;
      } catch (err) {
        console.warn('Profile lookup error:', err);
        return null;
      }
    },
    []
  );

  const loadCurrentUser = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      initializeStore();
      const currentUsers = getUsers();
      setUsersList(currentUsers);

      // Check Supabase session if configured with safe timeout
      if (isSupabaseConfigured() && supabase) {
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: null }), 2500)
          );

          const { data } = await Promise.race([sessionPromise, timeoutPromise]);
          const authUser = data?.session?.user;

          if (authUser) {
            const dbProfile = await fetchProfileForAuthUser(authUser.id, authUser.email);
            if (dbProfile) {
              if (dbProfile.is_active === false) {
                setAuthError('This employee account is deactivated. Contact office admin.');
                setUser(null);
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                }
                setIsLoading(false);
                return;
              }
              setUser(dbProfile);
              if (typeof window !== 'undefined') {
                localStorage.setItem(AUTH_STORAGE_KEY, dbProfile.id);
              }
              setIsLoading(false);
              return;
            }

            // Fallback match in local list
            const matched = currentUsers.find(
              (u) =>
                u.id === authUser.id ||
                (authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase())
            );

            if (matched) {
              if (matched.is_active === false) {
                setAuthError('This employee account is deactivated. Contact office admin.');
                setUser(null);
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(AUTH_STORAGE_KEY);
                }
                setIsLoading(false);
                return;
              }
              setUser(matched);
              if (typeof window !== 'undefined') {
                localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
              }
              setIsLoading(false);
              return;
            }

            // Authenticated in Supabase but no profile configured
            setAuthError(
              'Your account is authenticated, but your OfficeFlow profile is not configured. Please contact the administrator.'
            );
            setUser(null);
            setIsLoading(false);
            return;
          }
        } catch (supabaseErr) {
          console.warn('Supabase session check error:', supabaseErr);
        }
      }

      // Check local storage saved session
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
      if (savedUserId) {
        const found = currentUsers.find((u) => u.id === savedUserId);
        if (found && found.is_active !== false) {
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
  }, [fetchProfileForAuthUser]);

  useEffect(() => {
    loadCurrentUser();

    // Listen to Supabase auth state if configured
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(AUTH_STORAGE_KEY);
            }
            return;
          }

          if (session?.user) {
            const authUser = session.user;
            const dbProfile = await fetchProfileForAuthUser(authUser.id, authUser.email);
            if (dbProfile && dbProfile.is_active !== false) {
              setUser(dbProfile);
              if (typeof window !== 'undefined') {
                localStorage.setItem(AUTH_STORAGE_KEY, dbProfile.id);
              }
            } else {
              const currentUsers = getUsers();
              const matched = currentUsers.find(
                (u) =>
                  u.id === authUser.id ||
                  (authUser.email && u.email.toLowerCase() === authUser.email.toLowerCase())
              );
              if (matched && matched.is_active !== false) {
                setUser(matched);
                if (typeof window !== 'undefined') {
                  localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
                }
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
  }, [loadCurrentUser, fetchProfileForAuthUser]);

  const login = async (email: string, _password?: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setAuthError(null);
    const targetEmail = email.trim().toLowerCase();

    // 1. If Supabase Auth is configured, authenticate with Supabase Auth
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: _password || '',
        });

        if (authError) {
          console.log('Supabase sign-in error:', authError.message);
          setIsLoading(false);
          return {
            success: false,
            message: authError.message || 'Invalid login credentials',
          };
        }

        const authUser = authData?.user;
        if (authUser) {
          // Look up user profile from public.profiles
          const dbProfile = await fetchProfileForAuthUser(authUser.id, targetEmail);

          if (dbProfile) {
            if (dbProfile.is_active === false) {
              setIsLoading(false);
              return {
                success: false,
                message: 'This employee account is deactivated. Contact office admin.',
              };
            }

            setUser(dbProfile);
            if (typeof window !== 'undefined') {
              localStorage.setItem(AUTH_STORAGE_KEY, dbProfile.id);
            }
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${dbProfile.full_name}!` };
          }

          // Check fallback in local store
          const currentUsers = getUsers();
          const matched = currentUsers.find(
            (u) =>
              u.id === authUser.id ||
              u.email.toLowerCase() === targetEmail
          );

          if (matched) {
            if (matched.is_active === false) {
              setIsLoading(false);
              return {
                success: false,
                message: 'This employee account is deactivated. Contact office admin.',
              };
            }

            setUser(matched);
            if (typeof window !== 'undefined') {
              localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
            }
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${matched.full_name}!` };
          }

          setIsLoading(false);
          return {
            success: false,
            message:
              'Your account is authenticated, but your OfficeFlow profile is not configured. Please contact the administrator.',
          };
        }
      } catch (err: unknown) {
        console.error('Supabase auth catch error:', err);
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'Network error connecting to authentication server';
        return {
          success: false,
          message: msg,
        };
      }
    }

    // 2. Standalone / Local Mode Authentication
    const currentUsers = getUsers();
    const matchedUser = currentUsers.find((u) => u.email.toLowerCase() === targetEmail);

    if (!matchedUser) {
      setIsLoading(false);
      return {
        success: false,
        message: 'No company account found with this email address. Please use your @dwellvise.com work email.',
      };
    }

    if (matchedUser.is_active === false) {
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

  const logout = async () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut warning:', err);
      }
    }
  };

  const switchUser = (userId: string) => {
    const currentUsers = getUsers();
    const target = currentUsers.find((u) => u.id === userId);
    if (target && target.is_active !== false) {
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
