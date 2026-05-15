import { supabaseAdmin } from '@/lib/supabase/admin';
import { IntegrationAdapter, IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export const withdrawalsAdapter: IntegrationAdapter = {
  panel: 'retiros',
  
  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Fetch pending withdrawals
      if (!filter.status || filter.status === 'open') {
        const { data: withdrawals, error } = await admin
          .from('wallet_withdrawals')
          .select('id, amount, status, created_at, user_id')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }) // Oldest first for priority
          .limit(filter.limit || 20);

        if (error) {
          errors.push(`Error fetching withdrawals: ${error.message}`);
        } else if (withdrawals) {
          for (const w of withdrawals) {
            items.push({
              id: w.id,
              sourcePanel: 'retiros',
              type: 'warning',
              priority: 'high',
              title: `Retiro Pendiente: $${w.amount}`,
              description: `Solicitud de retiro por procesar.`,
              timestamp: w.created_at,
              actionUrl: `/admin/retiros?q=${w.id}`,
              metadata: {
                amount: w.amount,
                status: w.status,
                userId: w.user_id
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
        .from('wallet_withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      return {
        pending_withdrawals: count || 0
      };
    } catch {
      return {};
    }
  }
};
