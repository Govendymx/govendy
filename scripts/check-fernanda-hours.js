const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

(async () => {
    const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profiles } = await sb
        .from('profiles')
        .select('id, full_name, plan_type, pro_subscription_end')
        .ilike('full_name', '%FERNANDA%')
        .limit(3);

    if (!profiles || profiles.length === 0) { console.log('NO PROFILE FOUND'); return; }

    const p = profiles[0];
    console.log('USER: ' + p.full_name);
    console.log('PLAN: ' + p.plan_type);
    console.log('SUB_END: ' + p.pro_subscription_end);
    console.log('ID: ' + p.id);

    const uid = p.id;

    // Daily usage
    const { data: usage } = await sb
        .from('live_daily_usage')
        .select('usage_date, minutes_used')
        .eq('user_id', uid)
        .order('usage_date', { ascending: false })
        .limit(5);

    console.log('\nDAILY USAGE:');
    if (usage) usage.forEach(u => console.log('  ' + u.usage_date + ' => ' + u.minutes_used + ' min'));
    else console.log('  ninguno');

    // Extra hours
    const { data: extra } = await sb
        .from('live_extra_hours')
        .select('minutes_balance, updated_at')
        .eq('user_id', uid);

    console.log('\nEXTRA HOURS BALANCE:');
    if (extra && extra.length > 0) console.log('  ' + extra[0].minutes_balance + ' min (updated: ' + extra[0].updated_at + ')');
    else console.log('  no record');

    // Sessions today
    const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    const { data: sessions } = await sb
        .from('live_sessions')
        .select('id, status, started_at, ended_at')
        .eq('host_id', uid)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true });

    console.log('\nSESIONS TODAY:');
    let totalMins = 0;
    if (sessions) sessions.forEach(s => {
        let dur = 0;
        if (s.started_at && s.ended_at) {
            dur = Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
        }
        totalMins += dur;
        console.log('  ' + s.status + ' ' + dur + 'min start=' + (s.started_at || '?').substring(11, 19) + ' end=' + (s.ended_at || 'running').substring(11, 19));
    });
    console.log('TOTAL MINS TODAY: ' + totalMins);

    process.exit(0);
})();
