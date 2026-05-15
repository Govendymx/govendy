import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = supabaseAdmin();
        const { data: listings, error } = await admin
            .from('listings')
            .select('id, title, price, images, status')
            .eq('seller_id', userData.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('[my-listings] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ listings: listings || [] });
    } catch (err: any) {
        console.error('[my-listings] Exception:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
