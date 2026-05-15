
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://xlnxdzocwgrzqoznmarc.supabase.co";
// Service Role Key from RESPALDO_CLAVES.env
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderSchema() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching order:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Order keys:', Object.keys(data[0]));
    // console.log('Sample order:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No orders found even with Service Role. Maybe table is empty?');
  }
}

checkOrderSchema();
