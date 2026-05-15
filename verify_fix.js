const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function verify() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const targetId = '77402a98-2353-4c65-be11-48ae1249339a'; // One of the paused ones

    console.log('--- RE-ACTIVATION VERIFICATION ---');

    // 1. Check current state
    const { data: before } = await supabase.from('listings').select('status, expires_at').eq('id', targetId).single();
    console.log('Before Reactivation:', before);

    // 2. Reactivate manually (simulating the fix)
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('listings').update({
        status: 'active',
        expires_at: newExpiry
    }).eq('id', targetId);

    if (error) {
        console.error('Update Error:', error);
        return;
    }

    // 3. Confirm update
    const { data: after } = await supabase.from('listings').select('status, expires_at').eq('id', targetId).single();
    console.log('After Reactivation:', after);

    if (after.status === 'active' && after.expires_at === newExpiry) {
        console.log('SUCCESS: Reactivation logic confirmed.');
    } else {
        console.log('FAILURE: Reactivation logic mismatch.');
    }
}

verify();
