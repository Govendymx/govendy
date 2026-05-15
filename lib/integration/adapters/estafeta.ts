import { supabaseAdmin } from '@/lib/supabase/admin';
import { IntegrationAdapter, IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export const estafetaAdapter: IntegrationAdapter = {
  panel: 'tienda_estafeta',
  
  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Paid quotes without guides (guide_url is null or empty)
      if (!filter.status || filter.status === 'open') {
        const { data: quotes, error } = await admin
          .from('estafeta_quotes')
          .select('id, created_at, paid_at, calculated_cost, status, guide_url, tracking_number')
          .eq('status', 'paid')
          .is('guide_url', null) // Check for null guide_url
          .order('paid_at', { ascending: true }) // Oldest paid first
          .limit(filter.limit || 20);

        if (error) {
          errors.push(`Error fetching estafeta quotes: ${error.message}`);
        } else if (quotes) {
          for (const q of quotes) {
            items.push({
              id: q.id,
              sourcePanel: 'tienda_estafeta',
              type: 'warning',
              priority: 'high',
              title: `Guía Pendiente: $${q.calculated_cost}`,
              description: `Cotización pagada, falta subir guía.`,
              timestamp: q.paid_at || q.created_at,
              actionUrl: `/admin/estafeta?status=paid`,
              metadata: {
                cost: q.calculated_cost,
                status: q.status
              }
            });
          }
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

  async getMetrics() {
    const admin = supabaseAdmin();
    try {
      const { count } = await admin
        .from('estafeta_quotes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid')
        .is('guide_url', null);
      
      return {
        pending_guides: count || 0
      };
    } catch {
      return {};
    }
  }
};
