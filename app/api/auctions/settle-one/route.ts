import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/service';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { OrderItemsRepository } from '@/lib/repositories/order-items.repository';
import { getCommissions, getPlan } from '@/lib/plans/limits';
import { resolveAuctionShipping, listingToShippingInput, buildShippingSettings } from '@/lib/shipping/shipping-calculator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({} as any));
    const listingId = String(json?.listing_id || '').trim();
    if (!listingId) {
      return NextResponse.json({ ok: false, error: 'listing_id requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const ordersRepo = new OrdersRepository();
    const orderItemsRepo = new OrderItemsRepository();
    const nowIso = new Date().toISOString();

    // Try full query first; using * to avoid "column does not exist" errors if schema changes
    let listingRes: any = await admin
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();

    if (listingRes?.error) {
      const code = String(listingRes.error?.code || '');
      const msg = String(listingRes.error?.message || '').toLowerCase();
      console.error(`[SETTLE-ONE] Query error for ${listingId}:`, { code, message: listingRes.error.message });

      // Retry
      if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
        console.log(`[SETTLE-ONE] Retrying select * for ${listingId}...`);
        listingRes = await admin
          .from('listings')
          .select('*')
          .eq('id', listingId)
          .maybeSingle();
      }
    }

    if (listingRes?.error) {
      console.error(`[SETTLE-ONE] Final query error for ${listingId}:`, listingRes.error.message);
      return NextResponse.json({ ok: false, error: `DB error: ${listingRes.error.message}` }, { status: 500 });
    }

    if (!listingRes?.data) {
      console.log(`[SETTLE-ONE] Listing ${listingId} not found in DB`);
      return NextResponse.json({ ok: false, error: 'Listing no encontrado' }, { status: 404 });
    }

    const r = listingRes.data;
    if (r.sale_type !== 'auction') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_auction' });
    }
    if (!r.auction_end_at || new Date(r.auction_end_at).toISOString() > nowIso) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not_ended' });
    }
    if (['sold', 'deleted'].includes(String(r.status))) {
      // Even if already processed, find the existing order for the response
      const { data: existItems } = await admin
        .from('order_items')
        .select('order_id')
        .eq('listing_id', listingId)
        .limit(1);
      const existingOrderId = existItems?.[0]?.order_id || null;

      // Allow force re-notification via force_notify param
      const forceNotify = Boolean(json?.force_notify);
      if (forceNotify && existingOrderId) {
        const winnerId = String(r.auction_highest_bidder_id || '').trim();
        const sellerId = String(r.seller_id || '').trim();
        const title = String(r.title || 'Subasta').trim();
        const highestBid = Number(r.auction_highest_bid || 0);
        const data = { listingId, listing_id: listingId, highestBid, winnerId: winnerId || null };

        if (winnerId) {
          await notify(admin, {
            user_id: winnerId,
            type: 'auction_won',
            title: '¡Ganaste una subasta!',
            body: `Ganaste la subasta: ${title}. Ve a "Mis Compras" para completar el pago.`,
            data: { ...data, kind: 'auction_won', orderId: existingOrderId },
            is_read: false,
          });
        }
        if (sellerId) {
          await notify(admin, {
            user_id: sellerId,
            type: 'auction_ended',
            title: 'Tu subasta terminó',
            body: `Tu subasta terminó con ganador. Se creó una nueva venta por ${highestBid} (estado: pendiente de pago).`,
            data,
            is_read: false,
          });
        }
        return NextResponse.json({ ok: true, order_id: existingOrderId, renotified: true });
      }

      return NextResponse.json({ ok: true, skipped: true, reason: 'already_processed', order_id: existingOrderId });
    }
    // Si está pausada, verificamos si ya tiene orden abajo. Si no, permitimos continuar.

    const { data: existingItems } = await admin
      .from('order_items')
      .select('order_id')
      .eq('listing_id', listingId)
      .limit(1);

    if (existingItems && existingItems.length > 0) {
      await admin.from('listings').update({ status: 'sold' }).eq('id', listingId);
      return NextResponse.json({ ok: true, order_id: existingItems[0].order_id, idempotent: true });
    }

    const title = String(r.title || 'Subasta').trim();
    const sellerId = String(r.seller_id || '').trim();
    const winnerId = String(r.auction_highest_bidder_id || '').trim();
    const highestBid = Number(r.auction_highest_bid || 0);
    const data = { listingId, listing_id: listingId, highestBid: highestBid || null, winnerId: winnerId || null };

    let orderId: string | null = null;

    if (winnerId && sellerId && highestBid > 0) {
      // --- ATOMIC LOCK ---
      // Mark as sold FIRST to prevent race conditions with cron jobs
      const { data: lockedListing } = await admin
        .from('listings')
        .update({ status: 'sold' })
        .eq('id', listingId)
        .neq('status', 'sold')
        .select('id');

      if (!lockedListing || lockedListing.length === 0) {
        console.log(`[SETTLE-ONE] Listing ${listingId} already locked/sold. Checking for existing order...`);
        // Already processed by cron or another call.
        const { data: existingItems } = await admin
          .from('order_items')
          .select('order_id')
          .eq('listing_id', listingId)
          .limit(1);

        if (existingItems && existingItems.length > 0) {
          return NextResponse.json({ ok: true, order_id: existingItems[0].order_id, idempotent: true });
        }
        // Sold but no order yet (race condition in progress), return success/processing
        return NextResponse.json({ ok: true, settled: true, status: 'processing_settlement' });
      }

      try {
        const plan = await getPlan(admin, sellerId);
        const commissions = await getCommissions(admin);
        const percent = plan === 'basic' ? commissions.basic : plan === 'pro' ? commissions.pro : commissions.platinum;
        let commissionFee = Math.round((highestBid * percent) / 100 * 100) / 100;
        const minCommission = Math.round(percent * 100) / 100;
        if (commissionFee < minCommission) {
          commissionFee = minCommission;
        }

        // --- Calcular envío usando calculadora centralizada ---
        const shippingInput = listingToShippingInput(r);
        const { data: settingsRow } = await admin
          .from('app_settings')
          .select('shipping_base, estafeta_config, auction_shipping_enabled')
          .eq('id', 1)
          .maybeSingle();

        // Kill switch: if auction shipping disabled, pause listing instead
        if ((settingsRow as any)?.auction_shipping_enabled === false) {
          console.warn(`[SETTLE-ONE] Auction shipping disabled. Pausing ${listingId}`);
          await admin.from('listings').update({ status: 'paused' }).eq('id', listingId);
          return NextResponse.json({ ok: false, error: 'Envíos de subastas desactivados' }, { status: 400 });
        }

        const shippingSettings = buildShippingSettings(settingsRow);
        const shippingResult = resolveAuctionShipping(shippingInput, shippingSettings);

        // Detect digital product for correct chip in buyer dashboard
        const isDigitalProduct = String(r.product_type || '').toLowerCase() === 'digital';

        console.log(`[SETTLE-ONE] Shipping result for ${listingId}:`, JSON.stringify(shippingResult), { isDigitalProduct });

        const order = await ordersRepo.create({
          buyer_id: winnerId,
          seller_id: sellerId,
          payment_method: 'bank_transfer',
          status: 'pending_payment',
          subtotal: highestBid,
          shipping_fee: shippingResult.shippingFee,
          commission_fee: commissionFee,
          total: highestBid + shippingResult.shippingFee,
          shipping_option_id: isDigitalProduct ? undefined : (shippingResult.shippingOptionId ?? undefined),
          shipping_carrier: isDigitalProduct ? 'digital' : (shippingResult.shippingCarrier ?? undefined),
          shipping_by_seller: shippingResult.shippingBySeller,
          shipping_subsidy: shippingResult.shippingSubsidy > 0 ? shippingResult.shippingSubsidy : undefined,
          order_source: 'auction',
          ...(isDigitalProduct ? { shipping_method: 'digital' } : {}),
        });
        orderId = order.id;

        await orderItemsRepo.createMany([
          {
            order_id: order.id,
            listing_id: listingId,
            title: title,
            unit_price: highestBid,
            quantity: 1,
            line_total: highestBid,
          },
        ]);

        // await admin.from('listings').update({ status: 'sold' }).eq('id', listingId); // ALREADY LOCKED
      } catch (err) {
        console.error(`[SETTLE-ONE] ❌ Failed to create order for ${listingId}:`, err);

        // Revert lock so it can be retried
        await admin.from('listings').update({ status: 'active' }).eq('id', listingId);

        // NO pausar — dejar como está para que el cron y client-side reintenten.
        // Solo dar up después de 7 días.
        const endedAt = new Date(r.auction_end_at).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - endedAt > sevenDaysMs) {
          await admin.from('listings').update({ status: 'paused' }).eq('id', listingId);
        }
        return NextResponse.json({ ok: false, retry: true, error: 'order_creation_failed', detail: String((err as any)?.message || err) }, { status: 500 });
      }
    } else if (!winnerId) {
      // Atomic lock for pause
      const { data: lockedPaused } = await admin.from('listings').update({ status: 'paused' }).eq('id', listingId).neq('status', 'paused').select('id');
      if (!lockedPaused?.length) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'already_paused' });
      }
    }

    if (sellerId) {
      const body = winnerId
        ? `Tu subasta terminó con ganador. Se creó una nueva venta por ${highestBid} (estado: pendiente de pago).`
        : 'Tu subasta terminó sin pujas.';
      await notify(admin, {
        user_id: sellerId,
        type: 'auction_ended',
        title: 'Tu subasta terminó',
        body,
        data,
        is_read: false,
      });
    }

    if (winnerId) {
      await notify(admin, {
        user_id: winnerId,
        type: 'auction_won',
        title: '¡Ganaste una subasta!',
        body: `Ganaste la subasta: ${title}. Ve a "Mis Compras" para completar el pago.`,
        data: { ...data, kind: 'auction_won', orderId: orderId || null },
        is_read: false,
      });

      try {
        const bidsRes: any = await admin.from('bids').select('bidder_id').eq('listing_id', listingId);
        if (!bidsRes?.error && Array.isArray(bidsRes?.data)) {
          const bidderIds = Array.from(
            new Set(
              (bidsRes.data as any[]).map((b: any) => String(b?.bidder_id ?? '').trim()).filter(Boolean),
            ),
          );
          for (const bidderId of bidderIds) {
            if (!bidderId || bidderId === winnerId || bidderId === sellerId) continue;
            await notify(admin, {
              user_id: bidderId,
              type: 'auction_ended',
              title: 'Subasta finalizada',
              body: `La subasta "${title}" terminó. No fuiste el ganador.`,
              data: { ...data, kind: 'auction_ended' },
              is_read: false,
            });
          }
        }
      } catch (err) {
        console.error(`[SETTLE-ONE] Error notifying losers for ${listingId}:`, err);
      }
    }

    return NextResponse.json({ ok: true, settled: true, order_id: orderId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unexpected_error' },
      { status: 500 },
    );
  }
}
