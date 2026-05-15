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
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing' };

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

/**
 * POST /api/admin/payouts/repair-releases
 * Repara órdenes delivered/completed que no tienen paid_to_seller_at.
 * Solo actualiza donde paid_to_seller_at IS NULL (no sobrescribe, estabilidad).
 * Uso: corregir datos históricos tras marcar entregado por admin o flujos que no liberaban.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const now = new Date().toISOString();
    const { data: rows, error: fetchErr } = await admin
      .from('orders')
      .select('id')
      .in('status', ['delivered', 'completed'])
      .is('paid_to_seller_at', null)
      .limit(500);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }

    const ids = (Array.isArray(rows) ? rows : [])
      .map((r: any) => String(r?.id ?? '').trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, message: 'No hay órdenes delivered/completed sin liberar.' });
    }

    const { error: updErr } = await admin
      .from('orders')
      .update({ paid_to_seller_at: now, paid_to_seller_by: requesterId } as any)
      .in('id', ids)
      .is('paid_to_seller_at', null);

    if (updErr) {
      const code = String((updErr as any)?.code ?? '');
      const msg = String((updErr as any)?.message ?? '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        return NextResponse.json(
          { error: 'Falta paid_to_seller_at en orders. Ejecuta supabase_orders_paid_to_seller.sql.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: (updErr as Error).message }, { status: 400 });
    }

    const res = NextResponse.json({
      ok: true,
      updated: ids.length,
      message: `Se liberaron ${ids.length} orden(es) (paid_to_seller_at asignado).`,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (e: unknown) {
    console.error('[repair-releases]', e);
    const r = NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 },
    );
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  }
}
