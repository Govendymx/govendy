import { IntegrationAdapter, IntegrationFilter, IntegrationResult, IntegrationItem } from '../core/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const logisticsAdapter: IntegrationAdapter = {
  panel: 'logistica',

  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // 1. Guías Estafeta Pagadas pero No Generadas (Status 'paid')
      // Se asume que si está 'paid' en estafeta_quotes, falta generar/subir la guía final o procesarla
      const { data: quotes, error: qtError } = await admin
        .from('estafeta_quotes')
        .select('id, created_at, calculated_cost, status')
        .eq('status', 'paid')
        .order('created_at', { ascending: true })
        .limit(filter.limit || 10);

      if (qtError) {
        // Ignoramos error si la tabla no existe o hay problemas de permisos menores
        console.warn('[LogisticsAdapter] Error fetching quotes:', qtError);
      } else if (quotes) {
        for (const q of quotes) {
          items.push({
            id: `quote-${q.id}`,
            sourcePanel: 'logistica',
            type: 'warning',
            priority: 'high',
            title: 'Guía Estafeta Pendiente',
            description: `Cotización pagada ($${q.calculated_cost}) requiere generación de guía.`,
            timestamp: q.created_at,
            actionUrl: `/admin/estafeta?status=paid&highlight=${q.id}`,
            metadata: { cost: q.calculated_cost }
          });
        }
      }

      // 2. Órdenes sin Guía (Paid, sin shipping_label_url, metodo != 'pickup' si existiera)
      // Buscamos órdenes pagadas recientemente que no tengan guía subida
      const { data: orders, error: ordError } = await admin
        .from('orders')
        .select('id, created_at, paid_at, status, shipping_label_url')
        .eq('status', 'paid')
        .is('shipping_label_url', null)
        .order('paid_at', { ascending: false })
        .limit(5);

      if (ordError) {
        errors.push(`Error fetching orders without label: ${ordError.message}`);
      } else if (orders) {
        for (const o of orders) {
          items.push({
            id: `nolabel-${o.id}`,
            sourcePanel: 'logistica',
            type: 'info',
            priority: 'medium',
            title: 'Falta Guía de Envío',
            description: `Orden pagada sin guía adjunta.`,
            timestamp: o.paid_at || o.created_at,
            actionUrl: `/admin/logistica?status=paid&highlight=${o.id}`,
            metadata: {}
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
    
    const { count: pendingGuides } = await admin
      .from('estafeta_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid');

    return {
      pending_estafeta_guides: pendingGuides || 0
    };
  }
};
