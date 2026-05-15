import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const env = readEnv('VERCEL_ENV') || readEnv('NODE_ENV') || 'unknown';

  return NextResponse.json(
    {
      ok: true,
      env,
      commitSha: readEnv('VERCEL_GIT_COMMIT_SHA') || readEnv('GIT_COMMIT_SHA') || null,
      deploymentId: readEnv('VERCEL_DEPLOYMENT_ID') || null,
      buildId: readEnv('VERCEL_BUILD_ID') || readEnv('BUILD_ID') || null,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
