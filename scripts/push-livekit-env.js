/**
 * Script to push LiveKit environment variables to Vercel project
 * Run: node scripts/push-livekit-env.js
 */
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

function pushEnvVar(name, value) {
    const tempFile = require('os').tmpdir() + `\\${name}.txt`;
    require('fs').writeFileSync(tempFile, value, 'utf-8');
    try {
        execSync(`type "${tempFile}" | vercel env add ${name} production --force`, {
            stdio: 'pipe', shell: 'cmd.exe', timeout: 15000
        });
        console.log(`  ✅ ${name} → production`);
        execSync(`type "${tempFile}" | vercel env add ${name} development --force`, {
            stdio: 'pipe', shell: 'cmd.exe', timeout: 15000
        });
        console.log(`  ✅ ${name} → development`);
        execSync(`type "${tempFile}" | vercel env add ${name} preview --force`, {
            stdio: 'pipe', shell: 'cmd.exe', timeout: 15000
        });
        console.log(`  ✅ ${name} → preview`);
    } catch (e) {
        console.error(`  ❌ ${name}: ${e.message?.substring(0, 200)}`);
    } finally {
        try { require('fs').unlinkSync(tempFile); } catch { }
    }
}

async function main() {
    console.log('========================================');
    console.log('  LiveKit Env Vars → Vercel pocket-app');
    console.log('========================================');
    console.log('Enter your LiveKit credentials below.');
    console.log('(Get them from: https://cloud.livekit.io → Your Project)\n');

    const url = (await ask('LIVEKIT_URL (e.g. wss://my-project.livekit.cloud): ')).trim();
    const key = (await ask('LIVEKIT_API_KEY: ')).trim();
    const secret = (await ask('LIVEKIT_API_SECRET: ')).trim();
    rl.close();

    if (!url || !key || !secret) {
        console.error('\n❌ All three values are required. Aborting.');
        process.exit(1);
    }

    console.log('\nPushing to Vercel...\n');
    pushEnvVar('LIVEKIT_URL', url);
    pushEnvVar('LIVEKIT_API_KEY', key);
    pushEnvVar('LIVEKIT_API_SECRET', secret);

    console.log('\n✅ Done! Now run: vercel --prod --yes');
}

main().catch(console.error);
