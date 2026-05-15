import { createClient } from '@supabase/supabase-js';
import { getPlan, getCommissions } from '../lib/plans/limits';

/**
 * Manual script to process auction PCK-57DCFEE1C9
 * Run with: npx tsx scripts/fix_auction.ts
 */

// Create admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseServiceKey);

async function sendNotification(userId: string, type: string, title: string, body: string, linkTo: string, data: any) {
    await admin.from('notifications').insert({
        user_id: userId,
        type,
        title,
        body,
        link_to: linkTo,
        data,
        read: false,
    });
}

async function processAuction() {
    const listingId = 'PCK-57DCFEE1C9';

    console.log(`\n🔍 Processing auction ${listingId}...\n`);

    try {
        // 1. Get auction data
        const { data: listing, error: listingError } = await admin
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single();

        if (listingError || !listing) {
            console.error('❌ Listing not found:', listingError?.message);
            return;
        }

        console.log('📋 Auction Details:');
        console.log(`   Title: ${listing.title}`);
        console.log(`   Status: ${listing.status}`);
        console.log(`   End Date: ${listing.auction_end_at}`);
        console.log(`   Highest Bid: $${listing.auction_highest_bid}`);
        console.log(`   Winner ID: ${listing.auction_highest_bidder_id}`);
        console.log(`   Seller ID: ${listing.seller_id}\n`);

        // 2. Validate
        if (listing.sale_type !== 'auction') {
            console.error('❌ Not an auction');
            return;
        }

        if (!listing.auction_highest_bidder_id || !listing.auction_highest_bid) {
            console.error('❌ No winner or bid amount');
            return;
        }

        // 3. Check if order already exists
        const { data: existingItems } = await admin
            .from('order_items')
            .select('order_id')
            .eq('listing_id', listingId)
            .limit(1);

        if (existingItems && existingItems.length > 0) {
            console.log('⚠️  Order already exists:', existingItems[0].order_id);
            return;
        }

        const winnerId = listing.auction_highest_bidder_id;
        const highestBid = Number(listing.auction_highest_bid);
        const sellerId = listing.seller_id;

        // 4. Calculate commission
        const plan = await getPlan(admin, sellerId);
        const commissions = await getCommissions(admin);
        const percent = plan === 'pro' ? commissions.pro : commissions.basic;
        const commissionFee = Math.round((highestBid * percent) / 100);

        console.log(`💰 Commission: ${percent}% = $${commissionFee}\n`);

        // 5. Create order
        console.log('📦 Creating order...');
        const { data: order, error: orderError } = await admin
            .from('orders')
            .insert({
                buyer_id: winnerId,
                seller_id: sellerId,
                total: highestBid,
                status: 'pending_payment',
                shipping_option_id: listing.shipping_option_id || null,
                commission_fee: commissionFee,
            })
            .select()
            .single();

        if (orderError || !order) {
            console.error('❌ Failed to create order:', orderError?.message);
            return;
        }

        console.log(`✅ Order created: ${order.id}\n`);

        // 6. Create order item
        console.log('📝 Creating order item...');
        const { error: itemError } = await admin
            .from('order_items')
            .insert({
                order_id: order.id,
                listing_id: listingId,
                title: listing.title,
                quantity: 1,
                line_total: highestBid,
            });

        if (itemError) {
            console.error('❌ Failed to create order item:', itemError.message);
            return;
        }

        console.log('✅ Order item created\n');

        // 7. Mark listing as sold
        console.log('🏷️  Updating listing status to sold...');
        await admin.from('listings').update({ status: 'sold' }).eq('id', listingId);
        console.log('✅ Listing marked as sold\n');

        // 8. Send notifications
        console.log('📧 Sending notifications...');

        // Notify seller
        await sendNotification(
            sellerId,
            'auction_sold',
            '¡Subasta Vendida!',
            `Tu subasta "${listing.title}" se vendió por $${highestBid.toFixed(2)}. Revisa tu panel de ventas.`,
            `/dashboard/ventas?order=${order.id}`,
            { listingId, listing_id: listingId, highestBid, winnerId, kind: 'auction_sold', orderId: order.id }
        );

        console.log('✅ Seller notified');

        // Notify winner
        await sendNotification(
            winnerId,
            'auction_won',
            '¡Ganaste la Subasta!',
            `Ganaste la subasta "${listing.title}" con tu puja de $${highestBid.toFixed(2)}. Procede al pago.`,
            `/dashboard/compras?order=${order.id}`,
            { listingId, listing_id: listingId, highestBid, winnerId, kind: 'auction_won', orderId: order.id }
        );

        console.log('✅ Winner notified\n');

        console.log('🎉 SUCCESS! Auction processed successfully.');
        console.log(`   Order ID: ${order.id}`);
        console.log(`   Total: $${highestBid}`);
        console.log(`   Commission: $${commissionFee}\n`);

    } catch (err: any) {
        console.error('❌ Error:', err.message);
        console.error(err);
    }
}

processAuction();
