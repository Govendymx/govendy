import { sendTransactionalEmail } from '@/lib/email/send';
import { getEmailTemplate } from '@/lib/email/templates';

export async function sendNotificationEmail(opts: {
  to: string;
  toName: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  linkTo?: string;
  template?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const templateType = opts.template || opts.type;
    const template = getEmailTemplate(templateType);

    const subject = template?.subject || opts.title || 'Notificación - GoVendy';
    const html = template?.html({ ...opts.data, linkTo: opts.linkTo }) || `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>${opts.title}</h2>
          <p>${opts.body}</p>
          ${opts.linkTo ? `<a href="${opts.linkTo}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Ver más</a>` : ''}
        </div>
      </body>
      </html>
    `;
    const text = template?.text({ ...opts.data, linkTo: opts.linkTo }) || opts.body;

    return await sendTransactionalEmail({
      to: opts.to,
      subject,
      html,
      text,
      from: 'contacto@gopocket.com.mx',
      fromName: 'GoVendy',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error('[NOTIFICATION EMAIL] Error:', error);
    return { ok: false, error };
  }
}
