import { supabaseAdmin } from '@/lib/supabase/admin';
import { IntegrationAdapter, IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export const returnsAdapter: IntegrationAdapter = {
  panel: 'devoluciones',
  
  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      if (!filter.status || filter.status === 'open') {
        // Fetch disputes with return-related reasons
        const { data: returns, error } = await admin
          .from('disputes')
          .select('id, order_id, reason_code, status, created_at, last_message_at')
          .eq('status', 'open')
          .in('reason_code', ['damaged', 'not_as_described', 'missing_items'])
          .order('last_message_at', { ascending: false })
          .limit(filter.limit || 20);

        if (error && !error.message.includes('does not exist')) {
          errors.push(`Error fetching returns: ${error.message}`);
        } else if (returns) {
          for (const r of returns) {
            items.push({
              id: r.id,
              sourcePanel: 'devoluciones',
              type: 'warning',
              priority: 'medium',
              title: `Devolución: ${r.reason_code}`,
              description: `Orden #${r.order_id}`,
              timestamp: r.last_message_at || r.created_at,
              actionUrl: `/admin/devoluciones?q=${r.id}`, // Assuming shared view or specific view
              metadata: {
                status: r.status,
                orderId: r.order_id,
                reason: r.reason_code
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
        .in('reason_code', ['damaged', 'not_as_described', 'missing_items']);
      
      return {
        open_returns: count || 0
      };
    } catch {
      return {};
    }
  }
};
