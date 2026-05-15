// API Route refactorizada para confirmar recepción usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { OrderService } from '@/lib/services/orders/order.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  orderId: string;
  stars: number;
  comment?: string;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: buyerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    const stars = Number(body?.stars ?? 0);
    const comment = String(body?.comment || '').trim() || undefined;

    // Validación de comentario (seguridad)
    if (comment) {
      const looksLikeLink = (text: string) => {
        const t = text.toLowerCase();
        return t.includes('http://') || t.includes('https://') || t.includes('www.') ||
               /\b[a-z0-9-]+\.(com|mx|net|org|io|app|me|gg|ly|co|tv|xyz)\b/i.test(t) ||
               t.includes('wa.me') || t.includes('t.me');
      };
      const looksLikePhone = (text: string) => {
        const digits = text.replace(/\D/g, '');
        return digits.length >= 10 || /\b\d{7,}\b/.test(text);
      };

      if (looksLikeLink(comment) || looksLikePhone(comment)) {
        return NextResponse.json(
          { error: 'Por seguridad no se permiten enlaces ni teléfonos en el comentario.' },
          { status: 400 }
        );
      }
    }

    // Inicializar servicios
    const ordersRepo = new OrdersRepository();
    const notificationsRepo = new NotificationsRepository();
    const orderService = new OrderService(ordersRepo, notificationsRepo);

    // Confirmar recepción
    const result = await orderService.confirmReceived({
      orderId,
      buyerId,
      stars,
      comment,
    });

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      order: result.order,
      rating: {
        created: result.ratingCreated,
        id: result.ratingId,
      },
      notified: result.notified,
      both_rated: result.bothRated,
      both_notified: result.bothNotified,
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
