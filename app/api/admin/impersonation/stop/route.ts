import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const res = NextResponse.json({ ok: true, impersonating: false });
    res.headers.append(
      'Set-Cookie',
      'gp_impersonation=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    );
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error deteniendo impersonation' }, { status: 500 });
  }
}

