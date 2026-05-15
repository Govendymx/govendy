import { IntegrationAdapter, IntegrationFilter, IntegrationResult, IntegrationItem } from '../core/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const pocketCashAdapter: IntegrationAdapter = {
  panel: 'pocketcash',

  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Pending Topups
      if (!filter.status || filter.status === 'pending') {
        const { data: topups, error } = await admin
          .from('wallet_topups')
          .select('id, amount, status, created_at, user_id, proof_url')
          .in('status', ['pending', 'pending_proof', 'pending_approval'])
          .order('created_at', { ascending: false })
          .limit(filter.limit || 20);

        if (error) {
          errors.push(`Error fetching topups: ${error.message}`);
        } else if (topups) {
          for (const t of topups) {
            items.push({
              id: t.id,
              sourcePanel: 'pocketcash',
              type: 'warning', // Needs attention
              priority: 'high',
              title: `Recarga Pendiente: $${t.amount}`,
              description: `Solicitud de recarga recibida.`,
              timestamp: t.created_at,
              actionUrl: `/admin/pocketcash?status=pending&q=${t.id}`,
              metadata: {
                amount: t.amount,
                status: t.status,
                userId: t.user_id,
                proofUrl: t.proof_url
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
        .from('wallet_topups')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'pending_proof', 'pending_approval']);
      
      return {
        pending_topups: count || 0
      };
    } catch {
      return {};
    }
  }
};
