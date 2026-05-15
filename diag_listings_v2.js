const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found at', envPath);
        return;
    }

    const env = fs.readFileSync(envPath, 'utf8');
    const envMap = {};
    env.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            envMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });

    const url = envMap.SUPABASE_URL || envMap.NEXT_PUBLIC_SUPABASE_URL;
    const key = envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        console.error('Supabase URL or Key missing');
        return;
    }

    const supabase = createClient(url, key);

    const publicId = 'PCK-C30799A89C';
    console.log(`Checking listing: ${publicId}`);

    const { data: listing, error: lErr } = await supabase
        .from('listings')
        .select('id, seller_id, status, expires_at, created_at, sale_type')
        .eq('public_id', publicId)
        .single();

    if (lErr) {
        console.error('Listing Search Error:', lErr);
        return;
    }

    console.log('\n--- LISTING DATA ---');
    console.log(JSON.stringify(listing, null, 2));

    const { data: userState, error: uErr } = await supabase
        .from('user_admin_states')
        .select('*')
        .eq('user_id', listing.seller_id)
        .maybeSingle();

    console.log('\n--- SELLER ADMIN STATE ---');
    console.log(JSON.stringify(userState || { status: 'active (no entry)' }, null, 2));

    const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, plan_type, pro_subscription_end')
        .eq('id', listing.seller_id)
        .single();

    console.log('\n--- SELLER PROFILE ---');
    console.log(JSON.stringify(profile, null, 2));
}

run().catch(console.error);
