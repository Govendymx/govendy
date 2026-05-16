import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/backfill-order-source
 * Marks existing auction orders with order_source='auction'.
 * All other orders get order_source='checkout'.
 *
 * Safe to run multiple times (idempotent).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        const admin = auth.admin;

        // 1. Find orders that came from auctions:
        //    order_items → listings where sale_type='auction'
        const { data: auctionItems, error: e1 } = await admin
            .from('order_items')
            .select('order_id, listing_id, listings!inner(sale_type)')
            .eq('listings.sale_type', 'auction');

        if (e1) {
            // Fallback: try without the join if schema differs
            console.warn('[backfill-order-source] Join failed, trying fallback:', e1.message);

            // Get all auction listing IDs
            const { data: auctionListings } = await admin
                .from('listings')
                .select('id')
                .eq('sale_type', 'auction');

            const auctionListingIds = (auctionListings || []).map((l: any) => l.id);

            if (auctionListingIds.length > 0) {
                // Get order_items for those listings
                const { data: items } = await admin
                    .from('order_items')
                    .select('order_id')
                    .in('listing_id', auctionListingIds);

                const auctionOrderIds = [...new Set((items || []).map((i: any) => i.order_id))];

                if (auctionOrderIds.length > 0) {
                    // Mark auction orders
                    const { error: e2 } = await admin
                        .from('orders')
                        .update({ order_source: 'auction' })
                        .in('id', auctionOrderIds);

                    if (e2) console.warn('[backfill] Error updating auction orders:', e2.message);
                }

                // Mark remaining as checkout
                const { error: e3 } = await admin
                    .from('orders')
                    .update({ order_source: 'checkout' })
                    .is('order_source', null);

                if (e3) console.warn('[backfill] Error updating checkout orders:', e3.message);

                return NextResponse.json({
                    ok: true,
                    auction_orders: auctionOrderIds.length,
                    method: 'fallback',
                });
            }
        }

        // Primary path: join succeeded
        const auctionOrderIds = [...new Set((auctionItems || []).map((i: any) => i.order_id))];

        // Mark auction orders
        if (auctionOrderIds.length > 0) {
            await admin
                .from('orders')
                .update({ order_source: 'auction' })
                .in('id', auctionOrderIds);
        }

        // Mark everything else as checkout
        await admin
            .from('orders')
            .update({ order_source: 'checkout' })
            .is('order_source', null);

        return NextResponse.json({
            ok: true,
            auction_orders: auctionOrderIds.length,
            method: 'join',
        });
    } catch (err: any) {
        console.error('[backfill-order-source] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
