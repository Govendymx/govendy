// Servicio de lógica de negocio para notificaciones

import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { Notification, CreateNotificationData } from '@/lib/types/domain.types';
import { ValidationError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';

export class NotificationService {
  constructor(private repository: NotificationsRepository) {}

  /**
   * Crear notificación
   */
  async create(data: CreateNotificationData): Promise<Notification> {
    // Validaciones
    validateRequired(data.user_id, 'user_id');
    validateRequired(data.title, 'title');
    validateRequired(data.body, 'body');
    
    if (!validateUUID(data.user_id)) {
      throw new ValidationError('user_id debe ser un UUID válido');
    }

    if (!data.title.trim()) {
      throw new ValidationError('El título no puede estar vacío');
    }

    if (!data.body.trim()) {
      throw new ValidationError('El cuerpo no puede estar vacío');
    }

    return this.repository.create(data);
  }

  /**
   * Notificar a múltiples usuarios
   */
  async notifyMany(
    userIds: string[],
    notificationData: Omit<CreateNotificationData, 'user_id'>
  ): Promise<Notification[]> {
    if (userIds.length === 0) return [];

    const notifications: Notification[] = [];
    const errors: string[] = [];

    // Crear notificaciones en paralelo
    const promises = userIds.map(async (userId) => {
      try {
        const notification = await this.create({
          ...notificationData,
          user_id: userId,
        });
        return notification;
      } catch (error) {
        errors.push(`Error notificando a ${userId}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter((n): n is Notification => n !== null);
    
    notifications.push(...successful);

    if (errors.length > 0) {
      console.warn('[NotificationService] Algunas notificaciones fallaron:', errors);
    }

    return notifications;
  }

  /**
   * Obtener notificaciones de un usuario
   */
  async getUserNotifications(userId: string, limit: number = 100, unreadOnly: boolean = false): Promise<Notification[]> {
    validateRequired(userId, 'userId');
    if (!validateUUID(userId)) {
      throw new ValidationError('userId debe ser un UUID válido');
    }

    return this.repository.findByUserId(userId, limit, unreadOnly);
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    validateRequired(notificationId, 'notificationId');
    validateRequired(userId, 'userId');

    return this.repository.markAsRead(notificationId, userId);
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    validateRequired(userId, 'userId');
    if (!validateUUID(userId)) {
      throw new ValidationError('userId debe ser un UUID válido');
    }

    return this.repository.markAllAsRead(userId);
  }

  /**
   * Obtener contador de no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    validateRequired(userId, 'userId');
    if (!validateUUID(userId)) {
      throw new ValidationError('userId debe ser un UUID válido');
    }

    return this.repository.countUnread(userId);
  }
}
