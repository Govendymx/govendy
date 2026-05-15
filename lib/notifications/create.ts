/**
 * Sistema de Notificaciones - GoVendy
 * Crea notificaciones de forma simple y confiable
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

export type NotificationType = 
  | 'new_sale'           // Nueva venta (vendedor)
  | 'sale_paid'          // Venta pagada (vendedor)
  | 'payment_approved'   // Pago aprobado (comprador)
  | 'payment_rejected'   // Pago rechazado (comprador)
  | 'order_shipped'      // Orden enviada (comprador)
  | 'order_completed'    // Orden completada (ambos)
  | 'listing_question'   // Nueva pregunta (vendedor)
  | 'listing_answer';     // Respuesta recibida (comprador)

export type NotificationData = {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_to?: string;
  data?: Record<string, unknown>;
  is_important?: boolean; // Para indicador visual de atención
};

/**
 * Crea una notificación de forma simple y confiable
 */
export async function createNotification(data: NotificationData): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = supabaseAdmin();
    
    const payload = {
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      body: data.body,
      link_to: data.link_to || null,
      data: {
        ...(data.data || {}),
        kind: data.type,
        is_important: data.is_important || false,
      },
      is_read: false,
    };

    const { error } = await admin.from('notifications').insert([payload]);

    if (error) {
      console.error('[NOTIFICATIONS] Error al crear:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    console.error('[NOTIFICATIONS] Excepción:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' };
  }
}

/**
 * Crea notificación para comprador (pagos, envíos, etc.)
 */
export async function notifyBuyer(
  buyerId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkTo?: string,
  data?: Record<string, unknown>,
  isImportant = false,
): Promise<void> {
  await createNotification({
    user_id: buyerId,
    type,
    title,
    body,
    link_to: linkTo,
    data,
    is_important: isImportant,
  });
}

/**
 * Crea notificación para vendedor (ventas, pagos, etc.)
 */
export async function notifySeller(
  sellerId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkTo?: string,
  data?: Record<string, unknown>,
  isImportant = false,
): Promise<void> {
  await createNotification({
    user_id: sellerId,
    type,
    title,
    body,
    link_to: linkTo,
    data,
    is_important: isImportant,
  });
}
