import { NextRequest, NextResponse } from 'next/server';
import { sendTransactionalEmail } from '@/lib/email/send';
import { sendEmailWithResend } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Email - GoVendy</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; max-width: 500px; margin: 0 auto; line-height: 1.5; background-color: #f9fafb; }
          .card { background: white; border: 1px solid #e5e7eb; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          h1 { margin-top: 0; color: #111827; font-size: 1.5rem; }
          p { color: #6b7280; margin-bottom: 1.5rem; }
          label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; }
          input { width: 100%; padding: 0.75rem; font-size: 1rem; border: 1px solid #d1d5db; border-radius: 6px; margin-bottom: 1rem; box-sizing: border-box; }
          input:focus { outline: none; border-color: #2563eb; ring: 2px solid #2563eb; }
          button { width: 100%; padding: 0.75rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; font-weight: 600; transition: background 0.2s; }
          button:hover { background: #1d4ed8; }
          button:disabled { opacity: 0.7; cursor: not-allowed; }
          #status { margin-top: 1rem; padding: 1rem; border-radius: 6px; display: none; font-size: 0.9rem; }
          .success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
          .error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>📧 Prueba de Email</h1>
          <p>Verifica que la configuración de notificaciones funciona correctamente.</p>
          
          <div>
            <label for="email">Enviar email de prueba a:</label>
            <input type="email" id="email" placeholder="nombre@ejemplo.com" value="arturoalejandro031187@gmail.com" />
            <button id="sendBtn" onclick="sendEmail()">Enviar Email de Prueba</button>
          </div>

          <div id="status"></div>
        </div>

        <script>
          async function sendEmail() {
            const emailInput = document.getElementById('email');
            const btn = document.getElementById('sendBtn');
            const statusDiv = document.getElementById('status');
            
            const email = emailInput.value.trim();
            if (!email) {
              alert('Por favor ingresa un email');
              return;
            }

            btn.disabled = true;
            btn.textContent = 'Enviando...';
            statusDiv.style.display = 'none';

            try {
              const res = await fetch('/api/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: email })
              });
              
              const data = await res.json();
              
              statusDiv.style.display = 'block';
              if (res.ok) {
                statusDiv.className = 'success';
                statusDiv.innerHTML = '<strong>✅ ¡Email enviado!</strong><br>Revisa tu bandeja de entrada (y spam).';
              } else {
                statusDiv.className = 'error';
                statusDiv.innerHTML = '<strong>❌ Error:</strong> ' + (data.error || 'Error desconocido');
              }
            } catch (err) {
              statusDiv.style.display = 'block';
              statusDiv.className = 'error';
              statusDiv.textContent = '❌ Error de red: ' + err.message;
            } finally {
              btn.disabled = false;
              btn.textContent = 'Enviar Email de Prueba';
            }
          }
        </script>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Endpoint de prueba para verificar que el email funciona
 * POST: { "to": "email@ejemplo.com" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { to?: string };
    const to = body?.to?.trim() || 'arturoalejandro031187@gmail.com';
    const apiKey = process.env.RESEND_API_KEY;

    // Diagnóstico explícito de Resend
    let resendError = null;

    if (apiKey) {
        console.log(`[TEST] Intentando envío directo con Resend (Key length: ${apiKey.length})...`);
        const resendResult = await sendEmailWithResend({
            to,
            subject: 'Prueba de email desde GoVendy (Resend Directo)',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #ec4899;">¡Email vía Resend Exitoso! 🚀</h1>
                  <p>Este correo confirma que la integración con Resend está funcionando correctamente.</p>
                  <p><strong>Dominio verificado:</strong> gopocket.com.mx ✅</p>
                </div>
            `,
            text: 'Prueba de Resend exitosa.',
        });
        
        if (resendResult.ok) {
                    return NextResponse.json({ ok: true, message: '¡Éxito! Enviado vía Resend correctamente.' });
                } else {
                    resendError = resendResult.error;
                    console.error('[TEST] Fallo Resend:', resendError);
                    
                    // Si falla, retornamos el error con detalles de la llave para debug
                    const maskedKey = apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : 'N/A';
                    return NextResponse.json({ 
                        error: `Resend falló: ${resendError}`,
                        debug: {
                            key_length: apiKey.length,
                            key_preview: maskedKey,
                            resend_error: resendError
                        }
                    }, { status: 500 });
                }
            } else {
                resendError = 'RESEND_API_KEY no encontrada en variables de entorno';
                return NextResponse.json({ error: resendError }, { status: 500 });
            }
            
            // Si llegamos aquí, Resend falló o no está configurado.
    // Intentamos el método estándar (que incluye fallback) pero reportamos el error de Resend si existió.
    
    console.log('[TEST] Intentando envío con fallback (sendTransactionalEmail)...');

    const result = await sendTransactionalEmail({
      to,
      subject: 'Prueba de email desde GoVendy (Fallback)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ec4899;">¡Email funcionando! ✅</h1>
          <p>Este es un email de prueba desde <strong>contacto@gopocket.com.mx</strong></p>
          <p>Si recibes este email, la configuración está correcta.</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Enviado desde GoVendy App<br>
            contacto@gopocket.com.mx
          </p>
        </div>
      `,
      text: 'Este es un email de prueba desde contacto@gopocket.com.mx. Si recibes este email, la configuración está correcta.',
    });

    if (!result.ok) {
      return NextResponse.json({ 
        error: result.error || 'Error al enviar email',
        debug: {
            resend_error: resendError,
            final_error: result.error
        }
      }, { status: 500 });
    }

    return NextResponse.json({ 
        ok: true, 
        message: 'Email enviado (posiblemente vía fallback)',
        warning: resendError ? `Resend falló: ${resendError}` : undefined
    });
  } catch (e: unknown) {
    console.error('[TEST EMAIL] Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al procesar' }, { status: 500 });
  }
}
