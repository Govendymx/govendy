import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminEvent = {
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  admin_id?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Registra un evento de operación para el panel de administrador
 * Esta función es "best-effort" - no lanza errores para no interrumpir operaciones principales
 */
export async function recordAdminEvent(
  admin: SupabaseClient,
  event: AdminEvent,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await admin.from('admin_operation_events').insert([
      {
        event_type: event.event_type,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        user_id: event.user_id || null,
        admin_id: event.admin_id || null,
        status: event.status || 'pending',
        metadata: event.metadata || {},
        notified_admin: false,
      },
    ]);

    if (error) {
      console.error('[ADMIN EVENTS] Error registrando evento:', {
        event_type: event.event_type,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }

    console.log('[ADMIN EVENTS] ✅ Evento registrado:', {
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
    });

    return { ok: true };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[ADMIN EVENTS] Excepción registrando evento:', {
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      error: errorMsg,
    });
    return { ok: false, error: errorMsg };
  }
}

/**
 * Prioridades por tipo de evento
 */
export const EVENT_PRIORITIES: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  dispute_opened: 'urgent',
  dispute_resolved: 'medium',
  payment_failed: 'high',
  payment_offline_pending: 'high',
  payment_processed: 'high',
  order_created: 'medium',
  order_shipped: 'low',
  order_delivered: 'medium',
  listing_reported: 'high',
  listing_created: 'low',
  support_message_created: 'medium',
  user_suspended: 'high',
  user_verified: 'low',
  shipping_label_uploaded: 'low',
  tracking_updated: 'low',
};

/**
 * Obtiene la prioridad de un evento
 */
export function getEventPriority(eventType: string): 'low' | 'medium' | 'high' | 'urgent' {
  return EVENT_PRIORITIES[eventType] || 'medium';
}
