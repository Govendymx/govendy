const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // Primero buscar el item en order_items
    const { data: items, error: iErr } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('listing_id', '49079b0c-2581-4a98-836f-5535be6a5fd0');

    if (iErr) return console.error(iErr);
    if (!items || items.length === 0) return console.log('No order items found');

    const orderIds = items.map(i => i.order_id);
    const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds);

    if (oErr) console.error(oErr);
    else console.log(JSON.stringify(orders, null, 2));
}
run();
