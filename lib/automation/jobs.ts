import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendUnifiedNotification } from '@/lib/notifications/unified';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { getCommissions, getPlan } from '@/lib/plans/limits';
import { resolveAuctionShipping, listingToShippingInput, buildShippingSettings } from '@/lib/shipping/shipping-calculator';

/**
 * Ejecuta jobs automáticos periódicos
 * Llamar desde un cron job o Vercel Cron
 */
export async function runAutomatedJobs(): Promise<{
  ok: boolean;
  results: Record<string, { ok: boolean; count?: number; error?: string }>;
}> {
  const admin = supabaseAdmin();
  const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};

  try {
    // 1. Verificar suspensiones expiradas
    results.checkExpiredSuspensions = await checkExpiredSuspensions(admin);

    // 2. Limpiar sesiones de checkout expiradas
    results.cleanupExpiredCheckouts = await cleanupExpiredCheckouts(admin);

    // 3. Enviar recordatorios de pagos pendientes
    results.sendPaymentReminders = await sendPaymentReminders(admin);

    // 4. Actualizar estados de órdenes (shipped -> delivered después de X días)
    results.updateOrderStatuses = await updateOrderStatuses(admin);

    // 5. Verificar entregas Estafeta (API Check)
    results.checkEstafetaDeliveries = await checkEstafetaDeliveries(admin);

    // 6. Auto-completar órdenes entregadas hace 48h sin confirmar
    results.autoCompleteDeliveredOrders = await autoCompleteDeliveredOrders(admin);

    // 7. Limpiar logs antiguos
    results.cleanupOldLogs = await cleanupOldLogs(admin);

    // 8. Finalizar subastas vencidas (Crear órdenes automáticamente)
    results.settleEndedAuctions = await settleEndedAuctions(admin);

    // 9. Abrir disputas automáticas para subastas no cumplidas tras 7 días
    results.autoOpenAuctionDisputes = await autoOpenAuctionDisputes(admin);

    return { ok: true, results };
  } catch (e) {
    console.error('[AUTOMATION JOBS] Error ejecutando jobs:', e);
    return {
      ok: false,
      results: {
        general: { ok: false, error: e instanceof Error ? e.message : 'Unknown error' },
      },
    };
  }
}

