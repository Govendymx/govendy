import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabase as supabaseClient } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Obtener los detalles de la orden (incluyendo payment_method_type para P2P)
    const { data: order, error: fetchError } = await admin
      .from('orders')
      .select('id, seller_id, buyer_id, commission_fee, shipping_fee, shipping_subsidy, shipping_by_seller, shipping_option_id, shipping_carrier, isr_withheld, iva_withheld, status, payment_method_type')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      throw new Error(fetchError?.message || 'Orden no encontrada');
    }

    // Aceptar órdenes en cualquier estado pendiente de pago P2P
    const validStatuses = ['awaiting_voucher', 'verifying_payment', 'pending_payment'];
    if (!validStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: `La orden tiene un estado inválido para aprobación: ${order.status}` },
        { status: 400 }
      );
    }

    // 2. Marcar la orden como pagada
    const { error: updateError } = await admin
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 3. Deducir comisión y costos de la plataforma al vendedor.
    // Para ventas P2P, el vendedor cobró el total directamente. La plataforma le cobra:
    //   - commission_fee (almacenado en la orden al momento de la compra, según plan del vendedor)
    //   - shipping_subsidy (si GoVendy pagó el envío)
    //   - isr_withheld / iva_withheld (retenciones fiscales si aplica)
    const isPickup = order.shipping_option_id === 'pickup' || order.shipping_carrier === 'pickup';
    const isSellerManaged = order.shipping_by_seller === true && !isPickup;

    // Usar la comisión REAL guardada en la orden (calculada desde app_settings al momento de la compra)
    const commission = Number(order.commission_fee) || 0;
    const subsidy = Number(order.shipping_subsidy) || 0;
    const isr = Number(order.isr_withheld) || 0;
    const iva = Number(order.iva_withheld) || 0;

    // Si GoVendy gestionó el envío, el shipping_fee va a GoVendy (el vendedor lo cobra del comprador pero se lo debe a la plataforma)
    const shippingFee = Number(order.shipping_fee) || 0;
    const platformShippingCost = (isSellerManaged || isPickup) ? 0 : shippingFee;

    const totalDeduction = commission + subsidy + platformShippingCost + isr + iva;

    if (totalDeduction > 0 && order.seller_id) {
      try {
        // Upsert robusto: crear wallet si no existe, luego descontar
        const { data: existingWallet } = await admin
          .from('wallets')
          .select('id, balance')
          .eq('user_id', order.seller_id)
          .maybeSingle();

        if (!existingWallet) {
          // Crear wallet con balance negativo (deuda con la plataforma)
          await admin.from('wallets').insert({
            user_id: order.seller_id,
            balance: -totalDeduction,
          });
        } else {
          const newBalance = Number(existingWallet.balance) - totalDeduction;
          await admin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', order.seller_id);
        }

        // Registrar la transacción de débito
        const walletId = existingWallet?.id ?? null;
        await admin.from('wallet_transactions').insert({
          wallet_id: walletId ?? order.seller_id, // fallback al user_id si no hay wallet_id
          type: 'debit',
          amount: totalDeduction,
          concept: `Comisión GoVendy por Venta Directa (Orden #${order.id.slice(0, 8)})`,
          reference_type: 'order',
          reference_id: order.id,
        });
      } catch (walletErr: any) {
        // No bloquear la aprobación si el wallet falla — la orden ya se marcó como pagada
        console.error('[APPROVE] Error al registrar deducción en wallet:', walletErr?.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[APPROVE] Error al aprobar pago:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
