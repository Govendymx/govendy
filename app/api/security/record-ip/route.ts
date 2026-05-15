import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { ipService } from '@/lib/security/ip-service';

export async function POST(req: NextRequest) {
  try {
    // Authenticate using the standard middleware
    const { effectiveUserId } = await requireAuth(req);

    // Get IP
    let ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();

    const userAgent = req.headers.get('user-agent') || undefined;

    // Record asynchronously
    await ipService.recordUserIP(effectiveUserId, ip, userAgent);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Record IP Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
