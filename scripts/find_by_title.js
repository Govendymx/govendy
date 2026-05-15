const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('listings')
        .select('id, title, shipping_price, shipping_subsidy, shipping_by_seller, free_shipping, weight_kg, sale_type')
        .ilike('title', '%SUBASTA 3 SUBCIDIO%');

    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
run();
