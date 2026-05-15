const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSessions() {
    const { data } = await admin
        .from('live_sessions')
        .select('id, title, status, started_at, ended_at, host_id')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('\n=== Live Sessions (last 10) ===');
    for (const s of data || []) {
        console.log(`[${s.status.toUpperCase()}] ${s.id.slice(0, 8)}... "${s.title}" started=${s.started_at?.slice(11, 19)} ended=${s.ended_at?.slice(11, 19) || '—'}`);
    }

    const live = data?.filter(s => s.status === 'live' || s.status === 'scheduled');
    console.log(`\n${live?.length || 0} session(s) currently LIVE/SCHEDULED`);
    if (live?.length) {
        console.log('Active session IDs:', live.map(s => s.id));
    }
}

checkSessions().catch(console.error);
