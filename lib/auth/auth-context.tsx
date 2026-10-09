'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserProfile, Role } from '@/types';
import { getUsers, initializeStore, subscribeToStore, upsertUserInMemory } from '@/lib/data/store';
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
   * Normalize and guarantee proper roles for profiles, self-healing database if needed
   */
  const normalizeProfileRole = useCallback((profile: UserProfile): UserProfile => {
    if (!profile) return profile;
    const emailLower = (profile.email || '').toLowerCase().trim();
    const nameLower = (profile.full_name || '').toLowerCase().trim();
    let role: Role = ((profile.role || 'employee').toLowerCase() === 'admin' ? 'admin' : 'employee') as Role;
    if (
      emailLower === 'aswin@dwellvise.com' ||
      emailLower === 'dinesh@dwellvise.com' ||
      nameLower === 'aswin' ||
      nameLower === 'dinesh'
    ) {
      role = 'admin';
    } else if (
      emailLower === 'pachamuthu@dwellvise.com' ||
      emailLower === 'shalini@dwellvise.com' ||
      nameLower === 'pachamuthu' ||
      nameLower === 'shalini'
    ) {
      role = 'employee';
    }
    return {
      ...profile,
      role,
    };
  }, []);

  /**
   * Look up profile by auth user id (auth.users.id -> public.profiles.id or public.profiles.auth_user_id / email)
   */
  const fetchProfileForAuthUser = useCallback(
    async (authUserId: string, authEmail?: string): Promise<UserProfile | null> => {
      const client = getSupabaseClient();
      if (!client || !isSupabaseConfigured()) return null;

      try {
        // 1. Query public.profiles with .eq('id', authUserId)
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('Profile fetch warning (id lookup):', error.message);
        }

        if (data) {
          const profile = normalizeProfileRole({
            ...data,
            email: data.email || authEmail || '',
          } as UserProfile);
          upsertUserInMemory(profile);
          return profile;
        }

        // 2. Secondary fallback for schemas with separate auth_user_id column
        const { data: authUserData, error: authUserErr } = await client
          .from('profiles')
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();

        if (authUserErr) {
          console.warn('Profile fetch warning (auth_user_id lookup):', authUserErr.message);
        }

        if (authUserData) {
          const profile = normalizeProfileRole({
            ...authUserData,
            email: authUserData.email || authEmail || '',
          } as UserProfile);
          upsertUserInMemory(profile);
          return profile;
        }

        // 3. Fallback lookup by email if available
        if (authEmail) {
          const { data: emailData, error: emailErr } = await client
            .from('profiles')
            .select('*')
            .eq('email', authEmail.toLowerCase().trim())
            .maybeSingle();

          if (emailErr) {
            console.warn('Profile fetch warning (email lookup):', emailErr.message);
          }

          if (emailData) {
            const profile = normalizeProfileRole({
              ...emailData,
              email: emailData.email || authEmail || '',
            } as UserProfile);
            // Auto-link auth_user_id for seamless future lookups
            try {
              await client
                .from('profiles')
                .update({ auth_user_id: authUserId, role: profile.role })
                .eq('id', profile.id);
            } catch {
              // Ignore update error if RLS restricts
            }
            upsertUserInMemory(profile);
            return profile;
          }
        }

        return null;
      } catch (err) {
        console.warn('Profile lookup error:', err);
        return null;
      }
    },
    [normalizeProfileRole]
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
            try {
              await client.auth.signOut();
            } catch {}
            setUser(null);
            setIsLoading(false);
            return;
          }

          const authUser = data?.session?.user;

          if (authUser) {
            const dbProfile = await fetchProfileForAuthUser(authUser.id, authUser.email);
            if (dbProfile) {
              if (dbProfile.is_active === false) {
                setAuthError('Your OfficeFlow account is inactive. Please contact an administrator.');
                setUser(null);
                setIsLoading(false);
                return;
              }
              upsertUserInMemory(dbProfile);
              setUser(dbProfile);
              setIsLoading(false);
              return;
            }

            // Fallback match in loaded users by ID or email
            const matched = currentUsers.find((u) => u.id === authUser.id || (u.email && u.email.toLowerCase() === (authUser.email || '').toLowerCase()));

            if (matched) {
              if (matched.is_active === false) {
                setAuthError('Your OfficeFlow account is inactive. Please contact an administrator.');
                setUser(null);
                setIsLoading(false);
                return;
              }
              const normalized = normalizeProfileRole(matched);
              upsertUserInMemory(normalized);
              setUser(normalized);
              setIsLoading(false);
              return;
            }

            // Authenticated in Supabase but no matching profile in database
            setAuthError(
              'Your account is authenticated, but your OfficeFlow profile is not configured. Please contact an administrator.'
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
            const normalized = normalizeProfileRole(found);
            setUser(normalized);
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
  }, [fetchProfileForAuthUser, normalizeProfileRole]);

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
            const dbProfile = await fetchProfileForAuthUser(authUser.id, authUser.email);
            if (dbProfile && dbProfile.is_active !== false) {
              upsertUserInMemory(dbProfile);
              setUser(dbProfile);
            } else {
              const currentUsers = getUsers();
              const matched = currentUsers.find((u) => u.id === authUser.id || (u.email && u.email.toLowerCase() === (authUser.email || '').toLowerCase()));
              if (matched && matched.is_active !== false) {
                const normalized = normalizeProfileRole(matched);
                upsertUserInMemory(normalized);
                setUser(normalized);
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
      try {
        const updated = getUsers();
        setUsersList(updated);
        setUser((prevUser) => {
          if (!prevUser) return null;
          const prevEmail = (prevUser.email || '').toLowerCase().trim();
          const refreshed = updated.find(
            (u) =>
              u.id === prevUser.id ||
              (prevEmail && (u?.email || '').toLowerCase().trim() === prevEmail)
          );
          if (refreshed) {
            return normalizeProfileRole(refreshed);
          }
          return normalizeProfileRole(prevUser);
        });
      } catch (err) {
        console.warn('Store subscription update caught error:', err);
      }
    });

    return () => {
      authSubscription?.unsubscribe();
      unsubscribeStore();
    };
  }, [loadCurrentUser, fetchProfileForAuthUser, normalizeProfileRole]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setAuthError(null);
    const targetEmail = email.trim().toLowerCase();
    // DO NOT trim or modify password - send exactly as entered
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
        console.log('[OfficeFlow Auth] Attempting signInWithPassword for:', targetEmail);
        const { data: authData, error: authError } = await client.auth.signInWithPassword({
          email: targetEmail,
          password: cleanPassword,
        });

        if (authError) {
          setIsLoading(false);
          const rawMsg = (authError.message || '').toLowerCase();
          console.warn('[OfficeFlow Auth] Supabase auth rejection:', {
            status: authError.status,
            name: authError.name,
            message: authError.message,
          });
          
          if (
            rawMsg.includes('invalid login credentials') ||
            rawMsg.includes('invalid credentials') ||
            rawMsg.includes('invalid email or password') ||
            rawMsg.includes('invalid grant') ||
            rawMsg.includes('user not found')
          ) {
            return {
              success: false,
              message: 'Invalid email or password.',
            };
          }
          if (rawMsg.includes('email not confirmed')) {
            return {
              success: false,
              message: 'Email address has not been confirmed. Please check your inbox or contact an administrator.',
            };
          }
          if (rawMsg.includes('too many requests') || rawMsg.includes('rate limit')) {
            return {
              success: false,
              message: 'Too many login attempts. Please wait a moment before trying again.',
            };
          }
          if (rawMsg.includes('fetch') || rawMsg.includes('network') || rawMsg.includes('failed to fetch')) {
            return {
              success: false,
              message: 'Network error connecting to authentication server. Please check your internet connection.',
            };
          }

          return {
            success: false,
            message: authError.message || 'Invalid email or password.',
          };
        }

        const authUser = authData?.user;
        if (authUser) {
          console.log('[OfficeFlow Auth] Supabase auth verified. Auth User ID:', authUser.id);
          // Look up user profile from public.profiles using authenticatedUser.id (or email fallback)
          const dbProfile = await fetchProfileForAuthUser(authUser.id, authUser.email);
          console.log('[OfficeFlow Auth] Profile lookup result:', dbProfile ? { id: dbProfile.id, role: dbProfile.role, is_active: dbProfile.is_active } : 'NOT FOUND IN DB');

          if (dbProfile) {
            if (dbProfile.is_active === false) {
              setIsLoading(false);
              return {
                success: false,
                message: 'Your OfficeFlow account is inactive. Please contact an administrator.',
              };
            }

            if (typeof window !== 'undefined') {
              localStorage.setItem('officeflow_active_user_id', dbProfile.id);
            }
            const normalized = normalizeProfileRole(dbProfile);
            upsertUserInMemory(normalized);
            setUser(normalized);
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${normalized.full_name}!` };
          }

          // Check fallback match by ID in local store
          const currentUsers = getUsers();
          const matched = currentUsers.find(
            (u) =>
              u.id === authUser.id ||
              (targetEmail && (u?.email || '').toLowerCase().trim() === targetEmail)
          );

          if (matched) {
            if (matched.is_active === false) {
              setIsLoading(false);
              return {
                success: false,
                message: 'Your OfficeFlow account is inactive. Please contact an administrator.',
              };
            }

            const normalized = normalizeProfileRole(matched);
            if (typeof window !== 'undefined') {
              localStorage.setItem('officeflow_active_user_id', normalized.id);
            }
            upsertUserInMemory(normalized);
            setUser(normalized);
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${normalized.full_name}!` };
          }

          setIsLoading(false);
          return {
            success: false,
            message:
              'Your account is authenticated, but your OfficeFlow profile is not configured. Please contact an administrator.',
          };
        }
      } catch (err: unknown) {
        setIsLoading(false);
        const msg = err instanceof Error ? err.message : 'Network error connecting to authentication server';
        console.error('[OfficeFlow Auth] Unexpected error during login:', err);
        return {
          success: false,
          message: msg,
        };
      }
    }

    // 2. Standalone / Demo Mode Authentication (when Supabase is in local/mock mode)
    const currentUsers = getUsers();
    const matchedUser = currentUsers.find(
      (u) => (u?.email || '').toLowerCase().trim() === targetEmail
    );

    if (!matchedUser) {
      setIsLoading(false);
      return {
        success: false,
        message: 'Invalid email or password.',
      };
    }

    if (matchedUser.is_active === false) {
      setIsLoading(false);
      return {
        success: false,
        message: 'Your OfficeFlow account is inactive. Please contact an administrator.',
      };
    }

    const normalized = normalizeProfileRole(matchedUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('officeflow_active_user_id', normalized.id);
    }
    upsertUserInMemory(normalized);
    setUser(normalized);
    setIsLoading(false);
    return { success: true, message: `Welcome back, ${normalized.full_name}!` };
  };

  const logout = async () => {
    setUser(null);
    setAuthError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('officeflow_active_user_id');
      localStorage.removeItem('officeflow_dwellvise_users_v4');
      localStorage.removeItem('officeflow_dwellvise_users_v3');
      localStorage.removeItem('officeflow_dwellvise_users_v2');
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
      const normalized = normalizeProfileRole(target);
      if (typeof window !== 'undefined') {
        localStorage.setItem('officeflow_active_user_id', normalized.id);
      }
      upsertUserInMemory(normalized);
      setUser(normalized);
    }
  };

  const userEmailLower = (user?.email || '').toLowerCase().trim();
  const userNameLower = (user?.full_name || '').toLowerCase().trim();
  const isUserAdmin = Boolean(
    user &&
    (
      (user.role as string)?.toLowerCase() === 'admin' ||
      userEmailLower === 'dinesh@dwellvise.com' ||
      userEmailLower === 'aswin@dwellvise.com' ||
      userNameLower === 'dinesh' ||
      userNameLower === 'aswin'
    ) &&
    (user.is_active ?? true)
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        usersList,
        isAdmin: isUserAdmin,
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
