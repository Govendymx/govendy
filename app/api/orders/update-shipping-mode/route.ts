import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Body = {
  orderId: string;
  mode: 'pickup' | 'gopocket';
};

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId, admin } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body.orderId || '').trim();
    const mode = String(body.mode || '').trim() as Body['mode'];

    if (!orderId) {
      return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
    }

    if (mode !== 'pickup' && mode !== 'gopocket') {
      return NextResponse.json({ error: 'Modo de envío inválido. Use pickup o gopocket.' }, { status: 400 });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id,buyer_id,status,subtotal,commission_fee,shipping_fee,shipping_option_id,shipping_carrier,total')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const buyerId = String((order as any).buyer_id || '').trim();
    const status = String((order as any).status || '').trim();

    if (!buyerId) {
      return NextResponse.json({ error: 'Orden inválida' }, { status: 400 });
    }

    if (buyerId !== effectiveUserId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Statuses that allow modifying shipping (order not yet paid)
    const UNPAID = new Set(['pending', 'created', 'waiting_payment', 'payment_pending', 'pending_payment']);
    if (!UNPAID.has(status)) {
      return NextResponse.json({ error: 'Esta orden ya no permite cambiar el envío (ya fue pagada o cancelada)' }, { status: 400 });
    }

    // 5. Fetch order items
    const { data: items, error: itemsError } = await admin
      .from('order_items')
      .select('listing_id')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('[UPDATE-SHIPPING-MODE] Items error:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    if (!items || items.length === 0) {
      console.error('[UPDATE-SHIPPING-MODE] No items for order', orderId);
      return NextResponse.json({ error: 'Orden sin ítems' }, { status: 400 });
    }

    // 6. Fetch all listings involved
    const listingIds = (items || []).map(it => it.listing_id);
    const { data: listings, error: listingsError } = await admin
      .from('listings')
      .select(
        'id, seller_id, sale_type, allow_personal_delivery, shipping_by_seller, free_shipping, shipping_price, weight_kg, length_cm, width_cm, height_cm, shipping_subsidy'
      )
      .in('id', listingIds);

    if (listingsError) {
      console.error('[UPDATE-SHIPPING-MODE] Listings error:', listingsError);
      return NextResponse.json({ error: listingsError.message }, { status: 400 });
    }

    const sellerIds = Array.from(new Set((listings || []).map(l => l.seller_id).filter(Boolean)));
    const { data: sellerProfiles } = await admin.from('profiles').select('id, plan_type').in('id', sellerIds);
    const sellerPlans = Object.fromEntries((sellerProfiles || []).map(p => [p.id, p.plan_type]));

    // Use any listing that allows personal delivery, falling back to the first one
    const listing = (listings || []).find(l => l.allow_personal_delivery && (sellerPlans[l.seller_id as string] === 'platinum' || l.sale_type === 'auction')) || (listings || [])[0];

    if (!listing) {
      return NextResponse.json({ error: 'No se encontraron publicaciones en la orden' }, { status: 400 });
    }

    const allowPersonalDelivery = Boolean(listing.allow_personal_delivery) && (sellerPlans[listing.seller_id as string] === 'platinum' || listing.sale_type === 'auction');

    if (mode === 'pickup') {
      // ─── Switch to personal delivery ───
      if (!allowPersonalDelivery) {
        return NextResponse.json({ error: 'La publicación no permite entrega personal' }, { status: 400 });
      }

      const subtotal = Number((order as any).subtotal || 0);
      const newShippingFee = 0;
      // We keep it simple: total is subtotal (product) + shipping fee (0)
      const newTotal = subtotal + newShippingFee;

      console.log('[UPDATE-SHIPPING-MODE] Updating to pickup:', { newShippingFee, newTotal });

      const updatePayload: any = {
        shipping_fee: newShippingFee,
        shipping_carrier: 'pickup',
        shipping_option_id: null,
        total: newTotal,
        shipping_subsidy: 0,
      };

      const { error: updateError } = await admin.from('orders').update(updatePayload).eq('id', orderId);

      if (updateError) {
        console.error('[UPDATE-SHIPPING-MODE] Update error (pickup):', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        order: {
          id: orderId,
          total: newTotal,
          shipping_fee: newShippingFee,
          shipping_carrier: 'pickup',
          shipping_option_id: null,
        },
      });
    } else {
      // ─── Switch to GoVendy shipping ───
      // Recalculate shipping from weight ranges
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

      const { data: settingsRow } = await admin
        .from('app_settings')
        .select('shipping_base, estafeta_config')
        .eq('id', 1)
        .maybeSingle();

      const shippingBase = Number((settingsRow as any)?.shipping_base ?? 175);
      const estafetaConfig = ((settingsRow as any)?.estafeta_config as any) || {
        enabled: true,
        weight_ranges: DEFAULT_WEIGHT_RANGES,
      };

      if (!estafetaConfig.weight_ranges || estafetaConfig.weight_ranges.length < 5) {
        estafetaConfig.weight_ranges = DEFAULT_WEIGHT_RANGES;
      }

      const publishedShippingPrice = Number(listing.shipping_price || 0);
      const shippingSubsidy = Number(listing.shipping_subsidy || 0);

      let rawShippingFee: number;

      if (publishedShippingPrice > 0) {
        rawShippingFee = publishedShippingPrice;
      } else {
        // Calculate from weight
        const w = Number(listing.weight_kg) || 1;
        const len = Number(listing.length_cm) || 10;
        const wid = Number(listing.width_cm) || 10;
        const h = Number(listing.height_cm) || 10;
        const volW = (len * wid * h) / 5000;
        const finalWeight = Math.max(w, volW);

        let baseCost = shippingBase;
        if (Array.isArray(estafetaConfig.weight_ranges)) {
          const ranges = estafetaConfig.weight_ranges.sort((a: any, b: any) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
          const match = ranges.find((rng: any) => finalWeight <= (rng.max_weight_kg || 0));
          if (match) {
            baseCost = Number(match.price) || shippingBase;
          } else if (ranges.length > 0) {
            baseCost = Number(ranges[ranges.length - 1].price) || shippingBase;
          }
        }
        rawShippingFee = baseCost;
      }

      const finalShippingSubsidy = Math.min(shippingSubsidy, rawShippingFee);
      const newShippingFee = Math.max(0, rawShippingFee - finalShippingSubsidy);

      const subtotal = Number((order as any).subtotal || 0);
      const newTotal = subtotal + newShippingFee;

      console.log('[UPDATE-SHIPPING-MODE] Updating to gopocket:', { rawShippingFee, subsidy: finalShippingSubsidy, newShippingFee, newTotal });

      const updatePayload: any = {
        shipping_fee: newShippingFee,
        shipping_carrier: 'gopocket',
        shipping_option_id: 'gopocket',
        total: newTotal,
        shipping_subsidy: finalShippingSubsidy
      };

      const { error: updateError } = await admin.from('orders').update(updatePayload).eq('id', orderId);

      if (updateError) {
        console.error('[UPDATE-SHIPPING-MODE] Update error (gopocket):', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        order: {
          id: orderId,
          total: newTotal,
          shipping_fee: newShippingFee,
          shipping_carrier: 'gopocket',
          shipping_option_id: null,
        },
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
