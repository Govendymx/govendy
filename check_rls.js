const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkPolicies() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    console.log('--- CHECKING RLS POLICIES FOR listings ---');

    const { data: policies, error } = await supabase.rpc('get_policies', { table_name: 'listings' });

    if (error) {
        // Fallback: Use direct query if RPC doesn't exist
        console.log('RPC get_policies failed, try direct query to pg_policies...');
        const { data: directPolicies, error: directError } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'listings');

        if (directError) {
            console.error('Direct query failed:', directError);
            // One last attempt using a raw query via a helper if exists, or just try to list policies via a known schema
            console.log('Attempting to use information_schema or similar if possible (requires proper permissions)');
            // Actually, the most reliable way in Supabase without a custom RPC is often checking if anon can read.
        } else {
            console.log('Policies:', JSON.stringify(directPolicies, null, 2));
        }
    } else {
        console.log('Policies:', JSON.stringify(policies, null, 2));
    }

    // Test public access (ANON)
    const supabaseAnon = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log('--- TESTING ANON ACCESS TO ACTIVE LISTINGS ---');
    const { data: publicListings, error: publicError, count } = await supabaseAnon
        .from('listings')
        .select('id, status', { count: 'exact', head: false })
        .eq('status', 'active')
        .limit(1);

    if (publicError) {
        console.error('ANON Fetch Error:', publicError);
    } else {
        console.log(`ANON Success: Found ${count} active listings.`);
        console.log('Sample:', JSON.stringify(publicListings, null, 2));
    }
}

checkPolicies();
