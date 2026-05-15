import { supabaseAdmin } from '@/lib/supabase/admin';
import { IntegrationAdapter, IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export const usersAdapter: IntegrationAdapter = {
  panel: 'usuarios',
  
  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Pending Verifications: is_verified is false/null but ine_front_url is present
      if (!filter.status || filter.status === 'open') {
        const { data: users, error } = await admin
          .from('profiles')
          .select('id, full_name, email, created_at, ine_front_url')
          .is('is_verified', null) // or false, depending on logic. Usually null means pending if INE exists.
          .not('ine_front_url', 'is', null)
          .order('created_at', { ascending: true })
          .limit(filter.limit || 20);

        if (error) {
          errors.push(`Error fetching users: ${error.message}`);
        } else if (users) {
          for (const u of users) {
            items.push({
              id: u.id,
              sourcePanel: 'usuarios',
              type: 'info',
              priority: 'medium',
              title: `Verificación Pendiente: ${u.full_name || 'Usuario'}`,
              description: `INE subido, espera aprobación.`,
              timestamp: u.created_at,
              actionUrl: `/admin/usuarios?q=${u.email || u.id}`,
              metadata: {
                userId: u.id,
                email: u.email
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
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .is('is_verified', null)
        .not('ine_front_url', 'is', null);
      
      return {
        pending_verifications: count || 0
      };
    } catch {
      return {};
    }
  }
};
