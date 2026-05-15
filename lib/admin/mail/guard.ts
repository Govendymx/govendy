import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type MailboxConfig = {
  label: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_user: string;
  imap_pass: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
};

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Falta token de autorización' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Configuración Supabase incompleta' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'No autorizado' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'Solo administradores' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

export async function getMailboxes(admin: ReturnType<typeof supabaseAdmin>): Promise<MailboxConfig[]> {
  const { data, error } = await admin
    .from('app_settings')
    .select('admin_mailboxes')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return [];
  const raw = (data as any)?.admin_mailboxes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m === 'object' && String(m?.email ?? '').trim())
    .map((m: any) => ({
      label: String(m?.label ?? m?.email ?? '').trim() || String(m?.email ?? ''),
      email: String(m?.email ?? '').trim(),
      imap_host: String(m?.imap_host ?? '').trim(),
      imap_port: Math.max(1, Math.min(65535, Number(m?.imap_port) || 993)),
      imap_secure: m?.imap_secure !== false,
      imap_user: String(m?.imap_user ?? m?.email ?? '').trim(),
      imap_pass: String(m?.imap_pass ?? '').trim(),
      smtp_host: String(m?.smtp_host ?? m?.imap_host ?? '').trim(),
      smtp_port: Math.max(1, Math.min(65535, Number(m?.smtp_port) || 587)),
      smtp_secure: m?.smtp_secure === true,
      smtp_user: String(m?.smtp_user ?? m?.imap_user ?? m?.email ?? '').trim(),
      smtp_pass: String(m?.smtp_pass ?? m?.imap_pass ?? '').trim(),
    }));
}
