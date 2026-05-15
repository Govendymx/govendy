import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { payoutNet, toNumber, isCancelledStatus, isReleasedStatus, isPaidStatus } from '@/lib/payouts/calc';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.effectiveUserId;
    const admin = auth.admin;

    const cols =
      'id,buyer_id,seller_id,status,subtotal,total,shipping_fee,commission_fee,coupon_discount,shipping_subsidy,paid_to_seller_at';

    const [ordersBuyerRes, ordersSellerRes, withdrawalsRes, questionsRes, responsesRes, disputesRes] = await Promise.all([
      admin.from('orders').select(cols).eq('buyer_id', userId).limit(2000),
      admin.from('orders').select(cols).eq('seller_id', userId).limit(2000),
      admin
        .from('seller_withdrawals')
        .select('amount_cents,status')
        .eq('seller_id', userId)
        .eq('status', 'completed'),
      admin
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('is_deleted', false)
        .is('answer_text', null),
      admin
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('asker_id', userId)
        .eq('is_deleted', false)
        .not('answer_text', 'is', null),
      admin.from('disputes').select('id').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).eq('status', 'open'),
    ]);

    const ordersAsBuyer = ((ordersBuyerRes as any)?.data ?? []) as any[];
    const ordersAsSeller = ((ordersSellerRes as any)?.data ?? []) as any[];

    let total_pagado = 0;
    for (const o of ordersAsBuyer) {
      if (isCancelledStatus(String(o?.status ?? ''))) continue;
      total_pagado += toNumber(o?.total);
    }
    total_pagado = Math.round(total_pagado * 100) / 100;

    let total_retirado = 0;
    const withdrawals = Array.isArray((withdrawalsRes as any)?.data) ? (withdrawalsRes as any).data : [];
    for (const w of withdrawals as any[]) {
      const c = typeof w?.amount_cents === 'number' ? w.amount_cents : Number(w?.amount_cents ?? 0);
      if (Number.isFinite(c) && c > 0) total_retirado += c / 100;
    }
    total_retirado = Math.round(total_retirado * 100) / 100;

    const unpaidQuestions = Math.max(0, Number((questionsRes as any)?.count ?? 0));
    const responsesCount = Math.max(0, Number((responsesRes as any)?.count ?? 0));
    const disputesOpen = Array.isArray((disputesRes as any)?.data) ? (disputesRes as any).data.length : 0;

    const purchasesCount = ordersAsBuyer.filter((o) => !isCancelledStatus(String(o?.status ?? ''))).length;
    const salesCount = ordersAsSeller.filter((o) => !isCancelledStatus(String(o?.status ?? ''))).length;
    const operationsCount = purchasesCount + salesCount;

    const { balance, total_cobrado } = await runBalanceAndCobrado(admin, userId, ordersAsSeller);

    // [POCKETCASH FIX] Incorporar saldo del monedero
    let walletBalance = 0;
    try {
      const wallet = await WalletService.getOrCreateWallet(userId);
      walletBalance = Number(wallet.balance) || 0;
    } catch (e) {
      console.error('[Summary] Error loading wallet:', e);
    }
    
    // Sumar al disponible para que el usuario vea su saldo total (Ventas + Recargas)
    balance.disponible += walletBalance;
    // Agregar propiedad explícita por si el frontend la usa por separado
    (balance as any).wallet_balance = walletBalance;

    const res = NextResponse.json({
      ok: true,
      balance: {
        disponible: balance.disponible,
        por_liberar: balance.por_liberar,
        estimado: balance.estimado,
        can_withdraw: balance.can_withdraw,
        mercadopago_configured: balance.mercadopago_configured,
        wallet_balance: walletBalance,
      },
      total_pagado,
      total_cobrado,
      total_retirado,
      operations_count: operationsCount,
      sales_count: salesCount,
      purchases_count: purchasesCount,
      unanswered_questions: unpaidQuestions,
      responses_count: responsesCount,
      disputes_open: disputesOpen,
    });
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return res;
  } catch (e: unknown) {
    console.error('[dashboard/summary]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar resumen' },
      { status: 500 },
    );
  }
}

