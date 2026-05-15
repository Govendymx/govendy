import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false as const, status: 401, error: 'Missing bearer token' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false as const, status: 500, error: 'Supabase env vars missing' };
  }

  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Invalid admin token' };
  }

  const admin = supabaseAdmin();
  const { data: adminRow, error: adminError } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    return { ok: false as const, status: 403, error: 'Not an admin user' };
  }

  return { ok: true as const, user };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  const hookUrl =
    process.env.VERCEL_DEPLOY_HOOK_URL_PROD ||
    process.env.VERCEL_DEPLOY_HOOK_URL ||
    '';

  if (!hookUrl) {
    return NextResponse.json(
      { ok: false, error: 'Deploy hook no configurado' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    const text = await res.text();
    const bodySnippet = text.slice(0, 2000);

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          body: bodySnippet || null,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: res.status,
      body: bodySnippet || null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'deploy_failed',
      },
      { status: 500 },
    );
  }
}
