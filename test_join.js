const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testJoin() {
    const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const targetId = '80880381-7a5f-4209-b46f-0821879943d3';

    console.log('--- TESTING JOIN: seller:seller_id(...) ---');
    const { data, error } = await supabase
        .from('listings')
        .select(`
            id,
            seller:seller_id(full_name, city, state)
        `)
        .eq('id', targetId)
        .maybeSingle();

    if (error) {
        console.error('❌ JOIN FAILED:', error.message);
        console.log('Hint:', error.hint);
        console.log('Details:', error.details);
    } else {
        console.log('✅ JOIN SUCCESSFUL:', JSON.stringify(data, null, 2));
    }

    console.log('\n--- TESTING ALTERNATIVE JOIN: profiles(...) ---');
    const { data: data2, error: error2 } = await supabase
        .from('listings')
        .select(`
            id,
            profiles(full_name, city, state)
        `)
        .eq('id', targetId)
        .maybeSingle();

    if (error2) {
        console.error('❌ ALTERNATIVE JOIN FAILED:', error2.message);
    } else {
        console.log('✅ ALTERNATIVE JOIN SUCCESSFUL:', JSON.stringify(data2, null, 2));
    }
}

testJoin();
