const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function validateEndListingsCols() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const listingCols = [
        'shipping_subsidy', 'shipping_price', 'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'attributes', 'wholesale_tiers', 'stock', 'size_stock'
    ];

    console.log('--- VALIDATING END LISTINGS COLUMNS ---');
    for (const col of listingCols) {
        const { error } = await supabase.from('listings').select(col).limit(1);
        if (error) {
            console.log(`❌ Column ${col} is MISSING or INVALID: ${error.message}`);
        } else {
            console.log(`✅ Column ${col} exists.`);
        }
    }
}

validateEndListingsCols();
