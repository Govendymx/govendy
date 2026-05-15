import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyPaymentApprovedBuyer, notifyPaymentApprovedSellers } from '@/lib/email/notify';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId: userId } = await requireAuth(req);
    const body = await req.json();
    const { orderIds } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'No orderIds provided' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Obtener órdenes y validar que pertenezcan al usuario
    const { data: orders, error: ordersError } = await admin
      .from('orders')
      .select('id, total, status')
      .in('id', orderIds)
      .eq('buyer_id', userId);

    if (ordersError || !orders) {
      console.error('[Wallet Pay] Error buscando órdenes:', ordersError);
      return NextResponse.json({ error: 'Error consultando órdenes.' }, { status: 500 });
    }

    if (orders.length !== orderIds.length) {
      return NextResponse.json({ error: 'No se encontraron todas las órdenes solicitadas.' }, { status: 400 });
    }

    // Filtrar órdenes que requieren pago
    const ordersToPay: Array<{ id: string; total: number; status: string }> = [];
    for (const order of orders) {
      if (order.status === 'paid' || order.status === 'approved') {
        // Ya pagada, ignorar (idempotencia)
        continue;
      }
      if (order.status === 'pending' || order.status === 'pending_payment') {
        ordersToPay.push({ id: order.id, total: Number(order.total), status: order.status });
        continue;
      }
      // Si está cancelada u otro estado inválido
      return NextResponse.json({ error: `La orden #${order.id.slice(0, 8)} no es válida para pago (Estado: ${order.status}).` }, { status: 400 });
    }

    // Si no hay nada que pagar (todas ya estaban pagadas)
    if (ordersToPay.length === 0) {
      return NextResponse.json({
        ok: true,
        success: true,
        message: 'Órdenes ya pagadas previamente.'
      });
    }

    // 2. Verificar si ya existe una transacción de débito previa por cada orden (idempotencia fuerte)
    const adminForCheck = supabaseAdmin();
    const alreadyDebitedIds: string[] = [];
    for (const o of ordersToPay) {
      const { data: existingDebit } = await adminForCheck
        .from('wallet_transactions')
        .select('id')
        .eq('wallet_id', userId)
        .eq('type', 'debit')
        .eq('reference_type', 'order')
        .eq('reference_id', o.id)
        .maybeSingle();
      if (existingDebit) {
        alreadyDebitedIds.push(o.id);
      }
    }

    const toCharge = ordersToPay.filter(o => !alreadyDebitedIds.includes(o.id));
    const toOnlyMarkPaid = ordersToPay.filter(o => alreadyDebitedIds.includes(o.id));

    // 2b. Calcular total a pagar (solo las no debitadas)
    const totalAmountToCharge = toCharge.reduce((sum, order) => sum + Number(order.total), 0);

    if (totalAmountToCharge <= 0 && toOnlyMarkPaid.length === 0) {
      // Puede pasar si las órdenes tienen total 0? Si es así, se marcan pagadas directo.
      // Pero por seguridad validamos > 0 para uso de wallet.
      // Si total es 0, deberíamos solo actualizar estado? 
      // Asumiremos que si llegan aquí deben pagarse.
    }

    // 3. Ejecutar pago atómico (deducir wallet) solo para las órdenes no debitadas previamente
    // Usamos el servicio centralizado que maneja la lógica de saldo y transacciones
    let newBalance = 0;
    try {
      if (toCharge.length > 0) {
        newBalance = await WalletService.payOrdersBatch(
          userId,
          toCharge.map(o => ({ id: o.id, amount: Number(o.total) }))
        );
      } else {
        const w = await WalletService.getOrCreateWallet(userId);
        newBalance = Number(w.balance) || 0;
      }
    } catch (err: any) {
      // Fallback: deducir una por una de forma segura e idempotente
      console.warn('[Wallet Pay] payOrdersBatch falló, usando fallback por orden:', err?.message || err);
      for (const o of toCharge) {
        // Evitar doble débito si otra instancia lo hizo
        const { data: exists } = await adminForCheck
          .from('wallet_transactions')
          .select('id')
          .eq('wallet_id', userId)
          .eq('type', 'debit')
          .eq('reference_type', 'order')
          .eq('reference_id', o.id)
          .maybeSingle();
        if (!exists) {
          await WalletService.deductFunds(
            userId,
            Number(o.total),
            `Pago de orden #${o.id.slice(0, 8)}`,
            'order',
            o.id
          );
        }
      }
      const w = await WalletService.getOrCreateWallet(userId);
      newBalance = Number(w.balance) || 0;
    }

    const result = { new_balance: newBalance };

    const decrementStockForOrders = async (orderIdsToProcess: string[]) => {
      const { data: orderItems, error: itemsError } = await admin
        .from('order_items')
        .select('listing_id, quantity, selected_size, title')
        .in('order_id', orderIdsToProcess);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const failed: Array<{ listing_id: string; title?: string | null; quantity: number; selected_size?: string | null; message: string }> = [];

      for (const item of (orderItems as any[]) ?? []) {
        const listingId = String(item?.listing_id ?? '').trim();
        const quantity = Number(item?.quantity ?? 0);
        const selectedSize = typeof item?.selected_size === 'string' ? String(item.selected_size).trim() : null;
        const title = typeof item?.title === 'string' ? String(item.title).trim() : null;

        if (!listingId || !Number.isFinite(quantity) || quantity <= 0) continue;

        let rpc: any = await admin.rpc('decrement_stock', {
          p_listing_id: listingId,
          p_quantity: quantity,
          p_size: selectedSize || null,
        });

        if (rpc?.error) {
          const code = String((rpc.error as any)?.code ?? '');
          const msg = String((rpc.error as any)?.message ?? '').toLowerCase();
          const maybeSignatureMismatch =
            code === '42883' || msg.includes('p_size') || msg.includes('decrement_stock(') || msg.includes('function');
          if (maybeSignatureMismatch) {
            rpc = await admin.rpc('decrement_stock', {
              p_listing_id: listingId,
              p_quantity: quantity,
            });
          }
        }

        if (rpc?.error) {
          failed.push({
            listing_id: listingId,
            title,
            quantity,
            selected_size: selectedSize,
            message: String((rpc.error as any)?.message ?? 'Error actualizando stock'),
          });
          continue;
        }

        const result = rpc?.data as any;
        if (!result?.success) {
          failed.push({
            listing_id: listingId,
            title,
            quantity,
            selected_size: selectedSize,
            message: String(result?.message ?? 'Stock insuficiente'),
          });
        }
      }

      if (failed.length > 0) {
        const first = failed[0];
        const base = first?.title ? `"${first.title}"` : 'un artículo';
        const sizeTxt = first?.selected_size ? ` (Talla: ${first.selected_size})` : '';
        throw new Error(`Stock insuficiente para ${base}${sizeTxt}. Se reembolsó tu PocketCash automáticamente.`);
      }
    };

    const refundOrders = async () => {
      for (const o of ordersToPay) {
        const total = Number(o.total) || 0;
        if (total <= 0) continue;
        await WalletService.addFunds(
          userId,
          total,
          `Reembolso automático por stock insuficiente (orden #${o.id.slice(0, 8)})`,
          'refund',
          o.id,
        );
      }
      await admin.from('orders').update({ status: 'cancelled' } as any).in('id', ordersToPay.map((o) => o.id));
    };

    // 4. Marcar órdenes como pagadas de forma robusta
    const idsToPay = ordersToPay.map((o) => o.id);

    try {
      await decrementStockForOrders(idsToPay);
    } catch (e: any) {
      await refundOrders();
      return NextResponse.json(
        { error: typeof e?.message === 'string' && e.message.trim().length > 0 ? e.message : 'Stock insuficiente. Se reembolsó tu PocketCash.' },
        { status: 409 },
      );
    }

    // Intento con payment_status (puede no existir en la tabla)
    let updateSucceeded = false;
    const bulkUpdate = await admin.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_method: 'pocketcash',
      paid_at: new Date().toISOString(),
    }).in('id', idsToPay);

    if (bulkUpdate.error) {
      const errMsg = String(bulkUpdate.error.message || '').toLowerCase();
      console.warn('[Wallet Pay] Bulk update with payment_status failed:', bulkUpdate.error.message);

      // Si falla por columna inexistente, reintentar sin payment_status
      if (errMsg.includes('column') || errMsg.includes('payment_status') || errMsg.includes('does not exist') || String(bulkUpdate.error.code) === '42703') {
        console.log('[Wallet Pay] Retrying without payment_status column...');
        const retryUpdate = await admin.from('orders').update({
          status: 'paid',
          payment_method: 'pocketcash',
          paid_at: new Date().toISOString(),
        }).in('id', idsToPay);

        if (retryUpdate.error) {
          console.error('[Wallet Pay] Retry update also failed:', retryUpdate.error.message);
          // Fallback individual
          for (const id of idsToPay) {
            const up = await admin.from('orders').update({
              status: 'paid',
              payment_method: 'pocketcash',
              paid_at: new Date().toISOString(),
            }).eq('id', id);
            if (up.error) {
              console.error(`[Wallet Pay] Individual update failed for ${id}:`, up.error);
            } else {
              updateSucceeded = true;
            }
          }
        } else {
          updateSucceeded = true;
        }
      } else {
        // Error no relacionado con columna — fallback individual
        for (const id of idsToPay) {
          const up = await admin.from('orders').update({
            status: 'paid',
            payment_method: 'pocketcash',
            paid_at: new Date().toISOString(),
          }).eq('id', id);
          if (up.error) {
            console.error(`[Wallet Pay] Individual update failed for ${id}:`, up.error);
          } else {
            updateSucceeded = true;
          }
        }
      }
    } else {
      updateSucceeded = true;
    }

    // Verificación final: asegurar que todas quedaron en 'paid'
    const { data: verifyRows, error: verifyErr } = await admin
      .from('orders')
      .select('id, status')
      .in('id', idsToPay);
    if (verifyErr) {
      console.error('[Wallet Pay] Verify query failed:', verifyErr);
    } else {
      const notPaid = (verifyRows || []).filter((r: any) => String(r.status) !== 'paid').map((r: any) => r.id);
      if (notPaid.length > 0) {
        console.error('[Wallet Pay] Orders deducted but not marked paid:', notPaid);
      }
    }

    // 5. Notificar a todos (Paneles y Email)
    // Notificar al comprador (Panel)
    await admin.from('notifications').insert({
      user_id: userId,
      type: 'payment_approved',
      title: '¡Pago exitoso con PocketCash!',
      body: `Tu pago de $${(toOnlyMarkPaid.reduce((s, o) => s + Number(o.total), 0) + totalAmountToCharge).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} ha sido procesado correctamente.`,
      data: { kind: 'payment_approved', orderIds },
      link_to: '/dashboard/compras'
    });

    // Enviar emails (async, no bloqueamos respuesta)
    // Usamos Promise.allSettled para que no falle el request si falla el email
    await Promise.allSettled([
      notifyPaymentApprovedBuyer({ buyerId: userId, orderIds, total: toOnlyMarkPaid.reduce((s, o) => s + Number(o.total), 0) + totalAmountToCharge }),
      notifyPaymentApprovedSellers({ admin, orderIds })
    ]);

    // 6. Crear sesión de checkout para registro (opcional pero recomendado para consistencia)
    // Esto ayuda a que aparezca en "Mis Compras" con un ID de checkout unificado si se usa esa lógica
    await admin.from('checkout_sessions').insert({
      buyer_id: userId,
      order_ids: orderIds,
      payment_method: 'pocketcash',
      status: 'paid',
      amount: toOnlyMarkPaid.reduce((s, o) => s + Number(o.total), 0) + totalAmountToCharge,
      approved_at: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      new_balance: result.new_balance,
      message: 'Pago realizado con éxito'
    });

  } catch (error: any) {
    console.error('Wallet Pay Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
