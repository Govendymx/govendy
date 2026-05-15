// Repository para acceso a datos de notificaciones

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Notification, CreateNotificationData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class NotificationsRepository {
  /**
   * Crear notificación
   */
  async create(data: CreateNotificationData): Promise<Notification> {
    const admin = supabaseAdmin();
    
    // Preparar payload
    const payload: any = {
      user_id: data.user_id,
      title: data.title || '',
      body: data.body || '',
      is_read: data.is_read ?? false,
    };

    if (data.type) payload.type = data.type;
    if (data.link_to) payload.link_to = data.link_to;
    if (data.data) {
      payload.data = typeof data.data === 'object' ? data.data : {};
      // Asegurar que kind esté en data si hay type
      if (data.type && payload.data && typeof payload.data === 'object' && !('kind' in payload.data)) {
        payload.data.kind = data.type;
      }
    }

    const { data: notification, error } = await admin
      .from('notifications')
      .insert([payload])
      .select()
      .single();

    if (error) {
      // Si falla por ENUM inválido, intentar sin type
      const code = String((error as any)?.code || '');
      const msg = String((error as any)?.message || '').toLowerCase();
      
      if (code === '22P02' && msg.includes('invalid input value for enum') && payload.type) {
        delete payload.type;
        const retry = await admin.from('notifications').insert([payload]).select().single();
        if (retry.error) {
          throw new Error(`Error creando notificación: ${retry.error.message}`);
        }
        return retry.data as Notification;
      }

      throw new Error(`Error creando notificación: ${error.message}`);
    }

    return notification as Notification;
  }

  /**
   * Buscar notificaciones por usuario
   */
  async findByUserId(userId: string, limit: number = 100, unreadOnly: boolean = false): Promise<Notification[]> {
    const admin = supabaseAdmin();
    let query = admin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error buscando notificaciones: ${error.message}`);
    }

    return (data || []) as Notification[];
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error marcando notificación como leída: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundError('Notificación', notificationId);
    }

    return data as Notification;
  }

  /**
   * Marcar todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      throw new Error(`Error marcando notificaciones como leídas: ${error.message}`);
    }

    return Array.isArray(data) ? data.length : 0;
  }

  /**
   * Contar notificaciones no leídas
   */
  async countUnread(userId: string): Promise<number> {
    const admin = supabaseAdmin();
    const { count, error } = await admin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Error contando notificaciones: ${error.message}`);
    }

    return count || 0;
  }
}
