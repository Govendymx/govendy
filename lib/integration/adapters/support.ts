import { IntegrationAdapter, IntegrationFilter, IntegrationResult, IntegrationItem } from '../core/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const supportAdapter: IntegrationAdapter = {
  panel: 'soporte',

  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Open Support Tickets
      if (!filter.status || filter.status === 'open') {
        const { data: conversations, error } = await admin
          .from('support_conversations')
          .select('id, subject, status, created_at, last_message_at, assigned_admin_id, created_by')
          .eq('status', 'open')
          .order('last_message_at', { ascending: false })
          .limit(filter.limit || 20);

        if (error) {
          if (!error.message.includes('does not exist')) {
            errors.push(`Error fetching support: ${error.message}`);
          }
        } else if (conversations) {
          // We need to identify which ones need reply. 
          // For efficiency in this adapter, we'll just check if it's unassigned OR logic from route.
          // Replicating full "unread count" logic might be too heavy here, 
          // so we'll focus on "Unassigned" or "Open".
          
          for (const c of conversations) {
            const isUnassigned = !c.assigned_admin_id;
            
            items.push({
              id: c.id,
              sourcePanel: 'soporte',
              type: 'info',
              priority: isUnassigned ? 'high' : 'medium',
              title: `Soporte: ${c.subject || 'Sin asunto'}`,
              description: isUnassigned ? 'Ticket sin asignar' : `Ticket abierto - ${new Date(c.created_at).toLocaleDateString()}`,
              timestamp: c.last_message_at || c.created_at,
              actionUrl: `/admin/soporte?id=${c.id}`,
              metadata: {
                status: c.status,
                unassigned: isUnassigned,
                userId: c.created_by
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
        .from('support_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      
      return {
        open_tickets: count || 0
      };
    } catch {
      return {};
    }
  }
};
