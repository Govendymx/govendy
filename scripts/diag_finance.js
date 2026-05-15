const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- FINDING RECENT ORDERS ---');
    const { data: recentOrders, error: reErr } = await supabase
        .from('orders')
        .select('*, order_items(*, listings(title, sale_type, shipping_price, shipping_subsidy))')
        .order('created_at', { ascending: false })
        .limit(10);

    if (reErr) {
        console.error('Fetch error:', reErr);
        process.exit(1);
    }

    console.log('--- RECENT AUCTIONS ---');
    recentOrders.forEach(o => {
        const isAuction = o.order_items && o.order_items.some(item => item.listings && item.listings.sale_type === 'auction');
        if (isAuction) {
            console.log(`ORDER ID: ${o.id}`);
            console.log(`  Subtotal: ${o.subtotal}`);
            console.log(`  Shipping Fee: ${o.shipping_fee}`);
            console.log(`  Shipping Subsidy: ${o.shipping_subsidy}`);
            console.log(`  Total: ${o.total}`);
            console.log(`  Created At: ${o.created_at}`);
            o.order_items.forEach(item => {
                if (item.listings) {
                    console.log(`  LISTING: ${item.listings.title}`);
                    console.log(`    Listing Shipping Price: ${item.listings.shipping_price}`);
                    console.log(`    Listing Shipping Subsidy: ${item.listings.shipping_subsidy}`);
                }
            });
            console.log('---');
        }
    });

    console.log('--- POCKET CASH RECHARGES ---');
    const { data: recharges } = await supabase
        .from('pocket_cash_recharges')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
    console.log(JSON.stringify(recharges, null, 2));

    process.exit(0);
}

run();
