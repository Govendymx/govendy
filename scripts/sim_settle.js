const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const listingId = 'dc027ff2-e6c4-4daa-9e83-7dbff80ec0d9';
    const { data: r, error } = await supabase.from('listings').select('*').eq('id', listingId).single();
    if (error) return console.error(error);

    const { data: settingsRow } = await supabase.from('app_settings').select('shipping_base, estafeta_config').eq('id', 1).single();
    const shippingBase = Number(settingsRow.shipping_base ?? 175);
    const w = Number(r.weight_kg) || 1;
    const len = Number(r.length_cm) || 10;
    const wid = Number(r.width_cm) || 10;
    const h = Number(r.height_cm) || 10;
    const volW = (len * wid * h) / 5000;
    const finalWeight = Math.max(w, volW);

    const ranges = settingsRow.estafeta_config.weight_ranges.sort((a, b) => a.max_weight_kg - b.max_weight_kg);
    const match = ranges.find(rng => finalWeight <= rng.max_weight_kg);
    const baseCost = match ? match.price : shippingBase;

    const publishedShippingPrice = Number(r.shipping_price || 0);
    const shippingSubsidy = Number(r.shipping_subsidy || 0);

    console.log(`--- Listing: ${r.title} ---`);
    console.log(`Shipping Price (guardado en BD): $${publishedShippingPrice}`);
    console.log(`Shipping Subsidy (guardado en BD): $${shippingSubsidy}`);
    console.log(`Carrier Base Cost (calculado): $${baseCost}`);
    console.log(`\n--- Lógica ANTES (buggy): ---`);
    const feeOld = Math.max(0, publishedShippingPrice - shippingSubsidy);
    console.log(`publishedPrice($${publishedShippingPrice}) - subsidy($${shippingSubsidy}) = $${feeOld}  <-- ERROR: doble deducción`);
    console.log(`\n--- Lógica DESPUÉS (corregida): ---`);
    const feeNew = publishedShippingPrice;
    console.log(`publishedPrice($${publishedShippingPrice}) = $${feeNew}  <-- CORRECTO: el subsidio ya está incluido`);
    console.log(`\n✅ El comprador ahora paga: $${feeNew}`);
    console.log(`✅ El vendedor absorbe internamente: $${shippingSubsidy} (registrado en shipping_subsidy de orden)`);
}
run();
