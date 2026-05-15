import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin status
    const adminClient = supabaseAdmin();
    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
        
      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'top-searches', 'top-products', etc.
    const period = searchParams.get('period') || '30d'; // 24h, 7d, 30d, all
    const limit = parseInt(searchParams.get('limit') || '50');

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    let previousDate = new Date(); // Start of previous period

    if (period === '24h') {
      startDate.setHours(now.getHours() - 24);
      previousDate.setHours(now.getHours() - 48);
    } else if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
      previousDate.setDate(now.getDate() - 14);
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30);
      previousDate.setDate(now.getDate() - 60);
    } else if (period === 'all') {
      startDate = new Date(0);
      previousDate = new Date(0);
    }

    const isoStartDate = startDate.toISOString();
    const isoPreviousDate = previousDate.toISOString();
    
    let data: any[] = [];

    // Helper to calculate trend
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // 1. Top Searches
    if (type === 'top-searches') {
      const { data: raw } = await adminClient
        .from('search_logs')
        .select('query, created_at')
        .gte('created_at', isoPreviousDate); // Fetch both periods
      
      if (raw) {
        const currentCounts: Record<string, number> = {};
        const previousCounts: Record<string, number> = {};
        
        raw.forEach((r: any) => {
          const term = r.query?.trim().toLowerCase();
          if (!term) return;
          
          const created = new Date(r.created_at);
          if (created >= startDate) {
            currentCounts[term] = (currentCounts[term] || 0) + 1;
          } else {
            previousCounts[term] = (previousCounts[term] || 0) + 1;
          }
        });
        
        data = Object.entries(currentCounts)
          .map(([term, count]) => ({ 
            term, 
            count,
            trend: calculateTrend(count, previousCounts[term] || 0)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      }
    }

    // 2. Best Selling Products
    else if (type === 'top-products') {
      // Fetch paid orders in range (both periods)
      const { data: orders } = await adminClient
        .from('orders')
        .select('id, created_at')
        .eq('status', 'paid')
        .gte('created_at', isoPreviousDate);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: items } = await adminClient
          .from('order_items')
          .select('listing_id, price, quantity, order_id')
          .in('order_id', orderIds);

        if (items) {
           const currentStats: Record<string, { count: number, revenue: number }> = {};
           const previousStats: Record<string, { count: number, revenue: number }> = {};
           
           // Create map of order dates for quick lookup
           const orderDates = new Map(orders.map(o => [o.id, new Date(o.created_at)]));

           items.forEach(item => {
             const orderDate = orderDates.get(item.order_id);
             if (!orderDate) return;

             const isCurrent = orderDate >= startDate;
             const targetStats = isCurrent ? currentStats : previousStats;

             if (!targetStats[item.listing_id]) {
               targetStats[item.listing_id] = { count: 0, revenue: 0 };
             }
             targetStats[item.listing_id].count += (item.quantity || 1);
             targetStats[item.listing_id].revenue += (item.price * (item.quantity || 1));
           });

           // Get listing details
           const listingIds = Object.keys(currentStats);
           if (listingIds.length > 0) {
             const { data: listings } = await adminClient
               .from('listings')
               .select('id, title, images')
               .in('id', listingIds);
             
             const listingMap = new Map(listings?.map(l => [l.id, l]) || []);

             data = Object.entries(currentStats)
               .map(([id, stats]) => {
                 const l = listingMap.get(id) as any;
                 const prev = previousStats[id] || { count: 0, revenue: 0 };
                 return {
                   id,
                   name: l?.title || 'Unknown Product',
                   image: l?.images?.[0] || null,
                   sales: stats.count,
                   revenue: stats.revenue,
                   trend: calculateTrend(stats.count, prev.count)
                 };
               })
               .sort((a, b) => b.sales - a.sales)
               .slice(0, limit);
           }
        }
      }
    }

    // 3. Best Sellers (Users)
    else if (type === 'top-sellers') {
      const { data: orders } = await adminClient
        .from('orders')
        .select('seller_id, total, created_at')
        .eq('status', 'paid')
        .gte('created_at', isoPreviousDate);
      
      if (orders) {
        const currentStats: Record<string, { count: number, revenue: number }> = {};
        const previousStats: Record<string, { count: number, revenue: number }> = {};

        orders.forEach(o => {
          const created = new Date(o.created_at);
          const isCurrent = created >= startDate;
          const targetStats = isCurrent ? currentStats : previousStats;

          if (!targetStats[o.seller_id]) {
            targetStats[o.seller_id] = { count: 0, revenue: 0 };
          }
          targetStats[o.seller_id].count += 1;
          targetStats[o.seller_id].revenue += o.total;
        });

        const sellerIds = Object.keys(currentStats);
        if (sellerIds.length > 0) {
          const { data: profiles } = await adminClient
            .from('profiles')
            .select('id, full_name, email')
            .in('id', sellerIds);
          
          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

          data = Object.entries(currentStats)
            .map(([id, stats]) => {
              const p = profileMap.get(id) as any;
              const prev = previousStats[id] || { count: 0, revenue: 0 };
              return {
                id,
                name: p?.full_name || p?.email || 'Unknown',
                sales: stats.count,
                revenue: stats.revenue,
                trend: calculateTrend(stats.revenue, prev.revenue) // Trend based on revenue for sellers
              };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
        }
      }
    }

    // 4. Most Viewed
    else if (type === 'most-viewed') {
      const { data: views } = await adminClient
        .from('product_views')
        .select('listing_id, created_at')
        .gte('created_at', isoPreviousDate);
      
      if (views) {
        const currentCounts: Record<string, number> = {};
        const previousCounts: Record<string, number> = {};

        views.forEach(v => {
          if (!v.listing_id) return;
          const created = new Date(v.created_at);
          if (created >= startDate) {
            currentCounts[v.listing_id] = (currentCounts[v.listing_id] || 0) + 1;
          } else {
            previousCounts[v.listing_id] = (previousCounts[v.listing_id] || 0) + 1;
          }
        });

        const listingIds = Object.keys(currentCounts);
        if (listingIds.length > 0) {
          const { data: listings } = await adminClient
            .from('listings')
            .select('id, title, images')
            .in('id', listingIds);
          
          const listingMap = new Map(listings?.map(l => [l.id, l]) || []);

          data = Object.entries(currentCounts)
            .map(([id, count]) => {
              const l = listingMap.get(id) as any;
              return {
                id,
                name: l?.title || 'Unknown',
                image: l?.images?.[0] || null,
                views: count,
                trend: calculateTrend(count, previousCounts[id] || 0)
              };
            })
            .sort((a, b) => b.views - a.views)
            .slice(0, limit);
        }
      }
    }

    // 5. Most Shared
    else if (type === 'most-shared') {
      const { data: shares } = await adminClient
        .from('product_shares')
        .select('listing_id, platform, created_at')
        .gte('created_at', isoPreviousDate);
      
      if (shares) {
        const currentCounts: Record<string, number> = {};
        const previousCounts: Record<string, number> = {};

        shares.forEach(s => {
          if (!s.listing_id) return;
          const created = new Date(s.created_at);
          if (created >= startDate) {
            currentCounts[s.listing_id] = (currentCounts[s.listing_id] || 0) + 1;
          } else {
            previousCounts[s.listing_id] = (previousCounts[s.listing_id] || 0) + 1;
          }
        });

        const listingIds = Object.keys(currentCounts);
        if (listingIds.length > 0) {
          const { data: listings } = await adminClient
            .from('listings')
            .select('id, title, images')
            .in('id', listingIds);
          
          const listingMap = new Map(listings?.map(l => [l.id, l]) || []);

          data = Object.entries(currentCounts)
            .map(([id, count]) => {
              const l = listingMap.get(id) as any;
              return {
                id,
                name: l?.title || 'Unknown',
                image: l?.images?.[0] || null,
                shares: count,
                trend: calculateTrend(count, previousCounts[id] || 0)
              };
            })
            .sort((a, b) => b.shares - a.shares)
            .slice(0, limit);
        }
      }
    }

    // 6. Most Liked (Favorites)
    else if (type === 'most-liked') {
      const { data: favs } = await adminClient
        .from('favorites')
        .select('listing_id, created_at')
        .gte('created_at', isoPreviousDate);
      
      if (favs) {
        const currentCounts: Record<string, number> = {};
        const previousCounts: Record<string, number> = {};

        favs.forEach(f => {
          if (!f.listing_id) return;
          const created = new Date(f.created_at);
          if (created >= startDate) {
            currentCounts[f.listing_id] = (currentCounts[f.listing_id] || 0) + 1;
          } else {
            previousCounts[f.listing_id] = (previousCounts[f.listing_id] || 0) + 1;
          }
        });

        const listingIds = Object.keys(currentCounts);
        if (listingIds.length > 0) {
          const { data: listings } = await adminClient
            .from('listings')
            .select('id, title, images')
            .in('id', listingIds);
          
          const listingMap = new Map(listings?.map(l => [l.id, l]) || []);

          data = Object.entries(currentCounts)
            .map(([id, count]) => {
              const l = listingMap.get(id) as any;
              return {
                id,
                name: l?.title || 'Unknown',
                image: l?.images?.[0] || null,
                likes: count,
                trend: calculateTrend(count, previousCounts[id] || 0)
              };
            })
            .sort((a, b) => b.likes - a.likes)
            .slice(0, limit);
        }
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Metrics API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
