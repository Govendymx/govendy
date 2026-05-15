// Force-end all stuck live sessions for a user
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Try to load from .env files
    require('dotenv').config({ path: '.env.local' });
    require('dotenv').config({ path: '.env.production.local' });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const admin = createClient(url, key);

async function forceEndStuckSessions() {
    // Get all stuck live sessions
    const { data, error } = await admin
        .from('live_sessions')
        .select('id, host_id, title, status, started_at')
        .in('status', ['live', 'scheduled']);

    if (error) { console.error('Error:', error); return; }
    if (!data || data.length === 0) { console.log('✅ No stuck sessions found.'); return; }

    console.log(`Found ${data.length} stuck session(s):`);
    for (const s of data) {
        console.log(`  - [${s.id}] "${s.title}" (status: ${s.status}, started: ${s.started_at})`);
    }

    // End all stuck sessions
    const { error: updErr } = await admin
        .from('live_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .in('status', ['live', 'scheduled']);

    if (updErr) { console.error('Update error:', updErr); return; }
    console.log(`\n✅ Ended ${data.length} stuck session(s). The dashboard should now be clear.`);
}

forceEndStuckSessions().catch(console.error);
