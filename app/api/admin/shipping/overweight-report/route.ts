import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const sb = supabaseAdmin();

        const { data: { user }, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const sellerId = searchParams.get('seller_id') || null;
        const status = searchParams.get('status') || null; // 'pending', 'charged', 'none'

        let query = sb
            .from('shipping_labels')
            .select('*, orders(id, created_at, total_amount), profiles:seller_id(full_name, nickname, email)')
            .gt('overweight_fee', 0)
            .order('created_at', { ascending: false })
            .limit(200);

        if (sellerId) query = query.eq('seller_id', sellerId);
        if (status) query = query.eq('overweight_status', status);

        const { data, error } = await query;
        if (error) throw error;

        // Resumen por vendedor
        const bySeller: Record<string, { seller_name: string; total_pending: number; total_charged: number; count: number }> = {};
        for (const row of (data || [])) {
            const sid = row.seller_id || 'unknown';
            const p = (row as any).profiles;
            const name = p?.full_name || p?.nickname || p?.email || sid;
            if (!bySeller[sid]) bySeller[sid] = { seller_name: name, total_pending: 0, total_charged: 0, count: 0 };
            bySeller[sid].count++;
            if (row.overweight_status === 'pending') bySeller[sid].total_pending += Number(row.overweight_fee || 0);
            if (row.overweight_status === 'charged') bySeller[sid].total_charged += Number(row.overweight_fee || 0);
        }

        // Import history
        const { data: imports } = await sb
            .from('overweight_imports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        return NextResponse.json({
            success: true,
            labels: data || [],
            by_seller: bySeller,
            recent_imports: imports || [],
        });
    } catch (err: any) {
        console.error('[overweight-report]', err);
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
    }
}
