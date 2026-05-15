import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get('room');
    const isHost = searchParams.get('host') === 'true';

    if (!room) {
        return NextResponse.json({ error: 'room parameter required' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
        return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
    }

    // For host: require auth — for viewer: allow anonymous
    let identity: string;
    let displayName: string | undefined;

    if (isHost) {
        try {
            const auth = await requireAuth(req);
            identity = auth.userId;
        } catch {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    } else {
        // Try to get user identity — fall back to anonymous
        try {
            const auth = await requireAuth(req);
            identity = `viewer-${auth.userId}`;
        } catch {
            // Anonymous viewer
            identity = `anon-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
        }
    }

    const at = new AccessToken(apiKey, apiSecret, { identity });

    at.addGrant({
        roomJoin: true,
        room,
        canPublish: isHost,
        canSubscribe: true,
        canPublishData: false,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token, url: livekitUrl });
}
