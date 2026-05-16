/**
 * set-r2-env.mjs — Agrega las variables R2 a Vercel via API
 * Uso: node scripts/set-r2-env.mjs <VERCEL_TOKEN> <PROJECT_ID> <TEAM_ID>
 *
 * Obtén el token en: https://vercel.com/account/tokens
 * Project ID y Team ID están en: Settings → General (abajo del todo)
 */

const [,, TOKEN, PROJECT_ID, TEAM_ID] = process.argv;

if (!TOKEN || !PROJECT_ID) {
  console.error('Uso: node scripts/set-r2-env.mjs <VERCEL_TOKEN> <PROJECT_ID> [TEAM_ID]');
  process.exit(1);
}

const VARS = [
  { key: 'R2_ACCESS_KEY_ID',     value: '441ad9b240e130d0021e752081d41540' },
  { key: 'R2_SECRET_ACCESS_KEY', value: '2641c604d7d8816dbb41eb98284b9c3a34cb2eb9983ee20bbd95ddb95e3de49f' },
  { key: 'R2_BUCKET_NAME',       value: 'gopocket-images' },
  { key: 'R2_ENDPOINT',          value: 'https://9f0b79427bd07eec4c484d8322a70d2f.r2.cloudflarestorage.com' },
  { key: 'R2_PUBLIC_URL',        value: 'https://pub-5b2462102a09402eaad6f79f06b296c3.r2.dev' },
];

const teamParam = TEAM_ID ? `?teamId=${TEAM_ID}` : '';
const url = `https://api.vercel.com/v10/projects/${PROJECT_ID}/env${teamParam}`;

console.log(`\n→ Endpoint: ${url}\n`);

for (const { key, value } of VARS) {
  const body = JSON.stringify({
    key,
    value,
    type: 'encrypted',
    target: ['production', 'preview', 'development'],
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  const json = await res.json();
  if (res.ok) {
    console.log(`✅ ${key}`);
  } else {
    // Si ya existe, intentar actualizar (upsert)
    if (json.error?.code === 'ENV_ALREADY_EXISTS' || json.error?.message?.includes('already')) {
      console.log(`⚠️  ${key} ya existe — omitido (edítalo manualmente si el valor es incorrecto)`);
    } else {
      console.error(`❌ ${key}: ${JSON.stringify(json.error || json)}`);
    }
  }
}

console.log('\n¡Listo! Ahora ve a Vercel → Deployments y haz Redeploy.\n');
