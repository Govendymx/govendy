import { supabaseAdmin } from '@/lib/supabase/admin';

export type MailboxConfig = {
  label: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
};

/**
 * Obtiene las cuentas de correo configuradas en Admin → Buzón (app_settings).
 * Usado para envío de notificaciones automáticas desde la primera cuenta verificada.
 * No requiere auth; uso interno en servidor.
 */
export async function getMailboxesForNotifications(): Promise<MailboxConfig[]> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('app_settings')
    .select('admin_mailboxes')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return [];
  const raw = (data as any)?.admin_mailboxes;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m: any) => m && typeof m === 'object' && String(m?.email ?? '').trim())
    .map((m: any) => ({
      label: String(m?.label ?? m?.email ?? '').trim() || String(m?.email ?? ''),
      email: String(m?.email ?? '').trim(),
      smtp_host: String(m?.smtp_host ?? m?.imap_host ?? '').trim(),
      smtp_port: Math.max(1, Math.min(65535, Number(m?.smtp_port) || 587)),
      smtp_secure: m?.smtp_secure === true,
      smtp_user: String(m?.smtp_user ?? m?.imap_user ?? m?.email ?? '').trim(),
      smtp_pass: String(m?.smtp_pass ?? m?.imap_pass ?? '').trim(),
    }))
    .filter((m) => m.smtp_host && m.smtp_user);
}
