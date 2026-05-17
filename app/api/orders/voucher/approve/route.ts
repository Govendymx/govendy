import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Obtener los detalles de la orden
    const { data: order, error: fetchError } = await admin
      .from('orders')
      .select('id, seller_id, commission_fee, shipping_fee, shipping_subsidy, shipping_by_seller, shipping_option_id, shipping_carrier, isr_withheld, iva_withheld, status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      throw new Error(fetchError?.message || 'Orden no encontrada');
    }

    if (order.status !== 'awaiting_voucher' && order.status !== 'verifying_payment') {
      return NextResponse.json({ error: 'La orden no está pendiente de comprobante' }, { status: 400 });
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

    // 3. Deducir comisión y costos de la plataforma al vendedor
    // Dado que el vendedor cobró el total directo del comprador (P2P), la plataforma debe cobrarle:
    // Comisión + Envío GoVendy (si aplica) + Retenciones (si aplica).
    const isPickup = order.shipping_option_id === 'pickup' || order.shipping_carrier === 'pickup';
    const isSellerManaged = order.shipping_by_seller === true && !isPickup;

    const commission = Number(order.commission_fee) || 0;
    const subsidy = Number(order.shipping_subsidy) || 0;
    const isr = Number(order.isr_withheld) || 0;
    const iva = Number(order.iva_withheld) || 0;
    const shippingFee = Number(order.shipping_fee) || 0;

    // Si es envío gestionado por GoVendy, el vendedor debe pagar el shipping_fee a la plataforma.
    const platformShippingCost = (isSellerManaged || isPickup) ? 0 : shippingFee;

    const totalDeduction = commission + subsidy + platformShippingCost + isr + iva;

    if (totalDeduction > 0) {
      await WalletService.addFunds(
        order.seller_id,
        -totalDeduction,
        `Cobro de comisión y servicios por venta directa (Orden #${order.id.slice(0, 8)})`,
        'order',
        order.id
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
