import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
    // 1. Get configured rates
    const { data: settings } = await admin.from('app_settings').select('commission_basic_percent, commission_pro_percent, commission_platinum_percent').single();
    const basicRate = Number(settings?.commission_basic_percent ?? 23);
    const proRate = Number(settings?.commission_pro_percent ?? 18);
    const platRate = Number(settings?.commission_platinum_percent ?? 18);
    console.log(`Rates: basic=${basicRate}%, pro=${proRate}%, platinum=${platRate}%`);

    // 2. Fetch all orders with commission
    const { data: orders, error } = await admin
        .from('orders')
        .select('id, subtotal, commission_fee, seller_id')
        .gt('subtotal', 0)
        .gt('commission_fee', 0);

    if (error) { console.error('Error fetching orders:', error.message); return; }
    console.log(`Found ${orders.length} orders with commission`);

    // 3. Fetch seller plans
    const sellerIds = [...new Set(orders.map(o => o.seller_id).filter(Boolean))];
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, plan_type')
        .in('id', sellerIds);

    const planMap = {};
    for (const p of (profiles || [])) {
        planMap[p.id] = p.plan_type || 'basic';
    }

    // 4. Recalculate each order
    let updated = 0;
    let skipped = 0;
    for (const o of orders) {
        const plan = planMap[o.seller_id] || 'basic';
        const rate = plan === 'platinum' ? platRate : plan === 'pro' ? proRate : basicRate;
        let correctComm = Math.round(o.subtotal * rate / 100 * 100) / 100;
        // Apply minimum floor: $23 basic, $18 pro/platinum
        const minComm = plan === 'basic' ? basicRate : plan === 'pro' ? proRate : platRate;
        if (correctComm < minComm) {
            correctComm = minComm;
        }

        if (Math.abs(correctComm - o.commission_fee) > 0.005) {
            const { error: upErr } = await admin
                .from('orders')
                .update({ commission_fee: correctComm })
                .eq('id', o.id);
            if (upErr) {
                console.error(`Error updating ${o.id}:`, upErr.message);
            } else {
                console.log(`  ${o.id}: ${o.commission_fee} → ${correctComm} (${plan} ${rate}%, subtotal $${o.subtotal})`);
                updated++;
            }
        } else {
            skipped++;
        }
    }

    console.log(`\nDone! Updated: ${updated}, Already correct: ${skipped}`);
}

main().catch(console.error);
