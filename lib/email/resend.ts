import { Resend } from 'resend';

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
  fromName?: string;
};

/**
 * Envía email usando el SDK oficial de Resend.
 * Requiere: RESEND_API_KEY en variables de entorno.
 * El dominio gopocket.com.mx debe estar verificado en resend.com/domains.
 */
export async function sendEmailWithResend(opts: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EMAIL RESEND] RESEND_API_KEY no configurado');
    return { ok: false, error: 'RESEND_API_KEY no configurado' };
  }

  const fromEmail = opts.from || process.env.EMAIL_FROM || 'contacto@gopocket.com.mx';
  const fromName = opts.fromName || process.env.EMAIL_FROM_NAME || 'GoVendy';

  try {
    const resend = new Resend(apiKey);

    console.log(`[EMAIL RESEND] Enviando a: ${opts.to} desde: ${fromEmail}`);

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [opts.to.trim()],
      subject: opts.subject,
      text: opts.text || undefined,
      html: opts.html,
      replyTo: opts.replyTo || fromEmail,
    });

    if (error) {
      console.error('[EMAIL RESEND] Error de API:', error);
      return { ok: false, error: error.message };
    }

    console.log('[EMAIL RESEND] Enviado OK, id:', data?.id);
    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[EMAIL RESEND] Excepción:', err);
    return { ok: false, error: err.message || 'Error al enviar email' };
  }
}
