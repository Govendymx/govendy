import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Admin (basic check via token in header if needed, but middleware handles route protection usually)
    // For API routes called from client, we should verify the user is admin.
    // However, since this is a GET request, we rely on the session.

    // Quick auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();

    // 2. Fetch Stores using Admin Client (Bypasses RLS)
    let data, error;
    try {
      const res = await admin
        .from('profiles')
        .select('id, full_name, email, is_official_store, official_store_name, official_store_brand_color, official_store_banner_url, official_store_slogan')
        .eq('is_official_store', true)
        .order('official_store_name', { ascending: true });
      data = res.data;
      error = res.error;
    } catch (e) {
      // Fallback sin email
      const res = await admin
        .from('profiles')
        .select('id, full_name, is_official_store, official_store_name, official_store_brand_color, official_store_banner_url, official_store_slogan')
        .eq('is_official_store', true)
        .order('official_store_name', { ascending: true });
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('Error fetching official stores:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter in Javascript to be safe
    const mappedStores = data
      .filter((user: any) => {
        // Asegurarse de que is_official_store es true explícitamente
        return user.is_official_store === true;
      })
      .map((user: any) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        official_store_name: user.official_store_name,
        official_store_brand_color: user.official_store_brand_color,
        official_store_banner_url: user.official_store_banner_url,
        official_store_slogan: user.official_store_slogan,
        is_official_store: user.is_official_store
      }));

    return NextResponse.json(mappedStores);
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
