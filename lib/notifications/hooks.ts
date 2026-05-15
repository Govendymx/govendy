/**
 * Hooks para push y email. Solo la lógica para dispararlos.
 * Registra handlers con setNotificationHooks; por defecto son no-op.
 * Para producción: implementar FCM/OneSignal (push) y Nodemailer/Resend (email).
 */

import { setNotificationHooks, type NotificationEvent } from './service';

function stubPush(event: NotificationEvent) {
  // TODO: FCM, OneSignal, etc. Ejemplo:
  // await fetch('https://fcm.googleapis.com/...', { body: JSON.stringify({ to: deviceToken, notification: { title: event.title, body: event.body } }) });
  if (process.env.NODE_ENV === 'development') {
    console.log('[notifications] push stub:', event.type, event.user_id, event.title);
  }
}

function stubEmail(event: NotificationEvent) {
  // TODO: Nodemailer, Resend, etc. Ejemplo:
  // await transport.sendMail({ to: userEmail, subject: event.title, text: event.body });
  if (process.env.NODE_ENV === 'development') {
    console.log('[notifications] email stub:', event.type, event.user_id, event.title);
  }
}

/**
 * Registra los hooks por defecto (stubs). Sustituir por implementaciones reales.
 */
export function registerDefaultNotificationHooks() {
  setNotificationHooks({
    onPush: stubPush,
    onEmail: stubEmail,
  });
}