async function checkExpiredSuspensions(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const now = new Date().toISOString();

    const { data: expired, error } = await admin
      .from('user_admin_states')
      .select('user_id')
      .eq('status', 'suspended')
      .lte('suspended_until', now);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!expired || expired.length === 0) {
      return { ok: true, count: 0 };
    }

    let reactivated = 0;
    for (const user of expired) {
      const { error: updateError } = await admin
        .from('user_admin_states')
        .update({ status: 'active', suspended_until: null })
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error(`[AUTOMATION] Error reactivando usuario ${user.user_id}:`, updateError);
        continue;
      }

      // Reactivar publicaciones pausadas sin modificar vigencia por tiempo
      await admin
        .from('listings')
        .update({
          status: 'active',
        })
        .eq('seller_id', user.user_id)
        .eq('status', 'paused');

      // Notificar al usuario
      await sendUnifiedNotification(admin, {
        userId: user.user_id,
        type: 'user_reactivated',
        title: 'Cuenta Reactivada',
        body: 'Tu suspensión ha expirado y tu cuenta ha sido reactivada.',
        channels: ['both'],
      });

      reactivated++;
    }

    return { ok: true, count: reactivated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function cleanupExpiredCheckouts(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Cancelar sesiones pendientes de más de 7 días
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expired, error } = await admin
      .from('checkout_sessions')
      .select('id')
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!expired || expired.length === 0) {
      return { ok: true, count: 0 };
    }

    const { data: cancelled, error: cancelError } = await admin
      .from('checkout_sessions')
      .update({ status: 'cancelled' })
      .in(
        'id',
        expired.map((e) => e.id),
      )
      .select('id');

    if (cancelError) {
      return { ok: false, error: cancelError.message };
    }

    return { ok: true, count: cancelled?.length || 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function sendPaymentReminders(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Enviar recordatorios para pagos offline pendientes de más de 2 días
    // Dedup: sólo incluir sesiones cuyo updated_at sea > 24h (tocamos updated_at al enviar)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingPayments, error } = await admin
      .from('checkout_sessions')
      .select('id, buyer_id, amount, reference_code, payment_method')
      .eq('status', 'pending')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
      .lt('created_at', twoDaysAgo)
      .lt('updated_at', twentyFourHoursAgo); // ← Only if not updated in last 24h

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      return { ok: true, count: 0 };
    }

    let notified = 0;
    for (const payment of pendingPayments) {
      if (!payment.buyer_id) continue;

      await sendUnifiedNotification(admin, {
        userId: payment.buyer_id,
        type: 'payment_reminder',
        title: '⏰ Recordatorio de Pago Pendiente',
        body: `Tienes un pago pendiente de ${Number(payment.amount || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. ${payment.reference_code ? `Referencia: ${payment.reference_code}` : ''}`,
        channels: ['both'],
        linkTo: '/dashboard/pagos',
        priority: 'medium',
      });

      // Touch updated_at to mark that we sent a reminder (prevents re-sending for 24h)
      await admin
        .from('checkout_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', payment.id);

      notified++;
    }

    return { ok: true, count: notified };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function updateOrderStatuses(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Marcar como entregadas las órdenes enviadas hace más de 14 días
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: shippedOrders, error } = await admin
      .from('orders')
      .select('id')
      .eq('status', 'shipped')
      .lt('shipped_at', fourteenDaysAgo);

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!shippedOrders || shippedOrders.length === 0) {
      return { ok: true, count: 0 };
    }

    const { data: updated, error: updateError } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .in(
        'id',
        shippedOrders.map((o) => o.id),
      )
      .select('id');

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Process Cashback for auto-delivered orders
    if (updated && updated.length > 0) {
      for (const ord of updated) {
        try {
          await WalletService.processOrderCashback(ord.id);
        } catch (cbErr) {
          console.error(`[AUTOMATION] Error processing cashback for order ${ord.id}:`, cbErr);
        }
      }
    }

    return { ok: true, count: updated?.length || 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function cleanupOldLogs(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Eliminar logs de más de 90 días
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Limpiar payment_logs antiguos
    const { data: deletedPayments, error: paymentError } = await admin
      .from('payment_logs')
      .delete()
      .lt('created_at', ninetyDaysAgo)
      .select('id');

    if (paymentError) {
      console.error('[AUTOMATION] Error limpiando payment_logs:', paymentError);
    }

    // Limpiar admin_action_logs antiguos (mantener más tiempo, 180 días)
    const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const { data: deletedActions, error: actionError } = await admin
      .from('admin_action_logs')
      .delete()
      .lt('created_at', oneEightyDaysAgo)
      .select('id');

    if (actionError) {
      console.error('[AUTOMATION] Error limpiando admin_action_logs:', actionError);
    }

    const totalDeleted = (deletedPayments?.length || 0) + (deletedActions?.length || 0);

    return { ok: true, count: totalDeleted };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function checkEstafetaDeliveries(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Buscar órdenes enviadas por Estafeta que aún no están entregadas
    const { data: orders, error } = await admin
      .from('orders')
      .select('id, tracking_number, seller_id, buyer_id')
      .eq('status', 'shipped')
      .eq('shipping_carrier', 'Estafeta')
      .not('tracking_number', 'is', null);

    if (error) return { ok: false, error: error.message };
    if (!orders || orders.length === 0) return { ok: true, count: 0 };

    let updatedCount = 0;
    const { checkEstafetaTracking } = await import('@/lib/integration/tracking/estafeta');

    for (const order of orders) {
      if (!order.tracking_number) continue;

      try {
        const tracking = await checkEstafetaTracking(order.tracking_number);

        if (tracking && tracking.status === 'delivered') {
          // Marcar como entregado
          const { error: updateError } = await admin
            .from('orders')
            .update({
              status: 'delivered',
              delivered_at: tracking.timestamp || new Date().toISOString()
            })
            .eq('id', order.id);

          if (!updateError) {
            updatedCount++;

            // Notificar al vendedor
            if (order.seller_id) {
              await sendUnifiedNotification(admin, {
                userId: order.seller_id,
                type: 'order_delivered',
                title: '✅ Paquete Entregado',
                body: 'El paquete ha sido entregado. El comprador tiene 48 horas para confirmar o se liberará el dinero automáticamente.',
                linkTo: `/dashboard/ventas?order=${order.id}`,
                channels: ['both'], // Push & Email
                data: { orderId: order.id }
              });
            }

            // Notificar al comprador
            if (order.buyer_id) {
              await sendUnifiedNotification(admin, {
                userId: order.buyer_id,
                type: 'order_delivered',
                title: '📦 Paquete Entregado',
                body: 'Tu paquete ha llegado. Por favor confirma la recepción y califica al vendedor. Tienes 48 horas.',
                linkTo: `/dashboard/compras?order=${order.id}`,
                channels: ['both'],
                data: { orderId: order.id }
              });
            }
          }
        }
      } catch (err) {
        console.error(`[AUTOMATION] Error checking tracking for order ${order.id}:`, err);
      }
    }

    return { ok: true, count: updatedCount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function autoCompleteDeliveredOrders(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Buscar órdenes entregadas hace más de 48 horas que NO han sido pagadas al vendedor
    // Nota: 'paid_to_seller_at' es el indicador de liberación de fondos
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await admin
      .from('orders')
      .select('id, seller_id, buyer_id')
      .eq('status', 'delivered')
      .lt('delivered_at', fortyEightHoursAgo)
      .is('paid_to_seller_at', null);

    if (error) return { ok: false, error: error.message };
    if (!orders || orders.length === 0) return { ok: true, count: 0 };

    let completedCount = 0;

    for (const order of orders) {
      try {
        const now = new Date().toISOString();

        // Liberar fondos
        const { error: updateError } = await admin
          .from('orders')
          .update({
            paid_to_seller_at: now,
            paid_to_seller_by: 'system_auto_complete' // Marca especial
          })
          .eq('id', order.id);

        if (!updateError) {
          completedCount++;

          // Procesar Cashback (si aplica)
          try {
            await WalletService.processOrderCashback(order.id);
          } catch (cbErr) {
            console.error(`[AUTOMATION] Error processing cashback for order ${order.id}:`, cbErr);
          }

          // Notificar al vendedor
          if (order.seller_id) {
            await sendUnifiedNotification(admin, {
              userId: order.seller_id,
              type: 'order_completed',
              title: '💰 Fondos Liberados Automáticamente',
              body: 'Han pasado 48h desde la entrega. Los fondos han sido liberados en tu cuenta.',
              linkTo: `/dashboard/ventas?order=${order.id}`,
              channels: ['both'],
              data: { orderId: order.id }
            });
          }
        }
      } catch (err) {
        console.error(`[AUTOMATION] Error auto-completing order ${order.id}:`, err);
      }
    }

    return { ok: true, count: completedCount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function settleEndedAuctions(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    console.log(`[AUCTION-SETTLE] Starting auction settlement check at ${nowIso}`);

    // 1. Buscar subastas vencidas que NO estén ya vendidas/pausadas
    // Intentar con retry en caso de error transitorio
    let rows: any[] | null = null;
    let queryError: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await admin
        .from('listings')
        .select('id, title, seller_id, status, sale_type, auction_end_at, auction_highest_bid, auction_highest_bidder_id, images, price, shipping_by_seller, shipping_price, free_shipping, allow_personal_delivery, shipping_subsidy, weight_kg, length_cm, width_cm, height_cm, product_type')
        .eq('sale_type', 'auction')
        .not('status', 'in', '(sold,paused)')
        .lte('auction_end_at', nowIso)
        .limit(100);

      if (!error) {
        rows = data;
        queryError = null;
        break;
      }

      queryError = error;
      console.error(`[AUCTION-SETTLE] Query attempt ${attempt + 1} failed:`, error.message);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (queryError) {
      console.error('[AUCTION-SETTLE] All query attempts failed:', queryError.message);
      return { ok: false, error: queryError.message };
    }

    if (!rows || rows.length === 0) {
      console.log('[AUCTION-SETTLE] No ended auctions to process');
      return { ok: true, count: 0 };
    }

    console.log(`[AUCTION-SETTLE] Found ${rows.length} ended auction(s) to process`);

    const { data: settingsRow } = await admin
      .from('app_settings')
      .select('shipping_base, shipping_markup_percent, shipping_markup_fixed, estafeta_config')
      .eq('id', 1)
      .maybeSingle();

    const shippingBase = Number((settingsRow as any)?.shipping_base ?? 175);
    const markupPct = Number((settingsRow as any)?.shipping_markup_percent ?? 0) || 0;
    const markupFixed = Number((settingsRow as any)?.shipping_markup_fixed ?? 0) || 0;

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

    const estafetaConfig = ((settingsRow as any)?.estafeta_config as any) || {
      enabled: true,
      weight_ranges: DEFAULT_WEIGHT_RANGES,
    };

    if (!estafetaConfig.weight_ranges || estafetaConfig.weight_ranges.length < 5) {
      estafetaConfig.weight_ranges = DEFAULT_WEIGHT_RANGES;
    }

    // Build centralized settings
    const shippingSettings = buildShippingSettings(settingsRow);

    // ⚠️ KILL SWITCH: If auction shipping is disabled, pause all ended auctions
    if ((settingsRow as any)?.auction_shipping_enabled === false) {
      console.warn('[AUCTION-SETTLE] Auction shipping disabled. Pausing all ended auctions.');
      const ids = rows.map((r: any) => r.id);
      await admin.from('listings').update({ status: 'paused' }).in('id', ids);
      return { ok: true, count: 0, error: `Paused ${ids.length} auctions (shipping disabled)` };
    }

    let settledCount = 0;

    // 2. Procesar cada subasta
    for (const r of rows) {
      const listingId = r.id;
      const title = r.title || 'Subasta';
      const sellerId = r.seller_id;
      const winnerId = r.auction_highest_bidder_id;
      const highestBid = Number(r.auction_highest_bid || 0);
      const data = { listingId, listing_id: listingId, highestBid: highestBid || null, winnerId: winnerId || null };

      // Verificar si ya existe orden (idempotencia) - PRE-CHECK (Optimization)
      const { data: existingItems } = await admin
        .from('order_items')
        .select('order_id')
        .eq('listing_id', listingId)
        .limit(1);

      const alreadyHasOrder = existingItems && existingItems.length > 0;

      if (winnerId && highestBid > 0 && !alreadyHasOrder) {
        // --- CASO A: HUBO GANADOR ---
        // INTENTO DE BLOQUEO ATÓMICO: Marcar como 'sold' ANTES de crear la orden
        // Esto evita condiciones de carrera donde dos procesos crean la orden simultáneamente.
        const { data: lockedListing } = await admin
          .from('listings')
          .update({ status: 'sold' })
          .eq('id', listingId)
          .neq('status', 'sold') // Solo si no está ya vendido
          .select('id');

        if (!lockedListing || lockedListing.length === 0) {
          console.log(`[AUCTION-SETTLE] Listing ${listingId} was just locked/sold by another process. Skipping.`);
          continue;
        }

        console.log(`[AUCTION-SETTLE] Processing auction ${listingId} — Winner: ${winnerId}, Bid: ${highestBid}`);
        try {
          // Calcular comisiones
          const plan = await getPlan(admin, sellerId);
          const commissionFee = plan === 'basic' ? 23 : 18;

          // Use centralized shipping calculator
          const shippingInput = listingToShippingInput(r);
          const shippingResult = resolveAuctionShipping(shippingInput, shippingSettings);

          // Detect digital product
          const isDigitalProduct = String(r.product_type || '').toLowerCase() === 'digital';

          console.log(`[AUCTION-SETTLE] Shipping for ${listingId}:`, JSON.stringify(shippingResult), { isDigitalProduct });

          const { data: order, error: orderError } = await admin.from('orders').insert({
            buyer_id: winnerId,
            seller_id: sellerId,
            payment_method: 'bank_transfer',
            status: 'pending_payment',
            subtotal: highestBid,
            shipping_fee: shippingResult.shippingFee,
            commission_fee: commissionFee,
            total: highestBid + shippingResult.shippingFee,
            shipping_option_id: isDigitalProduct ? null : shippingResult.shippingOptionId,
            shipping_carrier: isDigitalProduct ? 'digital' : shippingResult.shippingCarrier,
            shipping_by_seller: shippingResult.shippingBySeller,
            shipping_subsidy: shippingResult.shippingSubsidy > 0 ? shippingResult.shippingSubsidy : null,
            order_source: 'auction',
            ...(isDigitalProduct ? { shipping_method: 'digital' } : {}),
          }).select().single();

          if (orderError) throw orderError;
          console.log(`[AUCTION-SETTLE] Order created: ${order.id} for auction ${listingId}`);

          // Crear item
          const { error: itemError } = await admin.from('order_items').insert({
            order_id: order.id,
            listing_id: listingId,
            title: title,
            unit_price: highestBid,
            quantity: 1,
            line_total: highestBid,
            image_url: r.images?.[0] || null
          });

          if (itemError) throw itemError;

          // NOTA: Ya no marcamos como 'sold' aquí porque lo hicimos al principio (Lock)
          console.log(`[AUCTION-SETTLE] Listing ${listingId} successfully settled.`);

          // Notificar al Vendedor
          await sendUnifiedNotification(admin, {
            userId: sellerId,
            type: 'auction_ended',
            title: '¡Subasta Vendida!',
            body: `Tu subasta "${title}" terminó y se ha creado la orden por ${highestBid}. Esperando pago del ganador.`,
            linkTo: `/dashboard/ventas?order=${order.id}`,
            channels: ['both'],
            data
          });

          // Notificar al Ganador
          await sendUnifiedNotification(admin, {
            userId: winnerId,
            type: 'auction_won',
            title: '¡Ganaste la Subasta!',
            body: `Ganaste "${title}" con ${highestBid}. Se generó tu orden de compra. ¡Paga ahora!`,
            linkTo: `/dashboard/compras?order=${order.id}`,
            channels: ['both'],
            data: { ...data, kind: 'auction_won', orderId: order.id }
          });

        } catch (err) {
          console.error(`[AUCTION-SETTLE] ❌ CRITICAL: Failed to create order for auction ${listingId}:`, err);

          // REVERTIR LOCK: Si falló la creación de la orden, devolvemos el estado a 'active' (o pausado si es muy viejo)
          // para que se pueda reintentar.
          const endedAt = new Date(r.auction_end_at).getTime();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

          if (Date.now() - endedAt > sevenDaysMs) {
            console.error(`[AUCTION-SETTLE] Auction ${listingId} failed for 7+ days — giving up and pausing`);
            await admin.from('listings').update({ status: 'paused' }).eq('id', listingId);
          } else {
            console.log(`[AUCTION-SETTLE] Reverting lock for ${listingId} to retry next cycle`);
            await admin.from('listings').update({ status: 'active' }).eq('id', listingId);
          }
        }

      } else {
        // --- CASO B: SIN GANADOR O YA PROCESADA ---
        if (!winnerId) {
          console.log(`[AUCTION-SETTLE] Auction ${listingId} ended with no bids — pausing`);

          // ATOMIC LOCK para pausar
          const { data: lockedPaused } = await admin
            .from('listings')
            .update({ status: 'paused' })
            .eq('id', listingId)
            .neq('status', 'paused')
            .select('id');

          if (lockedPaused && lockedPaused.length > 0) {
            // Notificar Vendedor (sin pujas)
            await sendUnifiedNotification(admin, {
              userId: sellerId,
              type: 'auction_ended',
              title: 'Subasta Finalizada sin éxito',
              body: `Tu subasta "${title}" terminó sin pujas. Ha sido pausada.`,
              linkTo: `/dashboard/ventas?listing=${listingId}`,
              channels: ['both'],
              data
            });
          }
        } else if (alreadyHasOrder) {
          console.log(`[AUCTION-SETTLE] Auction ${listingId} already has order — ensuring sold status`);
          await admin.from('listings').update({ status: 'sold' }).eq('id', listingId);
        }
      }

      // Notificar a perdedores (si hubo ganador)
      if (winnerId) {
        try {
          const { data: bids } = await admin
            .from('bids')
            .select('bidder_id')
            .eq('listing_id', listingId);

          if (bids && bids.length > 0) {
            const bidderIds = [...new Set(bids.map((b) => b.bidder_id))];

            for (const bidderId of bidderIds) {
              if (bidderId === winnerId || bidderId === sellerId) continue;

              await sendUnifiedNotification(admin, {
                userId: bidderId,
                type: 'auction_ended',
                title: 'Subasta Finalizada',
                body: `La subasta "${title}" ha terminado. Ganó otro usuario con ${highestBid}.`,
                linkTo: `/listings/${listingId}`,
                channels: ['panel'],
                data: { ...data, kind: 'auction_ended' }
              });
            }
          }
        } catch (err) {
          console.error(`[AUTOMATION] Error notifying losers for auction ${listingId}:`, err);
        }
      }

      settledCount++;
    }

    return { ok: true, count: settledCount };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function autoOpenAuctionDisputes(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    // Buscar órdenes de subastas creadas hace más de 7 días
    // que estén pagadas (pending_shipment) pero NO enviadas/entregadas/completadas
    // "En caso de que no se cumpla la subasta en un lapso de 7 dias... se abrira una disputa"

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Paso 1: Obtener órdenes candidatas
    // Join con order_items -> listings para verificar sale_type = auction es costoso.
    // Mejor estrategia: Buscar items de subasta primero o asumir que tenemos flag.
    // Usaremos order_items para filtrar.

    const { data: auctionOrders, error } = await admin
      .from('orders')
      .select(`
        id, seller_id, buyer_id, status, created_at,
        order_items!inner(listing_id, title)
      `)
      .eq('status', 'pending_shipment') // Pagado pero no enviado
      .lt('created_at', sevenDaysAgo)
      .limit(50); // Límite por ejecución para no saturar

    if (error) return { ok: false, error: error.message };
    if (!auctionOrders || auctionOrders.length === 0) return { ok: true, count: 0 };

    let disputesOpened = 0;

    for (const order of auctionOrders) {
      // Verificar si es subasta realmente (via order_items -> listing)
      // Nota: order_items ya está filtrado por !inner si pudiéramos filtrar por listing.sale_type
      // pero Supabase a veces limita joins profundos. Verificamos manual.
      const listingId = order.order_items[0]?.listing_id;
      if (!listingId) continue;

      const { data: listing } = await admin
        .from('listings')
        .select('sale_type')
        .eq('id', listingId)
        .single();

      if (listing?.sale_type !== 'auction') continue;

      // Verificar si ya existe disputa
      const { data: existingDispute } = await admin
        .from('disputes')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (existingDispute) continue;

      // Crear Disputa Automática
      const { error: disputeError } = await admin.from('disputes').insert({
        order_id: order.id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        opened_by: order.buyer_id, // A nombre del comprador
        reason_code: 'item_not_received', // Código estándar
        reason_text: 'AUTOMÁTICO: Subasta no cumplida (no enviada) tras 7 días de finalizada.',
        status: 'open',
        last_message_at: new Date().toISOString(),
      });

      if (!disputeError) {
        disputesOpened++;

        // Notificar Vendedor (Alerta)
        await sendUnifiedNotification(admin, {
          userId: order.seller_id,
          type: 'dispute_opened',
          title: '⚠️ Disputa Automática Abierta',
          body: 'No has enviado el producto de la subasta en 7 días. Se ha abierto una disputa automáticamente.',
          linkTo: `/dashboard/ventas?order=${order.id}`,
          channels: ['both'],
          priority: 'high',
          data: { orderId: order.id }
        });

        // Notificar Comprador
        await sendUnifiedNotification(admin, {
          userId: order.buyer_id,
          type: 'dispute_opened',
          title: '🛡️ Disputa Abierta por Protección',
          body: 'El vendedor no envió el producto en 7 días. Hemos abierto una disputa para proteger tu dinero.',
          linkTo: `/dashboard/compras?order=${order.id}`,
          channels: ['both'],
          priority: 'high',
          data: { orderId: order.id }
        });
      } else {
        console.error(`[AUTOMATION] Error creating dispute for order ${order.id}:`, disputeError);
      }
    }

    return { ok: true, count: disputesOpened };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
