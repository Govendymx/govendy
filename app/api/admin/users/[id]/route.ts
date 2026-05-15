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

const CANCELLED = ['cancelled', 'canceled', 'refunded'];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    let userId = '';
    try {
      const p = await ctx.params;
      userId = String(p?.id ?? '').trim();
    } catch {
      userId = '';
    }
    if (!userId) return NextResponse.json({ error: 'user id required' }, { status: 400 });

    const profileRes: any = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
    const profile = profileRes?.data ?? null;
    const adminStateRes: any = await admin.from('user_admin_states').select('*').eq('user_id', userId).maybeSingle();
    const adminState = adminStateRes?.data ?? null;

    // Verificar si el usuario existe en auth.users
    let userExistsInAuth = false;
    let userEmail: string | null = null;
    let authCreatedAt: string | null = null;
    let lastSignInAt: string | null = null;
    try {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
      if (!authErr && authUser?.user) {
        userExistsInAuth = true;
        userEmail = authUser.user.email ?? null;
        authCreatedAt = authUser.user.created_at ?? null;
        lastSignInAt = authUser.user.last_sign_in_at ?? null;
      }
    } catch (e) {
      console.warn('[ADMIN USERS ID] Error obteniendo datos de auth:', e);
    }

    // Si el usuario no existe ni en profiles ni en auth.users, devolver error
    if (!profile && !userExistsInAuth) {
      console.warn('[ADMIN USERS ID] Usuario no encontrado en profiles ni auth.users:', userId);
      return NextResponse.json({ error: 'Usuario no encontrado. Este usuario puede haber sido eliminado completamente del sistema.' }, { status: 404 });
    }

    // Si el usuario tiene estado "deleted", aún podemos devolver los datos pero con una advertencia
    const isDeleted = adminState?.status === 'deleted';
    if (isDeleted) {
      console.log('[ADMIN USERS ID] Usuario con estado deleted, pero devolviendo datos:', userId);
    }

    const orderCols = 'id,seller_id,buyer_id,status,total,created_at,paid_to_seller_at';
    const [asSeller, asBuyer, disputesAsBuyer, disputesAsSeller, withdrawals, ratingsReceived, recentOrders] = await Promise.all([
      admin.from('orders').select(orderCols).eq('seller_id', userId).limit(3000),
      admin.from('orders').select(orderCols).eq('buyer_id', userId).limit(3000),
      admin.from('disputes').select('id,order_id,status,admin_decision,created_at').eq('buyer_id', userId).limit(500),
      admin.from('disputes').select('id,order_id,status,admin_decision,created_at').eq('seller_id', userId).limit(500),
      admin.from('seller_withdrawals').select('id,amount_cents,status,order_ids,created_at').eq('seller_id', userId).limit(500),
      admin.from('user_ratings').select('id,order_id,rater_id,ratee_id,direction,stars,comment,created_at').eq('ratee_id', userId).order('created_at', { ascending: false }).limit(100),
      admin.from('orders').select('id,seller_id,buyer_id,status,total,created_at').or(`seller_id.eq.${userId},buyer_id.eq.${userId}`).order('created_at', { ascending: false }).limit(20),
    ]);

    const sellerRows = ((asSeller as any)?.error ? [] : (asSeller as any)?.data ?? []) as any[];
    const buyerRows = ((asBuyer as any)?.error ? [] : (asBuyer as any)?.data ?? []) as any[];
    const dispBuyer = ((disputesAsBuyer as any)?.error ? [] : (disputesAsBuyer as any)?.data ?? []) as any[];
    const dispSeller = ((disputesAsSeller as any)?.error ? [] : (disputesAsSeller as any)?.data ?? []) as any[];
    const withRows = ((withdrawals as any)?.error ? [] : (withdrawals as any)?.data ?? []) as any[];
    const ratings = ((ratingsReceived as any)?.error ? [] : (ratingsReceived as any)?.data ?? []) as any[];
    const recent = ((recentOrders as any)?.error ? [] : (recentOrders as any)?.data ?? []) as any[];

    let ventas_count = 0;
    let ventas_total = 0;
    let ventas_total_count = 0;
    let ventas_cancelled_count = 0;
    for (const o of sellerRows) {
      ventas_total_count += 1;
      ventas_total += Number(o?.total ?? 0) || 0;
      const st = String(o?.status ?? '').toLowerCase();
      if (CANCELLED.includes(st)) ventas_cancelled_count += 1;
      else ventas_count += 1;
    }

    let compras_count = 0;
    let compras_total = 0;
    let compras_total_count = 0;
    let compras_cancelled_count = 0;
    for (const o of buyerRows) {
      compras_total_count += 1;
      compras_total += Number(o?.total ?? 0) || 0;
      const st = String(o?.status ?? '').toLowerCase();
      if (CANCELLED.includes(st)) compras_cancelled_count += 1;
      else compras_count += 1;
    }

    let withdrawn_cents = 0;
    for (const w of withRows) {
      if (String(w?.status ?? '').toLowerCase() === 'completed') {
        withdrawn_cents += Number(w?.amount_cents ?? 0) || 0;
      }
    }
    const withdrawn_total = Math.round((withdrawn_cents / 100) * 100) / 100;

    const operations_count = sellerRows.filter((o: any) => !CANCELLED.includes(String(o?.status ?? '').toLowerCase())).length +
      buyerRows.filter((o: any) => !CANCELLED.includes(String(o?.status ?? '').toLowerCase())).length;

    const disputes_buyer = dispBuyer.length;
    const disputes_seller = dispSeller.length;
    const disputes_open = [...dispBuyer, ...dispSeller].filter((d: any) => String(d?.status ?? '').toLowerCase() === 'open').length;

    const raterIds = Array.from(new Set(ratings.map((r: any) => String(r?.rater_id ?? '').trim()).filter(Boolean)));
    let raterNames: Record<string, string> = {};
    if (raterIds.length > 0) {
      const pr: any = await admin.from('profiles').select('id,full_name,first_name,last_name,username').in('id', raterIds.slice(0, 100));
      const arr = Array.isArray(pr?.data) ? pr.data : [];
      for (const row of arr as any[]) {
        const id = String(row?.id ?? '').trim();
        const parts = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
        const name = parts || [row?.full_name, row?.username].filter(Boolean).join(' ') || id.slice(0, 8);
        raterNames[id] = name;
      }
    }

    const ratingsWithRater = ratings.map((r: any) => ({
      ...r,
      rater_name: raterNames[String(r?.rater_id ?? '')] ?? `${String(r?.rater_id ?? '').slice(0, 8)}…`,
    }));

    // userEmail, authCreatedAt, lastSignInAt ya fueron obtenidos arriba

    // Obtener saldo de monedero (wallet)
    let wallet_balance = 0;
    try {
      const { data: w } = await admin
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();
      if (w) wallet_balance = Number(w.balance) || 0;
    } catch (e) {
      console.warn('[ADMIN USERS ID] Error obteniendo wallet:', e);
    }

    const out = {
      ok: true,
      user: {
        id: userId,
        email: userEmail,
        auth_created_at: authCreatedAt,
        last_sign_in_at: lastSignInAt,
        profile: profile as any,
        admin_state: adminState as any,
        is_verified: Boolean((profile as any)?.is_verified),
        wallet_balance,
        stats: {
          ventas_count,
          ventas_total,
          ventas_total_count,
          ventas_cancelled_count,
          compras_count,
          compras_total,
          compras_total_count,
          compras_cancelled_count,
          operations_count,
          disputes_buyer,
          disputes_seller,
          disputes_open,
          disputes_total: disputes_buyer + disputes_seller,
          withdrawn_total,
        },
        ratings: ratingsWithRater,
        recent_orders: recent,
        disputes_as_buyer: dispBuyer,
        disputes_as_seller: dispSeller,
      },
    };

    const res = NextResponse.json(out);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (e: unknown) {
    console.error('[admin users id]', e);
    const r = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  }
}
