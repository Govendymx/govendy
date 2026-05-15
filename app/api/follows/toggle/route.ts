import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const sb = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: userData, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userData.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const userId = userData.user.id;

        const body = await req.json().catch(() => ({}));
        const sellerId = String(body.seller_id || '').trim();

        if (!sellerId) return NextResponse.json({ error: 'seller_id requerido' }, { status: 400 });
        if (sellerId === userId) return NextResponse.json({ error: 'No puedes seguirte a ti mismo' }, { status: 400 });

        const admin = supabaseAdmin();

        // Check if already following
        const { data: existing } = await admin
            .from('follows')
            .select('follower_id')
            .eq('follower_id', userId)
            .eq('seller_id', sellerId)
            .maybeSingle();

        let following: boolean;

        if (existing) {
            // Unfollow
            await admin
                .from('follows')
                .delete()
                .eq('follower_id', userId)
                .eq('seller_id', sellerId);
            following = false;
        } else {
            // Follow
            const { error: insertErr } = await admin
                .from('follows')
                .insert({ follower_id: userId, seller_id: sellerId });

            if (insertErr) {
                console.error('[FOLLOW] Insert error:', insertErr);
                return NextResponse.json({ error: 'Error al seguir' }, { status: 500 });
            }
            following = true;
        }

        // Get follower count
        const { count } = await admin
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', sellerId);

        return NextResponse.json({ ok: true, following, follower_count: count || 0 });
    } catch (e: any) {
        console.error('[FOLLOW] Exception:', e);
        return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
    }
}
