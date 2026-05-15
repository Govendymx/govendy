import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/mail/inbound
 * Resend Webhooks → email.received event
 *
 * Configurar en Resend → Webhooks → Add Webhook:
 *   URL: https://gopocket.com.mx/api/admin/mail/inbound
 *   Events: email.received
 */
export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'RESEND_API_KEY no configurado' }, { status: 500 });
        }

        const event = await req.json().catch(() => null);
        if (!event) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

        // Solo procesar eventos de tipo email.received
        if (event.type !== 'email.received') {
            return NextResponse.json({ ok: true, skipped: true });
        }

        const emailId: string = event?.data?.email_id || '';
        if (!emailId) {
            return NextResponse.json({ error: 'email_id faltante' }, { status: 400 });
        }

        // Obtener el cuerpo completo via REST API de Resend
        const resendRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        let htmlBody = '';
        let textBody = '';
        if (resendRes.ok) {
            const full = await resendRes.json() as Record<string, unknown>;
            htmlBody = String(full?.html || '');
            textBody = String(full?.text || '');
        }

        // Datos del evento
        const fromRaw: string = String(event?.data?.from || '');
        const toRaw: unknown = event?.data?.to;
        const to: string = Array.isArray(toRaw) ? (toRaw as string[]).join(', ') : String(toRaw || '');
        const subject: string = String(event?.data?.subject || '(sin asunto)');

        // Parsear nombre y email del remitente
        const fromNameMatch = fromRaw.match(/^(.+?)\s*<.+>$/);
        const fromName: string = fromNameMatch ? fromNameMatch[1].trim() : '';
        const fromEmail: string = fromRaw.replace(/^.+<(.+)>$/, '$1').trim() || fromRaw;

        const admin = supabaseAdmin();
        const { error } = await admin.from('admin_inbox').insert({
            resend_id: emailId,
            to_email: to,
            from_email: fromEmail,
            from_name: fromName,
            subject,
            text_body: textBody,
            html_body: htmlBody,
            received_at: String(event?.created_at || new Date().toISOString()),
            seen: false,
        });

        if (error) {
            if (error.code === '23505') return NextResponse.json({ ok: true, skipped: true });
            console.error('[inbound] DB error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[inbound] Guardado: "${subject}" de ${fromEmail}`);
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        console.error('[inbound]', e);
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
    }
}
