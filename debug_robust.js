const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const lines = envContent.split(/\r?\n/);
        const env = {};
        lines.forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                env[key] = value;
            }
        });

        const url = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'];
        const key = env['SUPABASE_SERVICE_ROLE_KEY'] || env['SUPABASE_SERVICE_KEY'];

        if (!url || !key) {
            console.error('Missing env vars. Found keys:', Object.keys(env));
            process.exit(1);
        }

        const supabase = createClient(url, key);
        const publicId = 'PCK-C30799A89C';

        const { data: listing, error } = await supabase
            .from('listings')
            .select('*')
            .eq('public_id', publicId)
            .single();

        if (error) {
            console.error('Error fetching listing:', error.message);
        } else {
            console.log('--- LISTING FOUND ---');
            console.log('ID:', listing.id);
            console.log('Public ID:', listing.public_id);
            console.log('Status:', listing.status);
            console.log('Expires At:', listing.expires_at);
            console.log('Created At:', listing.created_at);
            console.log('Seller ID:', listing.seller_id);

            const { data: userState } = await supabase
                .from('user_admin_states')
                .select('*')
                .eq('user_id', listing.seller_id)
                .maybeSingle();

            console.log('--- USER STATE ---');
            console.log(userState ? JSON.stringify(userState, null, 2) : 'No user state found (User is active)');
        }
    } catch (e) {
        console.error('Fatal error:', e.message);
        process.exit(1);
    }
}

run();
