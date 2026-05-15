const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAppSettings() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase credentials');
        return;
    }
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (error) {
        console.error('Error fetching settings:', error);
        return;
    }
    console.log('App Settings keys:', Object.keys(data));
    console.log('App Settings data:', JSON.stringify(data, null, 2));
}

checkAppSettings();
