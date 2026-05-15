import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/mail/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;

/** GET: ?account=0&page=1&limit=25&to=ventas@gopocket.com.mx */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_LIMIT));
    const toFilter = req.nextUrl.searchParams.get('to') || '';
    const offset = (page - 1) * limit;

    const admin = supabaseAdmin();

    let query = admin
      .from('admin_inbox')
      .select('id, from_email, from_name, to_email, subject, received_at, seen', { count: 'exact' })
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (toFilter) {
      query = query.ilike('to_email', `%${toFilter}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[admin/mail/inbox]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const emails = (data || []).map((row: any) => ({
      uid: row.id,
      from: row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email,
      to: row.to_email,
      subject: row.subject,
      date: row.received_at,
      seen: row.seen,
    }));

    const r = NextResponse.json({ ok: true, emails, total: count ?? 0, page, limit });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  } catch (e: unknown) {
    console.error('[admin/mail/inbox]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al cargar buzón' }, { status: 500 });
  }
}
