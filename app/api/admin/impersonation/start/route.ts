import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { requireAdmin } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

function getImpersonationSecret(): string {
  const fromEnv = process.env.IMPERSONATION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!fromEnv) {
    throw new Error('Missing IMPERSONATION_SECRET or SUPABASE_SERVICE_ROLE_KEY');
  }
  return fromEnv;
}

function signImpersonationToken(payload: { adminId: string; targetUserId: string; exp: number }) {
  const secret = getImpersonationSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const body = await req.json();
    const targetUserId = String(body?.targetUserId || '').trim();
    const adminPassword = String(body?.adminPassword || '').trim();

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId requerido' }, { status: 400 });
    }
    if (!adminPassword) {
      return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 });
    }

    const admin = auth.admin;
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(auth.userId);
    if (authErr || !authUser?.user?.email) {
      return NextResponse.json({ error: 'No se pudo obtener email de administrador' }, { status: 500 });
    }

    const email = authUser.user.email as string;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password: adminPassword,
    });

    if (error || !data?.user) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const token = signImpersonationToken({
      adminId: auth.userId,
      targetUserId,
      exp,
    });

    const res = NextResponse.json({ ok: true, impersonating: true });
    res.headers.append(
      'Set-Cookie',
      `gp_impersonation=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${15 * 60}`,
    );
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error iniciando impersonation' }, { status: 500 });
  }
}

