
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xlnxdzocwgrzqoznmarc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY';

const admin = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking orders table schema...');
  
  const { data, error } = await admin
    .from('orders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting orders:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns present in first order:', Object.keys(data[0]));
  } else {
    console.log('No orders found to check columns. Inserting dummy to check...');
    // Try to insert and delete a dummy order to see columns if needed, but selecting empty result usually doesn't give columns.
    // However, if we can't select, we can't know.
    // Let's try to query information_schema via RPC if possible, but admin client is bound to public schema usually.
    // Actually, let's try to insert a dummy order and see what happens.
  }
}

checkSchema();
