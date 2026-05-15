import { supabaseAdmin } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Verify Admin Auth
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: 'Unauthorized: No session found' }, { status: 401 });

    // Use admin client to bypass RLS for role check, just in case
    // (User is already authenticated via createServerClient)
    const admin = supabaseAdmin();
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      console.error('Forbidden access attempt:', user.id, profile?.role);
      return NextResponse.json({ error: `Forbidden: User role is '${profile?.role}'` }, { status: 403 });
    }

    // 2. Fix: Set is_approximate = true for non-GPS records
    // We can't do complex JSON filtering easily with JS client update syntax if relying on "NOT LIKE" inside JSON
    // But we can iterate or use a raw query if available.
    // Since we don't have raw query, we'll fetch and update in batches.
    
    // Actually, we can assume most records are IP based if we haven't launched GPS yet.
    // But let's be safe.
    
    // Fetch all records where is_approximate is false (default)
    let page = 0;
    let updatedCount = 0;
    const limit = 1000;
    
    while (true) {
      const { data: records, error } = await admin
        .from('user_ips')
        .select('id, metadata')
        .eq('is_approximate', false)
        .range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;
      if (!records || records.length === 0) break;

      const toUpdate = records.filter(r => {
        const source = r.metadata?.source;
        // If source is missing OR it does NOT start with 'browser_geolocation'
        return !source || !source.startsWith('browser_geolocation');
      });

      if (toUpdate.length > 0) {
        // Update in parallel (or batch if possible, but IDs are different)
        // Supabase doesn't support "update where id in list" with different values, but here the value is the same (true).
        const ids = toUpdate.map(r => r.id);
        
        const { error: updateError } = await admin
          .from('user_ips')
          .update({ is_approximate: true })
          .in('id', ids);
          
        if (updateError) throw updateError;
        updatedCount += ids.length;
      }

      if (records.length < limit) break;
      page++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Fixed ${updatedCount} records.` 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
