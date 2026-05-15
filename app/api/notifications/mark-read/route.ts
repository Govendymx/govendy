import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Body = {
  ids?: string[];
  all?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    // Validar token (usuario)
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const uid = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const all = Boolean(body?.all);
    const rawIds = Array.isArray(body?.ids) ? body!.ids! : [];
    const ids = rawIds.map(String).map((x) => x.trim()).filter(Boolean);

    if (!all && ids.length === 0) return NextResponse.json({ error: 'ids o all requerido.' }, { status: 400 });

    // Always use admin (service_role) to bypass RLS
    let db: any;
    let isAdmin = false;
    try {
      db = supabaseAdmin();
      isAdmin = true;
    } catch {
      db = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    console.log('[MARK-READ] uid:', uid, 'all:', all, 'ids:', ids.slice(0, 5), 'isAdmin:', isAdmin);

    // Build update query
    let q: any = db.from('notifications').update({ is_read: true }).eq('user_id', uid);
    if (!all) {
      const safeIds = ids.slice(0, clamp(ids.length, 0, 500));
      q = q.in('id', safeIds);
    } else {
      // Must catch BOTH false AND null (notifications inserted without is_read default to null)
      q = q.or('is_read.eq.false,is_read.is.null');
    }

    const upd: any = await q.select('id');

    console.log('[MARK-READ] result:', {
      error: upd?.error ? { code: (upd.error as any)?.code, message: (upd.error as any)?.message } : null,
      dataLength: Array.isArray(upd?.data) ? upd.data.length : 'no data',
      status: upd?.status,
      statusText: upd?.statusText,
    });

    if (upd?.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();

      // Table doesn't exist
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation') || code === 'PGRST106') {
        const resp = NextResponse.json({ ok: true, updated: 0, table_missing: true });
        resp.headers.set('Cache-Control', 'no-store, max-age=0');
        return resp;
      }
      // Column missing
      if (code === '42703' || msg.includes('column') || code === 'PGRST204') {
        console.error('[MARK-READ] Column is_read missing! Error:', msg);
        return NextResponse.json({ error: 'Tu tabla `notifications` no tiene `is_read`. Ejecuta: ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;' }, { status: 400 });
      }
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    const updated = Array.isArray(upd.data) ? upd.data.length : 0;
    console.log('[MARK-READ] Successfully updated', updated, 'notifications');

    const resp = NextResponse.json({ ok: true, updated });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[MARK-READ] Exception:', e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}


