import { createClient } from '@supabase/supabase-js';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const upgraded = trimmed.replace(/^http:\/\//i, 'https://');
  if (/^https?:\/\//i.test(upgraded)) return upgraded;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(upgraded)) return `https://${upgraded}`;
  return upgraded;
}

export function supabaseAdmin() {
  const url = readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin environment variables');
  }
  const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (anonKey && anonKey === serviceKey) {
    throw new Error('Supabase service role key must differ from anon key');
  }
  const finalUrl = normalizeSupabaseUrl(url);
  return createClient(finalUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
