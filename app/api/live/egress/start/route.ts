import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient, EgressClient, EncodedFileOutput, SegmentedFileOutput } from 'livekit-server-sdk';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

/**
 * POST /api/live/egress/start
 * 
 * Starts an HLS egress for a LiveKit room, converting WebRTC → HLS segments
 * served via Caddy → Cloudflare CDN for unlimited viewers.
 * 
 * Can be triggered:
 * 1. Automatically when viewer count exceeds threshold (from viewers/route.ts)
 * 2. Manually by the host
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { session_id, room_name, auto } = body;

        if (!session_id || !room_name) {
            return NextResponse.json({ error: 'session_id and room_name required' }, { status: 400 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitHost = process.env.LIVEKIT_URL?.replace('wss://', 'https://');

        if (!apiKey || !apiSecret || !livekitHost) {
            return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
        }

        const admin = supabaseAdmin();

        // Check if egress already active for this session
        const { data: session } = await admin
            .from('live_sessions')
            .select('egress_id, egress_hls_url, status')
            .eq('id', session_id)
            .maybeSingle();

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (session.egress_id) {
            // Egress already running — return existing HLS URL
            return NextResponse.json({
                ok: true,
                already_active: true,
                egress_id: session.egress_id,
                hls_url: session.egress_hls_url,
            });
        }

        if (session.status !== 'live') {
            return NextResponse.json({ error: 'Session is not live' }, { status: 400 });
        }

        // Start Room Composite Egress → HLS segments
        const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);

        // HLS output directory on the server: /tmp/egress/{room_name}/
        // Caddy serves this at https://livekit.gopocket.com.mx/hls/{room_name}/
        const hlsOutputPath = `/tmp/egress/${room_name}`;

        const egressInfo = await egressClient.startRoomCompositeEgress(
            room_name,
            {
                segments: new SegmentedFileOutput({
                    filenamePrefix: `${hlsOutputPath}/segment`,
                    playlistName: 'index.m3u8',
                    livePlaylistName: 'live.m3u8',
                    segmentDuration: 2, // 2 seconds per segment (low latency)
                    filenameSuffix: 0, // SegmentedFileSuffix.INDEX
                }),
            },
            {
                layout: 'speaker',
                audioOnly: false,
                videoOnly: false,
            }
        );

        const egressId = egressInfo.egressId;
        const hlsUrl = `https://livekit.gopocket.com.mx/hls/${room_name}/live.m3u8`;

        // Save egress info to session
        await admin
            .from('live_sessions')
            .update({
                egress_id: egressId,
                egress_hls_url: hlsUrl,
            })
            .eq('id', session_id);

        console.log(`[Egress] Started for room ${room_name}, egress_id: ${egressId}, hls_url: ${hlsUrl}`);

        return NextResponse.json({
            ok: true,
            egress_id: egressId,
            hls_url: hlsUrl,
        });
    } catch (e: any) {
        console.error('[Egress] Start error:', e);
        return NextResponse.json({ error: e.message || 'Failed to start egress' }, { status: 500 });
    }
}
