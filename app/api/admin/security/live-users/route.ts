import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin Role
    // We can use the admin client to check the role quickly
    const { data: adminRow } = await supabaseAdmin()
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch Active Users (Last 60 minutes for better visibility)
    // Using supabaseAdmin to BYPASS RLS
    const timeWindow = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: usersData, error: usersError } = await supabaseAdmin()
      .from('user_ips')
      .select('*')
      .gt('detected_at', timeWindow)
      .order('detected_at', { ascending: false });

    if (usersError) {
      console.error('Database Error fetching user_ips:', usersError);
      throw usersError;
    }

    return NextResponse.json({ 
      users: usersData || [],
      count: usersData?.length || 0,
      debug: {
        window: '60m',
        since: timeWindow,
        serverTime: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Live Users API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
