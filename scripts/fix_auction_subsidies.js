const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('🔍 Buscando órdenes de subastas con doble subsidio aplicado...\n');

    // Paso 1: Obtener todos los listings de tipo subasta con subsidio
    const { data: listings, error: lErr } = await supabase
        .from('listings')
        .select('id, title, shipping_price, shipping_subsidy, sale_type')
        .eq('sale_type', 'auction')
        .gt('shipping_subsidy', 0)
        .gt('shipping_price', 0);

    if (lErr) return console.error('Error obteniendo listings:', lErr);
    if (!listings || listings.length === 0) return console.log('No hay subastas con subsidio.');

    console.log(`Encontradas ${listings.length} publicaciones de subasta con subsidio.\n`);

    let fixed = 0;

    for (const listing of listings) {
        // Paso 2: Buscar la orden asociada a este listing
        const { data: items } = await supabase
            .from('order_items')
            .select('order_id')
            .eq('listing_id', listing.id)
            .limit(1);

        if (!items || items.length === 0) continue;
        const orderId = items[0].order_id;

        // Paso 3: Obtener la orden
        const { data: orders } = await supabase
            .from('orders')
            .select('id, subtotal, shipping_fee, shipping_subsidy, total, status')
            .eq('id', orderId)
            .not('status', 'in', '("cancelled","refunded")')
            .limit(1);

        if (!orders || orders.length === 0) continue;
        const order = orders[0];

        const correctFee = Number(listing.shipping_price);
        const correctSubsidy = Number(listing.shipping_subsidy);
        const currentFee = Number(order.shipping_fee);

        if (currentFee < correctFee) {
            const newTotal = Number(order.subtotal) + correctFee;
            console.log(`🔧 Corrigiendo: "${listing.title}"`);
            console.log(`   Orden: ${order.id}`);
            console.log(`   shipping_fee:     $${currentFee}  →  $${correctFee}`);
            console.log(`   shipping_subsidy: $${order.shipping_subsidy}  →  $${correctSubsidy}`);
            console.log(`   total:            $${order.total}  →  $${newTotal}`);

            const { error: uErr } = await supabase
                .from('orders')
                .update({
                    shipping_fee: correctFee,
                    shipping_subsidy: correctSubsidy,
                    total: newTotal,
                })
                .eq('id', orderId);

            if (uErr) {
                console.error(`   ❌ Error:`, uErr.message);
            } else {
                console.log(`   ✅ Corregido\n`);
                fixed++;
            }
        } else {
            console.log(`⏭  "${listing.title}" ya tiene el valor correcto ($${currentFee}), omitido.\n`);
        }
    }

    console.log(`\n✅ Proceso completado. ${fixed} órdenes corregidas.`);
}

run();
