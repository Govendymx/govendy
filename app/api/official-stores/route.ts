import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';



export async function GET(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Fetch only necessary public fields for the carousel
        const { data, error } = await admin
            .from('profiles')
            .select('id, full_name, avatar_url, store_logo_url, official_store_name, official_store_brand_color, official_store_banner_url, official_store_slogan')
            .eq('is_official_store', true)
            .order('official_store_name', { ascending: true });

        if (error) {
            console.error('Error fetching public official stores:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const res = NextResponse.json(data || []);
        res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res;
    } catch (err: any) {
        console.error('Server error in public official-stores API:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
