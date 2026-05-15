const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const env = fs.readFileSync('.env.local', 'utf8');
    const envMap = {};
    env.split('\n').forEach(line => {
        const [k, v] = line.split('=');
        if (k && v) envMap[k.trim()] = v.trim();
    });

    const supabase = createClient(
        envMap.SUPABASE_URL || envMap.NEXT_PUBLIC_SUPABASE_URL,
        envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.SUPABASE_SERVICE_KEY
    );

    const publicId = 'PCK-C30799A89C';

    console.log(`Checking listing: ${publicId}`);

    const { data: listing, error: lErr } = await supabase
        .from('listings')
        .select('*')
        .eq('public_id', publicId)
        .single();

    if (lErr) {
        console.error('Listing Error:', lErr);
        return;
    }

    console.log('--- LISTING FOUND ---');
    console.log('ID:', listing.id);
    console.log('Status:', listing.status);
    console.log('Expires At:', listing.expires_at);
    console.log('Seller ID:', listing.seller_id);

    const { data: adminState, error: aErr } = await supabase
        .from('user_admin_states')
        .select('*')
        .eq('user_id', listing.seller_id)
        .maybeSingle();

    console.log('--- ADMIN STATE ---');
    console.log(adminState || 'No admin state (active)');
}

run();
