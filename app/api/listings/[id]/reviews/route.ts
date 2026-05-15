import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const listingId = params.id;
    if (!listingId) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            cookie: (await cookieStore).getAll().map(c => `${c.name}=${c.value}`).join('; ')
          }
        }
      }
    );

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sort = searchParams.get('sort') || 'recent'; // recent, helpful, highest, lowest
    const offset = (page - 1) * limit;

    // Usar supabaseAdmin para evitar bloqueos de RLS en la lectura
    const adminDb = supabaseAdmin();

    const { data: reviewsRaw, count, error } = await adminDb
      .from('product_reviews')
      .select('*', { count: 'exact' })
      .eq('listing_id', listingId)
      .eq('status', 'active')
      .order(sort === 'helpful' ? 'helpful_count' : sort === 'highest' ? 'rating' : sort === 'lowest' ? 'rating' : 'created_at', { ascending: sort === 'lowest' })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[reviews GET] error fetching reviews:', error);
      return NextResponse.json({ reviews: [], pagination: { page, limit, total: 0, pages: 0 }, stats: { average: 0, total: 0, breakdown: {}, features: [] } });
    }

    // Fetch profiles separately to avoid FK dependency
    const userIds = [...new Set((reviewsRaw || []).map((r: any) => r.user_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await adminDb
        .from('profiles')
        .select('id, full_name, avatar_url, city, state')
        .in('id', userIds);
      if (profiles) {
        profiles.forEach((p: any) => { profilesMap[p.id] = p; });
      }
    }
    const reviews = (reviewsRaw || []).map((r: any) => ({ ...r, user: profilesMap[r.user_id] || null }));

    // Usar admin para calcular stats también (evita RLS)
    const { data: allReviews } = await adminDb
      .from('product_reviews')
      .select('rating, feature_ratings')
      .eq('listing_id', listingId)
      .eq('status', 'active');

    const totalReviews = allReviews.length;
    const avgRating = totalReviews > 0
      ? allReviews.reduce((sum, r) => sum + Number(r.rating), 0) / totalReviews
      : 0;

    // Rating breakdown (1-5 stars)
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    // Feature ratings breakdown
    const featureStats: Record<string, { sum: number; count: number }> = {};

    allReviews.forEach(r => {
      const rounded = Math.round(Number(r.rating));
      if (rounded >= 1 && rounded <= 5) {
        breakdown[rounded as keyof typeof breakdown]++;
      }

      if (r.feature_ratings) {
        Object.entries(r.feature_ratings as Record<string, number>).forEach(([key, val]) => {
          if (!featureStats[key]) featureStats[key] = { sum: 0, count: 0 };
          featureStats[key].sum += Number(val);
          featureStats[key].count++;
        });
      }
    });

    const features = Object.entries(featureStats).map(([key, data]) => ({
      name: key,
      rating: data.count > 0 ? data.sum / data.count : 0
    }));

    // Check if current user has voted on these reviews (if logged in)
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    let userVotes: Record<string, number> = {};

    if (userId && reviews.length > 0) {
      const { data: votes } = await supabase
        .from('product_review_votes')
        .select('review_id, vote_type')
        .eq('user_id', userId)
        .in('review_id', reviews.map(r => r.id));

      if (votes) {
        votes.forEach(v => {
          userVotes[v.review_id] = v.vote_type;
        });
      }
    }

    return NextResponse.json({
      reviews: reviews.map(r => ({
        ...r,
        user_vote: userVotes[r.id] || 0
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      },
      stats: {
        average: avgRating,
        total: totalReviews,
        breakdown,
        features
      }
    });

  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const listingId = params.id;
    if (!listingId) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userData.user.id;

    const body = await req.json();
    const { rating, title, content, images, feature_ratings } = body;

    if (!rating || rating < 0.5 || rating > 5) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Check if user already reviewed this listing
    const { data: existing } = await admin
      .from('product_reviews')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Ya dejaste una reseña para este producto' }, { status: 409 });
    }

    let isVerified = false;
    try {
      const { data: orders } = await admin
        .from('orders')
        .select('id')
        .eq('buyer_id', userId)
        .in('status', ['delivered', 'completed', 'rated', 'paid', 'shipped']);

      if (orders && orders.length > 0) {
        const orderIds = orders.map((o: any) => o.id);
        const { data: items } = await admin
          .from('order_items')
          .select('id')
          .eq('listing_id', listingId)
          .in('order_id', orderIds)
          .limit(1);
        if (items && items.length > 0) isVerified = true;
      }
    } catch {
      // If verification fails, continue without verified flag
    }

    const { data: review, error: insertError } = await admin
      .from('product_reviews')
      .insert({
        listing_id: listingId,
        user_id: userId,
        rating,
        title: title || null,
        content: content || null,
        images: images || [],
        feature_ratings: feature_ratings || {},
        is_verified_purchase: isVerified,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[reviews POST] insert error:', insertError);
      throw insertError;
    }

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
