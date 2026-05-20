import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching config...');
  const { data: settingsRow, error: fetchErr } = await supabase
    .from('app_settings')
    .select('t1_envios_config')
    .eq('id', 1)
    .single();

  if (fetchErr) {
    console.error('Error fetching settings:', fetchErr);
    return;
  }

  let config = settingsRow?.t1_envios_config || {};
  console.log('Current config before update:', JSON.stringify(config, null, 2));

  // Modify config to enable T1 Envios
  config.enabled = true;
  config.access_basic = true;
  config.access_pro = true;
  config.access_platinum = true;
  
  if (!config.api_url) {
     config.api_url = "https://apiv2.t1envios.com";
  }

  console.log('Updating config to enable T1 Envios...');
  const { error: upErr } = await supabase
    .from('app_settings')
    .update({ t1_envios_config: config })
    .eq('id', 1);

  if (upErr) {
    console.error('Failed to update config:', upErr);
    return;
  }
  console.log('T1 Envios ENABLED successfully in the database.');
}

run();
