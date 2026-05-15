const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debug() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const publicId = 'PCK-C30799A89C';

    console.log(`--- DEBUGGING LISTING ${publicId} ---`);

    const { data: listing, error } = await supabase
        .from('listings')
        .select('*')
        .eq('public_id', publicId)
        .single();

    if (error) {
        console.error('Fetch Error:', error);
        // Try by UUID if possible, but we only have publicId from screenshot
        return;
    }

    console.log('Listing Record:', JSON.stringify(listing, null, 2));

    // Also check seller state
    if (listing.seller_id) {
        const { data: sellerState } = await supabase
            .from('user_admin_states')
            .select('*')
            .eq('user_id', listing.seller_id)
            .maybeSingle();
        console.log('Seller Admin State:', JSON.stringify(sellerState, null, 2));
    }
}

debug();
