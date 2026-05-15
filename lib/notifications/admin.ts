/**
 * Sistema de notificaciones para administradores
 * Notifica a todos los admins cuando ocurren eventos importantes
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from './insertBestEffort';

/**
 * Obtiene todos los IDs de usuarios administradores
 */
export async function getAllAdminUserIds(): Promise<string[]> {
  const admin = supabaseAdmin();
  const ids: string[] = [];

  try {
    const { data: rows, error } = await admin.from('admin_users').select('user_id');
    if (error) {
      console.error('[ADMIN NOTIFICATIONS] Error obteniendo admins:', error);
      return [];
    }

    for (const row of rows ?? []) {
      const userId = String((row as any)?.user_id ?? '').trim();
      if (userId) ids.push(userId);
    }
  } catch (e) {
    console.error('[ADMIN NOTIFICATIONS] Error:', e);
  }

  return ids;
}

/**
 * Notifica a todos los administradores sobre un evento importante
 */
export async function notifyAllAdmins(opts: {
  type: string;
  title: string;
  body: string;
  linkTo?: string;
  data?: any;
}): Promise<{ ok: boolean; notified: number; errors: number }> {
  const admin = supabaseAdmin();
  const adminIds = await getAllAdminUserIds();

  if (adminIds.length === 0) {
    console.warn('[ADMIN NOTIFICATIONS] No hay administradores para notificar');
    return { ok: true, notified: 0, errors: 0 };
  }

  let notified = 0;
  let errors = 0;

  for (const adminId of adminIds) {
    try {
      const result = await insertNotificationBestEffort(admin, {
        user_id: adminId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link_to: opts.linkTo || null,
        data: opts.data || {},
        is_read: false,
      });

      if (result.ok) {
        notified++;
      } else {
        errors++;
        console.error(`[ADMIN NOTIFICATIONS] Error notificando a admin ${adminId}:`, result);
      }
    } catch (e) {
      errors++;
      console.error(`[ADMIN NOTIFICATIONS] Excepción notificando a admin ${adminId}:`, e);
    }
  }

  console.log(`[ADMIN NOTIFICATIONS] Notificados ${notified}/${adminIds.length} admins, ${errors} errores`);
  return { ok: errors === 0, notified, errors };
}

/**
 * Tipos de eventos importantes que requieren notificación a admin
 */
export const AdminEventTypes = {
  // Pagos
  PAYMENT_APPROVED: 'admin_payment_approved',
  PAYMENT_REJECTED: 'admin_payment_rejected',
  PAYMENT_OFFLINE_PENDING: 'admin_payment_offline_pending',
  PAYMENT_OFFLINE_APPROVED: 'admin_payment_offline_approved',

  // Órdenes
  ORDER_CREATED: 'admin_order_created',
  ORDER_SHIPPED: 'admin_order_shipped',
  ORDER_COMPLETED: 'admin_order_completed',
  ORDER_CANCELLED: 'admin_order_cancelled',

  // Disputas
  DISPUTE_OPENED: 'admin_dispute_opened',
  DISPUTE_MESSAGE: 'admin_dispute_message',
  DISPUTE_RESOLVED: 'admin_dispute_resolved',

  // Soporte
  SUPPORT_TICKET_CREATED: 'admin_support_ticket_created',
  SUPPORT_MESSAGE: 'admin_support_message',

  // Usuarios y contenido
  USER_REPORTED: 'admin_user_reported',
  LISTING_REPORTED: 'admin_listing_reported',
  LISTING_FLAGGED: 'admin_listing_flagged',

  // Sistema
  SYSTEM_ERROR: 'admin_system_error',
  HIGH_VALUE_ORDER: 'admin_high_value_order',
} as const;

/**
 * Funciones helper para notificar eventos comunes
 */
