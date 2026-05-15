import { NextRequest, NextResponse } from 'next/server';
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

function decodeImpersonation(raw: string | undefined, adminId: string) {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  try {
    const secret = getImpersonationSecret();
    const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const cookie = req.cookies.get('gp_impersonation')?.value;
    const decoded = decodeImpersonation(cookie, auth.userId);
    if (!decoded) {
      return NextResponse.json({ impersonating: false });
    }
    return NextResponse.json({
      impersonating: true,
      adminId: decoded.adminId,
      targetUserId: decoded.targetUserId,
      exp: decoded.exp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error obteniendo estado de impersonation' }, { status: 500 });
  }
}

