import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching config...');
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('t1_envios_config')
    .eq('id', 1)
    .single();

  let config = settingsRow?.t1_envios_config || {};
  
  // Update with the real credentials extracted by the subagent
  config.username = "arturoalejandro031187@gmail.com";
  config.password = "Chedraui031187.";
  config.shop_id = "316909";
  config.api_url = "https://apiv2.t1envios.com";
  config.enabled = true;
  config.access_basic = true;
  config.access_pro = true;
  config.access_platinum = true;
  config.test_mode = false;

  console.log('Updating config...');
  const { error: upErr } = await supabase
    .from('app_settings')
    .update({ t1_envios_config: config })
    .eq('id', 1);

  if (upErr) {
    console.error('Failed to update config:', upErr);
  } else {
    console.log('T1 Envios REAL CREDENTIALS SAVED successfully.');
  }
}

run();
