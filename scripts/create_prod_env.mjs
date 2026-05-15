import { readFileSync, writeFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    let val = t.substring(i + 1).trim();
    if (val.length >= 2 && ((val[0] === '"' && val[val.length - 1] === '"') || (val[0] === "'" && val[val.length - 1] === "'")))
        val = val.substring(1, val.length - 1);
    env[t.substring(0, i).trim()] = val;
}

// Write .env.production.local with the critical vars
const vars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
];

const lines = [];
for (const name of vars) {
    if (env[name]) {
        lines.push(`${name}=${env[name].trim()}`);
        console.log(`+ ${name} (${env[name].trim().length} chars)`);
    }
}

writeFileSync('.env.production.local', lines.join('\n') + '\n', 'utf-8');
console.log('\n✅ Created .env.production.local');
