const { createClient } = require('@supabase/supabase-js');
const c = createClient(
    'https://xlnxdzocwgrzqoznmarc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY'
);

async function check() {
    const lid = '982b266e-4a8c-4a2d-9254-13a1b0f2d416';

    // 1. Listing status
    const { data: listing } = await c.from('listings').select('id,title,sale_type,status,price,auction_end_at').eq('id', lid).single();
    console.log('--- LISTING ---');
    console.log('title:', listing?.title);
    console.log('sale_type:', listing?.sale_type);
    console.log('status:', listing?.status);
    console.log('price:', listing?.price);
    console.log('auction_end_at:', listing?.auction_end_at);

    // 2. Bids
    const { data: bids } = await c.from('bids').select('id,bidder_id,amount,status,created_at').eq('listing_id', lid).order('amount', { ascending: false });
    console.log('\n--- BIDS ---');
    console.log('count:', bids?.length || 0);
    if (bids) {
        for (const b of bids) {
            console.log(`  bidder=${b.bidder_id.slice(0, 8)} amount=${b.amount} status=${b.status || 'N/A'}`);
        }
    }

    // 3. Order items
    const { data: items } = await c.from('order_items').select('order_id,listing_id,line_total').eq('listing_id', lid);
    console.log('\n--- ORDER ITEMS ---');
    console.log('count:', items?.length || 0);
    if (items && items.length > 0) {
        for (const it of items) {
            console.log(`  order=${it.order_id.slice(0, 8)} total=${it.line_total}`);
        }
    }

    // 4. Check if any order was created
    if (items && items.length > 0) {
        const oids = [...new Set(items.map(i => i.order_id))];
        const { data: orders } = await c.from('orders').select('id,status,buyer_id,total,created_at').in('id', oids);
        console.log('\n--- ORDERS ---');
        if (orders) {
            for (const o of orders) {
                console.log(`  order=${o.id.slice(0, 8)} status=${o.status} buyer=${o.buyer_id.slice(0, 8)} total=${o.total}`);
            }
        }
    } else {
        console.log('\nNO ORDERS CREATED for this auction.');
    }
}

check();
