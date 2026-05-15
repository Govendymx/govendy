
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlnxdzocwgrzqoznmarc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking shipping_options...');
  
  const { data: options, error } = await supabase
    .from('shipping_options')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(options, null, 2));
}

main();
