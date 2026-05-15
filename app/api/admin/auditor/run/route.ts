import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { payoutNet } from '@/lib/payouts/calc';

export const dynamic = 'force-dynamic';

// ── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULT_WEIGHT_RANGES = [
  { max_weight_kg: 1, price: 175 },
  { max_weight_kg: 5, price: 195 },
  { max_weight_kg: 10, price: 235 },
  { max_weight_kg: 15, price: 255 },
  { max_weight_kg: 20, price: 275 },
  { max_weight_kg: 25, price: 300 },
  { max_weight_kg: 30, price: 325 },
];

function getCarrierCost(listing: any, shippingBase: number, estafetaConfig: any): number {
  const w = Number(listing.weight_kg) || 1;
  const len = Number(listing.length_cm) || 10;
  const wid = Number(listing.width_cm) || 10;
  const h = Number(listing.height_cm) || 10;
  const volW = (len * wid * h) / 5000;
  const finalWeight = Math.max(w, volW);
  let cost = shippingBase;
  const ranges = ((estafetaConfig?.weight_ranges as any[]) || DEFAULT_WEIGHT_RANGES)
    .slice()
    .sort((a: any, b: any) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
  const match = ranges.find((r: any) => finalWeight <= (r.max_weight_kg || 0));
  if (match) cost = Number(match.price) || shippingBase;
  else if (ranges.length > 0) cost = Number(ranges[ranges.length - 1].price) || shippingBase;
  return cost;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  const discrepancies: any[] = [];

  try {
    const now = new Date().toISOString();

    // ── Fetch config once ────────────────────────────────────────────────────
    const { data: settingsRow } = await admin
      .from('app_settings')
      .select('shipping_base, estafeta_config')
      .eq('id', 1)
      .maybeSingle();
    const shippingBase = Number((settingsRow as any)?.shipping_base ?? 175);
    const estafetaConfig = (settingsRow as any)?.estafeta_config || { weight_ranges: DEFAULT_WEIGHT_RANGES };

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 1: USUARIOS PRO VENCIDOS
    // ════════════════════════════════════════════════════════════════════════
    const { data: expiredPros } = await admin
      .from('profiles')
      .select('id, email, full_name, pro_subscription_end')
      .eq('plan_type', 'pro')
      .lt('pro_subscription_end', now);

    for (const user of expiredPros ?? []) {
      discrepancies.push({
        severity: 'critical',
        entity_type: 'user',
        entity_id: user.id,
        message: `Usuario PRO vencido: ${user.email ?? 'Sin email'}`,
        details: { end_date: user.pro_subscription_end, issue: 'plan_pro_but_expired' },
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 2: USUARIOS CON SUB ACTIVA PERO PLAN BÁSICO
    // ════════════════════════════════════════════════════════════════════════
    const { data: mislabeledPros } = await admin
      .from('profiles')
      .select('id, email, full_name, plan_type, pro_subscription_end')
      .neq('plan_type', 'pro')
      .gt('pro_subscription_end', now);

    for (const user of mislabeledPros ?? []) {
      discrepancies.push({
        severity: 'warning',
        entity_type: 'user',
        entity_id: user.id,
        message: `Suscripción activa sin Plan PRO: ${user.email ?? 'Sin email'}`,
        details: { end_date: user.pro_subscription_end, current_plan: user.plan_type, issue: 'active_sub_but_basic' },
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 3: TIENDAS OFICIALES DESINCRONIZADAS
    // ════════════════════════════════════════════════════════════════════════
    const { data: brokenStores } = await admin
      .from('profiles')
      .select('id, email, official_store_name')
      .not('official_store_name', 'is', null)
      .eq('is_official_store', false);

    for (const store of brokenStores ?? []) {
      discrepancies.push({
        severity: 'warning',
        entity_type: 'user',
        entity_id: store.id,
        message: `Tienda Oficial desincronizada: ${store.official_store_name}`,
        details: { email: store.email, issue: 'store_name_but_flag_false' },
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 4 💸 FUGA DE ENVÍO GOPOCKET (DOUBLE-SUBSIDY DETECTION)
    // Detecta órdenes GoVendy donde el comprador pagó menos que el costo
    // real del carrier sin que el subsidio registrado lo justifique.
    // ════════════════════════════════════════════════════════════════════════
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: gopocketOrders } = await admin
      .from('orders')
      .select(`
        id, shipping_fee, shipping_subsidy, total, subtotal,
        order_items(listing_id),
        listings:listing_id(weight_kg, length_cm, width_cm, height_cm, shipping_price, shipping_subsidy, sale_type)
      `)
      .eq('shipping_carrier', 'gopocket')
      .gte('created_at', since30d)
      .limit(200);

    for (const order of (gopocketOrders ?? []) as any[]) {
      const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings;
      if (!listing) continue;

      const carrierCost = getCarrierCost(listing, shippingBase, estafetaConfig);
      const paidShipping = Number(order.shipping_fee ?? 0);
      const recordedSubsidy = Number(order.shipping_subsidy ?? 0);
      // El comprador debería haber pagado: carrierCost - subsidio_vendedor
      // Si pagó menos que eso, hay fuga.
      const expectedFee = Math.max(0, carrierCost - recordedSubsidy);
      const gap = expectedFee - paidShipping;

      // Tolerancia: $5 para cubrir redondeos o paquetes pequeños
      if (gap > 5) {
        discrepancies.push({
          severity: 'critical',
          entity_type: 'order',
          entity_id: order.id,
          message: `⚠️ Fuga de Envío GoVendy: el comprador pagó $${paidShipping} pero el carrier cuesta $${carrierCost} (subsidio registrado: $${recordedSubsidy}, esperado: $${expectedFee})`,
          details: {
            order_id: order.id,
            shipping_fee_paid: paidShipping,
            carrier_cost: carrierCost,
            recorded_subsidy: recordedSubsidy,
            gap_amount: gap,
            issue: 'gopocket_shipping_gap',
            possible_cause: 'double_subsidy_deduction_in_settlement',
          },
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 5 🔁 RECARGAS DUPLICADAS DE POCKETCASH
    // Detecta dos o más recargas del mismo usuario en < 5 minutos.
    // ════════════════════════════════════════════════════════════════════════
    const { data: recentRecharges } = await admin
      .from('pocket_cash_recharges')
      .select('id, user_id, amount, created_at')
      .gte('created_at', since30d)
      .order('user_id')
      .order('created_at');

    if (recentRecharges && recentRecharges.length > 1) {
      for (let i = 1; i < recentRecharges.length; i++) {
        const prev = recentRecharges[i - 1] as any;
        const curr = recentRecharges[i] as any;
        if (prev.user_id !== curr.user_id) continue;
        const diffMs = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
        const fiveMin = 5 * 60 * 1000;
        if (diffMs < fiveMin && Math.abs(Number(curr.amount) - Number(prev.amount)) < 1) {
          discrepancies.push({
            severity: 'warning',
            entity_type: 'recharge',
            entity_id: curr.id,
            message: `🔁 Posible recarga PocketCash duplicada para usuario ${curr.user_id}: $${curr.amount} en ${Math.round(diffMs / 1000)}s de diferencia`,
            details: {
              prev_recharge_id: prev.id,
              curr_recharge_id: curr.id,
              user_id: curr.user_id,
              amount: curr.amount,
              diff_seconds: Math.round(diffMs / 1000),
              issue: 'duplicate_pocket_cash_recharge',
            },
          });
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 6 📉 NETO NEGATIVO DEL VENDEDOR
    // Detecta órdenes donde el vendedor termina debiendo dinero a la plataforma.
    // ════════════════════════════════════════════════════════════════════════
    const { data: ordersForNet } = await admin
      .from('orders')
      .select('id, subtotal, total, shipping_fee, commission_fee, shipping_subsidy, shipping_carrier, shipping_option_id, coupon_discount, seller_id')
      .gte('created_at', since30d)
      .not('status', 'in', '("cancelled","refunded")')
      .limit(500);

    for (const o of (ordersForNet ?? []) as any[]) {
      const net = payoutNet(o as any);
      if (net < 0) {
        discrepancies.push({
          severity: 'critical',
          entity_type: 'order',
          entity_id: o.id,
          message: `📉 Neto negativo para vendedor ${o.seller_id}: Neto calculado = $${net.toFixed(2)}`,
          details: {
            order_id: o.id,
            seller_id: o.seller_id,
            subtotal: o.subtotal,
            commission_fee: o.commission_fee,
            shipping_subsidy: o.shipping_subsidy,
            calculated_net: net,
            issue: 'negative_seller_net',
          },
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // REGLA 7 💰 MONTO PAGABLE EXCEDE EL TOTAL DE VENTA
    // Detecta sesiones de pago donde el neto a pagar al vendedor > total cobrado.
    // ════════════════════════════════════════════════════════════════════════
    // Revisión a nivel de orden individual: net > total es imposible en lógica sana.
    for (const o of (ordersForNet ?? []) as any[]) {
      const net = payoutNet(o as any);
      const total = Number(o.total ?? 0);
      if (total > 0 && net > total) {
        discrepancies.push({
          severity: 'critical',
          entity_type: 'order',
          entity_id: o.id,
          message: `💰 Neto excede total de venta en orden ${o.id}: Neto=$${net.toFixed(2)}, Total=$${total.toFixed(2)}`,
          details: {
            order_id: o.id,
            seller_id: o.seller_id,
            calculated_net: net,
            order_total: total,
            issue: 'payable_exceeds_sale_total',
          },
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // GUARDAR EN audit_logs
    // ════════════════════════════════════════════════════════════════════════
    if (discrepancies.length > 0) {
      const { error: insertErr } = await admin.from('audit_logs').insert(discrepancies);
      if (insertErr) {
        console.error('[CENTINELA] Failed to write audit logs:', insertErr);
        return NextResponse.json({
          status: 'error',
          error: 'La tabla audit_logs no existe o no tiene las columnas correctas.',
          discrepancies,
        });
      }
    }

    return NextResponse.json({
      status: discrepancies.length > 0 ? 'alert' : 'clean',
      total: discrepancies.length,
      discrepancies,
    });

  } catch (err: any) {
    console.error('[CENTINELA] Run error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}