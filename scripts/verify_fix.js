const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // Buscar la orden de SUBASTA 3 SUBCIDIO
    const { data: items } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('listing_id', 'dc027ff2-e6c4-4daa-9e83-7dbff80ec0d9')
        .limit(1);

    if (!items?.length) return console.log('No se encontró la orden.');
    const orderId = items[0].order_id;

    const { data: order } = await supabase
        .from('orders')
        .select('id, subtotal, shipping_fee, shipping_subsidy, total, status')
        .eq('id', orderId)
        .single();

    console.log('\n=== SUBASTA 3 SUBCIDIO ===');
    console.log(`Subtotal:         $${order.subtotal}`);
    console.log(`Envío (fee):      $${order.shipping_fee}   ${order.shipping_fee === 145 ? '✅' : '❌ Esperado: $145'}`);
    console.log(`Subsidio:         $${order.shipping_subsidy}   ${order.shipping_subsidy === 50 ? '✅' : '❌ Esperado: $50'}`);
    console.log(`Total:            $${order.total}   ${order.total === (Number(order.subtotal) + 145) ? '✅' : '❌'}`);
    console.log(`Neto Vendedor:    $${order.subtotal - 25 - order.shipping_subsidy}  (subtotal - comisión $25 - subsidio)`);
}
run();
