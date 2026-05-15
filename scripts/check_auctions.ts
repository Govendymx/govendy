import { supabaseAdmin } from '../lib/supabase/admin';

async function checkAuctions() {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    console.log('🔍 Checking for ended auctions...');
    console.log('Current time:', now);

    // Check for auctions that should have ended
    const { data: auctions, error } = await admin
        .from('listings')
        .select('id, title, seller_id, status, sale_type, auction_end_at, auction_highest_bid, auction_highest_bidder_id, auction_start_at')
        .eq('sale_type', 'auction')
        .lte('auction_end_at', now)
        .order('auction_end_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('❌ Error fetching auctions:', error);
        return;
    }

    if (!auctions || auctions.length === 0) {
        console.log('✅ No ended auctions found');
        return;
    }

    console.log(`\n📊 Found ${auctions.length} ended auctions:\n`);

    for (const auction of auctions) {
        console.log('━'.repeat(60));
        console.log(`ID: ${auction.id}`);
        console.log(`Title: ${auction.title}`);
        console.log(`Status: ${auction.status}`);
        console.log(`Started: ${auction.auction_start_at}`);
        console.log(`Ended: ${auction.auction_end_at}`);
        console.log(`Highest Bid: $${auction.auction_highest_bid || 0}`);
        console.log(`Winner ID: ${auction.auction_highest_bidder_id || 'No winner'}`);

        // Check if order exists
        const { data: orderItems } = await admin
            .from('order_items')
            .select('order_id')
            .eq('listing_id', auction.id)
            .limit(1);

        if (orderItems && orderItems.length > 0) {
            console.log(`✅ Order exists: ${orderItems[0].order_id}`);
        } else {
            console.log(`❌ NO ORDER CREATED`);

            // Check why
            if (!auction.auction_highest_bidder_id) {
                console.log(`   Reason: No winner (no bids)`);
            } else if (auction.status !== 'active') {
                console.log(`   Reason: Status is "${auction.status}" (should be "active" to process)`);
            }
        }
        console.log('');
    }

    console.log('━'.repeat(60));
    console.log('\n✅ Check complete');
}

checkAuctions().catch(console.error);
