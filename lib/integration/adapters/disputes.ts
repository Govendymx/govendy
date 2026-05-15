import { IntegrationAdapter, IntegrationFilter, IntegrationResult, IntegrationItem } from '../core/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const disputesAdapter: IntegrationAdapter = {
  panel: 'disputas',

  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Open Disputes
      if (!filter.status || filter.status === 'open') {
        const { data: disputes, error } = await admin
                  .from('disputes')
                  .select('id, order_id, reason_code, status, created_at, last_message_at')
                  .eq('status', 'open')
                  .not('reason_code', 'in', '("damaged","not_as_described","missing_items")') // Exclude returns
                  .order('last_message_at', { ascending: false })
                  .limit(filter.limit || 20);

        if (error) {
          // Ignore table not found errors if feature not enabled
          if (!error.message.includes('does not exist')) {
            errors.push(`Error fetching disputes: ${error.message}`);
          }
        } else if (disputes) {
          for (const d of disputes) {
            items.push({
              id: d.id,
              sourcePanel: 'disputas',
              type: 'error', // Disputes are critical
              priority: 'high',
              title: `Disputa Abierta: ${d.reason_code || 'Sin motivo'}`,
              description: `Orden #${d.order_id}`,
              timestamp: d.last_message_at || d.created_at,
              actionUrl: `/admin/disputas/${d.id}`,
              metadata: {
                status: d.status,
                orderId: d.order_id
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
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .not('reason_code', 'in', '("damaged","not_as_described","missing_items")');
      
      return {
        open_disputes: count || 0
      };
    } catch {
      return {};
    }
  }
};
