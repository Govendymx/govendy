// Servicio de lógica de negocio para disputas

import { DisputesRepository } from '@/lib/repositories/disputes.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { Dispute, DisputeMessage, DisputeReasonCode, DisputeSenderRole } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface OpenDisputeParams {
  orderId: string;
  buyerId: string;
  reasonCode: DisputeReasonCode;
  reasonText?: string;
}

export interface SendMessageParams {
  disputeId: string;
  senderId: string;
  body: string;
  attachments?: any[];
}

export class DisputeService {
  private notificationService?: NotificationService;

  constructor(
    private disputesRepo: DisputesRepository,
    private ordersRepo: OrdersRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Abrir disputa
   */
  async openDispute(params: OpenDisputeParams): Promise<Dispute> {
    const { orderId, buyerId, reasonCode, reasonText } = params;

    // Validaciones
    validateRequired(orderId, 'orderId');
    validateRequired(buyerId, 'buyerId');
    validateRequired(reasonCode, 'reasonCode');

    if (!validateUUID(orderId)) {
      throw new ValidationError('orderId debe ser un UUID válido');
    }

    const validReasonCodes: DisputeReasonCode[] = ['not_received', 'damaged', 'not_as_described', 'missing_items', 'other'];
    if (!validReasonCodes.includes(reasonCode)) {
      throw new ValidationError('reasonCode inválido');
    }

    if (reasonText && reasonText.length > 600) {
      throw new ValidationError('reason_text demasiado largo (máx. 600)');
    }

    // Buscar orden
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    // Verificar autorización
    if (order.buyer_id !== buyerId) {
      throw new ForbiddenError('Solo el comprador puede abrir una disputa');
    }

    // Verificar si ya existe disputa
    const existing = await this.disputesRepo.findByOrderId(orderId);
    if (existing) {
      return existing; // Ya existe, retornar la existente
    }

    // Crear disputa
    const dispute = await this.disputesRepo.create({
      order_id: orderId,
      buyer_id: buyerId,
      seller_id: order.seller_id,
      opened_by: buyerId,
      reason_code: reasonCode,
      reason_text: reasonText || '',
    });

    // Crear mensaje inicial (best-effort)
    try {
      const reasonLabel = this.getReasonLabel(reasonCode);
      await this.disputesRepo.createMessage({
        dispute_id: dispute.id,
        sender_id: buyerId,
        sender_role: 'buyer',
        body: `Disputa iniciada: ${reasonLabel}${reasonText ? `\n\nDetalle: ${reasonText}` : ''}`,
        attachments: [],
      });
    } catch (msgErr) {
      console.warn('[DisputeService] Error creando mensaje inicial:', msgErr);
    }

    // Marcar orden como disputed (best-effort)
    try {
      if (order.status !== 'disputed') {
        await this.ordersRepo.update(orderId, { status: 'disputed' });
      }
    } catch (orderErr) {
      console.warn('[DisputeService] Error actualizando estado de orden:', orderErr);
    }

    // Notificar al vendedor (best-effort)
    if (this.notificationService) {
      try {
        await this.notificationService.create({
          user_id: order.seller_id,
          type: 'dispute_opened',
          title: '⚠️ Se abrió una disputa',
          body: `El comprador abrió una disputa en la orden ${orderId.slice(0, 8)}…`,
          link_to: `/dashboard/ventas?order=${orderId}`,
          data: {
            disputeId: dispute.id,
            orderId,
            kind: 'dispute_opened',
          },
        });
      } catch (notifyErr) {
        console.warn('[DisputeService] Error enviando notificación:', notifyErr);
      }
    }

    return dispute;
  }

  /**
   * Enviar mensaje en disputa
   */
  async sendMessage(params: SendMessageParams): Promise<DisputeMessage> {
    const { disputeId, senderId, body, attachments } = params;

    // Validaciones
    validateRequired(disputeId, 'disputeId');
    validateRequired(senderId, 'senderId');
    validateRequired(body, 'body');

    if (!validateUUID(disputeId)) {
      throw new ValidationError('disputeId debe ser un UUID válido');
    }

    if (body.trim().length === 0) {
      throw new ValidationError('El mensaje no puede estar vacío');
    }

    if (body.length > 2000) {
      throw new ValidationError('El mensaje es demasiado largo (máx. 2000)');
    }

    // Validar seguridad (no permitir enlaces/teléfonos)
    if (this.looksLikeLink(body) || this.looksLikePhone(body)) {
      throw new ValidationError('Por seguridad no se permiten enlaces ni teléfonos en los mensajes');
    }

    // Buscar disputa
    const dispute = await this.disputesRepo.findById(disputeId);
    if (!dispute) {
      throw new NotFoundError('Disputa', disputeId);
    }

    // Determinar rol del sender
    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', senderId)
      .maybeSingle();

    const isAdmin = Boolean(adminCheck);
    let senderRole: DisputeSenderRole = 'user';

    if (isAdmin) {
      senderRole = 'admin';
    } else if (dispute.buyer_id === senderId) {
      senderRole = 'buyer';
    } else if (dispute.seller_id === senderId) {
      senderRole = 'seller';
    } else {
      throw new ForbiddenError('No autorizado para enviar mensajes en esta disputa');
    }

    // Crear mensaje
    const message = await this.disputesRepo.createMessage({
      dispute_id: disputeId,
      sender_id: senderId,
      sender_role: senderRole,
      body: body.trim(),
      attachments: attachments || [],
    });

    // Notificar al otro participante (best-effort)
    if (this.notificationService) {
      try {
        const recipientId = senderRole === 'buyer' ? dispute.seller_id : dispute.buyer_id;
        if (recipientId) {
          await this.notificationService.create({
            user_id: recipientId,
            type: 'dispute_message',
            title: '💬 Nuevo mensaje en disputa',
            body: `Hay un nuevo mensaje en la disputa de la orden ${dispute.order_id.slice(0, 8)}…`,
            link_to: `/dashboard/disputas?dispute=${disputeId}`,
            data: {
              disputeId,
              orderId: dispute.order_id,
              kind: 'dispute_message',
            },
          });
        }
      } catch (notifyErr) {
        console.warn('[DisputeService] Error enviando notificación de mensaje:', notifyErr);
      }
    }

    return message;
  }

  /**
   * Obtener mensajes de una disputa
   */
  async getMessages(disputeId: string, userId: string, limit: number = 200): Promise<DisputeMessage[]> {
    validateRequired(disputeId, 'disputeId');
    validateRequired(userId, 'userId');

    // Verificar acceso
    const dispute = await this.disputesRepo.findById(disputeId);
    if (!dispute) {
      throw new NotFoundError('Disputa', disputeId);
    }

    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const isAdmin = Boolean(adminCheck);
    const isBuyer = dispute.buyer_id === userId;
    const isSeller = dispute.seller_id === userId;

    if (!isAdmin && !isBuyer && !isSeller) {
      throw new ForbiddenError('No autorizado para ver esta disputa');
    }

    // Obtener mensajes
    const messages = await this.disputesRepo.findMessagesByDisputeId(disputeId, limit);

    // Marcar como leído (best-effort)
    try {
      await this.disputesRepo.markAsRead(disputeId, userId);
    } catch (readErr) {
      console.warn('[DisputeService] Error marcando como leído:', readErr);
    }

    return messages;
  }

  /**
   * Obtener disputas de un usuario
   */
  async getUserDisputes(userId: string, limit: number = 100): Promise<Dispute[]> {
    validateRequired(userId, 'userId');
    if (!validateUUID(userId)) {
      throw new ValidationError('userId debe ser un UUID válido');
    }

    // Obtener disputas como comprador y vendedor
    const buyerDisputes = await this.disputesRepo.findByBuyerId(userId, limit);
    const sellerDisputes = await this.disputesRepo.findBySellerId(userId, limit);

    // Combinar y ordenar por last_message_at
    const allDisputes = [...buyerDisputes, ...sellerDisputes];
    const uniqueDisputes = Array.from(
      new Map(allDisputes.map(d => [d.id, d])).values()
    );
    
    return uniqueDisputes.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    ).slice(0, limit);
  }

  /**
   * Helper: Obtener etiqueta de razón
   */
  private getReasonLabel(reasonCode: DisputeReasonCode): string {
    const labels: Record<DisputeReasonCode, string> = {
      not_received: 'No recibí mi pedido',
      damaged: 'Llegó dañado',
      not_as_described: 'No es como se describía',
      missing_items: 'Faltan artículos',
      other: 'Otro',
    };
    return labels[reasonCode] || 'Otro';
  }

  /**
   * Helper: Detectar enlaces
   */
  private looksLikeLink(text: string): boolean {
    const t = text.toLowerCase();
    return t.includes('http://') || t.includes('https://') || t.includes('www.') ||
           /\b[a-z0-9-]+\.(com|mx|net|org|io|app|me|gg|ly|co|tv|xyz)\b/i.test(t) ||
           t.includes('wa.me') || t.includes('t.me');
  }

  /**
   * Helper: Detectar teléfonos
   */
  private looksLikePhone(text: string): boolean {
    const digits = text.replace(/\D/g, '');
    return digits.length >= 10 || /\b\d{7,}\b/.test(text);
  }
}
