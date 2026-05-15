import { supabaseAdmin } from '@/lib/supabase/admin';

async function main() {
  const admin = supabaseAdmin();

  // 1) Normalizar shipping_option_id='gopocket' cuando carrier indica GoVendy
  const { data: toNormalize } = await admin
    .from('orders')
    .select('id')
    .is('shipping_option_id', null)
    .eq('shipping_carrier', 'gopocket')
    .limit(2000);

  if (toNormalize && toNormalize.length > 0) {
    const ids = toNormalize.map((o: any) => o.id);
    await admin.from('orders').update({ shipping_option_id: 'gopocket' }).in('id', ids);
    console.log(`[BACKFILL] Normalizados shipping_option_id=gopocket en ${ids.length} órdenes`);
  }

  // 2) Backfill de subsidio en órdenes GoVendy con envío gratis (buyer shipping_fee=0)
  const { data: freeOrders } = await admin
    .from('orders')
    .select('id,shipping_fee,shipping_subsidy')
    .eq('shipping_carrier', 'gopocket')
    .in('status', ['pending_payment', 'paid', 'shipped', 'delivered', 'completed'])
    .lte('shipping_fee', 0)
    .or('shipping_subsidy.is.null,shipping_subsidy.eq.0')
    .limit(2000);

  if (freeOrders && freeOrders.length > 0) {
    const orderIds = freeOrders.map((o: any) => o.id);

    // Obtener items + listings para calcular costo por peso
    const { data: items } = await admin
      .from('order_items')
      .select('order_id, listing_id, listings(weight_kg,length_cm,width_cm,height_cm,shipping_price,shipping_subsidy)')
      .in('order_id', orderIds);

    const mapByOrder: Record<string, any[]> = {};
    (items || []).forEach((it: any) => {
      if (!mapByOrder[it.order_id]) mapByOrder[it.order_id] = [];
      mapByOrder[it.order_id].push(it);
    });

    const { data: settingsRow } = await admin
      .from('app_settings')
      .select('shipping_base, estafeta_config')
      .eq('id', 1)
      .maybeSingle();

    const DEFAULT_WEIGHT_RANGES = [
      { max_weight_kg: 1, price: 175 },
      { max_weight_kg: 5, price: 195 },
      { max_weight_kg: 10, price: 235 },
      { max_weight_kg: 15, price: 255 },
      { max_weight_kg: 20, price: 275 },
      { max_weight_kg: 25, price: 300 },
      { max_weight_kg: 30, price: 325 },
      { max_weight_kg: 35, price: 340 },
      { max_weight_kg: 40, price: 355 },
      { max_weight_kg: 45, price: 385 },
      { max_weight_kg: 50, price: 415 },
      { max_weight_kg: 55, price: 435 },
      { max_weight_kg: 60, price: 455 },
    ];
    const shippingBase = Number((settingsRow as any)?.shipping_base ?? 175);
    const estafetaConfig = ((settingsRow as any)?.estafeta_config as any) || {
      enabled: true,
      weight_ranges: DEFAULT_WEIGHT_RANGES,
    };
    if (!Array.isArray(estafetaConfig.weight_ranges) || estafetaConfig.weight_ranges.length < 5) {
      estafetaConfig.weight_ranges = DEFAULT_WEIGHT_RANGES;
    }

    const updates: any[] = [];

    for (const oid of orderIds) {
      const its = mapByOrder[oid] || [];
      if (its.length === 0) continue;
      // Si algún listing ya tiene shipping_price > 0, úsalo como estimado base (asumimos subasta 1 item)
      const known = its.find((it: any) => Number(it.listings?.shipping_price || 0) > 0);
      let baseCost = known ? Number(known.listings.shipping_price) : 0;
      if (!(baseCost > 0)) {
        // calcular por peso (primer item)
        const l = its[0].listings || {};
        const w = Number(l.weight_kg) || 1;
        const len = Number(l.length_cm) || 10;
        const wid = Number(l.width_cm) || 10;
        const h = Number(l.height_cm) || 10;
        const volW = (len * wid * h) / 5000;
        const finalW = Math.max(w, volW);
        const ranges = estafetaConfig.weight_ranges.sort((a: any, b: any) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
        const match = ranges.find((rng: any) => finalW <= (rng.max_weight_kg || 0));
        baseCost = match ? Number(match.price) || shippingBase : Number(ranges[ranges.length - 1].price) || shippingBase;
      }
      updates.push({ id: oid, shipping_subsidy: baseCost });
    }

    if (updates.length > 0) {
      for (const u of updates) {
        await admin.from('orders').update({ shipping_subsidy: u.shipping_subsidy }).eq('id', u.id);
      }
      console.log(`[BACKFILL] Actualizadas ${updates.length} órdenes con shipping_subsidy por envío GoVendy gratis`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
