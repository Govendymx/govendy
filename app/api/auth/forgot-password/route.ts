import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyResetPassword } from '@/lib/email/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const origin = req.nextUrl.origin;
    // Redirigir directamente a reset-password para evitar problemas de cadena de redirección
    const redirectTo = `${origin}/reset-password`;

    // Generar link de recuperación
    // generateLink retorna un link que al visitarlo verifica el token y redirige a redirectTo
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error('[ForgotPassword] Error generating link:', error);
      // Si el usuario no existe, Supabase devuelve error.
      // DEBUG MODE: Devolvemos el error real para identificar el problema
      return NextResponse.json({ error: `Error al generar link: ${error.message}` }, { status: 400 });

      /* 
      // Comportamiento original seguro (restaurar después de debug)
      if (error.message.includes('User not found')) {
         return NextResponse.json({ ok: true });
      }
      if (error.status === 429) {
        return NextResponse.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Error al procesar solicitud' }, { status: 500 });
      */
    }

    const resetLink = data.properties?.action_link;
    if (!resetLink) {
      console.error('[ForgotPassword] No link returned from generateLink');
      return NextResponse.json({ error: 'Error interno: No se generó el link' }, { status: 500 });
    }

    // Enviar email con Resend (plantilla propia)
    console.log('[ForgotPassword] Sending reset email via Resend to:', email);
    const emailResult = await notifyResetPassword({
      email,
      resetLink,
    });

    if (!emailResult.ok) {
      console.warn('[ForgotPassword] notifyResetPassword failed, falling back to Supabase default email:', emailResult.error);

      // Fallback: usar el sistema de emails nativo de Supabase si Resend falla
      const { error: fallbackError } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (fallbackError) {
        console.error('[ForgotPassword] Fallback resetPasswordForEmail failed:', fallbackError);
        return NextResponse.json(
          {
            error: `Error al enviar el correo: ${emailResult.error}; fallback: ${fallbackError.message}`,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true, fallback: 'supabase' });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[ForgotPassword] Unexpected error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
