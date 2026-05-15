import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) return NextResponse.json({ error: 'No auth' }, { status: 401 });

        const admin = supabaseAdmin();
        const { data: { user }, error: userErr } = await admin.auth.getUser(token);
        if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: row } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
        if (!row) return NextResponse.json({ error: 'No admin' }, { status: 403 });

        const body = await req.json();
        const { sessionId } = body;

        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) return NextResponse.json({ error: 'No MP token' }, { status: 500 });

        const log: any = { pasos: [], tokenPrefix: accessToken.substring(0, 20) + '...' };

        // 1. Buscar la checkout_session
        const { data: session, error: sessErr } = await admin
            .from('checkout_sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        log.session = session ? {
            id: session.id,
            buyer_id: session.buyer_id,
            order_ids: session.order_ids,
            payment_method: session.payment_method,
            status: session.status,
            amount: session.amount,
            mp_payment_id: session.mp_payment_id,
            mp_preference_id: session.mp_preference_id,
            mp_status: session.mp_status,
            reference_code: session.reference_code,
            created_at: session.created_at,
        } : null;
        log.sessionError = sessErr?.message || null;

        if (!session) {
            return NextResponse.json({ log, error: 'Session no encontrada' }, { status: 404 });
        }

        // 2. Verificar preferencia en MP (HTTP directo)
        const prefId = session.mp_preference_id;
        if (prefId) {
            try {
                const prefRes = await fetch(`https://api.mercadopago.com/checkout/preferences/${prefId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                const prefData = await prefRes.json();
                log.pasos.push({
                    paso: '2_preferencia',
                    httpStatus: prefRes.status,
                    external_reference: prefData.external_reference,
                    items: prefData.items?.map((i: any) => ({ title: i.title, unit_price: i.unit_price })),
                    init_point: prefData.init_point ? prefData.init_point.substring(0, 60) + '...' : 'MISSING',
                    date_created: prefData.date_created,
                    collector_id: prefData.collector_id,
                    error_message: prefData.message || null,
                });
            } catch (e: any) {
                log.pasos.push({ paso: '2_preferencia', error: e?.message });
            }
        }

        // 3. Buscar por external_reference = sessionId (HTTP directo, sin SDK)
        try {
            const url3 = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(sessionId)}&limit=10&sort=date_created&criteria=desc`;
            const res3 = await fetch(url3, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const data3 = await res3.json();
            log.pasos.push({
                paso: '3_ext_ref_http',
                httpStatus: res3.status,
                ref: sessionId,
                total: data3.paging?.total || data3.results?.length || 0,
                results: (data3.results || []).slice(0, 5).map((r: any) => ({
                    id: r.id, status: r.status, status_detail: r.status_detail,
                    payment_method_id: r.payment_method_id, payment_type_id: r.payment_type_id,
                    date_created: r.date_created, external_reference: r.external_reference,
                    transaction_amount: r.transaction_amount,
                })),
                raw_error: data3.message || data3.error || null,
            });
        } catch (e: any) {
            log.pasos.push({ paso: '3_ext_ref_http', error: e?.message });
        }

        // 4. Buscar TODOS los pagos recientes (HTTP directo, sin SDK ni parámetros de fecha)
        try {
            const url4 = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=10`;
            const res4 = await fetch(url4, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const data4 = await res4.json();
            log.pasos.push({
                paso: '4_recientes_http',
                httpStatus: res4.status,
                total: data4.paging?.total || 0,
                results: (data4.results || []).slice(0, 5).map((r: any) => ({
                    id: r.id, status: r.status, payment_method_id: r.payment_method_id,
                    external_reference: r.external_reference,
                    transaction_amount: r.transaction_amount,
                    date_created: r.date_created,
                })),
                raw_error: data4.message || data4.error || null,
            });
        } catch (e: any) {
            log.pasos.push({ paso: '4_recientes_http', error: e?.message });
        }

        // 5. Verificar las órdenes asociadas
        if (session.order_ids && session.order_ids.length > 0) {
            const { data: orders } = await admin
                .from('orders')
                .select('id, status, payment_method, total, paid_at, created_at')
                .in('id', session.order_ids);
            log.orders = orders;
        }

        return NextResponse.json({ ok: true, log });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
