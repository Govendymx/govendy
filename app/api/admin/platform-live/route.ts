import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

async function checkAdmin(req: NextRequest) {
    const auth = await requireAuth(req);
    const admin = supabaseAdmin();
    const { data } = await admin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', auth.userId)
        .maybeSingle();
    if (!data) throw new Error('No autorizado');
    return { auth, admin };
}

// GET: Get platform live status + videos
export async function GET(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Get platform session (prefer 'live', fall back to any recent)
        let { data: session } = await admin
            .from('live_sessions')
            .select('*')
            .eq('is_platform', true)
            .eq('status', 'live')
            .maybeSingle();

        // Get platform videos
        const { data: videos } = await admin
            .from('platform_videos')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        // If no live session but we have videos, find or create a persistent session for chat
        if (!session && videos && videos.length > 0) {
            // Try to find most recent ended platform session (reuse it)
            const { data: recentSession } = await admin
                .from('live_sessions')
                .select('*')
                .eq('is_platform', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentSession) {
                // Reactivate it
                if (recentSession.status !== 'live') {
                    await admin
                        .from('live_sessions')
                        .update({ status: 'live', started_at: new Date().toISOString(), ended_at: null })
                        .eq('id', recentSession.id);
                }
                session = { ...recentSession, status: 'live' };
            } else {
                // Create a new persistent platform session
                const { data: newSession } = await admin
                    .from('live_sessions')
                    .insert({
                        host_id: '00000000-0000-0000-0000-000000000000', // System user
                        title: 'GoVendy TV',
                        description: 'Canal oficial de GoVendy',
                        status: 'live',
                        is_platform: true,
                        broadcast_mode: 'obs',
                        started_at: new Date().toISOString(),
                    } as any)
                    .select()
                    .single();
                session = newSession;
            }
        }

        // Check if OBS is actually streaming (try HLS)
        let obsOnline = false;
        if (session) {
            try {
                const hlsUrl = `https://livekit.gopocket.com.mx/hls/${session.id}.m3u8`;
                const r = await fetch(hlsUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
                obsOnline = r.ok;
            } catch { }
        }

        return NextResponse.json({
            session,
            videos: videos || [],
            obs_online: obsOnline,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Create/activate platform live session
export async function POST(req: NextRequest) {
    try {
        const { auth, admin } = await checkAdmin(req);
        const body = await req.json();
        const { title, description } = body;

        // Check if there's already an active platform session
        const { data: existing } = await admin
            .from('live_sessions')
            .select('id')
            .eq('is_platform', true)
            .eq('status', 'live')
            .maybeSingle();

        if (existing) {
            // Return existing session info
            const rtmpUrl = 'rtmp://stream.gopocket.com.mx/live';
            const hlsUrl = `https://livekit.gopocket.com.mx/hls/${existing.id}.m3u8`;
            return NextResponse.json({
                ok: true,
                session: existing,
                rtmp_url: rtmpUrl,
                stream_key: existing.id,
                hls_url: hlsUrl,
                message: 'Sesión ya activa',
            });
        }

        // Create new platform session
        const { data: session, error } = await admin
            .from('live_sessions')
            .insert({
                host_id: auth.userId,
                title: (title || 'GoVendy TV — Ofertas y Anuncios').trim(),
                description: description || 'Canal oficial de GoVendy. Ofertas exclusivas, anuncios y más.',
                product_ids: [],
                status: 'live',
                is_platform: true,
                broadcast_mode: 'obs',
                started_at: new Date().toISOString(),
            } as any)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Store stream key
        await admin
            .from('live_sessions')
            .update({ stream_key: session.id } as any)
            .eq('id', session.id);

        const rtmpUrl = 'rtmp://stream.gopocket.com.mx/live';
        const hlsUrl = `https://livekit.gopocket.com.mx/hls/${session.id}.m3u8`;

        return NextResponse.json({
            ok: true,
            session,
            rtmp_url: rtmpUrl,
            stream_key: session.id,
            hls_url: hlsUrl,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.message === 'No autorizado' ? 403 : 500 });
    }
}

// PATCH: Update title/description of platform live
export async function PATCH(req: NextRequest) {
    try {
        const { admin } = await checkAdmin(req);
        const body = await req.json();
        const { title, description } = body;

        const update: any = {};
        if (title) update.title = title.trim();
        if (description !== undefined) update.description = description;

        const { data, error } = await admin
            .from('live_sessions')
            .update(update)
            .eq('is_platform', true)
            .eq('status', 'live')
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true, session: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.message === 'No autorizado' ? 403 : 500 });
    }
}

// DELETE: End platform live session
export async function DELETE(req: NextRequest) {
    try {
        const { admin } = await checkAdmin(req);

        const { error } = await admin
            .from('live_sessions')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('is_platform', true)
            .eq('status', 'live');

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.message === 'No autorizado' ? 403 : 500 });
    }
}
