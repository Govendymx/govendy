
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials from check_shipping_options.ts
const supabaseUrl = 'https://xlnxdzocwgrzqoznmarc.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkColumns() {
  console.log('Checking listings table columns...');
  
  // Try to select the column. If it doesn't exist, Supabase will return an error.
  const { data, error } = await supabase
    .from('listings')
    .select('wholesale_tiers')
    .limit(1);

  if (error) {
    // PostgREST error code for undefined column is 42703
    if (error.code === '42703' || error.message.includes('does not exist') || error.message.includes('Select query has failed')) {
        console.log('RESULT: Column wholesale_tiers DOES NOT exist.');
    } else {
        console.error('Error checking column:', error);
    }
  } else {
    console.log('RESULT: Column wholesale_tiers EXISTS.');
  }
}

checkColumns();
