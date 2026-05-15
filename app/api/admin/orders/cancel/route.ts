import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { Order } from '@/lib/types/domain.types';
import { isAdminUser } from '@/lib/admin/isAdmin';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { cookie: cookieStore.toString() } },
      }
    );
    
    // 1. Validar Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const isUserAdmin = await isAdminUser(supabase, user.id);
    if (!isUserAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, cancelledBy, chargeCommissionTo, chargeShippingTo, reason } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
    }

    // 2. Obtener Orden
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !orderData) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const order = orderData as Order;

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'La orden ya está cancelada' }, { status: 400 });
    }

    // 3. Procesar Cargos (Comisión y Envío)
    // Nota: Usamos deductFunds. Si falla por falta de saldo, fallará toda la operación si no lo atrapamos.
    // Sin embargo, para admin, tal vez queramos permitir saldo negativo o forzarlo.
    // WalletService.deductFunds lanza error si no hay saldo.
    // Si queremos permitir que el admin cancele aunque el usuario no tenga saldo, deberíamos
    // modificar WalletService o usar una transacción manual que permita negativos, o
    // simplemente atrapar el error y avisar.
    // Asumiremos que si se eligió cobrar, se debe cobrar. Si falla, el admin debe saberlo.

    try {
      // Cobrar Comisión
      if (chargeCommissionTo === 'seller' && order.commission_fee > 0) {
        await WalletService.deductFunds(
          order.seller_id,
          order.commission_fee,
          `Comisión por cancelación de orden #${orderId.slice(0, 8)}`,
          'order',
          orderId
        );
      } else if (chargeCommissionTo === 'buyer' && order.commission_fee > 0) {
        await WalletService.deductFunds(
          order.buyer_id,
          order.commission_fee,
          `Comisión por cancelación de orden #${orderId.slice(0, 8)}`,
          'order',
          orderId
        );
      }

      // Cobrar Envío
      if (chargeShippingTo === 'seller' && order.shipping_fee > 0) {
        await WalletService.deductFunds(
          order.seller_id,
          order.shipping_fee,
          `Costo de envío por cancelación de orden #${orderId.slice(0, 8)}`,
          'order',
          orderId
        );
      } else if (chargeShippingTo === 'buyer' && order.shipping_fee > 0) {
        await WalletService.deductFunds(
          order.buyer_id,
          order.shipping_fee,
          `Costo de envío por cancelación de orden #${orderId.slice(0, 8)}`,
          'order',
          orderId
        );
      }
    } catch (err: any) {
      console.error('Error procesando cargos:', err);
      return NextResponse.json({ 
        error: `Error al procesar cargos a las partes: ${err.message}. La orden NO se canceló.` 
      }, { status: 400 });
    }

    // 4. Reembolsar al Comprador (Total pagado)
    // Asumimos que el comprador pagó el total (order.total).
    // Se reembolsa a su Wallet (PocketCash).
    try {
      if (order.total > 0) {
        await WalletService.addFunds(
          order.buyer_id,
          order.total,
          `Reembolso por cancelación de orden #${orderId.slice(0, 8)}`,
          'refund',
          orderId
        );
      }
    } catch (err: any) {
      console.error('Error procesando reembolso:', err);
      // Si falla el reembolso, es crítico. Pero los cargos anteriores ya pasaron.
      // Idealmente todo esto debería ser transaccional, pero con Supabase API REST es difícil.
      // Retornamos error pero avisamos.
      return NextResponse.json({ 
        error: `Error al reembolsar al comprador: ${err.message}. Los cargos pueden haberse aplicado.` 
      }, { status: 500 });
    }

    // 5. Actualizar Estado de Orden
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        // Podríamos guardar metadatos de cancelación si hubiera campos para ello,
        // pero por ahora solo cambiamos el estado.
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error actualizando orden:', updateError);
      return NextResponse.json({ error: 'Error actualizando estado de la orden' }, { status: 500 });
    }

    // 6. Notificar (Opcional, pero recomendado)
    // Aquí podríamos llamar a un servicio de notificaciones si existiera para cancelaciones.
    // Por ahora lo dejamos así.

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error en cancelación de orden:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
