import { createBrowserClient } from '@supabase/ssr';

// IMPORTANT: Use STATIC process.env references — webpack only inlines static access.
// process.env[variable] (dynamic) does NOT get replaced at build time!
const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const upgraded = trimmed.replace(/^http:\/\//i, 'https://');
  if (/^https?:\/\//i.test(upgraded)) return upgraded;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(upgraded)) return `https://${upgraded}`;
  return upgraded;
}

const supabaseUrl = normalizeSupabaseUrl(rawUrl);
const supabaseAnonKey = rawKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : createBrowserClient('https://invalid.supabase.co', 'missing-next-public-supabase-key');
