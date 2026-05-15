import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST: Ejecutar acción de moderación (mute, ban, kick, unmute, unban)
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();
        const { session_id, target_user_id, action } = await req.json();

        if (!target_user_id || !action) {
            return NextResponse.json({ error: 'target_user_id y action requeridos' }, { status: 400 });
        }

        const validActions = ['mute', 'ban', 'kick', 'unmute', 'unban'];
        if (!validActions.includes(action)) {
            return NextResponse.json({ error: `Acción inválida: ${action}` }, { status: 400 });
        }

        // Verificar que el usuario es host del live O es admin de GoVendy
        let isAuthorized = false;

        // Check if admin
        const { data: adminProfile } = await admin
            .from('profiles')
            .select('is_admin')
            .eq('id', auth.effectiveUserId)
            .maybeSingle();

        if (adminProfile?.is_admin) {
            isAuthorized = true;
        }

        // Check if host of the session
        if (!isAuthorized && session_id) {
            const { data: session } = await admin
                .from('live_sessions')
                .select('host_id')
                .eq('id', session_id)
                .single();
            if (session?.host_id === auth.effectiveUserId) {
                isAuthorized = true;
            }
        }

        // Also check platform live sessions (GoVendy TV)
        if (!isAuthorized) {
            const { data: platformSession } = await admin
                .from('platform_live_sessions')
                .select('host_id')
                .eq('status', 'live')
                .maybeSingle();
            if (platformSession?.host_id === auth.effectiveUserId) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'No tienes permisos para moderar' }, { status: 403 });
        }

        // Don't allow moderating yourself
        if (target_user_id === auth.effectiveUserId) {
            return NextResponse.json({ error: 'No puedes moderarte a ti mismo' }, { status: 400 });
        }

        // Execute action
        if (action === 'unmute' || action === 'unban') {
            // Deactivate the ban/mute
            const targetAction = action === 'unmute' ? 'mute' : 'ban';
            await admin
                .from('live_chat_bans')
                .update({ is_active: false })
                .eq('user_id', target_user_id)
                .eq('action', targetAction)
                .eq('is_active', true);

            return NextResponse.json({ ok: true, message: action === 'unmute' ? 'Usuario desilenciado' : 'Usuario desbloqueado' });
        }

        if (action === 'kick') {
            // Kick = ban temporal de 30 minutos
            // First deactivate any existing ban
            await admin
                .from('live_chat_bans')
                .update({ is_active: false })
                .eq('user_id', target_user_id)
                .eq('is_active', true);

            const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            await admin.from('live_chat_bans').insert({
                user_id: target_user_id,
                moderator_id: auth.effectiveUserId,
                session_id: session_id || null,
                action: 'ban',
                reason: 'Expulsado del live',
                is_active: true,
                expires_at: expiresAt,
            });

            return NextResponse.json({ ok: true, message: 'Usuario expulsado (30 min)' });
        }

        if (action === 'mute' || action === 'ban') {
            // First deactivate existing same-type bans
            await admin
                .from('live_chat_bans')
                .update({ is_active: false })
                .eq('user_id', target_user_id)
                .eq('action', action)
                .eq('is_active', true);

            await admin.from('live_chat_bans').insert({
                user_id: target_user_id,
                moderator_id: auth.effectiveUserId,
                session_id: session_id || null,
                action,
                reason: action === 'mute' ? 'Silenciado por moderador' : 'Bloqueado por moderador',
                is_active: true,
                expires_at: null, // permanent until unset
            });

            return NextResponse.json({
                ok: true,
                message: action === 'mute' ? 'Usuario silenciado' : 'Usuario bloqueado',
            });
        }

        return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
    } catch (e: any) {
        console.error('[Chat Moderate] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET: Obtener lista de usuarios baneados/silenciados (para admins)
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();

        // Only admins or hosts can view the ban list
        const { data: profile } = await admin
            .from('profiles')
            .select('is_admin')
            .eq('id', auth.effectiveUserId)
            .maybeSingle();

        if (!profile?.is_admin) {
            return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
        }

        const { data: bans } = await admin
            .from('live_chat_bans')
            .select('id, user_id, action, reason, created_at, expires_at')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        return NextResponse.json({ bans: bans || [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
