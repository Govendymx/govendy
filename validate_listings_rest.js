const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function validateRemainingListingsCols() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const listingCols = [
        'sale_type', 'gender', 'size', 'color', 'color_variants', 'size_variants', 'category', 'tags', 'auction_start_at', 'auction_end_at', 'auction_bid_increment', 'auction_highest_bid', 'auction_highest_bidder_id', 'shipping_by_seller', 'allow_personal_delivery', 'free_shipping', 'shipping_subsidy', 'shipping_price', 'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'attributes', 'wholesale_tiers', 'stock', 'size_stock'
    ];

    console.log('--- VALIDATING REMAINING LISTINGS COLUMNS ---');
    for (const col of listingCols) {
        const { error } = await supabase.from('listings').select(col).limit(1);
        if (error) {
            console.log(`❌ Column ${col} is MISSING or INVALID: ${error.message}`);
        } else {
            console.log(`✅ Column ${col} exists.`);
        }
    }
}

validateRemainingListingsCols();
