// API Route refactorizada para subida de guías usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { LogisticsRepository } from '@/lib/repositories/logistics.repository';
import { StorageService } from '@/lib/services/storage/storage.service';
import { ShippingService } from '@/lib/services/logistics/shipping.service';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: requesterId, admin } = await requireAdmin(req);

    // Parse FormData
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Error al procesar el formulario.' }, { status: 400 });
    }

    const orderId = String(form.get('orderId') || '').trim();
    const file = form.get('file') as File | null;

    // Validaciones básicas
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    // Inicializar servicios
    const logisticsRepo = new LogisticsRepository();
    const storageService = new StorageService();
    const shippingService = new ShippingService(logisticsRepo, storageService);
    const notificationsRepo = new NotificationsRepository();
    const notificationService = new NotificationService(notificationsRepo);

    // Subir guía
    const { order, url } = await shippingService.uploadShippingLabel({
      orderId,
      file,
      uploadedBy: requesterId,
    });

    // Notificar al vendedor (best-effort, no crítico)
    if (order.seller_id) {
      try {
        await notificationService.create({
          user_id: order.seller_id,
          type: 'shipping_label_ready',
          title: 'Guía disponible',
          body: `Ya puedes descargar la guía de envío para tu venta (orden ${orderId.slice(0, 8)}…).`,
          link_to: `/dashboard/ventas?order=${orderId}`,
          data: { orderId },
        });
      } catch (notifyErr) {
        // No crítico, solo loguear
        console.warn('[label-upload] Error enviando notificación:', notifyErr);
      }
    }

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      url,
      order: {
        id: order.id,
        shipping_label_url: order.shipping_label_url,
        shipping_label_uploaded_at: order.shipping_label_uploaded_at,
      },
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
