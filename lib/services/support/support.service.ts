// Servicio de lógica de negocio para support

import { SupportRepository } from '@/lib/repositories/support.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { SupportConversation, SupportMessage, SupportSenderRole } from '@/lib/types/domain.types';
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

export interface CreateConversationParams {
  userId: string;
  subject: string;
}

export interface SendMessageParams {
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
}

export class SupportService {
  private notificationService?: NotificationService;

  constructor(
    private supportRepo: SupportRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Crear conversación de soporte
   */
  async createConversation(params: CreateConversationParams): Promise<SupportConversation> {
    const { userId, subject } = params;

    // Validaciones
    validateRequired(userId, 'userId');
    validateRequired(subject, 'subject');

    if (!validateUUID(userId)) {
      throw new ValidationError('userId debe ser un UUID válido');
    }

    if (subject.trim().length < 3) {
      throw new ValidationError('El asunto debe tener al menos 3 caracteres');
    }

    if (subject.length > 200) {
      throw new ValidationError('El asunto es demasiado largo (máx. 200)');
    }

    // Crear conversación
    return this.supportRepo.createConversation({
      created_by: userId,
      subject: subject.trim(),
    });
  }

  /**
   * Enviar mensaje en conversación
   */
  async sendMessage(params: SendMessageParams): Promise<SupportMessage> {
    const { conversationId, senderId, body, attachmentUrl, attachmentName, attachmentMime, attachmentSize } = params;

    // Validaciones
    validateRequired(conversationId, 'conversationId');
    validateRequired(senderId, 'senderId');
    validateRequired(body, 'body');

    if (!validateUUID(conversationId)) {
      throw new ValidationError('conversationId debe ser un UUID válido');
    }

    if (body.trim().length === 0) {
      throw new ValidationError('El mensaje no puede estar vacío');
    }

    if (body.length > 2000) {
      throw new ValidationError('El mensaje es demasiado largo (máx. 2000)');
    }

    // Validar seguridad (no permitir enlaces/teléfonos)
    if (looksLikeLink(body) || looksLikePhone(body)) {
      throw new ValidationError('Por seguridad no se permiten enlaces ni teléfonos en los mensajes');
    }

    // Buscar conversación
    const conversation = await this.supportRepo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversación', conversationId);
    }

    // Verificar autorización
    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', senderId)
      .maybeSingle();

    const isAdmin = Boolean(adminCheck);
    const isCreator = conversation.created_by === senderId;

    if (!isAdmin && !isCreator) {
      throw new ForbiddenError('No autorizado para enviar mensajes en esta conversación');
    }

    // Determinar rol
    const senderRole: SupportSenderRole = isAdmin ? 'admin' : 'user';

    // Crear mensaje
    const message = await this.supportRepo.createMessage({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      body: body.trim(),
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      attachment_mime: attachmentMime || null,
      attachment_size: attachmentSize || null,
    });

    // Notificar al otro participante (best-effort)
    if (this.notificationService) {
      try {
        const recipientId = isAdmin ? conversation.created_by : null; // Si es admin, notificar al usuario
        if (recipientId) {
          await this.notificationService.create({
            user_id: recipientId,
            type: 'support_message',
            title: '💬 Nuevo mensaje de soporte',
            body: `Tienes un nuevo mensaje en: ${conversation.subject}`,
            link_to: `/dashboard/soporte/${conversationId}`,
            data: {
              conversationId,
              kind: 'support_message',
            },
          });
        }
      } catch (notifyErr) {
        console.warn('[SupportService] Error enviando notificación:', notifyErr);
      }
    }

    return message;
  }

  /**
   * Obtener mensajes de una conversación
   */
  async getMessages(conversationId: string, userId: string, limit: number = 200): Promise<SupportMessage[]> {
    validateRequired(conversationId, 'conversationId');
    validateRequired(userId, 'userId');

    // Verificar acceso
    const conversation = await this.supportRepo.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversación', conversationId);
    }

    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const isAdmin = Boolean(adminCheck);
    const isCreator = conversation.created_by === userId;

    if (!isAdmin && !isCreator) {
      throw new ForbiddenError('No autorizado para ver esta conversación');
    }

    // Obtener mensajes
    const messages = await this.supportRepo.findMessagesByConversationId(conversationId, limit);

    // Marcar como entregado si es el usuario (best-effort)
    if (!isAdmin) {
      try {
        await this.supportRepo.markAsDelivered(conversationId);
      } catch (deliveredErr) {
        console.warn('[SupportService] Error marcando como entregado:', deliveredErr);
      }
    }

    return messages;
  }

  /**
   * Obtener conversaciones de un usuario
   */
  async getUserConversations(userId: string, limit: number = 100): Promise<SupportConversation[]> {
    validateRequired(userId, 'userId');
    if (!validateUUID(userId)) {
      throw new ValidationError('userId debe ser un UUID válido');
    }

    return this.supportRepo.findConversationsByUser(userId, limit);
  }
}
