import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin, getMailboxes } from '@/lib/admin/mail/guard';

export const dynamic = 'force-dynamic';

type SendBody = {
  fromAccount?: number;
  to?: string;
  subject?: string;
  body?: string;
  html?: string;
};

/**
 * POST: { fromAccount: 0, to: '...', subject: '...', body: '...' }
 * Envía usando Resend SDK. El "from" se toma del buzón configurado en admin_mailboxes
 * (todos deben ser @gopocket.com.mx ya que el dominio está verificado en Resend).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY no configurado en variables de entorno.' },
        { status: 500 },
      );
    }

    const mailboxes = await getMailboxes(admin);
    const body = (await req.json().catch(() => ({}))) as SendBody;
    const fromAccount = Math.max(0, Math.min(Math.max(0, mailboxes.length - 1), Number(body?.fromAccount) || 0));
    const to = String(body?.to ?? '').trim();
    const subject = String(body?.subject ?? '').trim();
    const text = String(body?.body ?? '').trim();
    const html = String(body?.html ?? '').trim();

    if (!to) return NextResponse.json({ error: 'Destinatario (to) requerido' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: 'Asunto requerido' }, { status: 400 });
    if (!text && !html) return NextResponse.json({ error: 'Cuerpo del mensaje requerido' }, { status: 400 });

    // Determinar el remitente: usar buzón configurado o fallback a EMAIL_FROM
    let fromEmail = process.env.EMAIL_FROM || 'contacto@gopocket.com.mx';
    let fromName = process.env.EMAIL_FROM_NAME || 'GoVendy';

    if (mailboxes.length > 0) {
      const mb = mailboxes[fromAccount];
      fromEmail = mb.email || fromEmail;
      fromName = mb.label || fromName;
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text: text || undefined,
      html: html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${text}</pre>`,
      replyTo: fromEmail,
    });

    if (error) {
      console.error('[admin/mail/send] Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const r = NextResponse.json({ ok: true, message: 'Correo enviado', id: data?.id, from: fromEmail });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  } catch (e: unknown) {
    console.error('[admin/mail/send]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al enviar' }, { status: 500 });
  }
}
