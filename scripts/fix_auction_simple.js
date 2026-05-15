
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AUCTION_IDS = [
  "844db46d-00df-44f8-911d-ced8da9467ac",
  "49be4225-5a88-4a5c-a35b-926928c977c9",
  "2e85e479-83cb-4257-81cf-c22ef027b670",
  "e838413b-c7cf-4f66-bb11-21e1a9655ba8",
  "4ddd0c3c-fac2-4524-949b-eba25b58d9db",
  "04260a5a-cea6-40ee-9f87-b9ee08732531",
  "0ccf5d8d-96b4-4ef3-9aa1-fb177ca2f767",
  "817c7776-37f2-412e-b871-3e4f37b0f904",
  "24edbd7f-ead1-4625-a606-4e6681486e3b",
  "2ae98e85-ea54-4635-b5f5-c0bcff9ca562"
];

async function fixAuctions() {
  console.log('🚀 Iniciando reparación de subastas...');

  // 1. Obtener configuración de envío (Shipping Base & Estafeta)
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('shipping_base, estafeta_config')
    .eq('id', 1)
    .maybeSingle();

  const shippingBase = Number(settingsRow?.shipping_base ?? 175);
  const estafetaConfig = settingsRow?.estafeta_config || {
    enabled: true,
    weight_ranges: [
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
    ],
  };

  // Asegurar fallback de weight_ranges
  if (!estafetaConfig.weight_ranges || estafetaConfig.weight_ranges.length < 5) {
      estafetaConfig.weight_ranges = [
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
  }

  for (const listingId of AUCTION_IDS) {
    console.log(`\n🔧 Procesando subasta: ${listingId}`);

    // 2. Obtener datos de la subasta
    const { data: r, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (error || !r) {
      console.error(`❌ Error al obtener listing ${listingId}:`, error);
      continue;
    }

    const title = String(r.title || 'Subasta').trim();
    const sellerId = String(r.seller_id || '').trim();
    const winnerId = String(r.auction_highest_bidder_id || '').trim();
    const highestBid = Number(r.auction_highest_bid || 0);

    if (!winnerId || highestBid <= 0) {
      console.log(`⚠️ Subasta sin ganador válido o puja 0. Saltando.`);
      // Opcional: Marcar como pausada si no tiene ganador
      await supabase.from('listings').update({ status: 'paused' }).eq('id', listingId);
      continue;
    }

    // 3. Verificar si ya existe orden (Doble check)
    const { data: existingItems } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('listing_id', listingId)
      .limit(1);

    let existingOrderId = null;
    if (existingItems && existingItems.length > 0) {
      existingOrderId = existingItems[0].order_id;
      console.log(`✅ Orden ya existe: ${existingOrderId}. Se actualizarán montos y estado a 'sold'.`);
    }

    try {
      // 4. Calcular Comisión
      // Simplificado: asumimos Basic (23%) o Pro (18%) consultando el plan
      let commissionPercent = 23;
      const { data: sub } = await supabase.from('subscriptions').select('plan_id, status').eq('user_id', sellerId).eq('status', 'active').maybeSingle();
      if (sub?.plan_id === 'pro' || sub?.plan_id === 'platinum') commissionPercent = 18;

      let commissionFee = Math.round((highestBid * commissionPercent) / 100);
      if (commissionFee < 23) commissionFee = 23; // Mínimo global seguro

      // 5. Calcular Envío
      const isSellerShipping = Boolean(r.shipping_by_seller);
      const isFreeShipping = Boolean(r.free_shipping);
      const allowPersonalDelivery = Boolean(r.allow_personal_delivery);
      const publishedShippingPrice = Number(r.shipping_price || 0);
      const shippingSubsidy = Number(r.shipping_subsidy || 0);
      
      let shippingFee = 0;
      let shippingOptionId = r.shipping_option_id || null;
      let shippingCarrier = null;
      let hasGoPocketShipping = !isSellerShipping && !isFreeShipping && (publishedShippingPrice > 0 || Number(r.weight_kg) > 0);

      if (allowPersonalDelivery && !hasGoPocketShipping && !isSellerShipping && !isFreeShipping) {
        shippingFee = 0;
        shippingOptionId = null;
        shippingCarrier = 'pickup';
      } else if (isFreeShipping) {
        shippingFee = 0;
      } else if (isSellerShipping) {
        shippingFee = publishedShippingPrice;
      } else if (publishedShippingPrice > 0) {
        shippingFee = publishedShippingPrice;
        if (shippingSubsidy > 0) {
          shippingFee = Math.max(0, publishedShippingPrice - shippingSubsidy);
        }
      } else {
        // Calcular GoPocket desde peso
        const w = Number(r.weight_kg) || 1;
        const len = Number(r.length_cm) || 10;
        const wid = Number(r.width_cm) || 10;
        const h = Number(r.height_cm) || 10;
        const volW = (len * wid * h) / 5000;
        const finalWeight = Math.max(w, volW);

        let baseCost = shippingBase;
        if (estafetaConfig.enabled) {
            const ranges = estafetaConfig.weight_ranges.sort((a, b) => a.max_weight_kg - b.max_weight_kg);
            const match = ranges.find(rng => finalWeight <= rng.max_weight_kg);
            if (match) baseCost = Number(match.price);
            else if (ranges.length > 0) baseCost = Number(ranges[ranges.length - 1].price);
        }
        
        const totalShippingCost = baseCost;
        if (shippingSubsidy > 0) {
            shippingFee = Math.max(0, totalShippingCost - shippingSubsidy);
        } else {
            shippingFee = totalShippingCost;
        }
        console.log(`   🚚 Envío calculado: Peso=${finalWeight}kg, CostoBase=${baseCost}, Fee=${shippingFee}`);
      }

      // 6. Crear o actualizar Orden
      let orderId = existingOrderId;
      if (orderId) {
        console.log(`   🔁 Actualizando orden existente ${orderId}...`);
        const { data: updatedOrder, error: orderErr } = await supabase
          .from('orders')
          .update({
            payment_method: 'bank_transfer',
            status: 'pending_payment',
            subtotal: highestBid,
            shipping_fee: shippingFee,
            commission_fee: commissionFee,
            total: highestBid + shippingFee,
            shipping_option_id: shippingOptionId,
            shipping_carrier: shippingCarrier,
            shipping_subsidy: shippingSubsidy > 0 ? shippingSubsidy : 0,
          })
          .eq('id', orderId)
          .select('id')
          .single();

        if (orderErr) throw orderErr;
        orderId = updatedOrder.id;
      } else {
        console.log(`   📦 Creando orden para ganador ${winnerId}...`);
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            buyer_id: winnerId,
            seller_id: sellerId,
            payment_method: 'bank_transfer',
            status: 'pending_payment',
            subtotal: highestBid,
            shipping_fee: shippingFee,
            commission_fee: commissionFee,
            total: highestBid + shippingFee,
            shipping_option_id: shippingOptionId,
            shipping_carrier: shippingCarrier,
            shipping_subsidy: shippingSubsidy > 0 ? shippingSubsidy : 0,
          })
          .select('id')
          .single();

        if (orderErr) throw orderErr;
        orderId = order.id;

        // 7. Crear Item de Orden
        const { error: itemErr } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            listing_id: listingId,
            title: title,
            unit_price: highestBid,
            quantity: 1,
            line_total: highestBid,
          });
        if (itemErr) throw itemErr;

        // 9. Notificaciones básicas solo cuando la orden es nueva
        await supabase.from('notifications').insert([
          {
            user_id: winnerId,
            type: 'auction_won',
            title: '¡Ganaste una subasta!',
            body: `Ganaste la subasta: ${title}. Ve a "Mis Compras" para completar el pago.`,
            data: { listingId, kind: 'auction_won', orderId },
            is_read: false,
          },
          {
            user_id: sellerId,
            type: 'auction_ended',
            title: 'Tu subasta terminó',
            body: `Tu subasta terminó con ganador. Se creó una nueva venta por $${highestBid}.`,
            data: { listingId, kind: 'auction_ended' },
            is_read: false,
          },
        ]);
      }

      // 8. Actualizar estado a Sold
      await supabase.from('listings').update({ status: 'sold' }).eq('id', listingId);

      console.log(`   ✅ Orden lista: ${orderId}`);

    } catch (err) {
      console.error(`   ❌ Error procesando subasta ${listingId}:`, err);
    }
  }
}

fixAuctions();