export const notifyAdmin = {
  /**
   * Pago aprobado (MercadoPago o offline)
   */
  async paymentApproved(opts: { orderId: string; amount: number; buyerId: string; sellerId: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.PAYMENT_APPROVED,
      title: '💰 Pago Aprobado',
      body: `Se aprobó un pago de $${opts.amount.toFixed(2)} para la orden ${opts.orderId}`,
      linkTo: `/admin/pagos?order=${opts.orderId}`,
      data: { orderId: opts.orderId, amount: opts.amount, buyerId: opts.buyerId, sellerId: opts.sellerId },
    });
  },

  /**
   * Pago rechazado
   */
  async paymentRejected(opts: { orderId: string; buyerId: string; reason?: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.PAYMENT_REJECTED,
      title: '⚠️ Pago Rechazado',
      body: `Pago rechazado para la orden ${opts.orderId}${opts.reason ? `: ${opts.reason}` : ''}`,
      linkTo: `/admin/pagos?order=${opts.orderId}`,
      data: { orderId: opts.orderId, buyerId: opts.buyerId, reason: opts.reason },
    });
  },

  /**
   * Pago offline pendiente de revisión
   */
  async paymentOfflinePending(opts: { checkoutId: string; amount: number; buyerId: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.PAYMENT_OFFLINE_PENDING,
      title: '⏳ Pago Offline Pendiente',
      body: `Pago offline de $${opts.amount.toFixed(2)} pendiente de revisión (Checkout: ${opts.checkoutId})`,
      linkTo: `/admin/pagos?checkout=${opts.checkoutId}`,
      data: { checkoutId: opts.checkoutId, amount: opts.amount, buyerId: opts.buyerId },
    });
  },

  /**
   * Nueva disputa abierta
   */
  async disputeOpened(opts: { disputeId: string; orderId: string; buyerId: string; sellerId: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.DISPUTE_OPENED,
      title: '🚨 Nueva Disputa',
      body: `Se abrió una nueva disputa para la orden ${opts.orderId}`,
      linkTo: `/admin/disputas/${opts.disputeId}`,
      data: { disputeId: opts.disputeId, orderId: opts.orderId, buyerId: opts.buyerId, sellerId: opts.sellerId },
    });
  },

  /**
   * Nuevo mensaje en disputa
   */
  async disputeMessage(opts: { disputeId: string; orderId: string; fromUserId: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.DISPUTE_MESSAGE,
      title: '💬 Mensaje en Disputa',
      body: `Nuevo mensaje en la disputa de la orden ${opts.orderId}`,
      linkTo: `/admin/disputas/${opts.disputeId}`,
      data: { disputeId: opts.disputeId, orderId: opts.orderId, fromUserId: opts.fromUserId },
    });
  },

  /**
   * Nuevo ticket de soporte
   */
  async supportTicketCreated(opts: { ticketId: string; userId: string; subject: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.SUPPORT_TICKET_CREATED,
      title: '📧 Nuevo Ticket de Soporte',
      body: `Nuevo ticket: "${opts.subject}"`,
      linkTo: `/admin/soporte?ticket=${opts.ticketId}`,
      data: { ticketId: opts.ticketId, userId: opts.userId, subject: opts.subject },
    });
  },

  /**
   * Orden de alto valor
   */
  async highValueOrder(opts: { orderId: string; amount: number; threshold: number }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.HIGH_VALUE_ORDER,
      title: '💎 Orden de Alto Valor',
      body: `Nueva orden de $${opts.amount.toFixed(2)} (supera el umbral de $${opts.threshold.toFixed(2)})`,
      linkTo: `/admin/logistica?order=${opts.orderId}`,
      data: { orderId: opts.orderId, amount: opts.amount, threshold: opts.threshold },
    });
  },

  /**
   * Usuario reportado
   */
  async userReported(opts: { reportedUserId: string; reporterId: string; reason: string }): Promise<void> {
    await notifyAllAdmins({
      type: AdminEventTypes.USER_REPORTED,
      title: '🚩 Usuario Reportado',
      body: `Usuario reportado. Razón: ${opts.reason}`,
      linkTo: `/admin/usuarios?user=${opts.reportedUserId}`,
      data: { reportedUserId: opts.reportedUserId, reporterId: opts.reporterId, reason: opts.reason },
    });
  },
};
