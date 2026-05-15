import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/auction-debug
 * Diagnostic endpoint: shows all auctions that should have settled but haven't.
 */
export async function GET() {
    try {
        const admin = supabaseAdmin();
        const nowIso = new Date().toISOString();

        // 1. Find ended auctions that are NOT sold/paused
        const { data: stuck, error: e1 } = await admin
            .from('listings')
            .select('id, title, status, sale_type, auction_end_at, auction_highest_bid, auction_highest_bidder_id, product_type, created_at')
            .eq('sale_type', 'auction')
            .not('status', 'in', '(sold,paused)')
            .lte('auction_end_at', nowIso)
            .order('auction_end_at', { ascending: false })
            .limit(50);

        // 2. Find ALL active auctions (not ended yet)
        const { data: active, error: e2 } = await admin
            .from('listings')
            .select('id, title, status, sale_type, auction_end_at, auction_highest_bid, auction_highest_bidder_id, product_type')
            .eq('sale_type', 'auction')
            .eq('status', 'active')
            .gt('auction_end_at', nowIso)
            .order('auction_end_at', { ascending: true })
            .limit(50);

        // 3. Recent settled auctions (sold)
        const { data: settled, error: e3 } = await admin
            .from('listings')
            .select('id, title, status, sale_type, auction_end_at, auction_highest_bid, auction_highest_bidder_id, product_type')
            .eq('sale_type', 'auction')
            .eq('status', 'sold')
            .order('auction_end_at', { ascending: false })
            .limit(20);

        // 4. Paused auctions
        const { data: paused, error: e4 } = await admin
            .from('listings')
            .select('id, title, status, sale_type, auction_end_at, auction_highest_bid, auction_highest_bidder_id, product_type')
            .eq('sale_type', 'auction')
            .eq('status', 'paused')
            .order('auction_end_at', { ascending: false })
            .limit(20);

        // 5. Check if orders exist for stuck auctions
        const stuckIds = (stuck || []).map((s: any) => s.id);
        let ordersForStuck: any[] = [];
        if (stuckIds.length > 0) {
            const { data: items } = await admin
                .from('order_items')
                .select('order_id, listing_id')
                .in('listing_id', stuckIds);
            ordersForStuck = items || [];
        }

        // 6. Check app_settings for auction_shipping_enabled kill switch
        const { data: settings } = await admin
            .from('app_settings')
            .select('auction_shipping_enabled')
            .eq('id', 1)
            .maybeSingle();

        return NextResponse.json({
            ok: true,
            now: nowIso,
            kill_switch: (settings as any)?.auction_shipping_enabled,
            summary: {
                stuck_count: stuck?.length || 0,
                active_count: active?.length || 0,
                sold_count: settled?.length || 0,
                paused_count: paused?.length || 0,
            },
            stuck_auctions: (stuck || []).map((s: any) => ({
                ...s,
                has_order: ordersForStuck.some((oi: any) => oi.listing_id === s.id),
                ended_ago_minutes: Math.round((Date.now() - new Date(s.auction_end_at).getTime()) / 60000),
            })),
            active_auctions: active || [],
            recently_sold: settled || [],
            paused_auctions: paused || [],
            errors: {
                stuck: e1?.message,
                active: e2?.message,
                settled: e3?.message,
                paused: e4?.message,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
    }
}
