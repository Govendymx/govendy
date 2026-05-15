import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { payoutNet, toNumber, isCancelledStatus, isReleasedStatus, isPaidStatus } from '@/lib/payouts/calc';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Falta Authorization Bearer' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Configuración Supabase incompleta' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sellerId = userData.user.id;
    const admin = supabaseAdmin();

    const cols = 'id,status,subtotal,total,shipping_fee,commission_fee,coupon_discount,shipping_subsidy,paid_to_seller_at';
    const { data: ordersRaw, error: ordersErr } = await admin
      .from('orders')
      .select(cols)
      .eq('seller_id', sellerId)
      .limit(2000);

    if (ordersErr) {
      const code = String((ordersErr as any)?.code ?? '');
      const msg = String((ordersErr as any)?.message ?? '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        const fallback = await admin
          .from('orders')
          .select('id,status,subtotal,total,shipping_fee,commission_fee')
          .eq('seller_id', sellerId)
          .limit(2000);
        if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 400 });
        return runBalance(admin, sellerId, (fallback.data as any[]) ?? []);
      }
      return NextResponse.json({ error: ordersErr.message }, { status: 400 });
    }

    const orders = (ordersRaw as any[]) ?? [];
    return runBalance(admin, sellerId, orders);
  } catch (e: unknown) {
    console.error('[payouts/balance]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al obtener balance' },
      { status: 500 },
    );
  }
}

async function runBalance(admin: ReturnType<typeof supabaseAdmin>, sellerId: string, orders: any[]) {
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
    // ignorar si no existe tabla
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
    // ignorar
  }

  const active = orders.filter((o) => !isCancelledStatus(String(o?.status ?? '')));
  const released = active.filter((o) => isReleasedStatus(String(o?.status ?? '')));
  const paidNotReleased = active.filter((o) => isPaidStatus(String(o?.status ?? '')) && !isReleasedStatus(String(o?.status ?? '')));

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
  // Allow negative — represents seller debt
  disponible = disponible - guideDeduction;

  let por_liberar = 0;
  for (const o of released) {
    const id = String(o?.id ?? '').trim();
    if (!id || o?.paid_to_seller_at || withdrawnSet.has(id) || disputedSet.has(id)) continue;
    por_liberar += payoutNet(o);
  }
  // Allow negative for correct accounting

  let estimado = 0;
  for (const o of paidNotReleased) {
    const id = String(o?.id ?? '').trim();
    if (!id || withdrawnSet.has(id) || disputedSet.has(id)) continue;
    estimado += payoutNet(o);
  }
  // Allow negative for correct accounting

  let hasMercadopago = false;
  try {
    const p = await admin.from('profiles').select('mercadopago_account').eq('id', sellerId).maybeSingle();
    hasMercadopago = Boolean((p?.data as any)?.mercadopago_account);
  } catch {
    // ignorar
  }

  const can_withdraw = disponiblesOrderIds.length > 0 && disponible >= 0.01 && hasMercadopago;

  // ── AUTO-SUSPENSION: If disponible < 0, suspend user and create audit alert ──
  let account_suspended = false;
  if (disponible < 0) {
    try {
      // Check if already suspended to avoid duplicate alerts
      const { data: profileCheck } = await admin.from('profiles').select('admin_state').eq('id', sellerId).maybeSingle();
      const currentStatus = (profileCheck as any)?.admin_state?.status || 'active';

      if (currentStatus !== 'suspended' && currentStatus !== 'banned' && currentStatus !== 'deleted') {
        // Insert audit log
        await admin.from('audit_logs').insert({
          severity: 'critical',
          entity_type: 'user',
          entity_id: sellerId,
          message: `Saldo negativo detectado: ${(Math.round(disponible * 100) / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. Cuenta suspendida automáticamente.`,
          details: {
            disponible: Math.round(disponible * 100) / 100,
            por_liberar: Math.round(por_liberar * 100) / 100,
            estimado: Math.round(estimado * 100) / 100,
            guide_deduction: Math.round(guideDeduction * 100) / 100,
            reason: 'negative_balance_auto_suspend',
          },
          status: 'open',
        });

        // Suspend the user account
        const { executeUserAction } = await import('@/lib/admin/userManagement');
        await executeUserAction(admin, 'system', sellerId, 'suspend', {
          days: 3650, // ~10 years until admin manually reactivates
          notes: `Auto-suspendido: saldo negativo de ${(Math.round(disponible * 100) / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
        });

        account_suspended = true;
        console.warn(`[payouts/balance] ⚠️ User ${sellerId} auto-suspended: negative balance ${disponible}`);
      }
    } catch (suspendErr) {
      console.error(`[payouts/balance] Error auto-suspending user ${sellerId}:`, suspendErr);
      // Don't fail the balance response — just log the error
    }
  }

  const out = {
    ok: true,
    disponible: Math.round(disponible * 100) / 100,
    por_liberar: Math.round(por_liberar * 100) / 100,
    estimado: Math.round(estimado * 100) / 100,
    can_withdraw: !!can_withdraw,
    mercadopago_configured: !!hasMercadopago,
    orders_disponible: disponiblesOrderIds.length,
    guide_deduction: Math.round(guideDeduction * 100) / 100,
    account_suspended,
  };

  const res = NextResponse.json(out);
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
