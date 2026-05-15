const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function findRelationName() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const targetId = '80880381-7a5f-4209-b46f-0821879943d3';

    // Try a few common patterns
    const patterns = [
        'profiles(*)',
        'seller:profiles(*)',
        'user:seller_id(*)',
        'seller:user_id(*)',
        'author:seller_id(*)'
    ];

    for (const p of patterns) {
        console.log(`Testing pattern: ${p}`);
        const { data, error } = await supabase
            .from('listings')
            .select(`id, ${p}`)
            .eq('id', targetId)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.log(`❌ FAILED: ${error.message}`);
        } else {
            console.log(`✅ SUCCESS: Relationship name found!`);
            console.log('Sample data keys:', Object.keys(data));
            break;
        }
    }
}

findRelationName();
