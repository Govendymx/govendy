const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkColumns() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const tables = ['listings', 'profiles'];

    for (const table of tables) {
        console.log(`\n--- COLUMNS FOR ${table} ---`);
        const { data, error } = await supabase.rpc('get_table_columns', { t_name: table });

        if (error) {
            console.log(`RPC get_table_columns failed for ${table}, using alternative...`);
            // Alternative: Select one row and get keys
            const { data: sample, error: sampleError } = await supabase.from(table).select('*').limit(1).maybeSingle();
            if (sampleError) {
                console.error(`Error sampling ${table}:`, sampleError);
            } else if (sample) {
                console.log(Object.keys(sample).sort().join(', '));
            } else {
                console.log(`No data in ${table} to inspect.`);
            }
        } else {
            console.log(data.map(c => c.column_name).sort().join(', '));
        }
    }
}

checkColumns();
