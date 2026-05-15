import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

// Statuses that mean the order has NOT been paid yet (valid enum values from the DB)
// We do NOT pass these to .in() on the initial lookup to avoid enum cast errors on some Supabase configs.
// Instead we fetch the order first, then validate the status in JS before deleting.
const UNPAID_STATUSES = new Set(['pending', 'created', 'waiting_payment', 'payment_pending']);

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
    // Same auth pattern as other admin routes — check admin_users table
    const { data: row } = await admin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
    if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

    return { ok: true as const, admin, requesterId: userData.user.id };
}

export async function POST(req: NextRequest) {
    try {
        const guard = await requireAdmin(req);
        if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

        const body = await req.json().catch(() => ({}));
        const orderId = String(body?.orderId || '').trim();
        const userId = String(body?.userId || '').trim();

        if (!orderId && !userId) {
            return NextResponse.json({ error: 'Se requiere orderId o userId.' }, { status: 400 });
        }

        const admin = guard.admin;

        // ── Buscar órdenes (sin filtrar por status aquí para evitar errores de enum) ──
        let query: any;
        if (orderId) {
            query = admin
                .from('orders')
                .select('id, status, buyer_id, seller_id')
                .eq('id', orderId);
        } else {
            query = admin
                .from('orders')
                .select('id, status, buyer_id, seller_id')
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
        }

        const { data: allOrders, error: findErr } = await query;

        if (findErr) {
            console.error('[DELETE-ORDER] Error finding orders:', findErr);
            return NextResponse.json({ error: 'Error al buscar órdenes: ' + findErr.message }, { status: 500 });
        }

        // Filtrar en JS: solo órdenes no pagadas
        const orders = ((allOrders as any[]) ?? []).filter((o) =>
            UNPAID_STATUSES.has(String(o?.status || '').toLowerCase())
        );

        if (orders.length === 0) {
            return NextResponse.json({
                error: orderId
                    ? `No se encontró la orden ${orderId} con estado pendiente de pago (solo se pueden eliminar órdenes no pagadas).`
                    : `No se encontraron órdenes pendientes de pago para el usuario ${userId}.`,
                deleted: 0,
            }, { status: 404 });
        }

        const deletedResults: Array<{ id: string; status: string }> = [];
        const errors: string[] = [];

        for (const order of orders) {
            // ---------- Borrar registros relacionados primero ----------
            // order_items
            try { await (admin.from('order_items') as any).delete().eq('order_id', order.id); } catch { /* tabla puede no existir */ }
            // order_tracking
            try { await (admin.from('order_tracking') as any).delete().eq('order_id', order.id); } catch { /* tabla puede no existir */ }
            // order_messages
            try { await (admin.from('order_messages') as any).delete().eq('order_id', order.id); } catch { /* tabla puede no existir */ }
            // notifications que referencian esta orden en el campo data
            try { await (admin.from('notifications') as any).delete().filter('data->>order_id', 'eq', order.id); } catch { /* ignorar */ }

            // ---------- Borrar la orden en sí ----------
            // No ponemos .in('status', ...) aquí para evitar el error de enum; ya filtramos en JS arriba.
            const { error: delErr } = await admin
                .from('orders')
                .delete()
                .eq('id', order.id);

            if (delErr) {
                errors.push(`Orden ${order.id}: ${delErr.message}`);
            } else {
                deletedResults.push({ id: order.id, status: order.status });
            }
        }

        return NextResponse.json({
            deleted: deletedResults.length,
            orders: deletedResults,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (e) {
        console.error('[DELETE-ORDER] Unexpected error:', e);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
