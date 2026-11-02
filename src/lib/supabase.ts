import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hasValidProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    const isNotPlaceholder =
      !url.includes('placeholder') &&
      !url.includes('your-project') &&
      !url.includes('example.com');
    return hasValidProtocol && Boolean(parsed.hostname) && isNotPlaceholder;
  } catch {
    return false;
  }
}

function isValidAnonKey(key: string): boolean {
  return Boolean(
    key &&
    key.length > 10 &&
    !key.includes('placeholder') &&
    !key.includes('your-anon-key')
  );
}

export const isSupabaseConfigured: boolean = Boolean(
  isValidSupabaseUrl(rawUrl) && isValidAnonKey(rawAnonKey)
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
