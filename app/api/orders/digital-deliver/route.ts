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
 * POST /api/orders/digital-deliver
 * Seller delivers digital product data (serial, username, etc.) for a paid order.
 * Body: { order_id: string, fields: Record<string, string> }
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) {
            return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
        }

        const admin = supabaseAdmin();

        // Verify user from token
        const { data: userData, error: userError } = await admin.auth.getUser(token);
        if (userError || !userData.user) {
            return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 });
        }
        const userId = userData.user.id;

        const body = await req.json().catch(() => ({} as any));
        const orderId = String(body.order_id || '').trim();
        const fields = body.fields as Record<string, string>;

        if (!orderId) {
            return NextResponse.json({ ok: false, error: 'order_id requerido' }, { status: 400 });
        }
        if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
            return NextResponse.json({ ok: false, error: 'fields requerido (al menos un campo)' }, { status: 400 });
        }

        // Verify order exists and user is the seller
        const { data: order, error: orderError } = await admin
            .from('orders')
            .select('id, seller_id, buyer_id, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ ok: false, error: 'Orden no encontrada' }, { status: 404 });
        }
        if (order.seller_id !== userId) {
            return NextResponse.json({ ok: false, error: 'No eres el vendedor de esta orden' }, { status: 403 });
        }

        // Check if already delivered
        const { data: existing } = await admin
            .from('digital_deliveries')
            .select('id')
            .eq('order_id', orderId)
            .limit(1);

        if (existing && existing.length > 0) {
            // Update existing delivery
            const { error: updateError } = await admin
                .from('digital_deliveries')
                .update({ fields, delivered_at: new Date().toISOString() })
                .eq('order_id', orderId);

            if (updateError) {
                console.error('[DIGITAL-DELIVER] Update error:', updateError);
                return NextResponse.json({ ok: false, error: 'Error actualizando entrega' }, { status: 500 });
            }
        } else {
            // Insert new delivery
            const { error: insertError } = await admin
                .from('digital_deliveries')
                .insert({
                    order_id: orderId,
                    listing_id: null,
                    delivered_by: userId,
                    fields,
                });

            if (insertError) {
                console.error('[DIGITAL-DELIVER] Insert error:', insertError);
                return NextResponse.json({ ok: false, error: 'Error guardando entrega' }, { status: 500 });
            }
        }

        // Mark order as shipped/delivered
        await admin
            .from('orders')
            .update({ status: 'shipped' })
            .eq('id', orderId);

        // Send notification to buyer
        try {
            await admin.from('notifications').insert({
                user_id: order.buyer_id,
                type: 'digital_delivery',
                title: '¡Producto digital entregado!',
                body: 'El vendedor ha entregado los datos de tu producto digital. Revisa "Mis Compras" para ver los detalles.',
                link_to: `/dashboard/compras`,
                is_read: false,
            });
        } catch (e) {
            console.error('[DIGITAL-DELIVER] Notification error:', e);
        }

        return NextResponse.json({ ok: true, delivered: true });
    } catch (e) {
        console.error('[DIGITAL-DELIVER] Unexpected error:', e);
        return NextResponse.json({ ok: false, error: 'Error inesperado' }, { status: 500 });
    }
}
