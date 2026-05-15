import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnon);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = supabaseAdmin();

    // 1. Get user's active listings
    const { data: listings, error: listingsError } = await admin
      .from('listings')
      .select('id, title, price, images, status, is_featured, created_at')
      .eq('seller_id', user.id)
      .eq('is_deleted', false)
      .neq('status', 'sold') // Only show unsold items? Or maybe allow sold items to be seen but not promoted?
      .order('created_at', { ascending: false });

    if (listingsError) throw listingsError;

    // 2. Get active featured subscriptions
    let featured: any[] = [];
    try {
      const { data, error: featuredError } = await admin
        .from('featured_listings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('end_at', new Date().toISOString());

      if (featuredError) {
        // Ignorar error si la tabla no existe (migración pendiente)
        const msg = featuredError.message.toLowerCase();
        if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
          console.error('Error fetching featured_listings:', featuredError);
        }
      } else {
        featured = data || [];
      }
    } catch (err) {
      // Ignorar errores de conexión/tabla
      console.warn('Failed to query featured_listings (table might be missing)');
    }

    // 3. Merge
    const featuredMap = new Map(featured.map(f => [f.listing_id, f]));

    const result = listings?.map(l => ({
      ...l,
      featured_info: featuredMap.get(l.id) || null
    }));

    return NextResponse.json({ listings: result });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
