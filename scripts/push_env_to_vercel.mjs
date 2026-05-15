import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    // Remove surrounding quotes
    if (val.length >= 2 && ((val[0] === '"' && val[val.length - 1] === '"') || (val[0] === "'" && val[val.length - 1] === "'"))) {
        val = val.substring(1, val.length - 1);
    }
    env[key] = val;
}

// Vars we need to push
const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
];

for (const name of requiredVars) {
    const value = env[name];
    if (!value) {
        console.log(`SKIP ${name} (not found in .env.local)`);
        continue;
    }

    const cleanValue = value.trim();
    console.log(`Setting ${name} (${cleanValue.length} chars)...`);

    // Write to temp file
    const tmpFile = join(tmpdir(), `vercel_env_${name}.txt`);
    writeFileSync(tmpFile, cleanValue, 'utf-8');

    try {
        // Add to production (--force to overwrite)
        execSync(`type "${tmpFile}" | vercel env add ${name} production --force`, {
            stdio: 'pipe',
            shell: 'cmd.exe',
            timeout: 15000
        });
        console.log(`  ✅ ${name} set for production`);
    } catch (e) {
        console.log(`  ⚠️ ${name}: ${e.message?.substring(0, 100)}`);
    }

    try {
        unlinkSync(tmpFile);
    } catch { }
}

console.log('\nDone! Now redeploy to apply changes.');
