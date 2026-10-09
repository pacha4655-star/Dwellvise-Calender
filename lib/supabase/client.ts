import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-supabase-anon-key') &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))
  );
};

let browserClientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (!browserClientInstance) {
    try {
      browserClientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: typeof window !== 'undefined',
          autoRefreshToken: typeof window !== 'undefined',
          detectSessionInUrl: typeof window !== 'undefined',
        },
      });
    } catch (err) {
      console.warn('[OfficeFlow Supabase] Client initialization caught error:', err);
      return null;
    }
  }
  return browserClientInstance;
};

export const createClient = () => getSupabaseClient();
