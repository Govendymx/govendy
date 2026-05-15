/**
 * One-time fix: Find wallet transactions for Estafeta quotes that were paid
 * via PocketCash but whose status was never updated from 'quote' to 'paid'.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function main() {
    // Find wallet transactions that reference Estafeta quotes (description contains 'Guía Estafeta')
    const { data: txns, error: txErr } = await admin
        .from('wallet_transactions')
        .select('id, wallet_id, amount, concept, reference_type, reference_id, created_at')
        .ilike('concept', '%Guía Estafeta%')
        .order('created_at', { ascending: false });

    if (txErr) {
        console.error('Error fetching transactions:', txErr.message);

        // Fallback: try to find all estafeta_quotes with status='quote' 
        // and check if any have a matching deduction
        console.log('\nTrying alternative approach: checking quotes directly...');
        const { data: quotes, error: qErr } = await admin
            .from('estafeta_quotes')
            .select('id, status, calculated_cost, sender_name, recipient_name, created_at, paid_at')
            .in('status', ['quote', 'pending_payment'])
            .order('created_at', { ascending: false })
            .limit(10);

        if (qErr) {
            console.error('Error fetching quotes:', qErr.message);
            return;
        }

        console.log(`Found ${quotes?.length || 0} unpaid quotes (latest 10):`);
        for (const q of (quotes || [])) {
            console.log(`  ${q.id.slice(0, 8)}... | $${q.calculated_cost} | ${q.sender_name} → ${q.recipient_name} | ${q.created_at}`);
        }
        return;
    }

    console.log(`Found ${txns?.length || 0} Estafeta wallet transactions`);

    for (const tx of (txns || [])) {
        console.log(`\n--- Transaction ${tx.id} ---`);
        console.log(`  Amount: $${tx.amount}`);
        console.log(`  Concept: ${tx.concept}`);
        console.log(`  Reference ID: ${tx.reference_id}`);
        console.log(`  Created: ${tx.created_at}`);

        if (!tx.reference_id) {
            console.log('  ⚠️ No reference_id, skipping');
            continue;
        }

        // Check the quote status
        const { data: quote, error: qErr } = await admin
            .from('estafeta_quotes')
            .select('id, status, paid_at, calculated_cost')
            .eq('id', tx.reference_id)
            .maybeSingle();

        if (qErr || !quote) {
            console.log(`  ⚠️ Quote not found: ${qErr?.message || 'null'}`);
            continue;
        }

        console.log(`  Quote status: ${quote.status}, paid_at: ${quote.paid_at}`);

        if (quote.status === 'quote' || quote.status === 'pending_payment') {
            console.log(`  🔧 Fixing: updating status to 'paid' with paid_at...`);
            const { error: upErr } = await admin
                .from('estafeta_quotes')
                .update({
                    status: 'paid',
                    paid_at: tx.created_at || new Date().toISOString(),
                })
                .eq('id', quote.id);

            if (upErr) {
                console.error(`  ❌ Update failed:`, upErr.message);
            } else {
                console.log(`  ✅ Fixed! Status updated to 'paid'`);
            }
        } else {
            console.log(`  ✓ Already has correct status: ${quote.status}`);
        }
    }

    console.log('\nDone!');
}

main().catch(console.error);
