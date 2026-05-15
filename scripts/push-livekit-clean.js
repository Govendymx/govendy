const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const vars = {
    LIVEKIT_URL: 'wss://gopocket-live-1cvwgdhd.livekit.cloud',
    LIVEKIT_API_KEY: 'APIoWMFEWDevCnZ',
    LIVEKIT_API_SECRET: '1LvWtedwigBqAvN7edKDeAdG8QgQOY8Fk01958mqsq0B',
};

for (const [name, value] of Object.entries(vars)) {
    console.log(`Setting ${name}...`);
    const tmpFile = path.join(os.tmpdir(), `lk_${name}.tmp`);
    // Write WITHOUT trailing newline
    fs.writeFileSync(tmpFile, value, { encoding: 'utf8' });
    for (const env of ['production', 'preview', 'development']) {
        try {
            execSync(
                `type "${tmpFile}" | vercel env add ${name} ${env} --force`,
                { stdio: 'pipe', shell: 'cmd.exe', timeout: 20000 }
            );
            console.log(`  ✅ ${name} → ${env}`);
        } catch (e) {
            console.error(`  ❌ ${name} → ${env}: ${e.stderr?.toString()?.substring(0, 100)}`);
        }
    }
    try { fs.unlinkSync(tmpFile); } catch { }
}

console.log('\nAll done! Deploying...');
