import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cache for 1 hour
export const revalidate = 3600;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const listingId = params.id;
    if (!listingId) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Get current listing details (category, price) for fallback
    const { data: current, error: currError } = await supabase
      .from('listings')
      .select('category, price, seller_id')
      .eq('id', listingId)
      .single();

    if (currError || !current) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // 2. Collaborative Filtering: "Users who viewed this also viewed..."
    // Strategy:
    // a. Get last 50 users who viewed this item
    // b. Get items they viewed (limit 10 per user)
    // c. Aggregate and sort by frequency

    // a. Get users
    const { data: views } = await supabase
      .from('product_views')
      .select('user_id')
      .eq('listing_id', listingId)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    let recommendedIds: string[] = [];

    if (views && views.length > 0) {
      const userIds = [...new Set(views.map(v => v.user_id))];

      // b. Get other views
      const { data: otherViews } = await supabase
        .from('product_views')
        .select('listing_id')
        .in('user_id', userIds)
        .neq('listing_id', listingId) // Exclude current
        .limit(200);

      if (otherViews) {
        // c. Count frequency
        const counts: Record<string, number> = {};
        otherViews.forEach(v => {
          counts[v.listing_id] = (counts[v.listing_id] || 0) + 1;
        });

        // Sort by count
        recommendedIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10) // Top 10
          .map(e => e[0]);
      }
    }

    // 3. Fallback/Fill: Similar items (Same Category)
    let recommendations: any[] = [];

    // If we have some collaborative results, fetch them
    if (recommendedIds.length > 0) {
      const { data: colabItems } = await supabase
        .from('listings')
        .select('id, title, price, images, currency, free_shipping, status, seller_id')
        .in('id', recommendedIds)
        .eq('status', 'active');

      if (colabItems) recommendations = colabItems;
    }

    // Fill the rest up to 10 with Category matches
    if (recommendations.length < 10) {
      const needed = 10 - recommendations.length;
      const excludeIds = [listingId, ...recommendations.map(r => r.id)];

      // Calculate price range (+/- 50%)
      const minPrice = current.price * 0.5;
      const maxPrice = current.price * 1.5;

      const { data: fillItems } = await supabase
        .from('listings')
        .select('id, title, price, images, currency, free_shipping, status, seller_id')
        .eq('category', current.category)
        .eq('status', 'active')
        .neq('seller_id', current.seller_id) // Prefer other sellers for variety
        .gte('price', minPrice)
        .lte('price', maxPrice)
        .not('id', 'in', excludeIds)
        .limit(needed);

      if (fillItems) {
        recommendations = [...recommendations, ...fillItems];
      }
    }

    // If still not enough, loosen constraints (remove price range)
    if (recommendations.length < 5) {
      const excludeIds = [listingId, ...recommendations.map(r => r.id)];
      const { data: fillMore } = await supabase
        .from('listings')
        .select('id, title, price, images, currency, free_shipping, status, seller_id')
        .eq('category', current.category)
        .eq('status', 'active')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(10 - recommendations.length);

      if (fillMore) recommendations = [...recommendations, ...fillMore];
    }

    return NextResponse.json({ recommendations });

  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
