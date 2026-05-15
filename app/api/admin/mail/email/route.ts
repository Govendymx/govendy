import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/mail/guard';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** GET: ?uid=123 — lee el cuerpo completo de un correo de admin_inbox */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const uid = Number(req.nextUrl.searchParams.get('uid'));
    if (!Number.isFinite(uid) || uid < 1) {
      return NextResponse.json({ error: 'uid requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Marcar como leído y obtener el correo
    const { data, error } = await admin
      .from('admin_inbox')
      .update({ seen: true })
      .eq('id', uid)
      .select('id, from_email, from_name, to_email, subject, text_body, html_body, received_at')
      .maybeSingle();

    if (error) {
      console.error('[admin/mail/email]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Correo no encontrado' }, { status: 404 });
    }

    const email = {
      from: data.from_name ? `${data.from_name} <${data.from_email}>` : data.from_email,
      to: data.to_email,
      subject: data.subject,
      date: data.received_at,
      text: data.text_body || undefined,
      html: data.html_body || undefined,
    };

    const r = NextResponse.json({ ok: true, email });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  } catch (e: unknown) {
    console.error('[admin/mail/email]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al cargar correo' }, { status: 500 });
  }
}
