import { IntegrationAdapter, IntegrationFilter, IntegrationResult, IntegrationItem } from '../core/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const supervisionAdapter: IntegrationAdapter = {
  panel: 'supervision',

  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // 1. Disputas Abiertas
      // Prioridad Alta: Requieren intervención inmediata
      const { data: disputes, error: dispError } = await admin
        .from('disputes')
        .select('id, order_id, reason, created_at, status')
        .eq('status', 'open')
        .order('created_at', { ascending: true }) // Las más viejas primero
        .limit(filter.limit || 10);

      if (dispError) {
        errors.push(`Error fetching disputes: ${dispError.message}`);
      } else if (disputes) {
        for (const d of disputes) {
          items.push({
            id: `disp-${d.id}`,
            sourcePanel: 'supervision',
            type: 'warning',
            priority: 'high',
            title: 'Disputa Abierta',
            description: `Disputa pendiente por ${d.reason || 'motivo no especificado'}`,
            timestamp: d.created_at,
            actionUrl: `/admin/disputas?status=open&highlight=${d.id}`,
            metadata: { orderId: d.order_id }
          });
        }
      }

      // 2. Órdenes con Retraso en Envío (> 3 días)
      // Prioridad Media: Seguimiento requerido
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: delayedOrders, error: ordError } = await admin
        .from('orders')
        .select('id, created_at, paid_at, status, total')
        .eq('status', 'paid') // Pagada pero no enviada
        .lt('paid_at', threeDaysAgo)
        .order('paid_at', { ascending: true })
        .limit(filter.limit || 10);

      if (ordError) {
        errors.push(`Error fetching delayed orders: ${ordError.message}`);
      } else if (delayedOrders) {
        for (const o of delayedOrders) {
          items.push({
            id: `delay-${o.id}`,
            sourcePanel: 'supervision',
            type: 'info',
            priority: 'medium',
            title: 'Retraso en Envío',
            description: `Orden pagada hace +3 días y aún no enviada. Total: $${o.total}`,
            timestamp: o.paid_at || o.created_at,
            actionUrl: `/admin/supervision?status=paid&highlight=${o.id}`,
            metadata: { total: o.total }
          });
        }
      }

    } catch (e: any) {
      errors.push(e.message);
    }

    return {
      items,
      total: items.length,
      hasMore: false,
      errors: errors.length > 0 ? errors : undefined
    };
  },

  async getMetrics(): Promise<Record<string, number>> {
    const admin = supabaseAdmin();
    
    // Conteo rápido de disputas abiertas
    const { count: disputesCount } = await admin
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    return {
      open_disputes: disputesCount || 0
    };
  }
};
