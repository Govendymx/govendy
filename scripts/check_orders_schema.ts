
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking orders table schema...');
  
  // Try to select one order to see keys
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
    console.log('No orders found to check columns. Creating a dummy check...');
  }
}

checkSchema();
