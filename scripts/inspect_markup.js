const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('shipping_markup_fixed, shipping_markup_percent')
        .eq('id', 1)
        .single();

    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
run();
