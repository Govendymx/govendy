const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envMap = {};
env.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) envMap[k.trim()] = v.trim();
});

async function listSuspensions() {
    const supabase = createClient(
        envMap.SUPABASE_URL || envMap.NEXT_PUBLIC_SUPABASE_URL,
        envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.SUPABASE_SERVICE_KEY
    );

    console.log('--- FETCHING ACTIVE SUSPENSIONS ---');

    const { data: states, error } = await supabase
        .from('user_admin_states')
        .select('user_id, status, suspended_until, reason')
        .neq('status', 'active');

    if (error) {
        console.error('Fetch Error:', error);
        return;
    }

    console.log(`Found ${states.length} non-active states.`);
    states.forEach(s => {
        console.log(`User: ${s.user_id}, Status: ${s.status}, Until: ${s.suspended_until}, Reason: ${s.reason}`);
    });
}

listSuspensions();