async function runBalanceAndCobrado(
  admin: ReturnType<typeof supabaseAdmin>,
  sellerId: string,
  orders: any[],
): Promise<{ balance: any; total_cobrado: number }> {
  const disputedRes: any = await admin
    .from('disputes')
    .select('order_id')
    .eq('seller_id', sellerId)
    .eq('status', 'open');
  const disputedSet = new Set<string>(
    (Array.isArray(disputedRes?.data) ? disputedRes.data : []).map((d: any) => String(d?.order_id ?? '').trim()).filter(Boolean),
  );

  let withdrawnIds: string[] = [];
  try {
    const wRes: any = await admin
      .from('seller_withdrawals')
      .select('order_ids')
      .eq('seller_id', sellerId)
      .eq('status', 'completed');
    if (!wRes?.error && Array.isArray(wRes.data)) {
      for (const w of wRes.data as any[]) {
        const arr = Array.isArray(w?.order_ids) ? w.order_ids : [];
        withdrawnIds = withdrawnIds.concat(arr.map((x: unknown) => String(x ?? '').trim()).filter(Boolean));
      }
    }
  } catch {
    /* ignore */
  }
  const withdrawnSet = new Set(withdrawnIds);

  let guideDeduction = 0;
  try {
    const gRes: any = await admin
      .from('disputes')
      .select('order_id,return_guide_cost')
      .eq('seller_id', sellerId)
      .eq('status', 'resolved')
      .eq('admin_decision', 'assign_guide_charged_seller');
    if (!gRes?.error && Array.isArray(gRes.data)) {
      for (const r of gRes.data as any[]) {
        const c = toNumber(r?.return_guide_cost);
        if (c > 0) guideDeduction += c;
      }
    }
  } catch {
    /* ignore */
  }

  const active = orders.filter((o) => !isCancelledStatus(String(o?.status ?? '')));
  const released = active.filter((o) => isReleasedStatus(String(o?.status ?? '')));
  const paidNotReleased = active.filter(
    (o) => isPaidStatus(String(o?.status ?? '')) && !isReleasedStatus(String(o?.status ?? '')),
  );

  let disponible = 0;
  const disponiblesOrderIds: string[] = [];
  for (const o of active) {
    const id = String(o?.id ?? '').trim();
    if (!id) continue;
    if (withdrawnSet.has(id) || disputedSet.has(id)) continue;
    if (!o?.paid_to_seller_at) continue;
    const st = String(o?.status ?? '').toLowerCase();
    if (['cancelled', 'canceled', 'refunded'].includes(st)) continue;
    disponible += payoutNet(o);
    disponiblesOrderIds.push(id);
  }
  disponible = Math.max(0, disponible - guideDeduction);

  let por_liberar = 0;
  for (const o of released) {
    const id = String(o?.id ?? '').trim();
    if (!id || o?.paid_to_seller_at || withdrawnSet.has(id) || disputedSet.has(id)) continue;
    por_liberar += payoutNet(o);
  }
  por_liberar = Math.max(0, por_liberar);

  let estimado = 0;
  for (const o of paidNotReleased) {
    const id = String(o?.id ?? '').trim();
    if (!id || withdrawnSet.has(id) || disputedSet.has(id)) continue;
    estimado += payoutNet(o);
  }
  estimado = Math.max(0, estimado);

  let hasMercadopago = false;
  try {
    const p = await admin.from('profiles').select('mercadopago_account').eq('id', sellerId).maybeSingle();
    hasMercadopago = Boolean((p?.data as any)?.mercadopago_account);
  } catch {
    /* ignore */
  }

  const can_withdraw = disponiblesOrderIds.length > 0 && disponible >= 0.01 && hasMercadopago;

  let total_retirado_cents = 0;
  try {
    const wRes: any = await admin
      .from('seller_withdrawals')
      .select('amount_cents')
      .eq('seller_id', sellerId)
      .eq('status', 'completed');
    if (!wRes?.error && Array.isArray(wRes.data)) {
      for (const w of wRes.data as any[]) {
        const c = typeof w?.amount_cents === 'number' ? w.amount_cents : Number(w?.amount_cents ?? 0);
        if (Number.isFinite(c) && c > 0) total_retirado_cents += c;
      }
    }
  } catch {
    /* ignore */
  }
  const total_retirado = total_retirado_cents / 100;
  const total_cobrado = Math.round((disponible + por_liberar + estimado + total_retirado) * 100) / 100;

  const balance = {
    disponible: Math.round(disponible * 100) / 100,
    por_liberar: Math.round(por_liberar * 100) / 100,
    estimado: Math.round(estimado * 100) / 100,
    can_withdraw: !!can_withdraw,
    mercadopago_configured: !!hasMercadopago,
  };

  return { balance, total_cobrado };
}
