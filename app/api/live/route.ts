import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlan, PLAN_LIMITS } from '@/lib/plans/limits';
import { getLiveHoursStatus, deductLiveMinutes } from '@/lib/live/hours';

// Vercel Edge Cache will handle revalidation; force-dynamic is NOT needed with s-maxage

// GET: List all live sessions with pagination
export async function GET(req: NextRequest) {
    try {
        const admin = supabaseAdmin();
        const url = new URL(req.url);
        const status = url.searchParams.get('status') || 'live';
        const hostId = url.searchParams.get('host_id');
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const perPage = Math.min(50, parseInt(url.searchParams.get('per_page') || '10', 10));
        const from = (page - 1) * perPage;

        let query = admin
            .from('live_sessions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, from + perPage - 1);

        if (status !== 'all') {
            query = query.eq('status', status);
        }
        if (hostId) {
            query = query.eq('host_id', hostId);
        }

        // Platform live filter: exclude platform sessions from normal list,
        // or fetch only platform session when explicitly requested
        const isPlatform = url.searchParams.get('is_platform');
        if (isPlatform === 'true') {
            query = query.eq('is_platform', true);
        } else {
            // Normal queries: exclude platform sessions
            query = query.or('is_platform.is.null,is_platform.eq.false');
        }

        const { data, error, count } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const sessions = data || [];

        // Fetch host profiles separately
        if (sessions.length > 0) {
            const hostIds = [...new Set(sessions.map((s: any) => s.host_id))];
            const { data: profiles } = await admin
                .from('profiles')
                .select('id, full_name, nickname, avatar_url, store_logo_url')
                .in('id', hostIds);
            const profileMap: Record<string, any> = {};
            (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
            sessions.forEach((s: any) => { s.profiles = profileMap[s.host_id] || null; });
        }

        // Resolve live thumbnails (avoid browser CORS)
        await Promise.all(sessions.map(async (s: any) => {
            if (s.status !== 'live' || s.thumbnail_url) return;
            try {
                const thumbUrl = `https://livekit.gopocket.com.mx/thumbs/${s.id}.jpg`;
                const r = await fetch(thumbUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
                if (r.ok) s.thumbnail_url = thumbUrl;
            } catch { }
        }));

        const res = NextResponse.json({
            sessions,
            total: count ?? 0,
            page,
            per_page: perPage,
            total_pages: Math.ceil((count ?? 0) / perPage),
        });
        res.headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=45');
        return res;
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}


// POST: Create a new live session — requiere plan Pro/Platinum con horas disponibles
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();

        const plan = await getPlan(admin, auth.effectiveUserId);

        // Basic: siempre bloqueado
        if (plan === 'basic') {
            return NextResponse.json(
                { error: 'GoVendy Live requiere Plan Pro o Platinum. Actualiza tu plan para transmitir en vivo.' },
                { status: 403 }
            );
        }

        // Verificar saldo de horas
        const hoursStatus = await getLiveHoursStatus(auth.effectiveUserId, plan);
        if (!hoursStatus.can_go_live) {
            if (plan === 'platinum') {
                return NextResponse.json(
                    { error: 'Horas gratuitas agotadas por hoy. Espera al día siguiente o compra horas extra en la Tienda de Lives.', hours_status: hoursStatus },
                    { status: 403 }
                );
            } else {
                return NextResponse.json(
                    { error: 'No tienes horas de live disponibles. Compra un paquete en la Tienda de Lives.', hours_status: hoursStatus },
                    { status: 403 }
                );
            }
        }

        const body = await req.json();
        const { title, description, product_ids } = body;

        if (!title || typeof title !== 'string' || title.trim().length < 3) {
            return NextResponse.json({ error: 'El título debe tener al menos 3 caracteres' }, { status: 400 });
        }

        // Check no active session
        const { data: active } = await admin
            .from('live_sessions')
            .select('id')
            .eq('host_id', auth.effectiveUserId)
            .in('status', ['live', 'scheduled'])
            .limit(1);

        if (active && active.length > 0) {
            return NextResponse.json({ error: 'Ya tienes una sesión activa o programada' }, { status: 409 });
        }

        const { data: session, error } = await admin
            .from('live_sessions')
            .insert({
                host_id: auth.effectiveUserId,
                title: title.trim(),
                description: description || null,
                product_ids: product_ids || [],
                status: 'live',
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // ─── Phase 2: Notify followers about Live ───
        try {
            const { data: followers } = await admin
                .from('follows')
                .select('follower_id')
                .eq('seller_id', auth.effectiveUserId);

            if (followers && followers.length > 0) {
                // Get seller name
                const { data: profile } = await admin
                    .from('profiles')
                    .select('full_name, nickname')
                    .eq('id', auth.effectiveUserId)
                    .single();
                const sellerName = profile?.full_name || profile?.nickname || 'Un vendedor';

                const { insertNotificationBestEffort } = await import('@/lib/notifications/insertBestEffort');
                // Send notifications in parallel (best-effort, don't block response)
                const notifPromises = followers.map((f: any) =>
                    insertNotificationBestEffort(admin, {
                        user_id: f.follower_id,
                        type: 'admin_announcement',
                        title: '🔴 ¡En vivo ahora!',
                        body: `${sellerName} está transmitiendo en vivo: "${title.trim()}"`,
                        link_to: `/live/${session.id}`,
                        data: { kind: 'live_started', seller_id: auth.effectiveUserId, session_id: session.id },
                    }).catch(() => { })
                );
                Promise.allSettled(notifPromises); // fire-and-forget
            }
        } catch (notifErr) {
            console.error('[LIVE] Error notifying followers:', notifErr);
        }

        return NextResponse.json({ ok: true, session });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH: Update session (end it) — allows host OR admin
export async function PATCH(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();
        const body = await req.json();
        const { session_id, action, broadcast_secs } = body;

        if (!session_id) {
            return NextResponse.json({ error: 'session_id requerido' }, { status: 400 });
        }

        const { data: session } = await admin
            .from('live_sessions')
            .select('id, host_id, started_at, status')
            .eq('id', session_id)
            .single();

        if (!session) {
            return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
        }

        // Allow if host OR admin
        const isHost = session.host_id === auth.effectiveUserId;
        let isAdmin = false;
        if (!isHost) {
            const { data: adminRow } = await admin
                .from('admin_users')
                .select('user_id')
                .eq('user_id', auth.userId)
                .maybeSingle();
            isAdmin = !!adminRow;
        }

        if (!isHost && !isAdmin) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        if (action === 'end') {
            const endedAt = new Date().toISOString();
            const { error } = await admin
                .from('live_sessions')
                .update({ status: 'ended', ended_at: endedAt })
                .eq('id', session_id);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            // Calcular duración y deducir horas del balance del host
            // Skip deduction for platform sessions (no real host)
            const isPlatformSession = (session as any).is_platform === true;
            if (session.started_at && !isPlatformSession) {
                try {
                    let minutesUsed: number;
                    if (typeof broadcast_secs === 'number' && broadcast_secs > 0) {
                        // Use actual broadcast time (fairer — doesn't count setup time)
                        minutesUsed = Math.ceil(broadcast_secs / 60);
                    } else {
                        // Fallback: full session duration
                        const startMs = new Date(session.started_at).getTime();
                        const endMs = new Date(endedAt).getTime();
                        minutesUsed = Math.ceil((endMs - startMs) / 60000);
                    }
                    const plan = await getPlan(admin, session.host_id);
                    console.log(`[LIVE] Deducting ${minutesUsed} mins for host ${session.host_id} (plan: ${plan}, broadcast_secs: ${broadcast_secs ?? 'N/A'})`);
                    await deductLiveMinutes(session.host_id, plan, minutesUsed);
                    console.log(`[LIVE] ✅ Deduction successful`);
                } catch (e) {
                    console.error('[LIVE] ❌ Error deducting hours:', e);
                }
            }

            return NextResponse.json({ ok: true, status: 'ended' });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
