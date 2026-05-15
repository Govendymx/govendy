import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as { conversationId?: string; action?: 'take' | 'release' };
    const conversationId = String(body?.conversationId || '').trim();
    const action = String(body?.action || '').trim() as 'take' | 'release';
    if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    if (!['take', 'release'].includes(action)) return NextResponse.json({ error: 'action inválida' }, { status: 400 });

    const now = new Date().toISOString();
    const patch =
      action === 'take'
        ? { assigned_admin_id: requesterId, assigned_at: now, updated_at: now }
        : { assigned_admin_id: null, assigned_at: null, updated_at: now };

    const upd: any = await admin.from('support_conversations').update(patch).eq('id', conversationId);
    if (upd?.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Faltan columnas PRO. Ejecuta la versión actualizada de `supabase_support_chat.sql` en Supabase.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    const resp = NextResponse.json({ ok: true, assigned_admin_id: action === 'take' ? requesterId : null });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

