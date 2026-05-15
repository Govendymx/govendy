import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * One-time fix: remove duplicate auction orders (same listing_id).
 * Keeps the newest order for each listing, deletes the rest.
 * 
 * POST /api/auctions/fix-duplicates?token=SECRET
 */
export async function POST(req: NextRequest) {
    try {
        const secret = process.env.AUCTION_SETTLE_SECRET || '';
        const token = req.nextUrl.searchParams.get('token') || '';
        if (!secret || token !== secret) {
            return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
        }

        const admin = supabaseAdmin();

        // 1. Get all order_items to find duplicates
        const { data: allItems, error: itemsErr } = await admin
            .from('order_items')
            .select('id, order_id, listing_id');

        if (itemsErr) {
            return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
        }

        // 2. Group by listing_id to find duplicates
        const byListing: Record<string, Array<{ item_id: string; order_id: string }>> = {};
        for (const item of (allItems || [])) {
            const lid = item.listing_id;
            if (!byListing[lid]) byListing[lid] = [];
            byListing[lid].push({ item_id: item.id, order_id: item.order_id });
        }

        // 3. Find listings with multiple orders (duplicates)
        const duplicates: Array<{
            listing_id: string;
            order_ids: string[];
            keep: string;
            remove: string[];
        }> = [];

        for (const [listingId, entries] of Object.entries(byListing)) {
            if (entries.length <= 1) continue;

            // Get unique order IDs for this listing
            const uniqueOrderIds = Array.from(new Set(entries.map(e => e.order_id)));
            if (uniqueOrderIds.length <= 1) continue;

            // Fetch these orders to decide which to keep (keep the most recently created)
            const { data: orders } = await admin
                .from('orders')
                .select('id, created_at, status, total')
                .in('id', uniqueOrderIds)
                .order('created_at', { ascending: false });

            if (!orders || orders.length <= 1) continue;

            // Keep the first (most recent), remove the rest
            const keepOrder = orders[0].id;
            const removeOrders = orders.slice(1).map(o => o.id);

            duplicates.push({
                listing_id: listingId,
                order_ids: uniqueOrderIds,
                keep: keepOrder,
                remove: removeOrders,
            });
        }

        if (duplicates.length === 0) {
            return NextResponse.json({ ok: true, message: 'No duplicate orders found', fixed: 0 });
        }

        // 4. Remove duplicate order_items and orders
        const results: any[] = [];
        for (const dup of duplicates) {
            for (const removeId of dup.remove) {
                // Delete order_items first (FK constraint)
                const { error: delItemsErr } = await admin
                    .from('order_items')
                    .delete()
                    .eq('order_id', removeId);

                // Delete the order
                const { error: delOrderErr } = await admin
                    .from('orders')
                    .delete()
                    .eq('id', removeId);

                results.push({
                    listing_id: dup.listing_id,
                    removed_order: removeId,
                    kept_order: dup.keep,
                    items_delete_error: delItemsErr?.message || null,
                    order_delete_error: delOrderErr?.message || null,
                });
            }
        }

        return NextResponse.json({
            ok: true,
            fixed: results.length,
            details: results,
        });
    } catch (e: any) {
        console.error('[FIX-DUPLICATES] Error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
