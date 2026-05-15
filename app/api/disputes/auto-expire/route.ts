
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DisputesRepository } from '@/lib/repositories/disputes.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Autenticación (cualquier usuario autenticado puede dispararlo, pero validamos la lógica)
    const { userId } = await requireAuth(req);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    
    // 1. Obtener la orden con detalles
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('*, order_items(listing_id)')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Validar estado
    // Solo si está pagada y NO enviada
    if (order.status !== 'paid' || order.shipped_at || order.tracking_number) {
       return NextResponse.json({ error: 'Order is not eligible for auto-dispute (shipped or not paid)' }, { status: 400 });
    }

    // 3. Verificar si ya existe disputa
    const disputesRepo = new DisputesRepository();
    const existing = await disputesRepo.findByOrderId(orderId);
    if (existing) {
      return NextResponse.json({ ok: true, disputeId: existing.id, already: true });
    }

    // 4. Calcular deadline real para asegurar que de verdad expiró (doble check servidor)
    // Obtener handling_days de los listings
    const listingIds = order.order_items.map((i: any) => i.listing_id);
    let maxHandling = 3;
    if (listingIds.length > 0) {
      const { data: listings } = await admin.from('listings').select('handling_days').in('id', listingIds);
      if (listings) {
        maxHandling = Math.max(...listings.map((l: any) => l.handling_days || 3));
      }
    }

    const createdAt = new Date(order.created_at);
    let current = new Date(createdAt);
    let daysAdded = 0;
    const targetDays = maxHandling === 0 ? 1 : maxHandling;

    while (daysAdded < targetDays) {
        current.setDate(current.getDate() + 1);
        
        // Simular zona horaria de México (UTC-6) para determinar si es domingo
        // current es un objeto Date (timestamp).
        // Si restamos 6 horas, obtenemos el día que es en México.
        const mexicoDate = new Date(current.getTime() - 6 * 60 * 60 * 1000);
        if (mexicoDate.getUTCDay() !== 0) { 
            daysAdded++;
        }
    }
    
    // Margen de tolerancia de 1 hora para evitar condiciones de carrera con el frontend
    // Y un buffer adicional de 2 horas para discrepancias de zona horaria
    const deadline = current.getTime();
    const now = Date.now();
    const gracePeriod = 2 * 60 * 60 * 1000; // 2 horas de gracia

    if (now < deadline - gracePeriod) {
        // Aún no expira según el servidor (incluso con gracia)
        return NextResponse.json({ error: 'Order has not expired yet', deadline, now }, { status: 400 });
    }

    // 5. Crear disputa AUTOMÁTICA
    // Usamos el ID del comprador como "opened_by" para consistencia, o un ID de sistema si tuviéramos.
    // En este caso, simularemos que el sistema (o el comprador por proxy) abre la disputa por "Envío retrasado".
    // Reason code: 'not_received' es lo más cercano.
    
    const dispute = await disputesRepo.create({
      order_id: orderId,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      opened_by: order.buyer_id, // Atribuimos al comprador para que le aparezca como suya
      reason_code: 'not_received',
      reason_text: 'Disputa automática: El vendedor no envió el producto dentro del tiempo establecido.',
    });

    // Actualizar orden
    await admin.from('orders').update({ status: 'disputed' }).eq('id', orderId);

    // Notificaciones
    const notificationsRepo = new NotificationsRepository();
    
    // Al vendedor
    await notificationsRepo.create({
        user_id: order.seller_id,
        type: 'dispute_opened',
        title: '⚠️ Disputa Automática',
        body: `Se ha abierto una disputa automática en la orden ${orderId.slice(0, 8)} por tiempo de envío agotado.`,
        link_to: `/dashboard/ventas?order=${orderId}`,
        data: { disputeId: dispute.id, orderId, kind: 'auto_dispute' }
    });

    // Al comprador
    await notificationsRepo.create({
        user_id: order.buyer_id,
        type: 'dispute_opened',
        title: '🛡️ Disputa Automática Iniciada',
        body: `Hemos abierto una disputa por ti en la orden ${orderId.slice(0, 8)} debido a la demora en el envío.`,
        link_to: `/dashboard/compras?order=${orderId}`,
        data: { disputeId: dispute.id, orderId, kind: 'auto_dispute' }
    });

    return NextResponse.json({ ok: true, disputeId: dispute.id });

  } catch (error: any) {
    console.error('Auto-expire error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
