// Quick debug script to check order data
const { createClient } = require('@supabase/supabase-js');

const admin = createClient(
    'https://xlnxdzocwgrzqoznmarc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY'
);

async function checkOrder() {
    // Get the most recent order for FERNANDA
    const { data: orders } = await admin
        .from('orders')
        .select('id, shipping_option_id, shipping_carrier, status, created_at')
        .ilike('shipping_full_name', '%FERNANDA%')
        .order('created_at', { ascending: false })
        .limit(3);

    console.log('\n📋 Recent orders for FERNANDA:\n');
    orders?.forEach((o, i) => {
        console.log(`${i + 1}. Order ${o.id.slice(0, 8)}...`);
        console.log(`   Created: ${o.created_at}`);
        console.log(`   Status: ${o.status}`);
        console.log(`   shipping_option_id: ${o.shipping_option_id || 'NULL'}`);
        console.log(`   shipping_carrier: ${o.shipping_carrier || 'NULL'}`);
        console.log('');
    });
}

checkOrder();
