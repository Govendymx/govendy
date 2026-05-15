import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET: obtener productos por IDs (bypasses RLS para que viewers vean todos los productos del live)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const idsParam = searchParams.get('ids');

        if (!idsParam) {
            return NextResponse.json({ products: [] });
        }

        const ids = idsParam.split(',').filter(Boolean).slice(0, 50); // max 50

        if (ids.length === 0) {
            return NextResponse.json({ products: [] });
        }

        const admin = supabaseAdmin();
        const { data, error } = await admin
            .from('listings')
            .select('id, title, price, images')
            .in('id', ids);

        if (error) throw error;

        return NextResponse.json({ products: data || [] });
    } catch (e: any) {
        console.error('[Live Products] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
