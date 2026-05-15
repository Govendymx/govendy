import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

/**
 * GET /api/orders/digital-delivery?order_id=xxx
 * Returns the digital delivery data for an order (accessible by buyer or seller).
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
        }

        const admin = supabaseAdmin();

        const { data: userData, error: userError } = await admin.auth.getUser(token);
        if (userError || !userData.user) {
            return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 });
        }
        const userId = userData.user.id;

        const orderId = req.nextUrl.searchParams.get('order_id')?.trim();
        if (!orderId) {
            return NextResponse.json({ ok: false, error: 'order_id requerido' }, { status: 400 });
        }

        // Verify user is buyer or seller of this order
        const { data: order, error: orderError } = await admin
            .from('orders')
            .select('id, seller_id, buyer_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 });
        }
        if (order.seller_id !== userId && order.buyer_id !== userId) {
            return NextResponse.json({ ok: false, error: 'No tienes acceso a esta orden' }, { status: 403 });
        }

        // Fetch delivery data
        const { data: delivery, error: deliveryError } = await admin
            .from('digital_deliveries')
            .select('id, fields, delivered_at, created_at')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (deliveryError) {
            console.error('[DIGITAL-DELIVERY] Query error:', deliveryError);
            return NextResponse.json({ ok: false, error: 'Error consultando entrega' }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            delivered: !!delivery,
            delivery: delivery || null,
        });
    } catch (e) {
        console.error('[DIGITAL-DELIVERY] Unexpected error:', e);
        return NextResponse.json({ ok: false, error: 'Error inesperado' }, { status: 500 });
    }
}
