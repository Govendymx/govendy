import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fix-digital-orders
 * Retroactively updates all orders that contain digital products
 * to have shipping_method = 'digital' and shipping_option_id = 'digital'.
 * 
 * This fixes orders that were created before the digital detection
 * was added to the checkout/settle routes.
 */
export async function POST(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Step 1: Find all listings with product_type = 'digital'
        const { data: digitalListings, error: listErr } = await admin
            .from('listings')
            .select('id')
            .ilike('product_type', 'digital')
            .limit(1000);

        if (listErr) {
            return NextResponse.json({ ok: false, error: 'Error querying digital listings: ' + listErr.message }, { status: 500 });
        }

        if (!digitalListings || digitalListings.length === 0) {
            return NextResponse.json({ ok: true, message: 'No digital listings found', updated: 0 });
        }

        const digitalListingIds = digitalListings.map((l: any) => l.id);

        // Step 2: Find all order_items that reference digital listings
        const { data: orderItems, error: itemErr } = await admin
            .from('order_items')
            .select('order_id')
            .in('listing_id', digitalListingIds)
            .limit(5000);

        if (itemErr) {
            return NextResponse.json({ ok: false, error: 'Error querying order items: ' + itemErr.message }, { status: 500 });
        }

        if (!orderItems || orderItems.length === 0) {
            return NextResponse.json({ ok: true, message: 'No orders with digital products found', updated: 0 });
        }

        const orderIdsToFix = Array.from(new Set(orderItems.map((it: any) => it.order_id)));

        // Step 3: Update those orders to have shipping_method = 'digital'
        const { data: updated, error: updErr } = await admin
            .from('orders')
            .update({
                shipping_method: 'digital',
                shipping_carrier: 'digital',
                shipping_fee: 0,
            })
            .in('id', orderIdsToFix)
            .select('id,shipping_method');

        if (updErr) {
            return NextResponse.json({ ok: false, error: 'Error updating orders: ' + updErr.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            message: `Updated ${updated?.length || 0} orders to shipping_method=digital`,
            updated: updated?.length || 0,
            digitalListingIds,
            orderIds: orderIdsToFix,
            updatedOrders: updated,
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || 'Error fixing digital orders' },
            { status: 500 },
        );
    }
}
