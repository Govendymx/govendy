import { supabaseAdmin } from '@/lib/supabase/admin';
import { IntegrationAdapter, IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export const listingsAdapter: IntegrationAdapter = {
  panel: 'publicaciones',
  
  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // Recent listings (last 24h) or any specific "flagged" status if exists
      // Assuming 'active' for now, sorted by newest
      const { data: listings, error } = await admin
        .from('listings')
        .select('id, title, status, created_at, price')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(filter.limit || 10);

      if (error) {
        errors.push(`Error fetching listings: ${error.message}`);
      } else if (listings) {
        for (const l of listings) {
          // Only show very recent ones as "Info" items
          const isRecent = new Date(l.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
          
          if (isRecent) {
            items.push({
              id: l.id,
              sourcePanel: 'publicaciones',
              type: 'info',
              priority: 'low',
              title: `Nueva Publicación: ${l.title}`,
              description: `$${l.price} - ${l.status}`,
              timestamp: l.created_at,
              actionUrl: `/admin/listings?q=${l.id}`, // assuming listings page is at /admin/listings
              metadata: {
                price: l.price,
                status: l.status
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
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      return {
        active_listings: count || 0
      };
    } catch {
      return {};
    }
  }
};
