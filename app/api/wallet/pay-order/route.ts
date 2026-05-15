import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Support single orderId or array of orderIds
    let orderIds: string[] = [];
    if (body.orderIds && Array.isArray(body.orderIds)) {
      orderIds = body.orderIds.map((id: any) => String(id).trim()).filter(Boolean);
    } else if (body.orderId) {
      orderIds = [String(body.orderId).trim()];
    }

    if (orderIds.length === 0) return NextResponse.json({ error: 'orderIds is required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const userId = userData.user.id;

    // 1. Obtener órdenes
    const { data: orders, error: orderErr } = await admin
      .from('orders')
      .select('id, buyer_id, total, status, payment_method')
      .in('id', orderIds);

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 });
    if (!orders || orders.length !== orderIds.length) return NextResponse.json({ error: 'No se encontraron todas las órdenes' }, { status: 404 });

    // Validar propiedad y estado
    const blockedStatuses = ['paid', 'completed', 'shipped', 'delivered', 'cancelled', 'canceled', 'refunded', 'disputed'];
    let totalAmount = 0;

    for (const order of orders) {
      if (order.buyer_id !== userId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      if (blockedStatuses.includes(order.status)) {
        return NextResponse.json({ error: `La orden ${order.id.slice(0, 8)} ya está en estado ${order.status}` }, { status: 400 });
      }
      const t = Number(order.total) || 0;
      if (t <= 0) return NextResponse.json({ error: `El total de la orden ${order.id.slice(0, 8)} es inválido` }, { status: 400 });
      totalAmount += t;
    }

    // 2. Verificar saldo
    const wallet = await WalletService.getOrCreateWallet(userId);
    const balance = Number(wallet.balance) || 0;

    if (balance < totalAmount) {
      return NextResponse.json({
        error: `Saldo insuficiente. Tienes $${balance.toFixed(2)} pero el total es $${totalAmount.toFixed(2)}`
      }, { status: 400 });
    }

    // 3. Procesar pago (iterar para registrar transacción por orden)
    for (const order of orders) {
      const amount = Number(order.total) || 0;

      // a) Si ya existe un débito asociado a esta orden, no descontar de nuevo (idempotencia fuerte)
      const { data: existingDebit } = await admin
        .from('wallet_transactions')
        .select('id')
        .eq('wallet_id', userId)
        .eq('type', 'debit')
        .eq('reference_type', 'order')
        .eq('reference_id', order.id)
        .maybeSingle();
      const alreadyDebited = Boolean(existingDebit);

      // b) Actualizar método de pago si es diferente
      if (order.payment_method !== 'pocketcash') {
        await admin.from('orders').update({ payment_method: 'pocketcash' }).eq('id', order.id);
      }

      // c) Descontar saldo solo si no se ha debitado antes
      if (!alreadyDebited) {
        await WalletService.deductFunds(
          userId,
          amount,
          `Pago de orden #${order.id.slice(0, 8)}`,
          'order',
          order.id
        );
      }

      const refundOrder = async () => {
        if (!alreadyDebited) {
          await WalletService.addFunds(
            userId,
            amount,
            `Reembolso automático por stock insuficiente (orden #${order.id.slice(0, 8)})`,
            'refund',
            order.id,
          );
        }
        await admin.from('orders').update({ status: 'cancelled' } as any).eq('id', order.id);
      };

      const decrementStockForOrder = async () => {
        const { data: items, error: itemsError } = await admin
          .from('order_items')
          .select('listing_id, quantity, selected_size, title')
          .eq('order_id', order.id);
        if (itemsError) throw new Error(itemsError.message);

        const failed: Array<{ title?: string | null; quantity: number; selected_size?: string | null; message: string }> = [];

        for (const item of (items as any[]) ?? []) {
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

      try {
        await decrementStockForOrder();
      } catch (stockErr: any) {
        await refundOrder();
        return NextResponse.json(
          { error: typeof stockErr?.message === 'string' ? stockErr.message : 'Stock insuficiente. Se reembolsó tu PocketCash automáticamente.' },
          { status: 409 },
        );
      }

      // d) Marcar como pagada (robusto ante columna payment_status inexistente)
      const paidUpdate = await admin
        .from('orders')
        .update({
          status: 'paid',
          payment_status: 'paid',
          payment_method: 'pocketcash',
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (paidUpdate.error) {
        const errMsg = String(paidUpdate.error.message || '').toLowerCase();
        if (errMsg.includes('column') || errMsg.includes('payment_status') || errMsg.includes('does not exist') || String(paidUpdate.error.code) === '42703') {
          // Reintentar sin payment_status
          const retry = await admin.from('orders').update({
            status: 'paid',
            payment_method: 'pocketcash',
            paid_at: new Date().toISOString(),
          }).eq('id', order.id);
          if (retry.error) {
            console.error('[PAY-ORDER] Retry without payment_status also failed:', retry.error);
          }
        } else {
          console.error('[PAY-ORDER] Error updating order status after deduction:', paidUpdate.error);
        }
        // Continuamos con las siguientes
      }
    }

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error('[PAY-ORDER] Error:', e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
