const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para operaciones server-side.');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function main() {
  const admin = supabaseAdmin();

  // 1) Normalizar shipping_option_id='gopocket' cuando carrier indica GoPocket
  const { data: toNormalize, error: normErr } = await admin
    .from('orders')
    .select('id')
    .is('shipping_option_id', null)
    .eq('shipping_carrier', 'gopocket')
    .limit(2000);

  if (normErr) {
    console.error('[BACKFILL] Error al buscar órdenes para normalizar:', normErr);
  } else if (toNormalize && toNormalize.length > 0) {
    const ids = toNormalize.map((o) => o.id);
    const { error: updErr } = await admin.from('orders').update({ shipping_option_id: 'gopocket' }).in('id', ids);
    if (updErr) {
      console.error('[BACKFILL] Error al normalizar shipping_option_id:', updErr);
    } else {
      console.log(`[BACKFILL] Normalizados shipping_option_id=gopocket en ${ids.length} órdenes`);
    }
  } else {
    console.log('[BACKFILL] No hay órdenes para normalizar shipping_option_id.');
  }

  // 2) Backfill de subsidio en órdenes GoPocket con envío gratis (buyer shipping_fee=0)
  const { data: freeOrders, error: freeErr } = await admin
    .from('orders')
    .select('id,shipping_fee,shipping_subsidy')
    .eq('shipping_carrier', 'gopocket')
    .in('status', ['pending_payment', 'paid', 'shipped', 'delivered', 'completed'])
    .lte('shipping_fee', 0)
    .or('shipping_subsidy.is.null,shipping_subsidy.eq.0')
    .limit(2000);

  if (freeErr) {
    console.error('[BACKFILL] Error al buscar órdenes GoPocket gratis:', freeErr);
    return;
  }

  if (!freeOrders || freeOrders.length === 0) {
    console.log('[BACKFILL] No se encontraron órdenes GoPocket con envío gratis para ajustar.');
    return;
  }

  const orderIds = freeOrders.map((o) => o.id);

  // Obtener items + listings para calcular costo por peso
  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('order_id, listing_id, listings(weight_kg,length_cm,width_cm,height_cm,shipping_price,shipping_subsidy)')
    .in('order_id', orderIds);

  if (itemsErr) {
    console.error('[BACKFILL] Error al obtener items/listings:', itemsErr);
    return;
  }

  const mapByOrder = {};
  (items || []).forEach((it) => {
    if (!mapByOrder[it.order_id]) mapByOrder[it.order_id] = [];
    mapByOrder[it.order_id].push(it);
  });

  const { data: settingsRow, error: settingsErr } = await admin
    .from('app_settings')
    .select('shipping_base, estafeta_config')
    .eq('id', 1)
    .maybeSingle();

  if (settingsErr) {
    console.error('[BACKFILL] Error al leer app_settings:', settingsErr);
    return;
  }

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

  const shippingBase = Number((settingsRow || {}).shipping_base ?? 175);
  const estafetaConfig = (settingsRow || {}).estafeta_config || {
    enabled: true,
    weight_ranges: DEFAULT_WEIGHT_RANGES,
  };

  if (!Array.isArray(estafetaConfig.weight_ranges) || estafetaConfig.weight_ranges.length < 5) {
    estafetaConfig.weight_ranges = DEFAULT_WEIGHT_RANGES;
  }

  const updates = [];

  for (const oid of orderIds) {
    const its = mapByOrder[oid] || [];
    if (its.length === 0) continue;
    // Si algún listing ya tiene shipping_price > 0, úsalo como estimado base (asumimos subasta 1 item)
    const known = its.find((it) => Number((it.listings || {}).shipping_price || 0) > 0);
    let baseCost = known ? Number(known.listings.shipping_price) : 0;
    if (!(baseCost > 0)) {
      const l = its[0].listings || {};
      const w = Number(l.weight_kg) || 1;
      const len = Number(l.length_cm) || 10;
      const wid = Number(l.width_cm) || 10;
      const h = Number(l.height_cm) || 10;
      const volW = (len * wid * h) / 5000;
      const finalW = Math.max(w, volW);
      const ranges = estafetaConfig.weight_ranges.slice().sort((a, b) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
      const match = ranges.find((rng) => finalW <= (rng.max_weight_kg || 0));
      baseCost = match ? Number(match.price) || shippingBase : Number(ranges[ranges.length - 1].price) || shippingBase;
    }
    updates.push({ id: oid, shipping_subsidy: baseCost });
  }

  if (updates.length === 0) {
    console.log('[BACKFILL] No se generaron subsidios para actualizar.');
    return;
  }

  let okCount = 0;
  for (const u of updates) {
    const { error: updErr } = await admin.from('orders').update({ shipping_subsidy: u.shipping_subsidy }).eq('id', u.id);
    if (updErr) {
      console.error(`[BACKFILL] Error actualizando orden ${u.id}:`, updErr);
    } else {
      okCount += 1;
    }
  }
  console.log(`[BACKFILL] Actualizadas ${okCount} órdenes con shipping_subsidy por envío GoPocket gratis`);
}

main()
  .then(() => {
    console.log('[BACKFILL] Completado');
    process.exit(0);
  })
  .catch((e) => {
    console.error('[BACKFILL] Error inesperado:', e);
    process.exit(1);
  });
