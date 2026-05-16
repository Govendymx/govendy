const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('estafeta_quotes').select('id').limit(1);
  if (error) {
    console.error('Error estafeta_quotes:', error.message);
  } else {
    console.log('estafeta_quotes existe:', data);
  }

  const { data: d2, error: e2 } = await supabase.from('listings').select('size_stock, size_variants').limit(1);
  if (e2) {
    console.error('Error listings:', e2.message);
  } else {
    console.log('listings size_stock existe:', d2);
  }
}

test();
