const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function getForeignKeys() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    console.log('--- FOREIGN KEYS FOR listings ---');
    const { data, error } = await supabase.rpc('get_table_foreign_keys', { t_name: 'listings' });

    if (error) {
        console.log('RPC failed, trying query via REST if possible...');
        // Try to deduce by trying joins in patterns
        // But let's try a cleverer query if we can. 
        // Actually, let's just try the join with the TABLE name directly.
    } else {
        console.log('FKs:', JSON.stringify(data, null, 2));
    }
}

getForeignKeys();
