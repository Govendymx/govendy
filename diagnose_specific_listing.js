const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debug() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const targetId = '80880381-7a5f-4209-b46f-0821879943d3';

    const { data: listing, error } = await supabase
        .from('listings')
        .select('id, public_id, title, status, seller_id, deleted_at, sale_type')
        .or(`id.eq.${targetId},public_id.eq.${targetId}`)
        .maybeSingle();

    if (error) {
        console.error('Fetch Error:', error);
        return;
    }

    if (!listing) {
        console.log('RESULT: Listing NOT FOUND in database.');
        return;
    }

    console.log('Visibility Check:', JSON.stringify(listing, null, 2));

    // Check if seller is blocked or suspended
    if (listing.seller_id) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, is_verified, plan_type')
            .eq('id', listing.seller_id)
            .maybeSingle();
        console.log('Seller Profile:', JSON.stringify(profile, null, 2));
    }
}

debug();
