const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function validateSellerCols() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const sellerCols = [
        'full_name', 'city', 'state', 'zip_code', 'store_logo_url', 'plan_type', 'is_official_store', 'official_store_name', 'official_store_banner_url', 'official_store_brand_color', 'is_verified', 'is_wholesaler', 'is_manufacturer', 'rating_total_count', 'rating_good_count', 'reputation_score', 'manual_reputation_score', 'manual_sales_count'
    ];

    console.log('--- VALIDATING PROFILE (SELLER) COLUMNS ---');
    for (const col of sellerCols) {
        const { error } = await supabase.from('profiles').select(col).limit(1);
        if (error) {
            console.log(`❌ Column ${col} is MISSING or INVALID: ${error.message}`);
        } else {
            console.log(`✅ Column ${col} exists.`);
        }
    }
}

validateSellerCols();
