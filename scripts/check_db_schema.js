
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking column types...');
  
  const longString = 'x'.repeat(200);
  
  // Try to insert with long string in mercadopago_preference_id
  const { data, error } = await supabase
    .from('wallet_topups')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // This might fail due to FK
      amount: 1,
      mercadopago_preference_id: 'TEST_STRING',
      status: 'pending'
    })
    .select();

  if (error) {
    console.error('Insert Error:', error);
    if (error.code === '23503') { // FK violation
       console.log('FK violation confirmed, but type check passed implicitly if not 22P02 (invalid text representation)');
    }
    if (error.message.includes('invalid input syntax for type uuid')) {
        console.log('❌ mercadopago_preference_id is UUID');
    } else {
        console.log('✅ mercadopago_preference_id accepts text (likely)');
    }
  } else {
    console.log('✅ Insert success (it is text). Deleting...');
    await supabase.from('wallet_topups').delete().eq('id', data[0].id);
  }
}

checkSchema();
