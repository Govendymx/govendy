import nodemailer from 'nodemailer';
import { getMailboxesForNotifications } from './mailboxes';
import { sendEmailWithResend } from './resend';

const ENV_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED;
const ENABLED = ENV_ENABLED === undefined || ENV_ENABLED === '' || ENV_ENABLED.toLowerCase() === 'true' || ENV_ENABLED === '1';
const MAILBOX_INDEX = Math.max(0, parseInt(process.env.EMAIL_NOTIFICATIONS_MAILBOX_INDEX ?? '0', 10) || 0);

export type SendTransactionalOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string; // Dirección de email personalizada (opcional)
  fromName?: string; // Nombre personalizado (opcional)
};

/**
 * Envía un correo transaccional.
 * Prioridad: 1) Resend (si está configurado), 2) Buzones configurados en Admin
 * Best-effort: si falla, se registra en consola y no se lanza.
 */
export async function sendTransactionalEmail(opts: SendTransactionalOptions): Promise<{ ok: boolean; error?: string }> {
  if (!ENABLED) {
    return { ok: false, error: 'EMAIL_NOTIFICATIONS_ENABLED is off' };
  }

  const { to, subject, html, text, replyTo } = opts;
  const toTrim = String(to ?? '').trim();
  if (!toTrim) return { ok: false, error: 'Missing recipient' };

  // Intentar primero con Resend si está configurado (preferido para contacto@gopocket.com.mx)
  if (process.env.RESEND_API_KEY) {
    const resendResult = await sendEmailWithResend({ 
      to: toTrim, 
      subject, 
      html, 
      text, 
      replyTo,
      from: opts.from,
      fromName: opts.fromName,
    });
    
    // Si falla Resend, retornamos el error directamente sin hacer fallback a Microsoft 365.
    // Esto asegura que no se intenten usar credenciales SMTP obsoletas o bloqueadas.
    return resendResult;
  }
  
  // Si no hay API Key de Resend, fallamos explícitamente.
  console.warn('[EMAIL] RESEND_API_KEY is missing');
  return { ok: false, error: 'RESEND_API_KEY not configured. SMTP fallback (Microsoft 365) is disabled.' };

  /* 
  // --- FALLBACK DESACTIVADO (Microsoft 365 / SMTP) ---
  // Se ha desactivado el uso de buzones SMTP directos para evitar errores de autenticación (535 5.7.139).
  // Todo el tráfico de correo debe ir por Resend.
  
  // Fallback: usar buzones configurados en Admin
  const mailboxes = await getMailboxesForNotifications();
  if (mailboxes.length === 0) {
    console.warn('[EMAIL] No mailboxes configured. Skip send.', { to: toTrim, subject });
    const errorMsg = resendError ? `Resend failed (${resendError}) and no mailboxes configured` : 'No mailboxes configured';
    return { ok: false, error: errorMsg };
  }

  const idx = Math.min(MAILBOX_INDEX, mailboxes.length - 1);
  const mb = mailboxes[idx];

  try {
    const transporter = nodemailer.createTransport({
      host: mb.smtp_host,
      port: mb.smtp_port,
      secure: mb.smtp_secure,
      auth: { user: mb.smtp_user, pass: mb.smtp_pass },
    });

    await transporter.sendMail({
      from: `GoVendy <${mb.email}>`,
      to: toTrim,
      subject,
      text: text || undefined,
      html: html || undefined,
      replyTo: replyTo || undefined,
    });

    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    const msg = err?.message ?? 'Send failed';
    console.error('[EMAIL] sendTransactionalEmail failed', { to: toTrim, subject, error: msg });
    
    // Combine errors for better visibility
    const finalError = resendError 
      ? `Resend Error: [${resendError}] | Fallback Error: [${msg}]`
      : msg;
      
    return { ok: false, error: finalError };
  }
  */
}
