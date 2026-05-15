import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ActivityLogEntry {
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id?: string | null;
  admin_id?: string | null;
  severity: EventSeverity;
  details?: Record<string, any>;
}

/**
 * Registra un evento operativo en la base de datos para el feed de administración.
 * Utiliza el cliente admin de Supabase para saltar restricciones si es necesario.
 */
export async function logActivity(entry: ActivityLogEntry) {
  try {
    const admin = supabaseAdmin();
    
    // Validar datos mínimos
    if (!entry.event_type || !entry.entity_type || !entry.entity_id) {
      console.warn('[ACTIVITY LOG] Missing required fields', entry);
      return;
    }

    const payload = {
      event_type: entry.event_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      user_id: entry.user_id || null,
      admin_id: entry.admin_id || null,
      severity: entry.severity || 'info',
      details: entry.details || {},
      created_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from('admin_operation_events')
      .insert(payload);

    if (error) {
      console.error('[ACTIVITY LOG] Database insert failed:', error);
      // Fallback: log a consola si falla la DB
      console.log('[ACTIVITY LOG FALLBACK]', JSON.stringify(payload));
    } else {
      console.log(`[ACTIVITY LOG] Recorded: ${entry.event_type} (${entry.severity})`);
    }
  } catch (err) {
    console.error('[ACTIVITY LOG] Unexpected error:', err);
  }
}
