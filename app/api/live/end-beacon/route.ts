import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlan } from '@/lib/plans/limits';
import { deductLiveMinutes } from '@/lib/live/hours';

export const dynamic = 'force-dynamic';

/**
 * POST /api/live/end-beacon
 * Fire-and-forget endpoint for navigator.sendBeacon() when host closes tab.
 * Uses supabaseAdmin directly (no auth) since sendBeacon can't send headers.
 * The session_id is trusted because it was already validated when the session was created.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { session_id, broadcast_secs } = body;

        if (!session_id) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // Fetch session details before ending (needed for hour deduction)
        const { data: session } = await admin
            .from('live_sessions')
            .select('id, host_id, started_at, status')
            .eq('id', session_id)
            .eq('status', 'live')
            .single();

        if (!session) {
            return NextResponse.json({ ok: true }); // Already ended
        }

        const endedAt = new Date().toISOString();

        // End the session
        const { error } = await admin
            .from('live_sessions')
            .update({ status: 'ended', ended_at: endedAt })
            .eq('id', session_id)
            .eq('status', 'live');

        if (error) {
            console.error('[end-beacon] Error:', error);
        }

        // Deduct hours used — prefer broadcast_secs (actual broadcast time)
        if (session.started_at && session.host_id) {
            try {
                let minutesUsed: number;
                if (typeof broadcast_secs === 'number' && broadcast_secs > 0) {
                    minutesUsed = Math.ceil(broadcast_secs / 60);
                } else {
                    const startMs = new Date(session.started_at).getTime();
                    const endMs = new Date(endedAt).getTime();
                    minutesUsed = Math.ceil((endMs - startMs) / 60000);
                }
                const plan = await getPlan(admin, session.host_id);
                console.log(`[end-beacon] Deducting ${minutesUsed} mins for host ${session.host_id} (plan: ${plan}, broadcast_secs: ${broadcast_secs ?? 'N/A'})`);
                await deductLiveMinutes(session.host_id, plan, minutesUsed);
                console.log(`[end-beacon] ✅ Deduction successful`);
            } catch (e) {
                console.error('[end-beacon] ❌ Error deducting hours:', e);
            }
        }

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
