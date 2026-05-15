// Ejecutar: node fix_auction_orders.mjs
// Corrige shipping_fee $165 → $200 en las 2 órdenes afectadas
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xlnxdzocwgrzqoznmarc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ORDER_IDS = [
    'ea095fbd-0c84-46ad-8d98-da4142f1b44e',
    '3d192010-a811-468e-afdc-464e6cec7ea4',
];

for (const orderId of ORDER_IDS) {
    const { data, error } = await supabase
        .from('orders')
        .select('id, status, payment_status, shipping_fee, total, subtotal')
        .eq('id', orderId)
        .single();

    if (error || !data) {
        console.log(`❌ ${orderId}: ${error?.message || 'no encontrada'}`);
        // Try with 'total_amount' column name
        const { data: d2, error: e2 } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
        console.log('Raw data:', JSON.stringify(d2, null, 2));
        console.log('Error:', e2?.message);
        continue;
    }

    const oldShipping = Number(data.shipping_fee) || 0;
    const oldTotal = Number(data.total) || 0;
    const newShipping = 200; // El precio correcto
    const newTotal = oldTotal - oldShipping + newShipping;

    console.log(`\n📦 ${orderId}`);
    console.log(`   shipping_fee: $${oldShipping} → $${newShipping}`);
    console.log(`   total: $${oldTotal} → $${newTotal}`);

    const { error: updErr } = await supabase
        .from('orders')
        .update({ shipping_fee: newShipping, total: newTotal })
        .eq('id', orderId);

    if (updErr) {
        console.log(`   ❌ Error: ${updErr.message}`);
    } else {
        console.log(`   ✅ Corregida.`);
    }
}
