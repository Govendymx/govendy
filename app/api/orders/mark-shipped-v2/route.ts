// API Route refactorizada para marcar orden como enviada usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { OrderService } from '@/lib/services/orders/order.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  orderId: string;
  tracking_number: string;
  shipping_carrier?: string;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: sellerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    const trackingNumber = String(body?.tracking_number || '').trim();
    const shippingCarrier = String(body?.shipping_carrier || '').trim() || undefined;

    // Inicializar servicios
    const ordersRepo = new OrdersRepository();
    const notificationsRepo = new NotificationsRepository();
    const orderService = new OrderService(ordersRepo, notificationsRepo);

    // Marcar como enviada
    const result = await orderService.markAsShipped({
      orderId,
      sellerId,
      trackingNumber,
      shippingCarrier,
    });

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      order: result.order,
      notified: result.notified,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    const resp = NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
