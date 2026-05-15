
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkPolicies() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(url, key);

    console.log('Checking RLS policies for "follows"...');
    const { data: policies, error } = await supabase.rpc('check_policies', { table_name: 'follows' });

    // Since I can't use rpc if it doesn't exist, I'll use a direct query to pg_policies
    // using a privileged user (service_role usually works for some pg_ catalogs depending on setup)
    // Actually, I'll just try to select from pg_policies if the role allows.

    const { data, error: pgError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'follows');

    if (pgError) {
        console.log('Could not query pg_policies directly. Trying alternative check.');
        // Alternative: try to select from follows as anon
        const anonSupabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { data: anonData, error: anonError } = await anonSupabase
            .from('follows')
            .select('*')
            .limit(1);

        if (anonError) {
            console.error('Anon user CANNOT select from "follows":', anonError.message);
        } else {
            console.log('Anon user CAN select from "follows". Public SELECT is likely working.');
        }
    } else {
        console.log('Policies found:', JSON.stringify(data, null, 2));
    }
}

checkPolicies();
