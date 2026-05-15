import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest) {
  const secret = process.env.CART_REMINDER_SECRET || '';
  if (!secret) return false; // por seguridad, requiere secret
  return req.nextUrl.searchParams.get('token') === secret;
}

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

    const admin = supabaseAdmin();
    const hours = Math.max(1, Math.min(168, toNumber(req.nextUrl.searchParams.get('hours') || 24) || 24));
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Traer items viejos (best-effort si columnas no existen)
    // Esperamos que cart_items tenga user_id, listing_id, created_at
    const res: any = await admin
      .from('cart_items')
      .select('user_id,created_at')
      .lte('created_at', cutoff)
      .limit(5000);

    if (res.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || code === '42P01' || msg.includes('relation') || msg.includes('does not exist')) {
        return NextResponse.json({ ok: true, skipped: true, reason: 'missing_columns_or_table' });
      }
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const rows = (res.data as any[]) ?? [];
    if (rows.length === 0) return NextResponse.json({ ok: true, reminded: 0 });

    const users = Array.from(new Set(rows.map((r) => String(r?.user_id || '').trim()).filter(Boolean)));
    let reminded = 0;
    for (const uid of users) {
      const rr = await insertNotificationBestEffort(admin, {
        user_id: uid,
        type: 'cart_reminder',
        title: 'Tienes artículos en tu carrito',
        body: 'Aún tienes artículos en tu carrito. Termina tu compra cuando quieras.',
        data: { hours, cutoff },
        is_read: false,
      });
      if (rr.ok) reminded += 1;
    }

    const resp = NextResponse.json({ ok: true, users: users.length, reminded });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error sending cart reminders' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

