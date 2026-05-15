import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/service';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { OrderItemsRepository } from '@/lib/repositories/order-items.repository';
import { getCommissions, getPlan } from '@/lib/plans/limits';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest) {
  const secret = process.env.AUCTION_SETTLE_SECRET || '';
  if (!secret) return false; // por seguridad, requiere secret
  return req.nextUrl.searchParams.get('token') === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

    const admin = supabaseAdmin();
    const ordersRepo = new OrdersRepository();
    const orderItemsRepo = new OrderItemsRepository();
    const nowIso = new Date().toISOString();

    // Traer subastas vencidas (best-effort si columnas no existen)
    const res: any = await admin
      .from('listings')
      .select('id,title,seller_id,status,sale_type,auction_end_at,auction_highest_bid,auction_highest_bidder_id,shipping_option_id,shipping_by_seller,shipping_price,free_shipping,allow_personal_delivery,weight_kg,length_cm,width_cm,height_cm,shipping_subsidy,product_type')
      .eq('sale_type', 'auction')
      .eq('status', 'active')
      .lte('auction_end_at', nowIso)
      .limit(500);

    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || code === '42P01' || msg.includes('relation') || msg.includes('does not exist')) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'missing_columns_or_table' });
      }
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const rows = (res.data as any[]) ?? [];
    if (rows.length === 0) return NextResponse.json({ ok: true, settled: 0 });

    // NOTE: We no longer mass-pause all auctions upfront.
    // Each auction is locked individually via atomic status update to 'sold' or 'paused'
    // below, to avoid losing state if order creation fails.

    // Fetch shipping config once for all auctions
    const { data: settingsRow } = await admin
      .from('app_settings')
      .select('shipping_base, shipping_markup_percent, shipping_markup_fixed, estafeta_config')
      .eq('id', 1)
      .maybeSingle();

    const shippingBase = Number((settingsRow as any)?.shipping_base ?? 175);
    const estafetaConfig = ((settingsRow as any)?.estafeta_config as any) || {
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

    let notified = 0;
    for (const r of rows) {
      const listingId = String(r?.id || '').trim();
      const title = String(r?.title || 'Subasta').trim();
      const sellerId = String(r?.seller_id || '').trim();
      const winnerId = String(r?.auction_highest_bidder_id || '').trim();
      const highest = typeof r?.auction_highest_bid === 'number' ? r.auction_highest_bid : Number(r?.auction_highest_bid ?? 0);
      const highestBid = Number.isFinite(highest) ? highest : 0;
      const data = { listingId, listing_id: listingId, highestBid: highestBid || null, winnerId: winnerId || null };

      // Si hay ganador, CREAR ORDEN (con verificación de idempotencia)
      if (winnerId && sellerId && highestBid > 0) {
        try {
          // 0. Idempotencia: verificar si ya existe una orden para este listing
          const { data: existingItems } = await admin
            .from('order_items')
            .select('order_id')
            .eq('listing_id', listingId)
            .limit(1);

          if (existingItems && existingItems.length > 0) {
            // Ya existe una orden, solo marcar como sold y continuar
            await admin.from('listings').update({ status: 'sold' }).eq('id', listingId);
            console.log(`[SETTLE] Skipping ${listingId} — order already exists: ${existingItems[0].order_id}`);
            continue;
          }

          // ATOMIC LOCK: Mark as sold BEFORE creating order
          const { data: lockedListing } = await admin
            .from('listings')
            .update({ status: 'sold' })
            .eq('id', listingId)
            .neq('status', 'sold')
            .select('id');

          if (!lockedListing || lockedListing.length === 0) {
            console.log(`[SETTLE] Listing ${listingId} already locked/sold by another process. Skipping.`);
            continue;
          }

          // 1. Calcular comisiones desde BD
          const plan = await getPlan(admin, sellerId);
          const commissions = await getCommissions(admin);
          const commissionRate = plan === 'basic' ? commissions.basic : plan === 'pro' ? commissions.pro : commissions.platinum;
          const commissionFee = Math.round((highestBid * commissionRate) / 100 * 100) / 100;

          // --- Detectar producto digital ---
          const isDigitalProduct = String((r as any)?.product_type || '').toLowerCase() === 'digital';

          // --- Calcular envío ---
          const isSellerShipping = Boolean(r.shipping_by_seller);
          const isFreeShipping = Boolean(r.free_shipping);
          const allowPersonalDelivery = Boolean(r.allow_personal_delivery);
          const publishedShippingPrice = Number(r.shipping_price || 0);
          const shippingSubsidy = Number(r.shipping_subsidy || 0);
          let shippingFee = 0;
          let shippingOptionId = r.shipping_option_id || null;
          let shippingMethod: string | null = null;

          // Digital products: no physical shipping
          if (isDigitalProduct) {
            shippingFee = 0;
            shippingOptionId = 'digital';
            shippingMethod = 'digital';
          }

          // Determine if GoVendy shipping is available
          const hasGoVendyShipping = !isSellerShipping && !isFreeShipping && (publishedShippingPrice > 0 || Number(r.weight_kg) > 0 || shippingOptionId === 'gopocket');

          if (isDigitalProduct) {
            // Already handled above
          } else if (allowPersonalDelivery && !hasGoVendyShipping && !isSellerShipping && !isFreeShipping) {
            // ONLY personal delivery (no other shipping): pickup with $0
            shippingFee = 0;
            shippingOptionId = 'pickup';
          } else if (isFreeShipping) {
            shippingFee = 0;
          } else if (isSellerShipping) {
            shippingFee = publishedShippingPrice;
          } else if (publishedShippingPrice > 0) {
            // GoVendy con precio pre-calculado. El frontend ya guardó el precio NETO para el comprador
            // (shipping_price = carrier_cost - shipping_subsidy). NO restar subsidio otra vez.
            shippingFee = publishedShippingPrice;
            console.log(`[SETTLE] GoVendy fixed price for ${listingId}: publishedPrice=${publishedShippingPrice}, subsidy=${shippingSubsidy} (already factored in). BuyerPays=${shippingFee}`);
          } else {
            // GoVendy shipping — calculate from weight
            const w = Number(r.weight_kg) || 1;
            const len = Number(r.length_cm) || 10;
            const wid = Number(r.width_cm) || 10;
            const h = Number(r.height_cm) || 10;
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

            const totalShippingCost = baseCost;

            if (shippingSubsidy > 0) {
              shippingFee = Math.max(0, totalShippingCost - shippingSubsidy);
            } else {
              shippingFee = totalShippingCost;
            }

            console.log(`[SETTLE] GoVendy shipping for ${listingId}: weight=${finalWeight}kg, base=${baseCost}, final=${totalShippingCost}, subsidy=${shippingSubsidy}, buyerPays=${shippingFee}`);
          }

          // Ensure shipping_option_id/carrier are correct y manejar envío gratis en GoVendy
          let shippingCarrier: string | null = null;
          let shippingSubsidyForOrder: number | undefined = undefined;
          if (!isSellerShipping && !isFreeShipping && hasGoVendyShipping) {
            if (!shippingOptionId || shippingOptionId === 'pickup') {
              shippingOptionId = 'gopocket';
            }
            shippingCarrier = 'gopocket';
          } else if (!isSellerShipping && isFreeShipping) {
            // GoVendy gratis: calcular subsidio (costo base) para descontarlo del vendedor
            let baseCost = publishedShippingPrice;
            if (!(baseCost > 0)) {
              const w = Number(r.weight_kg) || 1;
              const len = Number(r.length_cm) || 10;
              const wid = Number(r.width_cm) || 10;
              const h = Number(r.height_cm) || 10;
              const volW = (len * wid * h) / 5000;
              const finalWeight = Math.max(w, volW);
              let calc = shippingBase;
              if (Array.isArray(estafetaConfig.weight_ranges)) {
                const ranges = estafetaConfig.weight_ranges.sort((a: any, b: any) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
                const match = ranges.find((rng: any) => finalWeight <= (rng.max_weight_kg || 0));
                if (match) calc = Number(match.price) || shippingBase;
                else if (ranges.length > 0) calc = Number(ranges[ranges.length - 1].price) || shippingBase;
              }
              baseCost = calc;
            }
            shippingOptionId = 'gopocket';
            shippingCarrier = 'gopocket';
            shippingSubsidyForOrder = baseCost;
            shippingFee = 0;
          }

          const order = await ordersRepo.create({
            buyer_id: winnerId,
            seller_id: sellerId,
            payment_method: 'bank_transfer',
            status: 'pending_payment',
            subtotal: highestBid,
            shipping_fee: shippingFee,
            commission_fee: commissionFee,
            total: highestBid + shippingFee,
            shipping_option_id: isDigitalProduct ? null : shippingOptionId,
            shipping_carrier: isDigitalProduct ? 'digital' : (shippingCarrier ?? undefined),
            // ⚠️ CRÍTICO: shipping_by_seller = true solo si el vendedor gestiona el envío.
            // Para GoVendy (gratis o con precio), SIEMPRE false.
            shipping_by_seller: isSellerShipping,
            shipping_subsidy: shippingSubsidyForOrder,
            ...(shippingMethod ? { shipping_method: shippingMethod } : {}),
          } as any);

          // 3. Crear items de orden
          await orderItemsRepo.createMany([{
            order_id: order.id,
            listing_id: listingId,
            title: title,
            unit_price: highestBid,
            quantity: 1,
            line_total: highestBid,
          }]);

          // Listing already locked as 'sold' above

        } catch (err) {
          console.error(`Error creating order for auction ${listingId}:`, err);
          // Revert atomic lock so it can retry
          await admin.from('listings').update({ status: 'active' }).eq('id', listingId);
          // Continue with notifications even if order creation fails (best effort)
        }
      }

      // Vendedor: subasta finalizada
      if (sellerId) {
        const body = winnerId
          ? `Tu subasta terminó con ganador. Se creó una nueva venta por ${highestBid} (estado: pendiente de pago).`
          : 'Tu subasta terminó sin pujas.';

        const rr = await notify(admin, {
          user_id: sellerId,
          type: 'auction_ended',
          title: 'Tu subasta terminó',
          body,
          data,
          is_read: false,
        });
        if (rr.ok) notified += 1;
      }

      // Ganador: auction_won
      if (winnerId) {
        const rr = await notify(admin, {
          user_id: winnerId,
          type: 'auction_won',
          title: '¡Ganaste una subasta!',
          body: `Ganaste la subasta: ${title}. Ve a "Mis Compras" para completar el pago.`,
          data: { ...data, kind: 'auction_won' },
          is_read: false,
        });
        if (rr.ok) notified += 1;
      }

      // Perdedores: subasta finalizada (no ganaron)
      try {
        const bidsRes: any = await admin.from('bids').select('bidder_id').eq('listing_id', listingId);
        if (!bidsRes?.error && Array.isArray(bidsRes?.data)) {
          const bidderIds = Array.from(new Set((bidsRes.data as any[]).map((b: any) => String(b?.bidder_id ?? '').trim()).filter(Boolean)));
          for (const bidderId of bidderIds) {
            if (!bidderId || bidderId === winnerId || bidderId === sellerId) continue;
            const rr = await notify(admin, {
              user_id: bidderId,
              type: 'auction_ended',
              title: 'Subasta finalizada',
              body: `La subasta "${title}" terminó. No fuiste el ganador.`,
              data: { ...data, kind: 'auction_ended' },
              is_read: false,
            });
            if (rr.ok) notified += 1;
          }
        }
      } catch {
        // best-effort; no bloquear settle
      }
    }

    const resp = NextResponse.json({ ok: true, settled: rows.length, notified });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error settling auctions' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

