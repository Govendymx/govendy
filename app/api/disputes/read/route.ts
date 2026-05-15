import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const body = (await req.json().catch(() => ({}))) as { disputeId?: string };
    const disputeId = String(body?.disputeId || '').trim();
    if (!disputeId || !isUuid(disputeId)) return NextResponse.json({ error: 'disputeId inválido' }, { status: 400 });

    const admin = supabaseAdmin();
    const adminOk = await isAdminUser(admin, guard.userId).catch(() => false);
    const { data: drow, error: derr } = await admin.from('disputes').select('id,buyer_id,seller_id').eq('id', disputeId).maybeSingle();
    if (derr) return NextResponse.json({ error: derr.message }, { status: 400 });
    if (!drow) return NextResponse.json({ error: 'Disputa no encontrada.' }, { status: 404 });
    const buyerId = String((drow as any)?.buyer_id || '').trim();
    const sellerId = String((drow as any)?.seller_id || '').trim();
    if (!adminOk && guard.userId !== buyerId && guard.userId !== sellerId) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    const now = new Date().toISOString();
    const up: any = await admin
      .from('dispute_reads')
      .upsert([{ dispute_id: disputeId, user_id: guard.userId, last_read_at: now }], { onConflict: 'dispute_id,user_id' });

    if (up.error) {
      const code = String((up.error as any)?.code || '');
      const msg = String((up.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json({ error: 'Falta configurar disputas. Ejecuta `supabase_disputes.sql` en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: up.error.message }, { status: 400 });
    }

    const resp = NextResponse.json({ ok: true });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

