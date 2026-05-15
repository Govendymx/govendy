import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('listings')
        .select('id, title, shipping_price, shipping_subsidy, shipping_by_seller, free_shipping')
        .ilike('title', '%SHEIN SUBASTA SUBCIDIO 2.0%')
        .single();

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Listing Data:', JSON.stringify(data, null, 2));

    const { data: orderData, error: orderError } = await supabase
        .from('order_items')
        .select('order_id, orders(id, subtotal, total, shipping_fee, shipping_subsidy, shipping_carrier)')
        .eq('listing_id', data.id)
        .single();

    if (orderError) {
        console.error('Order Error:', orderError.message);
    } else {
        console.log('Order Data:', JSON.stringify(orderData, null, 2));
    }
}

check();
