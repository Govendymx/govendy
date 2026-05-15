import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireUserFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  return { ok: true as const, userId: userData.user.id };
}

async function isAdminUser(admin: any, userId: string) {
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 60)));

    const admin = supabaseAdmin();
    const adminOk = await isAdminUser(admin, guard.userId).catch(() => false);

    let rows: any[] = [];

    if (adminOk) {
      const res: any = await admin
        .from('disputes')
        .select('id,order_id,buyer_id,seller_id,reason_code,reason_text,status,admin_decision,admin_note,last_message_at,created_at,updated_at')
        .order('last_message_at', { ascending: false })
        .limit(limit);
      if (res.error) {
        const code = String((res.error as any)?.code || '');
        const msg = String((res.error as any)?.message || '').toLowerCase();
        if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
          return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
        }
        return NextResponse.json({ error: res.error.message }, { status: 400 });
      }
      rows = (res.data as any[]) ?? [];
    } else {
      const [buyerRes, sellerRes] = await Promise.all([
        admin
          .from('disputes')
          .select('id,order_id,buyer_id,seller_id,reason_code,reason_text,status,admin_decision,admin_note,last_message_at,created_at,updated_at')
          .eq('buyer_id', guard.userId)
          .order('last_message_at', { ascending: false })
          .limit(limit),
        admin
          .from('disputes')
          .select('id,order_id,buyer_id,seller_id,reason_code,reason_text,status,admin_decision,admin_note,last_message_at,created_at,updated_at')
          .eq('seller_id', guard.userId)
          .order('last_message_at', { ascending: false })
          .limit(limit),
      ]);
      const err = (buyerRes as any)?.error ?? (sellerRes as any)?.error;
      if (err) {
        const code = String((err as any)?.code || '');
        const msg = String((err as any)?.message || '').toLowerCase();
        if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
          return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
        }
        return NextResponse.json({ error: (err as any)?.message || 'Error al listar disputas' }, { status: 400 });
      }
      const byId = new Map<string, any>();
      for (const d of ((buyerRes as any)?.data as any[]) ?? []) {
        const id = String(d?.id || '').trim();
        if (id && !byId.has(id)) byId.set(id, d);
      }
      for (const d of ((sellerRes as any)?.data as any[]) ?? []) {
        const id = String(d?.id || '').trim();
        if (id && !byId.has(id)) byId.set(id, d);
      }
      rows = Array.from(byId.values()).sort((a, b) => {
        const ta = (a?.last_message_at || a?.created_at || '').toString();
        const tb = (b?.last_message_at || b?.created_at || '').toString();
        return tb.localeCompare(ta);
      });
      rows = rows.slice(0, limit);
    }

    const ids = rows.map((d) => String(d?.id || '').trim()).filter(Boolean);
    const lastById: Record<string, any> = {};
    if (ids.length > 0) {
      const mRes: any = await admin
        .from('dispute_messages')
        .select('dispute_id,body,created_at,sender_role')
        .in('dispute_id', ids)
        .order('created_at', { ascending: false })
        .limit(3000);
      if (!mRes?.error && Array.isArray(mRes.data)) {
        for (const m of mRes.data as any[]) {
          const did = String(m?.dispute_id || '').trim();
          if (!did || lastById[did]) continue;
          lastById[did] = m;
        }
      }
    }

    const resp = NextResponse.json({
      ok: true,
      viewer: { user_id: guard.userId, is_admin: adminOk },
      disputes: rows.map((d) => ({
        ...d,
        last_message: lastById[String(d?.id || '')] ?? null,
      })),
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

