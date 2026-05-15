const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const env = fs.readFileSync(envPath, 'utf8');
    const envMap = {};
    env.split('\n').filter(Boolean).forEach(line => {
        const [k, ...v] = line.split('=');
        envMap[k.trim()] = v.join('=').trim();
    });

    const url = envMap.SUPABASE_URL || envMap.NEXT_PUBLIC_SUPABASE_URL;
    const key = envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.SUPABASE_SERVICE_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);

    console.log('--- TABLES ---');
    const { data: tables } = await supabase.rpc('get_tables_info').catch(() => ({ data: null })); // If exists

    // Alternative: query information_schema if enabled
    const { data: cols, error: cErr } = await supabase.from('listings').select('*').limit(1);
    if (cols && cols.length > 0) {
        console.log('Columns in listings:', Object.keys(cols[0]).join(', '));
    } else {
        console.log('No listings found or error fetching columns');
    }

    // Check for status values
    const { data: statuses } = await supabase.from('listings').select('status').limit(100);
    const statusCounts = {};
    statuses?.forEach(s => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });
    console.log('Status counts (sample 100):', statusCounts);
}

run();
