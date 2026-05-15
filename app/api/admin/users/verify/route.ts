import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
import { sendEmailWithResend } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

/** Get the user's email from auth.users */
async function getUserEmail(admin: any, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch { return null; }
}

type Body = {
  user_id: string;
  is_verified?: boolean;
  action?: 'approve' | 'reject';
  rejection_reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const userId = String(body?.user_id || '').trim();

    if (!userId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    const action = body?.action;

    // ── Approve ──
    if (action === 'approve') {
      const { data, error } = await admin
        .from('profiles')
        .update({
          is_verified: true,
          verification_status: 'approved',
          verification_rejection_reason: null,
          verification_reviewed_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id, is_verified, verification_status')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // In-app notification (bell)
      const notifResult = await insertNotificationBestEffort(admin, {
        user_id: userId,
        type: 'verification_approved',
        title: '✅ Identidad verificada',
        body: 'Tu verificación de identidad ha sido aprobada. Ya puedes vender en GoVendy.',
      });
      console.log('[VERIFY] Notification result (approve):', notifResult);

      // Email notification
      const email = await getUserEmail(admin, userId);
      if (email) {
        await sendEmailWithResend({
          to: email,
          subject: '✅ Tu identidad ha sido verificada — GoVendy',
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#16a34a">✅ ¡Verificación aprobada!</h2>
              <p>Hola,</p>
              <p>Tu verificación de identidad ha sido <strong>aprobada</strong>. Ya puedes publicar y vender en GoVendy.</p>
              <p style="margin-top:20px">
                <a href="https://gopocket.com.mx/dashboard" 
                   style="background:#e85d04;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                  Ir a mi cuenta
                </a>
              </p>
              <p style="margin-top:30px;color:#666;font-size:12px">— Equipo GoVendy</p>
            </div>`,
          text: 'Tu verificación de identidad ha sido aprobada. Ya puedes vender en GoVendy. Visita: https://gopocket.com.mx/dashboard',
        }).catch((e) => console.error('[VERIFY] Email error (approve):', e));
      }

      return NextResponse.json({ ok: true, is_verified: true, verification_status: 'approved' });
    }

    // ── Reject ──
    if (action === 'reject') {
      const reason = String(body?.rejection_reason || '').trim();
      if (!reason) return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 });

      const { data, error } = await admin
        .from('profiles')
        .update({
          is_verified: false,
          verification_status: 'rejected',
          verification_rejection_reason: reason,
          verification_reviewed_at: new Date().toISOString(),
          ine_front_url: null,
          ine_back_url: null,
          selfie_ine_url: null,
        })
        .eq('id', userId)
        .select('id, is_verified, verification_status')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // In-app notification (bell)
      const notifResult = await insertNotificationBestEffort(admin, {
        user_id: userId,
        type: 'verification_rejected',
        title: '❌ Verificación rechazada',
        body: `Tu verificación fue rechazada. Motivo: ${reason}. Por favor vuelve a subir tus documentos.`,
      });
      console.log('[VERIFY] Notification result (reject):', notifResult);

      // Email notification
      const email = await getUserEmail(admin, userId);
      if (email) {
        await sendEmailWithResend({
          to: email,
          subject: '❌ Tu verificación fue rechazada — GoVendy',
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#dc2626">❌ Verificación rechazada</h2>
              <p>Hola,</p>
              <p>Tu verificación de identidad fue <strong>rechazada</strong> por el siguiente motivo:</p>
              <blockquote style="border-left:4px solid #dc2626;padding:10px 15px;background:#fef2f2;margin:15px 0;border-radius:4px">
                ${reason}
              </blockquote>
              <p>Por favor vuelve a subir tus documentos para intentar nuevamente.</p>
              <p style="margin-top:20px">
                <a href="https://gopocket.com.mx/verificacion" 
                   style="background:#e85d04;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
                  Volver a subir documentos
                </a>
              </p>
              <p style="margin-top:30px;color:#666;font-size:12px">— Equipo GoVendy</p>
            </div>`,
          text: `Tu verificación fue rechazada. Motivo: ${reason}. Sube tus documentos nuevamente en: https://gopocket.com.mx/verificacion`,
        }).catch((e) => console.error('[VERIFY] Email error (reject):', e));
      }

      return NextResponse.json({ ok: true, is_verified: false, verification_status: 'rejected' });
    }

    // ── Legacy: simple toggle ──
    const isVerified = Boolean(body?.is_verified);
    const { data, error } = await admin
      .from('profiles')
      .update({
        is_verified: isVerified,
        verification_status: isVerified ? 'approved' : 'none',
        verification_reviewed_at: isVerified ? new Date().toISOString() : null,
      })
      .eq('id', userId)
      .select('id, is_verified')
      .single();

    if (error) {
      const code = String((error as any)?.code || '');
      const msg = String((error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Falta la columna is_verified o verification_status en profiles. Ejecuta la migración SQL.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, is_verified: data?.is_verified ?? false });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

