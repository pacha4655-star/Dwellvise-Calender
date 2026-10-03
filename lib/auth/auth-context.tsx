'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserProfile } from '@/types';
import { getUsers, initializeStore, subscribeToStore } from '@/lib/data/store';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * Look up profile by auth user id (auth.users.id -> public.profiles.id)
   */
  const fetchProfileForAuthUser = useCallback(
    async (authUserId: string): Promise<UserProfile | null> => {
      const client = getSupabaseClient();
      if (!client || !isSupabaseConfigured()) return null;

      try {
        // Query public.profiles with .eq('id', authUserId)
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('Profile fetch warning (id lookup):', error.message);
        }

        if (data) {
          return data as UserProfile;
        }

        // Secondary fallback for schemas with separate auth_user_id column
        const { data: authUserData, error: authUserErr } = await client
          .from('profiles')
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();

        if (authUserErr) {
          console.warn('Profile fetch warning (auth_user_id lookup):', authUserErr.message);
        }

        return (authUserData as UserProfile) || null;
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

      const client = getSupabaseClient();

      // Check Supabase session if configured
      if (isSupabaseConfigured() && client) {
        try {
          const { data, error } = await client.auth.getSession();
          if (error) {
            console.warn('Supabase getSession error:', error.message);
            setUser(null);
            setIsLoading(false);
            return;
          }

          const authUser = data?.session?.user;

          if (authUser) {
            const dbProfile = await fetchProfileForAuthUser(authUser.id);
            if (dbProfile) {
              if (dbProfile.is_active === false) {
                setAuthError('This employee account is deactivated. Contact office admin.');
                setUser(null);
                setIsLoading(false);
                return;
              }
              setUser(dbProfile);
              setIsLoading(false);
              return;
            }

            // Fallback match in loaded users by ID
            const matched = currentUsers.find((u) => u.id === authUser.id);

            if (matched) {
              if (matched.is_active === false) {
                setAuthError('This employee account is deactivated. Contact office admin.');
                setUser(null);
                setIsLoading(false);
                return;
              }
              setUser(matched);
              setIsLoading(false);
              return;
            }

            // Authenticated in Supabase but no matching profile in database
            setAuthError(
              'Your account is authenticated, but your OfficeFlow profile is not configured. Please contact the administrator.'
            );
            setUser(null);
            setIsLoading(false);
            return;
          } else {
            // No active Supabase session
            setUser(null);
            setIsLoading(false);
            return;
          }
        } catch (supabaseErr) {
          console.warn('Supabase session check error:', supabaseErr);
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      // Standalone / local demo mode (when Supabase is not connected)
      if (typeof window !== 'undefined') {
        const storedActiveUserId = localStorage.getItem('officeflow_active_user_id');
        if (storedActiveUserId) {
          const found = currentUsers.find((u) => u.id === storedActiveUserId);
          if (found && found.is_active !== false) {
            setUser(found);
            setIsLoading(false);
            return;
          }
        }
      }

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

    const client = getSupabaseClient();
    let authSubscription: { unsubscribe: () => void } | null = null;

    if (isSupabaseConfigured() && client) {
      try {
        const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
            setIsLoading(false);
            return;
          }

          if (session?.user) {
            const authUser = session.user;
            const dbProfile = await fetchProfileForAuthUser(authUser.id);
            if (dbProfile && dbProfile.is_active !== false) {
              setUser(dbProfile);
            } else {
              const currentUsers = getUsers();
              const matched = currentUsers.find((u) => u.id === authUser.id);
              if (matched && matched.is_active !== false) {
                setUser(matched);
              }
            }
            setIsLoading(false);
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

  const login = async (email: string, password?: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setAuthError(null);
    const targetEmail = email.trim().toLowerCase();
    const cleanPassword = password || '';

    if (!targetEmail || !cleanPassword) {
      setIsLoading(false);
      return {
        success: false,
        message: 'Please enter both your work email address and password.',
      };
    }

    const client = getSupabaseClient();

    // 1. If Supabase Auth is configured, authenticate via official browser signInWithPassword
    if (isSupabaseConfigured() && client) {
      try {
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: targetEmail,
          password: cleanPassword,
        });

        if (authError) {
          setIsLoading(false);
          return {
            success: false,
            message: authError.message || 'Invalid login credentials',
          };
        }

        const authUser = authData?.user;
        if (authUser) {
          // Look up user profile from public.profiles using authenticatedUser.id
          const dbProfile = await fetchProfileForAuthUser(authUser.id);

          if (dbProfile) {
            if (dbProfile.is_active === false) {
              setIsLoading(false);
              return {
                success: false,
                message: 'This employee account is deactivated. Contact office admin.',
              };
            }

            setUser(dbProfile);
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${dbProfile.full_name}!` };
          }

          // Check fallback match by ID in store
          const currentUsers = getUsers();
          const matched = currentUsers.find((u) => u.id === authUser.id);

          if (matched) {
            if (matched.is_active === false) {
              setIsLoading(false);
              return {
                success: false,
                message: 'This employee account is deactivated. Contact office admin.',
              };
            }

            setUser(matched);
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
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'Network error connecting to authentication server';
        return {
          success: false,
          message: msg,
        };
      }
    }

    // 2. Standalone / Demo Mode Authentication (when Supabase is in local/mock mode)
    const currentUsers = getUsers();
    const matchedUser = currentUsers.find((u) => u.email.toLowerCase() === targetEmail);

    if (!matchedUser) {
      setIsLoading(false);
      return {
        success: false,
        message: 'Invalid login credentials. No account found with this email address.',
      };
    }

    if (matchedUser.is_active === false) {
      setIsLoading(false);
      return {
        success: false,
        message: 'This employee account is deactivated. Contact office admin.',
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('officeflow_active_user_id', matchedUser.id);
    }
    setUser(matchedUser);
    setIsLoading(false);
    return { success: true, message: `Welcome back, ${matchedUser.full_name}!` };
  };

  const logout = async () => {
    setUser(null);
    setAuthError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('officeflow_active_user_id');
    }

    const client = getSupabaseClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut warning:', err);
      }
    }
  };

  const switchUser = (userId: string) => {
    const currentUsers = getUsers();
    const target = currentUsers.find((u) => u.id === userId);
    if (target && target.is_active !== false) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('officeflow_active_user_id', target.id);
      }
      setUser(target);
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
