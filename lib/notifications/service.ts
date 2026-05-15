/**
 * Servicio de notificaciones (patrón Observer).
 * Punto único de entrada: notify(). Persistencia en BD, tiempo real vía Supabase
 * Realtime, y hooks para push/email (solo lógica para dispararlos).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { insertNotificationBestEffort, type NotificationPayload } from './insertBestEffort';
import { buildLinkFromPayload } from './getNotificationLink';

export type NotificationEvent = NotificationPayload & { id?: string };

export type NotificationHooks = {
  /** Lógica para disparar push (FCM, OneSignal, etc.). Se llama después de insertar. */
  onPush?: (event: NotificationEvent) => void | Promise<void>;
  /** Lógica para disparar email (Nodemailer, Resend, etc.). Se llama después de insertar. */
  onEmail?: (event: NotificationEvent) => void | Promise<void>;
};

let hooks: NotificationHooks = {};

/**
 * Registra hooks para push/email. Desacoplado: añadir nuevos canales es solo añadir un handler.
 */
export function setNotificationHooks(h: NotificationHooks) {
  hooks = { ...hooks, ...h };
}

/**
 * Notifica a un usuario. Persiste en BD, luego ejecuta hooks (push/email).
 * Realtime: Supabase postgres_changes en `notifications` se encarga del tiempo real.
 */
export async function notify(
  admin: SupabaseClient,
  payload: NotificationPayload,
): Promise<{ ok: boolean; id?: string; code?: string; message?: string }> {
  const type = (payload.type ?? '').trim() || undefined;
  const data = (payload.data && typeof payload.data === 'object') ? payload.data : {};
  const linkTo = payload.link_to ?? buildLinkFromPayload(type ?? '', data as Record<string, unknown>) ?? null;

  const full: NotificationPayload = {
    ...payload,
    type: type ?? payload.type,
    data: { ...(data as any), kind: (data as any)?.kind ?? type },
    link_to: linkTo || undefined,
  };

  const result = await insertNotificationBestEffort(admin, full);
  if (!result.ok) {
    return { ok: false, code: (result as any).code, message: (result as any).message };
  }

  const event: NotificationEvent = {
    ...full,
    id: undefined, // el insert no devuelve id en insertBestEffort; se podría mejorar
  };

  try {
    if (hooks.onPush) await Promise.resolve(hooks.onPush(event));
  } catch (e) {
    console.error('[notifications] onPush hook error:', e);
  }
  try {
    if (hooks.onEmail) await Promise.resolve(hooks.onEmail(event));
  } catch (e) {
    console.error('[notifications] onEmail hook error:', e);
  }

  return { ok: true };
}
