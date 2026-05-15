import { supabaseAdmin } from '@/lib/supabase/admin';

export class FeaturedService {
  /**
   * Get active featured listings for rotation.
   * Returns a random subset of active featured listings.
   * This ensures equitable visibility as requested ("rotación automática").
   */
  static async getRotatedListings(limit = 10): Promise<any[]> {
    const admin = supabaseAdmin();
    
    // 1. Get IDs of active featured listings
    // We filter by status='active' and end_at > now
    const { data: featuredIds, error } = await admin
      .from('featured_listings')
      .select('listing_id')
      .eq('status', 'active')
      .gt('end_at', new Date().toISOString());

    if (error || !featuredIds || featuredIds.length === 0) {
      return [];
    }

    // 2. Shuffle and pick IDs (simple rotation)
    // This provides random distribution each time it's called.
    const shuffledIds = featuredIds
      .map(x => x.listing_id)
      .sort(() => 0.5 - Math.random())
      .slice(0, limit);

    if (shuffledIds.length === 0) return [];

    // 3. Fetch full listing details
    // We also verify the listing itself is still active/not deleted
    const { data: listings } = await admin
      .from('listings')
      .select('id, title, price, images, status, seller_id, slug, currency')
      .in('id', shuffledIds)
      .eq('status', 'active')
      .eq('is_deleted', false);

    return listings || [];
  }

  /**
   * Get stats for admin dashboard
   */
  static async getStats() {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    const { count: activeCount } = await admin
      .from('featured_listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gt('end_at', now);

    return { activeCount: activeCount || 0 };
  }
}
