import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ─── Moderación de contenido ──────────────────────────────────────────────────
function moderateMessage(text: string): { blocked: boolean; reason?: string } {
    const lower = text.toLowerCase().replace(/\s+/g, ' ');

    // Teléfonos: 10+ dígitos, formatos MX/intl, con o sin separadores
    const phonePatterns = [
        /\b\d{10,15}\b/,                          // 10-15 dígitos seguidos
        /\b\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4}\b/, // formato con separadores
        /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/, // internacional
        /\btel[eé]?f?o?n?o?\s*:?\s*\d/i,          // "telefono: ..."
        /\bcel(ular)?\s*:?\s*\d/i,                 // "cel: ..."
        /\bwhats\s*a?p{1,2}\s*:?\s*\d/i,           // "whatsapp: ..."
        /\bl[aá]m[ae]\s*(al|me)\s*\d/i,            // "llama al ..."
        /\bm[aá]rc[ae]\s*(al|me)\s*\d/i,           // "marca al ..."
    ];
    for (const p of phonePatterns) {
        if (p.test(text)) return { blocked: true, reason: 'No se permiten números de teléfono en el chat' };
    }

    // Emails
    if (/[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(text)) {
        return { blocked: true, reason: 'No se permiten direcciones de email en el chat' };
    }

    // URLs y links externos
    const linkPatterns = [
        /https?:\/\//i,
        /www\./i,
        /\b[a-z0-9-]+\.(com|mx|net|org|io|co|info|biz|shop|store|link|me|tv|app|dev|xyz|online|site|website|club)\b/i,
    ];
    for (const p of linkPatterns) {
        // Permitir gopocket.com.mx
        const cleaned = text.replace(/gopocket\.com\.mx/gi, '');
        if (p.test(cleaned)) return { blocked: true, reason: 'No se permiten links externos en el chat' };
    }

    // Redes sociales / contacto
    const socialPatterns = [
        /\b(whats\s*a?p{1,2}|telegram|signal|wsp|wa\.me)\b/i,
        /\b(instagram|facebook|twitter|tiktok|snap\s*chat)\s*:?\s*@?[a-z0-9]/i,
        /\b@[a-z0-9_.]{3,}/i, // @usuario
        /\bagnr[ée]?ga\s*me\b/i, // "agregame"
        /\bescr[ií]be\s*me\s*(por|al)\b/i, // "escribeme por/al"
        /\bcont[aá]cta\s*me\b/i, // "contactame"
    ];
    for (const p of socialPatterns) {
        if (p.test(text)) return { blocked: true, reason: 'No se permiten datos de contacto ni redes sociales en el chat' };
    }

    return { blocked: false };
}

// GET: Obtener mensajes del chat con perfiles (sin FK join para evitar errores de schema cache)
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const sessionId = url.searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({ error: 'session_id requerido' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // 1. Obtener mensajes sin join de FK (evita error de schema cache)
        const { data: messages, error } = await admin
            .from('live_chat_messages')
            .select('id, session_id, user_id, message, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
            .limit(200);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!messages || messages.length === 0) return NextResponse.json({ messages: [] });

        // 2. Obtener perfiles de los usuarios únicos
        const userIds = [...new Set(messages.map(m => m.user_id).filter(Boolean))];
        const { data: profiles } = await admin
            .from('profiles')
            .select('id, full_name, nickname, avatar_url')
            .in('id', userIds);

        // 3. Combinar mensajes con perfiles
        const profileMap: Record<string, any> = {};
        for (const p of profiles || []) profileMap[p.id] = p;

        const messagesWithProfiles = messages.map(m => ({
            ...m,
            profiles: profileMap[m.user_id] ?? null,
        }));

        return NextResponse.json({ messages: messagesWithProfiles });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Enviar mensaje de chat
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();
        const body = await req.json();
        const { session_id, message } = body;

        if (!session_id || !message || typeof message !== 'string') {
            return NextResponse.json({ error: 'session_id y message requeridos' }, { status: 400 });
        }

        if (message.trim().length === 0 || message.length > 500) {
            return NextResponse.json({ error: 'Mensaje debe ser entre 1 y 500 caracteres' }, { status: 400 });
        }

        // ── Moderar contenido ──────────────────────────────────────────────────
        const mod = moderateMessage(message);
        if (mod.blocked) {
            return NextResponse.json({ error: mod.reason || 'Mensaje no permitido' }, { status: 400 });
        }

        // ── Verificar si el usuario está baneado/silenciado ────────────────────
        const { data: ban } = await admin
            .from('live_chat_bans')
            .select('id, action')
            .eq('user_id', auth.effectiveUserId)
            .in('action', ['ban', 'mute'])
            .eq('is_active', true)
            .maybeSingle();

        if (ban) {
            const reason = ban.action === 'ban'
                ? 'Estás bloqueado y no puedes participar en el chat'
                : 'Estás silenciado y no puedes enviar mensajes';
            return NextResponse.json({ error: reason }, { status: 403 });
        }

        // Verificar sesión activa
        const { data: session } = await admin
            .from('live_sessions')
            .select('id, status')
            .eq('id', session_id)
            .single();

        if (!session || session.status !== 'live') {
            return NextResponse.json({ error: 'La sesión no está en vivo' }, { status: 400 });
        }

        // Insertar mensaje
        const { data: msg, error } = await admin
            .from('live_chat_messages')
            .insert({
                session_id,
                user_id: auth.effectiveUserId,
                message: message.trim(),
            })
            .select('id, session_id, user_id, message, created_at')
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Obtener perfil del usuario para devolver mensaje completo
        const { data: profile } = await admin
            .from('profiles')
            .select('id, full_name, nickname, avatar_url')
            .eq('id', auth.effectiveUserId)
            .maybeSingle();

        return NextResponse.json({
            ok: true,
            message: { ...msg, profiles: profile ?? null },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
