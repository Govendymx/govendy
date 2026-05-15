import { NextRequest, NextResponse } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/live/egress/stop
 * 
 * Stops an active HLS egress for a LiveKit room.
 * Called when:
 * 1. The host ends the stream
 * 2. Session goes offline
 * 3. Manual cleanup
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { session_id } = body;

        if (!session_id) {
            return NextResponse.json({ error: 'session_id required' }, { status: 400 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitHost = process.env.LIVEKIT_URL?.replace('wss://', 'https://');

        if (!apiKey || !apiSecret || !livekitHost) {
            return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
        }

        const admin = supabaseAdmin();

        // Get egress ID from session
        const { data: session } = await admin
            .from('live_sessions')
            .select('egress_id, egress_hls_url')
            .eq('id', session_id)
            .maybeSingle();

        if (!session?.egress_id) {
            // No egress running — clear fields anyway
            await admin
                .from('live_sessions')
                .update({ egress_id: null, egress_hls_url: null })
                .eq('id', session_id);
            return NextResponse.json({ ok: true, message: 'No egress was active' });
        }

        // Stop the egress
        const egressClient = new EgressClient(livekitHost, apiKey, apiSecret);

        try {
            await egressClient.stopEgress(session.egress_id);
            console.log(`[Egress] Stopped egress ${session.egress_id} for session ${session_id}`);
        } catch (stopErr: any) {
            // Egress may have already stopped (e.g., room closed)
            console.warn(`[Egress] Stop warning for ${session.egress_id}:`, stopErr.message);
        }

        // Clear egress fields from session
        await admin
            .from('live_sessions')
            .update({ egress_id: null, egress_hls_url: null })
            .eq('id', session_id);

        return NextResponse.json({ ok: true, stopped: session.egress_id });
    } catch (e: any) {
        console.error('[Egress] Stop error:', e);
        return NextResponse.json({ error: e.message || 'Failed to stop egress' }, { status: 500 });
    }
}
