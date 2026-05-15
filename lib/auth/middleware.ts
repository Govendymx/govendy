// Middleware de autenticación reutilizable

import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/errors';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export interface AuthResult {
  userId: string;
  effectiveUserId: string;
  impersonating: boolean;
  impersonatedUserId: string | null;
  admin: ReturnType<typeof supabaseAdmin>;
}

function getImpersonationSecret(): string {
  const fromEnv = process.env.IMPERSONATION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!fromEnv) {
    throw new Error('Missing IMPERSONATION_SECRET or SUPABASE_SERVICE_ROLE_KEY');
  }
  return fromEnv;
}

function verifyImpersonationCookie(raw: string | undefined, adminId: string) {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  try {
    const secret = getImpersonationSecret();
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as {
      adminId: string;
      targetUserId: string;
      exp: number;
    };
    if (payload.adminId !== adminId) return null;
    if (!payload.targetUserId) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Requerir autenticación básica (usuario logueado)
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = getBearerToken(req);
  if (!token) {
    throw new UnauthorizedError('Missing Authorization Bearer token');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error('Supabase env vars missing on server');
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  
  if (userErr || !userData.user) {
    throw new UnauthorizedError(userErr?.message || 'Invalid token');
  }

  const userId = userData.user.id;
  const cookie = req.cookies.get('gp_impersonation')?.value;
  const decoded = verifyImpersonationCookie(cookie, userId);
  const effectiveUserId = decoded?.targetUserId || userId;

  return {
    userId,
    effectiveUserId,
    impersonating: Boolean(decoded),
    impersonatedUserId: decoded?.targetUserId || null,
    admin: supabaseAdmin(),
  };
}

/**
 * Requerir autenticación de administrador
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  const { data: row, error } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error verificando admin: ${error.message}`);
  }

  if (!row) {
    throw new ForbiddenError('No autorizado (admin requerido)');
  }

  return auth;
}
