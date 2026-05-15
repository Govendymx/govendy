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

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const status = String(req.nextUrl.searchParams.get('status') || '').trim(); // open/resolved/closed/''(all)
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200)));

    let q: any = admin
      .from('disputes')
      .select('id,order_id,buyer_id,seller_id,reason_code,reason_text,status,admin_decision,last_message_at,created_at,updated_at')
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (status && ['open', 'resolved', 'closed'].includes(status)) q = q.eq('status', status);

    const res: any = await q;
    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const ids = ((res.data as any[]) ?? []).map((d) => String(d?.id || '').trim()).filter(Boolean);
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
      disputes: ((res.data as any[]) ?? []).map((d) => ({ ...d, last_message: lastById[String(d?.id || '')] ?? null })),
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

