import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

/**
 * POST /api/gift-cards/send-email
 * Sends a beautiful gift card email to the recipient
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, code, amount, message, senderName, template } = body;

        if (!to || !code || !amount) {
            return NextResponse.json({ error: 'Faltan campos requeridos (to, code, amount)' }, { status: 400 });
        }

        // Template colors
        const templates: Record<string, { gradient: string; emoji: string; bgColor: string; name: string }> = {
            general: { gradient: 'linear-gradient(135deg, #1f2937, #000)', emoji: '🎁', bgColor: '#1f2937', name: 'Clásica' },
            birthday: { gradient: 'linear-gradient(135deg, #ec4899, #a855f7)', emoji: '🎂', bgColor: '#ec4899', name: 'Cumpleaños' },
            christmas: { gradient: 'linear-gradient(135deg, #b91c1c, #15803d)', emoji: '🎄', bgColor: '#b91c1c', name: 'Navidad' },
            valentine: { gradient: 'linear-gradient(135deg, #fb7185, #ef4444)', emoji: '💕', bgColor: '#fb7185', name: 'San Valentín' },
            graduation: { gradient: 'linear-gradient(135deg, #4f46e5, #06b6d4)', emoji: '🎓', bgColor: '#4f46e5', name: 'Graduación' },
            thanks: { gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', emoji: '🙏', bgColor: '#10b981', name: 'Gracias' },
        };

        const tpl = templates[template] || templates.general;
        const formattedAmount = Number(amount).toLocaleString('es-MX');
        const sender = senderName || 'Alguien especial';

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tarjeta de Regalo GoVendy</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:20px;">
        
        <!-- Header -->
        <div style="text-align:center;padding:20px 0;">
            <img src="https://www.gopocket.com.mx/logo.png" alt="GoVendy" style="height:40px;" onerror="this.style.display='none'">
            <p style="color:#6b7280;font-size:14px;margin:8px 0 0;">Tarjetas de Regalo PocketCash</p>
        </div>

        <!-- Gift Card -->
        <div style="background:${tpl.gradient};border-radius:24px;padding:40px 32px;color:white;text-align:center;position:relative;overflow:hidden;">
            <!-- Pattern -->
            <div style="position:absolute;top:10px;right:20px;font-size:48px;opacity:0.2;">${tpl.emoji}${tpl.emoji}</div>
            <div style="position:absolute;bottom:10px;left:20px;font-size:36px;opacity:0.15;">${tpl.emoji}</div>
            
            <!-- Content -->
            <div style="position:relative;z-index:1;">
                <p style="font-size:14px;opacity:0.7;margin:0 0 4px;">Tarjeta de Regalo</p>
                <p style="font-size:18px;font-weight:700;margin:0 0 16px;">GoVendy PocketCash</p>
                
                <p style="font-size:56px;font-weight:900;margin:0;line-height:1.1;">$${formattedAmount}</p>
                <p style="font-size:18px;opacity:0.8;margin:4px 0 20px;">MXN</p>
                
                ${message ? `
                <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:12px 20px;margin:0 auto 20px;max-width:400px;">
                    <p style="font-style:italic;margin:0;font-size:16px;opacity:0.95;">"${message}"</p>
                </div>
                ` : ''}
                
                <!-- Code Box -->
                <div style="background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);border-radius:16px;padding:16px 24px;margin:0 auto;max-width:350px;">
                    <p style="font-size:12px;opacity:0.7;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px;">Tu código de canje</p>
                    <p style="font-size:28px;font-weight:900;font-family:monospace;margin:0;letter-spacing:2px;">${code}</p>
                </div>
            </div>
        </div>

        <!-- Sender info -->
        <div style="text-align:center;padding:24px 0 16px;">
            <p style="color:#374151;font-size:18px;font-weight:700;margin:0;">
                ${tpl.emoji} ¡${sender} te envió un regalo!
            </p>
        </div>

        <!-- How to redeem -->
        <div style="background:white;border-radius:16px;padding:24px;margin:0 0 16px;border:1px solid #e5e7eb;">
            <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 16px;text-align:center;">¿Cómo canjear tu tarjeta?</p>
            
            <div style="display:flex;align-items:flex-start;gap:12px;margin:0 0 12px;">
                <div style="width:28px;height:28px;border-radius:50%;background:#f97316;color:white;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">1</div>
                <div style="padding-top:4px;">
                    <p style="margin:0;color:#374151;font-size:14px;">Ingresa a <a href="https://www.gopocket.com.mx/dashboard/monedero" style="color:#f97316;font-weight:600;">tu Monedero PocketCash</a></p>
                </div>
            </div>
            
            <div style="display:flex;align-items:flex-start;gap:12px;margin:0 0 12px;">
                <div style="width:28px;height:28px;border-radius:50%;background:#f97316;color:white;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">2</div>
                <div style="padding-top:4px;">
                    <p style="margin:0;color:#374151;font-size:14px;">Busca la sección "Canjear Tarjeta de Regalo"</p>
                </div>
            </div>
            
            <div style="display:flex;align-items:flex-start;gap:12px;margin:0 0 12px;">
                <div style="width:28px;height:28px;border-radius:50%;background:#f97316;color:white;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">3</div>
                <div style="padding-top:4px;">
                    <p style="margin:0;color:#374151;font-size:14px;">Ingresa el código <strong style="font-family:monospace;background:#fff7ed;padding:2px 6px;border-radius:4px;color:#c2410c;">${code}</strong></p>
                </div>
            </div>
            
            <div style="display:flex;align-items:flex-start;gap:12px;">
                <div style="width:28px;height:28px;border-radius:50%;background:#10b981;color:white;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">✓</div>
                <div style="padding-top:4px;">
                    <p style="margin:0;color:#374151;font-size:14px;font-weight:600;">¡Listo! El saldo se acredita al instante 🎉</p>
                </div>
            </div>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center;padding:8px 0 24px;">
            <a href="https://www.gopocket.com.mx/dashboard/monedero?redeem=${code}" 
               style="display:inline-block;background:linear-gradient(135deg,#f97316,#ef4444);color:white;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;">
                💳 Canjear mi Tarjeta
            </a>
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding:16px 0;border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">
                Esta tarjeta no tiene fecha de expiración.
            </p>
            <p style="color:#9ca3af;font-size:12px;margin:0;">
                <a href="https://www.gopocket.com.mx" style="color:#f97316;">www.gopocket.com.mx</a> — Tu marketplace favorito
            </p>
        </div>
    </div>
</body>
</html>`;

        const textVersion = `🎁 ¡${sender} te envió una Tarjeta de Regalo PocketCash por $${formattedAmount} MXN!

${message ? `"${message}"\n` : ''}
Tu código de canje: ${code}

Para canjearlo:
1. Ingresa a https://www.gopocket.com.mx/dashboard/monedero
2. Busca "Canjear Tarjeta de Regalo"
3. Ingresa el código: ${code}
4. ¡Listo! El saldo se acredita al instante.

— GoVendy`;

        const result = await sendEmailWithResend({
            to,
            subject: `🎁 ¡Tienes una Tarjeta de Regalo PocketCash por $${formattedAmount} MXN!`,
            html,
            text: textVersion,
            from: 'regalos@gopocket.com.mx',
            fromName: 'GoVendy Regalos',
        });

        if (!result.ok) {
            console.error('[GIFT-CARD-EMAIL] Failed:', result.error);
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: `Email enviado a ${to}` });
    } catch (err: any) {
        console.error('[GIFT-CARD-EMAIL] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
