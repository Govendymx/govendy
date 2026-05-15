
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkFollows() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(url, key);

    console.log('Checking table "follows"...');
    const { data, error } = await supabase
        .from('follows')
        .select('*');

    if (error) {
        console.error('Error querying "follows" table:', error);
    } else {
        console.log('Success! Table exists.');
        console.log('Total follows:', data.length);
        console.log('Follow records:', JSON.stringify(data, null, 2));
    }
}

checkFollows();
