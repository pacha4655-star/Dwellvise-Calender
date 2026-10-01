import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

export const createClient = () => {
  if (isSupabaseConfigured()) {
    try {
      return createBrowserClient(supabaseUrl, supabaseAnonKey);
    } catch (err) {
      console.warn('Browser client creation fallback:', err);
      return createSupabaseClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return null;
};

export const supabase = isSupabaseConfigured()
  ? createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
