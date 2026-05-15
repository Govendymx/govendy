// Quick script to check and force-settle a specific auction
const fs = require('fs');
const path = require('path');

// Read env vars from .env.local
let envVars = {};
for (const f of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', f);
    if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        for (const line of lines) {
            const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.+?)"?\s*$/);
            if (m) envVars[m[1]] = m[2];
        }
    }
}

const url = envVars.SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://xlnxdzocwgrzqoznmarc.supabase.co';
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || '';

if (!key) {
    console.error('ERROR: No SUPABASE_SERVICE_ROLE_KEY found. Set it in .env.local or as env var.');
    process.exit(1);
}

const LISTING_ID = process.argv[2] || '938f6154-ebf3-4d75-86c8-06f3d1f5b9ed';

async function main() {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(url, key);

    console.log(`\n=== Checking auction: ${LISTING_ID} ===\n`);

    const { data, error } = await sb
        .from('listings')
        .select('id,title,status,sale_type,auction_end_at,auction_highest_bid,auction_highest_bidder_id,seller_id')
        .eq('id', LISTING_ID)
        .maybeSingle();

    if (error) {
        console.error('DB Error:', error.message);
        return;
    }

    if (!data) {
        console.log('Listing NOT FOUND in database.');
        return;
    }

    console.log('Listing found:');
    console.log(JSON.stringify(data, null, 2));

    const isAuction = data.sale_type === 'auction';
    const isEnded = data.auction_end_at && new Date(data.auction_end_at) <= new Date();
    const hasWinner = !!data.auction_highest_bidder_id;
    const hasHighBid = Number(data.auction_highest_bid || 0) > 0;

    console.log(`\nIs Auction: ${isAuction}`);
    console.log(`Has Ended: ${isEnded}`);
    console.log(`Has Winner: ${hasWinner}`);
    console.log(`Has High Bid: ${hasHighBid}`);
    console.log(`Status: ${data.status}`);

    // Check if an order already exists
    const { data: existingItems } = await sb
        .from('order_items')
        .select('order_id')
        .eq('listing_id', LISTING_ID)
        .limit(1);

    const hadOrder = existingItems && existingItems.length > 0;
    console.log(`Has existing order: ${hadOrder}`);

    if (hadOrder) {
        console.log('Order ID:', existingItems[0].order_id);
    }

    // Check bids
    const { data: bids } = await sb
        .from('bids')
        .select('id,bidder_id,amount,created_at')
        .eq('listing_id', LISTING_ID)
        .order('amount', { ascending: false })
        .limit(5);

    console.log(`\nTop bids (${bids?.length || 0}):`);
    if (bids) {
        for (const b of bids) {
            console.log(`  $${b.amount} by ${b.bidder_id.slice(0, 8)}... at ${b.created_at}`);
        }
    }
}

main().catch(console.error);
