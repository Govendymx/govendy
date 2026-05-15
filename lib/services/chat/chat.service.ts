// Servicio de lógica de negocio para chat

import { ChatRepository } from '@/lib/repositories/chat.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { OrderMessage, ChatSenderRole } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { supabaseAdmin } from '@/lib/supabase/admin';

function looksLikeLink(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('http://') || t.includes('https://') || t.includes('www.') ||
         /\b[a-z0-9-]+\.(com|mx|net|org|io|app|me|gg|ly|co|tv|xyz)\b/i.test(t) ||
         t.includes('wa.me') || t.includes('t.me');
}

function looksLikePhone(text: string): boolean {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 || /\b\d{7,}\b/.test(text);
}

export interface SendMessageParams {
  orderId: string;
  senderId: string;
  body: string;
  attachments?: any[];
}

export class ChatService {
  private notificationService?: NotificationService;

  constructor(
    private chatRepo: ChatRepository,
    private ordersRepo: OrdersRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Enviar mensaje en chat de orden
   */
  async sendMessage(params: SendMessageParams): Promise<OrderMessage> {
    const { orderId, senderId, body, attachments } = params;

    // Validaciones
    validateRequired(orderId, 'orderId');
    validateRequired(senderId, 'senderId');

    if (!validateUUID(orderId)) {
      throw new ValidationError('orderId debe ser un UUID válido');
    }

    if (body.length > 800) {
      throw new ValidationError('Mensaje demasiado largo (máx. 800)');
    }

    if (!body.trim() && (!attachments || attachments.length === 0)) {
      throw new ValidationError('Escribe un mensaje o adjunta un archivo');
    }

    if (attachments && attachments.length > 4) {
      throw new ValidationError('Máximo 4 adjuntos por mensaje');
    }

    // Validar seguridad (no permitir enlaces/teléfonos)
    if (body && (looksLikeLink(body) || looksLikePhone(body))) {
      throw new ValidationError('Por seguridad no se permiten enlaces ni números de teléfono en el chat');
    }

    // Buscar orden
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    // Verificar autorización y determinar rol
    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', senderId)
      .maybeSingle();

    const isAdmin = Boolean(adminCheck);
    const isBuyer = order.buyer_id === senderId;
    const isSeller = order.seller_id === senderId;

    if (!isAdmin && !isBuyer && !isSeller) {
      throw new ForbiddenError('No autorizado para enviar mensajes en esta orden');
    }

    // Determinar rol
    let senderRole: ChatSenderRole = 'user';
    if (isAdmin) {
      senderRole = 'admin';
    } else if (isBuyer) {
      senderRole = 'buyer';
    } else if (isSeller) {
      senderRole = 'seller';
    }

    // Crear mensaje
    const message = await this.chatRepo.createMessage({
      order_id: orderId,
      sender_id: senderId,
      sender_role: senderRole,
      body: body.trim() || '',
      attachments: attachments || [],
    });

    // Notificar a las otras partes (best-effort)
    if (this.notificationService) {
      try {
        const snippet = body.trim()
          ? body.trim().slice(0, 120)
          : (attachments && attachments.length > 0)
            ? `Adjunto(s): ${attachments.length}`
            : 'Nuevo mensaje';

        const recipients = [order.buyer_id, order.seller_id].filter((id) => id && id !== senderId);
        for (const recipientId of recipients) {
          const title = recipientId === order.buyer_id ? 'Nuevo mensaje en tu compra' : 'Nuevo mensaje en tu venta';
          await this.notificationService.create({
            user_id: recipientId,
            type: 'order_chat_message',
            title,
            body: snippet,
            link_to: `/dashboard/${recipientId === order.buyer_id ? 'compras' : 'ventas'}?order=${orderId}`,
            data: {
              orderId,
              from: senderRole,
              kind: 'order_chat_message',
            },
          });
        }
      } catch (notifyErr) {
        console.warn('[ChatService] Error enviando notificaciones:', notifyErr);
      }
    }

    return message;
  }

  /**
   * Obtener mensajes de una orden
   */
  async getMessages(orderId: string, userId: string, limit: number = 80): Promise<OrderMessage[]> {
    validateRequired(orderId, 'orderId');
    validateRequired(userId, 'userId');

    // Verificar acceso
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Orden', orderId);
    }

    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const isAdmin = Boolean(adminCheck);
    const isBuyer = order.buyer_id === userId;
    const isSeller = order.seller_id === userId;

    if (!isAdmin && !isBuyer && !isSeller) {
      throw new ForbiddenError('No autorizado para ver esta conversación');
    }

    // Obtener mensajes
    return this.chatRepo.findMessagesByOrderId(orderId, limit);
  }
}
