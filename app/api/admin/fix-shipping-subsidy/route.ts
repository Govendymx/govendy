import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fix-shipping-subsidy
 * Finds all orders with shipping_carrier='gopocket', shipping_fee=0, shipping_subsidy=0 or NULL
 * and backfills the correct shipping_subsidy from the listing's weight.
 * Also accepts { order_id: string } to fix a single order.
 */
export async function POST(req: NextRequest) {
    try {
        const admin = supabaseAdmin();
        const body = await req.json().catch(() => ({}));
        const singleOrderId = String(body?.order_id || '').trim();

        const DEFAULT_WEIGHT_RANGES = [
            { max_weight_kg: 1, price: 175 },
            { max_weight_kg: 5, price: 195 },
            { max_weight_kg: 10, price: 235 },
            { max_weight_kg: 15, price: 255 },
            { max_weight_kg: 20, price: 275 },
            { max_weight_kg: 25, price: 300 },
            { max_weight_kg: 30, price: 325 },
        ];

        function calcShippingCost(weightKg: number, lengthCm: number, widthCm: number, heightCm: number, shippingPrice: number): number {
            if (shippingPrice > 0) return shippingPrice;
            const volWeight = (lengthCm * widthCm * heightCm) / 5000;
            const finalWeight = Math.max(weightKg || 1, volWeight);
            const match = DEFAULT_WEIGHT_RANGES.find(r => finalWeight <= r.max_weight_kg);
            return match ? match.price : DEFAULT_WEIGHT_RANGES[DEFAULT_WEIGHT_RANGES.length - 1].price;
        }

        // Find broken orders: carrier=gopocket, fee=0, subsidy=0/null
        let query = admin
            .from('orders')
            .select('id, shipping_carrier, shipping_fee, shipping_subsidy, subtotal, total, commission_fee')
            .eq('shipping_carrier', 'gopocket')
            .eq('shipping_fee', 0);

        if (singleOrderId) {
            query = query.eq('id', singleOrderId);
        }

        const { data: orders, error: oErr } = await query.limit(500);
        if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });

        const brokenOrders = (orders || []).filter(o =>
            Number(o.shipping_subsidy || 0) === 0
        );

        if (brokenOrders.length === 0) {
            return NextResponse.json({ ok: true, message: 'No broken orders found', fixed: 0 });
        }

        // Get listing data for each broken order
        const orderIds = brokenOrders.map(o => o.id);
        const { data: items } = await admin
            .from('order_items')
            .select('order_id, listing_id')
            .in('order_id', orderIds)
            .limit(1000);

        const listingIdByOrderId: Record<string, string> = {};
        for (const item of (items || [])) {
            const oid = String(item.order_id || '').trim();
            const lid = String(item.listing_id || '').trim();
            if (oid && lid && !listingIdByOrderId[oid]) {
                listingIdByOrderId[oid] = lid;
            }
        }

        const listingIds = [...new Set(Object.values(listingIdByOrderId))];
        const { data: listings } = await admin
            .from('listings')
            .select('id, weight_kg, length_cm, width_cm, height_cm, shipping_price, free_shipping')
            .in('id', listingIds)
            .limit(1000);

        const listingById: Record<string, any> = {};
        for (const l of (listings || [])) {
            listingById[String(l.id)] = l;
        }

        // Fix each broken order
        const results: any[] = [];
        for (const order of brokenOrders) {
            const lid = listingIdByOrderId[order.id];
            const listing = lid ? listingById[lid] : null;

            if (!listing) {
                results.push({ order_id: order.id, status: 'skipped', reason: 'no_listing_found' });
                continue;
            }

            const cost = calcShippingCost(
                Number(listing.weight_kg || 0),
                Number(listing.length_cm || 0),
                Number(listing.width_cm || 0),
                Number(listing.height_cm || 0),
                Number(listing.shipping_price || 0),
            );

            const { error: upErr } = await admin
                .from('orders')
                .update({ shipping_subsidy: cost })
                .eq('id', order.id);

            if (upErr) {
                results.push({ order_id: order.id, status: 'error', error: upErr.message });
            } else {
                const subtotal = Number(order.subtotal || (Number(order.total || 0) - Number(order.shipping_fee || 0)));
                const commission = Number(order.commission_fee || 0);
                const netPayout = Math.max(0, subtotal - commission - cost);
                results.push({
                    order_id: order.id,
                    status: 'fixed',
                    listing_id: lid,
                    weight_kg: Number(listing.weight_kg || 0),
                    shipping_cost: cost,
                    subtotal,
                    commission,
                    net_payout: netPayout,
                    is_negative: (subtotal - commission - cost) < 0,
                });
            }
        }

        return NextResponse.json({
            ok: true,
            fixed: results.filter(r => r.status === 'fixed').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            errors: results.filter(r => r.status === 'error').length,
            results,
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || 'Error interno' }, { status: 500 });
    }
}
