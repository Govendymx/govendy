const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const url = env.match(/SUPABASE_URL=(.+)/)?.[1]?.trim();
        const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

        if (!url || !key) {
            console.error('Missing env vars');
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
            console.log('LISTING_DETAILS:' + JSON.stringify(listing));

            const { data: userState } = await supabase
                .from('user_admin_states')
                .select('*')
                .eq('user_id', listing.seller_id)
                .maybeSingle();

            console.log('USER_STATE:' + JSON.stringify(userState));
        }
    } catch (e) {
        console.error('Fatal error:', e.message);
        process.exit(1);
    }
}

run();
