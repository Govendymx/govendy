import type { SupabaseClient } from '@supabase/supabase-js';
import { insertNotificationBestEffort } from './insertBestEffort';
import { sendNotificationEmail } from './email';

export type NotificationChannel = 'panel' | 'email' | 'both';

export type UnifiedNotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  linkTo?: string;
  channels?: NotificationChannel[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  emailTemplate?: string;
  emailSubject?: string;
};

/**
 * Envía notificación tanto al panel como por email
 * Garantiza que al menos una llegue, incluso si la otra falla
 */
export async function sendUnifiedNotification(
  admin: SupabaseClient,
  payload: UnifiedNotificationPayload,
): Promise<{
  panel: { ok: boolean; error?: string };
  email: { ok: boolean; error?: string };
}> {
  const channels = payload.channels || ['both'];
  const results = {
    panel: { ok: false, error: undefined as string | undefined },
    email: { ok: false, error: undefined as string | undefined },
  };

  // 1. Notificación al panel (siempre intentar)
  if (channels.includes('panel') || channels.includes('both')) {
    try {
      const panelResult = await insertNotificationBestEffort(admin, {
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        link_to: payload.linkTo,
        is_read: false,
      });
      results.panel = {
        ok: panelResult.ok,
        error: panelResult.ok ? undefined : ((panelResult as any).message || 'Unknown error'),
      };
    } catch (e) {
      results.panel.error = e instanceof Error ? e.message : 'Unknown error';
      console.error('[UNIFIED NOTIFY] Error en notificación panel:', e);
    }
  } else {
    results.panel = { ok: true, error: undefined }; // No requerido
  }

  // 2. Notificación por email (best-effort)
  if (channels.includes('email') || channels.includes('both')) {
    try {
      // Obtener email del usuario
    let email: string | undefined;
    let name: string | undefined;

    try {
      // 1. Intentar desde profiles
      const { data: profile } = await admin
        .from('profiles')
        .select('email, full_name, name')
        .eq('id', payload.userId)
        .maybeSingle();

      if (profile?.email) {
        email = profile.email;
        name = profile.full_name || (profile as any).name || 'Usuario';
      } else {
        // 2. Fallback: Auth Admin API
        const { data: userData } = await admin.auth.admin.getUserById(payload.userId);
        if (userData?.user?.email) {
          email = userData.user.email;
          name = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || 'Usuario';
        }
      }
    } catch (err) {
      console.warn('[UNIFIED NOTIFY] Error fetching user email:', err);
    }

    if (!email) {
      results.email.error = 'No email found for user (profiles & auth)';
    } else {
      const emailResult = await sendNotificationEmail({
        to: email,
        toName: name || 'Usuario',
        type: payload.type,
        title: payload.title || payload.emailSubject || 'Notificación',
        body: payload.body,
        data: payload.data,
        linkTo: payload.linkTo,
        template: payload.emailTemplate,
      });
        results.email = {
          ok: emailResult.ok,
          error: emailResult.ok ? undefined : (emailResult.error ?? 'Unknown error'),
        };
      }
    } catch (e) {
      results.email.error = e instanceof Error ? e.message : 'Unknown error';
      console.error('[UNIFIED NOTIFY] Error en notificación email:', e);
    }
  } else {
    results.email = { ok: true, error: undefined }; // No requerido
  }

  // 3. Log del resultado
  if (!results.panel.ok || !results.email.ok) {
    console.warn('[UNIFIED NOTIFY] Algunas notificaciones fallaron:', {
      userId: payload.userId,
      type: payload.type,
      results,
    });
  }

  return results;
}
