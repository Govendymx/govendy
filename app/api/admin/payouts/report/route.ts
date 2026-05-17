import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toNumber, payoutNet, isCancelledStatus, isPaidStatus, isReleasedStatus } from '@/lib/payouts/calc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const view = String(req.nextUrl.searchParams.get('view') || 'released').trim(); // released|to_release|all
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
    const from = String(req.nextUrl.searchParams.get('from') || '').trim();
    const to = String(req.nextUrl.searchParams.get('to') || '').trim();
    const limit = clamp(Number(req.nextUrl.searchParams.get('limit') || 5000), 1, 5000);
    const includeEmail = String(req.nextUrl.searchParams.get('includeEmail') || '1').trim() === '1';

    // Traer órdenes (preferimos muchas para reporte tipo Excel)
    // Best-effort por compatibilidad de columnas.
    const selectFull =
      'id,status,total,subtotal,shipping_fee,shipping_subsidy,commission_fee,coupon_discount,coupon_code,created_at,paid_at,shipped_at,delivered_at,paid_to_seller_at,paid_to_seller_by,buyer_id,seller_id';
    const selectBase =
      'id,status,total,subtotal,shipping_fee,commission_fee,created_at,buyer_id,seller_id';

    const run = async (cols: string) => {
      let qq: any = admin.from('orders').select(cols).order('created_at', { ascending: false }).limit(limit);
      if (from) qq = qq.gte('created_at', from);
      if (to) qq = qq.lte('created_at', to);
      return await qq;
    };

    let res: any = await run(selectFull);
    if (res?.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        res = await run(selectBase);
      }
    }
    if (res?.error) return NextResponse.json({ error: res.error.message }, { status: 400 });

    let orders = ((res.data as any[]) ?? []) as any[];
    orders = orders.filter((o) => {
      const st = String(o?.status || '').trim().toLowerCase();
      if (!st) return false;
      if (isCancelledStatus(st)) return false;
      if (view === 'released') return isReleasedStatus(st);
      if (view === 'to_release') return isPaidStatus(st) && !isReleasedStatus(st);
      return true;
    });

    // Prefiltro por búsqueda (id/status/seller/buyer/coupon)
    if (q) {
      orders = orders.filter((o) => {
        const id = String(o?.id || '').toLowerCase();
        const st = String(o?.status || '').toLowerCase();
        const seller = String(o?.seller_id || '').toLowerCase();
        const buyer = String(o?.buyer_id || '').toLowerCase();
        const coupon = String((o as any)?.coupon_code || '').toLowerCase();
        return id.includes(q) || st.includes(q) || seller.includes(q) || buyer.includes(q) || coupon.includes(q);
      });
    }

    const sellerIds = Array.from(new Set(orders.map((o) => String(o?.seller_id || '').trim()).filter(Boolean)));

    // Perfiles (nombre/telefono + datos de cobro) para mostrar en el excel
    const profileById: Record<string, any> = {};
    if (sellerIds.length > 0) {
      let pRes: any = await admin
        .from('profiles')
        .select('id,full_name,phone,payout_bank_name,payout_account_holder,payout_clabe,payout_account_number,payout_notes')
        .in('id', sellerIds)
        .limit(5000);
      if (pRes?.error) {
        const code = String((pRes.error as any)?.code || '');
        const msg = String((pRes.error as any)?.message || '').toLowerCase();
        if (code === '42703' || msg.includes('column')) {
          pRes = await admin.from('profiles').select('id,full_name').in('id', sellerIds).limit(5000);
        }
      }
      if (!pRes?.error && Array.isArray(pRes.data)) {
        for (const p of pRes.data as any[]) {
          const id = String(p?.id || '').trim();
          if (!id) continue;
          profileById[id] = p;
        }
      }
    }

    // Datos bancarios desde seller_payment_methods
    const paymentMethodsById: Record<string, any> = {};
    if (sellerIds.length > 0) {
      const pmRes: any = await admin
        .from('seller_payment_methods')
        .select('seller_id, bank_name, account_holder_name, clabe')
        .in('seller_id', sellerIds)
        .eq('is_default', true)
        .limit(5000);
      
      if (!pmRes?.error && Array.isArray(pmRes.data)) {
        for (const pm of pmRes.data as any[]) {
          const id = String(pm?.seller_id || '').trim();
          if (id) {
            paymentMethodsById[id] = pm;
          }
        }
      }
    }

    // Compradores: nombre (para mostrar "quién compró" con link a su perfil/reputación)
    const buyerIds = Array.from(new Set(orders.map((o) => String(o?.buyer_id || '').trim()).filter(Boolean)));
    const buyerNameById: Record<string, string> = {};
    if (buyerIds.length > 0) {
      let bRes: any = await admin.from('profiles').select('id,full_name').in('id', buyerIds).limit(5000);
      if (bRes?.error) {
        const code = String((bRes.error as any)?.code || '');
        const msg = String((bRes.error as any)?.message || '').toLowerCase();
        if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
          // Si no existe profiles/full_name, seguimos con fallback por id.
          bRes = { data: [], error: null };
        }
      }
      if (!bRes?.error && Array.isArray(bRes.data)) {
        for (const p of bRes.data as any[]) {
          const id = String(p?.id || '').trim();
          if (!id) continue;
          const name = String(p?.full_name || '').trim();
          if (name) buyerNameById[id] = name;
        }
      }
    }

    // Descuento por guías (cargo vendedor): disputas resueltas con assign_guide_charged_seller
    const guideDeductionBySeller: Record<string, number> = {};
    for (const sid of sellerIds) guideDeductionBySeller[sid] = 0;
    if (sellerIds.length > 0) {
      try {
        const dRes: any = await admin
          .from('disputes')
          .select('seller_id, return_guide_cost')
          .in('seller_id', sellerIds)
          .eq('status', 'resolved')
          .eq('admin_decision', 'assign_guide_charged_seller');
        if (!dRes?.error && Array.isArray(dRes.data)) {
          for (const row of dRes.data as any[]) {
            const sid = String(row?.seller_id || '').trim();
            if (!sid) continue;
            const c = typeof row?.return_guide_cost === 'number' ? row.return_guide_cost : Number(row?.return_guide_cost ?? 0);
            if (Number.isFinite(c) && c > 0) guideDeductionBySeller[sid] = (guideDeductionBySeller[sid] || 0) + c;
          }
        }
      } catch {
        // noop
      }
    }

    // Email (best-effort): auth.users
    const emailById: Record<string, string> = {};
    if (includeEmail && sellerIds.length > 0) {
      const max = Math.min(200, sellerIds.length);
      for (const sid of sellerIds.slice(0, max)) {
        try {
          const r: any = await admin.auth.admin.getUserById(sid);
          const email = String(r?.data?.user?.email || '').trim();
          if (email) emailById[sid] = email;
        } catch {
          // noop
        }
      }
    }

    // Agrupar por vendedor
    const bySeller: Record<
      string,
      {
        seller_id: string;
        seller_name: string;
        seller_phone: string | null;
        seller_email: string | null;
        payout_bank_name: string | null;
        payout_account_holder: string | null;
        payout_clabe: string | null;
        payout_account_number: string | null;
        total_paid_total: number;
        shipping_fee_total: number;
        orders_count: number;
        gross_total: number;
        commission_total: number;
        shipping_subsidy_total: number;
        payout_total: number;
        guide_deduction_total: number;
      }
    > = {};

    const detailRows = orders.map((o) => {
      const sid = String(o?.seller_id || '').trim();
      const st = String(o?.status || '').trim();
      const totalPaid = toNumber(o?.total);
      const gross = toNumber(o?.subtotal) > 0 ? toNumber(o?.subtotal) - toNumber((o as any)?.coupon_discount) : toNumber(o?.total) - toNumber(o?.shipping_fee);
      const commission = toNumber(o?.commission_fee);
      const shippingFee = toNumber(o?.shipping_fee);
      const shippingSubsidy = toNumber((o as any)?.shipping_subsidy);
      const payout = payoutNet(o);

      const prof = profileById[sid] || {};
      const pm = paymentMethodsById[sid] || {};
      const name = String(prof?.full_name || '').trim() || `${sid.slice(0, 6)}…`;
      const phone = String(prof?.phone || '').trim() || null;
      const email = emailById[sid] ? String(emailById[sid]) : null;
      const payout_bank_name = String(pm?.bank_name || prof?.payout_bank_name || '').trim() || null;
      const payout_account_holder = String(pm?.account_holder_name || prof?.payout_account_holder || '').trim() || null;
      const payout_clabe = String(pm?.clabe || prof?.payout_clabe || '').trim() || null;
      const payout_account_number = String(prof?.payout_account_number || '').trim() || null;

      const buyerId = String(o?.buyer_id || '').trim();
      const buyerName = buyerId ? buyerNameById[buyerId] || `${buyerId.slice(0, 6)}…` : '—';

      if (!bySeller[sid]) {
        bySeller[sid] = {
          seller_id: sid,
          seller_name: name,
          seller_phone: phone,
          seller_email: email,
          payout_bank_name,
          payout_account_holder,
          payout_clabe,
          payout_account_number,
          total_paid_total: 0,
          shipping_fee_total: 0,
          orders_count: 0,
          gross_total: 0,
          commission_total: 0,
          shipping_subsidy_total: 0,
          payout_total: 0,
          guide_deduction_total: 0,
        };
      }

      bySeller[sid].total_paid_total += totalPaid;
      bySeller[sid].shipping_fee_total += shippingFee;
      bySeller[sid].orders_count += 1;
      bySeller[sid].gross_total += gross;
      bySeller[sid].commission_total += commission;
      bySeller[sid].shipping_subsidy_total += shippingSubsidy;
      bySeller[sid].payout_total += payout;

      return {
        id: String(o?.id || ''),
        status: st,
        created_at: (o as any)?.created_at ?? null,
        paid_at: (o as any)?.paid_at ?? null,
        shipped_at: (o as any)?.shipped_at ?? null,
        delivered_at: (o as any)?.delivered_at ?? null,
        paid_to_seller_at: (o as any)?.paid_to_seller_at ?? null,
        paid_to_seller_by: (o as any)?.paid_to_seller_by ?? null,
        buyer_id: buyerId,
        buyer_name: buyerName,
        seller_id: sid,
        seller_name: name,
        seller_email: email,
        payout_bank_name,
        payout_account_holder,
        payout_clabe,
        payout_account_number,
        subtotal: toNumber(o?.subtotal),
        coupon_discount: toNumber((o as any)?.coupon_discount),
        total_paid: totalPaid,
        shipping_fee: shippingFee,
        shipping_subsidy: shippingSubsidy,
        commission_fee: commission,
        payout_net: payout,
      };
    });

    for (const sid of Object.keys(bySeller)) {
      const guideDed = guideDeductionBySeller[sid] || 0;
      bySeller[sid].guide_deduction_total = guideDed;
      bySeller[sid].payout_total = Math.max(0, (bySeller[sid].payout_total ?? 0) - guideDed);
    }

    const sellers = Object.values(bySeller).sort((a, b) => b.payout_total - a.payout_total);

    const resp = NextResponse.json({
      ok: true,
      view,
      stats: {
        sellers: sellers.length,
        orders: detailRows.length,
        payout_total: sellers.reduce((s, r) => s + (Number(r.payout_total) || 0), 0),
      },
      sellers,
      rows: detailRows,
      notes: [
        '“Liberado” = órdenes con status delivered/completed.',
        '“Por liberar” = paid/shipped (aún no delivered/completed).',
        'Neto (pago al vendedor) = subtotal - descuento - comisión - envío gratis (shipping_subsidy).',
      ],
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

