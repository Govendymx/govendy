const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function validateSelect() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const listingCols = [
        'id', 'public_id', 'title', 'description', 'description_blocks', 'price', 'currency', 'images', 'status', 'seller_id', 'created_at', 'sale_type', 'gender', 'size', 'color', 'color_variants', 'size_variants', 'category', 'tags', 'auction_start_at', 'auction_end_at', 'auction_bid_increment', 'auction_highest_bid', 'auction_highest_bidder_id', 'shipping_by_seller', 'allow_personal_delivery', 'free_shipping', 'shipping_subsidy', 'shipping_price', 'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'attributes', 'wholesale_tiers', 'stock', 'size_stock'
    ];

    const sellerCols = [
        'full_name', 'city', 'state', 'zip_code', 'store_logo_url', 'plan_type', 'is_official_store', 'official_store_name', 'official_store_banner_url', 'official_store_brand_color', 'is_verified', 'is_wholesaler', 'is_manufacturer', 'rating_total_count', 'rating_good_count', 'reputation_score', 'manual_reputation_score', 'manual_sales_count'
    ];

    console.log('--- VALIDATING LISTINGS COLUMNS ---');
    for (const col of listingCols) {
        const { error } = await supabase.from('listings').select(col).limit(1);
        if (error) {
            console.log(`❌ Column ${col} is MISSING or INVALID in listings table.`);
        } else {
            console.log(`✅ Column ${col} exists.`);
        }
    }

    console.log('\n--- VALIDATING PROFILE (SELLER) COLUMNS ---');
    for (const col of sellerCols) {
        const { error } = await supabase.from('profiles').select(col).limit(1);
        if (error) {
            console.log(`❌ Column ${col} is MISSING or INVALID in profiles table.`);
        } else {
            console.log(`✅ Column ${col} exists.`);
        }
    }
}

validateSelect();
