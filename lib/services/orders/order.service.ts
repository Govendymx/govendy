// Servicio de lógica de negocio para órdenes

import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { Order, OrderStatus } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { notifyOrderShippedBuyer } from '@/lib/email/notify';

export interface MarkShippedParams {
  orderId: string;
  sellerId: string;
  trackingNumber: string;
  shippingCarrier?: string;
}

export interface ConfirmReceivedParams {
  orderId: string;
  buyerId: string;
  stars: number;
  comment?: string;
}

export interface MarkShippedResult {
  order: Order;
  notified: boolean;
}

export interface ConfirmReceivedResult {
  order: Order;
  ratingCreated: boolean;
  ratingId?: string | null;
  notified: boolean;
  bothRated: boolean;
  bothNotified: boolean;
}

export class OrderService {
  private notificationService?: NotificationService;

  constructor(
    private ordersRepo: OrdersRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Marcar orden como enviada
   */
  async markAsShipped(params: MarkShippedParams): Promise<MarkShippedResult> {
    const { orderId, sellerId, trackingNumber, shippingCarrier } = params;

    // Validaciones
    validateRequired(orderId, 'orderId');
    validateRequired(sellerId, 'sellerId');
    validateRequired(trackingNumber, 'trackingNumber');

    if (!validateUUID(orderId)) {
      throw new ValidationError('orderId debe ser un UUID válido');
    }

    if (trackingNumber.length < 4) {
      throw new ValidationError('El código de rastreo debe tener al menos 4 caracteres');
    }

    if (trackingNumber.length > 80) {
      throw new ValidationError('El código de rastreo es demasiado largo (máx. 80)');
    }

    if (shippingCarrier && shippingCarrier.length > 60) {
      throw new ValidationError('La paquetería es demasiado larga (máx. 60)');
    }

    // Buscar orden
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    // Verificar autorización
    if (order.seller_id !== sellerId) {
      throw new ForbiddenError('No autorizado para marcar esta orden como enviada');
    }

    // Verificar estado
    if (order.status !== 'paid') {
      throw new ValidationError(`No se puede marcar como enviada una orden con estado: ${order.status}`);
    }

    // Actualizar orden
    const now = new Date().toISOString();
    const updatedOrder = await this.ordersRepo.update(orderId, {
      status: 'shipped',
      shipped_at: now,
      tracking_number: trackingNumber,
      shipping_carrier: shippingCarrier || null,
    });

    // Notificar al comprador (best-effort)
    let notified = false;
    if (this.notificationService && order.buyer_id) {
      try {
        await this.notificationService.create({
          user_id: order.buyer_id,
          type: 'order_shipped',
          title: '📦 ¡Tu compra fue enviada!',
          body: `Tu compra fue enviada${shippingCarrier ? ` por ${shippingCarrier}` : ''}. Código de rastreo: ${trackingNumber}`,
          link_to: `/dashboard/compras?order=${orderId}`,
          data: {
            kind: 'order_shipped',
            orderId,
            tracking_number: trackingNumber,
            shipping_carrier: shippingCarrier || null,
          },
        });
        notified = true;
      } catch (notifyErr) {
        console.warn('[OrderService] Error enviando notificación de envío:', notifyErr);
      }
    }

    // Notificar por email al comprador (best-effort)
    if (order.buyer_id) {
      try {
        await notifyOrderShippedBuyer({
          buyerId: order.buyer_id,
          orderId,
          tracking: trackingNumber,
          carrier: shippingCarrier,
        });
      } catch (emailErr) {
        console.warn('[OrderService] Error enviando email de envío:', emailErr);
      }
    }

    return {
      order: updatedOrder,
      notified,
    };
  }

  /**
   * Confirmar recepción de orden
   */
  async confirmReceived(params: ConfirmReceivedParams): Promise<ConfirmReceivedResult> {
    const { orderId, buyerId, stars, comment } = params;

    // Validaciones
    validateRequired(orderId, 'orderId');
    validateRequired(buyerId, 'buyerId');

    if (!validateUUID(orderId)) {
      throw new ValidationError('orderId debe ser un UUID válido');
    }

    if (!Number.isFinite(stars) || stars < 1 || stars > 10) {
      throw new ValidationError('La calificación debe estar entre 1 y 10');
    }

    if (comment && comment.length > 600) {
      throw new ValidationError('El comentario es demasiado largo (máx. 600)');
    }

    // Buscar orden
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    // Verificar autorización
    if (order.buyer_id !== buyerId) {
      throw new ForbiddenError('No autorizado para confirmar esta orden');
    }

    // Verificar estado
    if (['cancelled', 'canceled', 'refunded'].includes(order.status)) {
      throw new ValidationError('Esta orden no puede confirmarse');
    }

    if (order.status !== 'shipped' && order.status !== 'delivered') {
      throw new ValidationError('Aún no puedes confirmar recepción: espera a que el vendedor registre el envío');
    }

    // Actualizar orden a delivered y liberar pago
    const now = new Date().toISOString();
    const updateData: any = {};

    if (order.status === 'shipped') {
      updateData.status = 'delivered';
    }

    // Liberar pago solo si aún no está liberado
    const currentOrder = await this.ordersRepo.findById(orderId);
    if (currentOrder && !(currentOrder as any).paid_to_seller_at) {
      updateData.paid_to_seller_at = now;
      updateData.paid_to_seller_by = buyerId;
    } else if (order.status === 'delivered' && currentOrder && !(currentOrder as any).paid_to_seller_at) {
      updateData.paid_to_seller_at = now;
      updateData.paid_to_seller_by = buyerId;
    }

    let updatedOrder = order;
    if (Object.keys(updateData).length > 0) {
      updatedOrder = await this.ordersRepo.update(orderId, updateData);
    }

    // Crear calificación (best-effort)
    let ratingCreated = false;
    let ratingId: string | null = null;
    try {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const admin = supabaseAdmin();
      const ratingRes = await admin
        .from('user_ratings')
        .insert([{
          order_id: orderId,
          rater_id: buyerId,
          ratee_id: order.seller_id,
          direction: 'buyer_to_seller',
          stars: Math.round(stars),
          comment: comment || null,
        }])
        .select('id')
        .single();

      if (!ratingRes.error && ratingRes.data) {
        ratingCreated = true;
        ratingId = (ratingRes.data as any).id;
      }
    } catch (ratingErr) {
      console.warn('[OrderService] Error creando calificación:', ratingErr);
    }

    // Verificar si ambas calificaciones existen
    let bothRated = false;
    try {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      const admin = supabaseAdmin();
      const sellerRatingRes = await admin
        .from('user_ratings')
        .select('id')
        .eq('order_id', orderId)
        .eq('direction', 'seller_to_buyer')
        .maybeSingle();

      if (!sellerRatingRes.error && sellerRatingRes.data) {
        bothRated = true;
      }
    } catch (e) {
      // Ignorar errores
    }

    // Notificar al vendedor (best-effort)
    let notified = false;
    if (this.notificationService && order.seller_id) {
      try {
        await this.notificationService.create({
          user_id: order.seller_id,
          type: 'order_completed',
          title: '✅ Compra completada',
          body: `El comprador confirmó que recibió el artículo. Pago liberado. Calificación recibida: ${Math.round(stars)}/10`,
          link_to: `/dashboard/ventas?order=${orderId}`,
          data: {
            kind: 'order_completed',
            orderId,
            stars: Math.round(stars),
          },
        });
        notified = true;
      } catch (notifyErr) {
        console.warn('[OrderService] Error enviando notificación de completado:', notifyErr);
      }
    }

    // Si ambas calificaciones existen, notificar a ambos
    let bothNotified = false;
    if (bothRated && this.notificationService) {
      try {
        // Notificar al comprador
        await this.notificationService.create({
          user_id: buyerId,
          type: 'ratings_complete',
          title: 'Ambas calificaciones completadas',
          body: 'Ya puedes ver la calificación que recibiste del vendedor.',
          link_to: `/dashboard/compras?order=${orderId}`,
          data: { orderId, kind: 'ratings_complete' },
        });

        // Notificar al vendedor
        await this.notificationService.create({
          user_id: order.seller_id,
          type: 'ratings_complete',
          title: 'Ambas calificaciones completadas',
          body: 'Ya puedes ver la calificación que recibiste del comprador.',
          link_to: `/dashboard/ventas?order=${orderId}`,
          data: { orderId, kind: 'ratings_complete' },
        });

        bothNotified = true;
      } catch (notifyErr) {
        console.warn('[OrderService] Error enviando notificaciones de calificaciones:', notifyErr);
      }
    }

    return {
      order: updatedOrder,
      ratingCreated,
      ratingId,
      notified,
      bothRated,
      bothNotified,
    };
  }
}
