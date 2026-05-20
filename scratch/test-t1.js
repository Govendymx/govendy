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

  const config = settingsRow?.t1_envios_config || {};
  console.log('T1 Config enabled:', config.enabled);
  console.log('Shop ID:', config.shop_id);

  if (!config.enabled) {
    console.log('T1 is not enabled in DB.');
    return;
  }

  // 1. Auth
  const authUrl = `${config.api_url.replace(/\/$/, '')}/auth/login`;
  console.log('Auth URL:', authUrl);
  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    })
  });
  const authData = await authRes.json();
  if (!authRes.ok) {
    console.log('Auth failed:', authData);
    return;
  }
  const token = authData.result?.access_token || authData.access_token || authData.token;
  console.log('Token acquired:', !!token);

  // 2. Quote
  const quoteUrl = `${config.api_url.replace(/\/$/, '')}/quote/create`;
  const t1Req = {
    codigo_postal_origen: "02940",
    codigo_postal_destino: "91180",
    peso: 1,
    largo: 20,
    ancho: 20,
    alto: 30,
    dias_embarque: 1,
    seguro: false,
    valor_paquete: 0,
    tipo_paquete: 2,
    comercio_id: config.shop_id,
    paquetes: 1,
    generar_recoleccion: false,
  };

  console.log('Requesting quote:', t1Req);
  const quoteRes = await fetch(quoteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'shop_id': config.shop_id,
    },
    body: JSON.stringify(t1Req),
  });

  const quoteData = await quoteRes.json();
  console.log('Quote response status:', quoteRes.status);
  console.log('Quote data:', JSON.stringify(quoteData, null, 2));
}

run();
