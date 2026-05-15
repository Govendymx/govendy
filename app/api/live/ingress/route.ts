import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/live/ingress
 * Creates RTMP credentials for OBS streaming via MediaMTX.
 * The stream key is the session_id — MediaMTX accepts any path.
 * HLS output is automatically available at /hls/<stream_key>/index.m3u8
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const { session_id } = await req.json();

        if (!session_id) {
            return NextResponse.json({ error: 'session_id required' }, { status: 400 });
        }

        // Verify the session belongs to this user
        const admin = supabaseAdmin();
        const { data: session, error: sessionError } = await admin
            .from('live_sessions')
            .select('id, host_id, title')
            .eq('id', session_id)
            .eq('host_id', auth.userId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Sesión no encontrada o sin permiso' }, { status: 404 });
        }

        // MediaMTX accepts any RTMP path — we use session_id as the stream key
        const rtmpUrl = 'rtmp://stream.gopocket.com.mx/live';
        const streamKey = session_id;
        const hlsUrl = `https://livekit.gopocket.com.mx/hls/${session_id}.m3u8`;

        // Store stream info in the session
        await admin
            .from('live_sessions')
            .update({
                broadcast_mode: 'obs',
                stream_key: streamKey,
            } as any)
            .eq('id', session_id);

        return NextResponse.json({
            rtmp_url: rtmpUrl,
            stream_key: streamKey,
            hls_url: hlsUrl,
            ingress_id: `mediamtx-${session_id}`, // Compatibility with existing cleanup code
        });
    } catch (err: any) {
        console.error('[Ingress] Error:', err);
        return NextResponse.json({ error: err.message || 'Error al crear ingress' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await requireAuth(req);
        // MediaMTX cleans up automatically when the RTMP stream disconnects
        // No explicit cleanup needed
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[Ingress DELETE] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
