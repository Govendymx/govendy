import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const sellerId = req.nextUrl.searchParams.get('seller_id') || '';
        if (!sellerId) return NextResponse.json({ error: 'seller_id requerido' }, { status: 400 });

        // user_id se pasa como query param directamente — no depende del Bearer token
        const userId = req.nextUrl.searchParams.get('user_id') || '';

        const admin = supabaseAdmin();

        // Conteo de seguidores (siempre público)
        const { count } = await admin
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', sellerId);

        // Verificar si el usuario actual sigue al vendedor
        let following = false;
        if (userId) {
            const { data: row } = await admin
                .from('follows')
                .select('follower_id')
                .eq('follower_id', userId)
                .eq('seller_id', sellerId)
                .maybeSingle();
            following = !!row;
        }

        return NextResponse.json({ ok: true, following, follower_count: count || 0 });
    } catch (e: any) {
        console.error('[FOLLOW STATUS] Exception:', e);
        return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
    }
}
