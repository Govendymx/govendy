import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const userId = userData.user.id;
        const admin = supabaseAdmin();

        // Get purchased + redeemed gift cards
        const [purchased, redeemed] = await Promise.all([
            admin
                .from('gift_cards')
                .select('id, code, amount, status, payment_status, for_self, recipient_email, created_at, redeemed_at, payment_method')
                .eq('purchased_by', userId)
                .order('created_at', { ascending: false })
                .limit(50),
            admin
                .from('gift_cards')
                .select('id, code, amount, status, created_at, redeemed_at')
                .eq('redeemed_by', userId)
                .neq('purchased_by', userId) // exclude self-redeems (already in purchased)
                .order('redeemed_at', { ascending: false })
                .limit(50),
        ]);

        return NextResponse.json({
            ok: true,
            purchased: purchased.data || [],
            redeemed: redeemed.data || [],
        });

    } catch (error: any) {
        console.error('[GIFT-CARD LIST] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
