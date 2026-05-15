import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
    
    // Auth Check (Admin)
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: adminUser } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).single();
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch featured listings
    const { data: featured, error } = await admin
      .from('featured_listings')
      .select(`
        *,
        listing:listings(id, title, price, images)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Manually fetch profiles to avoid complex FK setup on auth.users vs profiles
    const userIds = Array.from(new Set(featured.map(f => f.user_id)));
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email, nickname') // Assuming nickname exists, or email from profiles if synced
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));

    // Combine
    const result = featured.map(f => ({
      ...f,
      user: profileMap.get(f.user_id) || { id: f.user_id, full_name: 'Unknown' }
    }));

    return NextResponse.json({ featured: result });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
