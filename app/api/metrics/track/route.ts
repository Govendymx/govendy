import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            cookie: (await cookieStore).getAll().map(c => `${c.name}=${c.value}`).join('; ')
          }
        }
      }
    );
    const body = await request.json();
    const { type, data } = body;

    // Get current user if available (optional)
    const { data: { session } } = await supabase.auth.getSession();
    const user_id = session?.user?.id || null;

    if (type === 'search') {
      const { query } = data;
      if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });

      const { error } = await supabase.from('search_logs').insert({
        user_id,
        query: query.trim(),
        results_count: 0 // We can't easily know this from client without exposing it
      });

      if (error) throw error;
    } else if (type === 'view') {
      const { listing_id, source } = data;
      if (!listing_id) return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });

      const { error } = await supabase.from('product_views').insert({
        user_id,
        listing_id,
        source: source || 'direct',
        duration_seconds: 0 // Initial view
      });

      if (error) throw error;
    } else if (type === 'share') {
      const { listing_id, platform } = data;
      if (!listing_id || !platform) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { error } = await supabase.from('product_shares').insert({
        user_id,
        listing_id,
        platform
      });

      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Metrics Track Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
