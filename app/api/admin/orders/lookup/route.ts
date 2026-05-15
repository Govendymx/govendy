import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
    const auth = req.headers.get('authorization') || '';
    const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) return { ok: false as const, status: 401, error: 'Missing token' };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const client = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await client.auth.getUser(token);
    if (userErr || !userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

    const admin = supabaseAdmin();
    const { data: row } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
    if (!row) return { ok: false as const, status: 403, error: 'No autorizado.' };

    return { ok: true as const, admin };
}

export async function GET(req: NextRequest) {
    try {
        const guard = await requireAdmin(req);
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

        const id = req.nextUrl.searchParams.get('id')?.trim();
        if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

        const { data: order, error } = await guard.admin
            .from('orders')
            .select('id, status, total, subtotal, shipping_fee, payment_method, shipping_carrier, buyer_id, seller_id, created_at, updated_at, reference_code')
            .eq('id', id)
            .maybeSingle();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

        // Enrich with buyer/seller profiles
        const userIds = [String(order.buyer_id || ''), String(order.seller_id || '')].filter(Boolean);
        const profiles: Record<string, any> = {};
        if (userIds.length > 0) {
            const { data: profs } = await guard.admin.from('profiles').select('id, full_name, email, nickname').in('id', userIds);
            (profs ?? []).forEach((p: any) => { profiles[p.id] = p; });
        }

        const buyer = profiles[String(order.buyer_id || '')] || null;
        const seller = profiles[String(order.seller_id || '')] || null;

        return NextResponse.json({
            ok: true,
            order: {
                ...order,
                buyer_email: buyer?.email || buyer?.nickname || '',
                buyer_name: buyer?.full_name || buyer?.email || '',
                seller_name: seller?.full_name || seller?.email || '',
                _type: 'order',
            },
        });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Error interno' }, { status: 500 });
    }
}
