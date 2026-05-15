import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ─── GET: obtener anuncios activos para un live ──────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('session_id');
        const type = searchParams.get('type'); // overlay | video | product_spotlight

        const admin = supabaseAdmin();

        // Verificar si la sesión es gratuita o pagada
        // Si no hay session_id (ej. GoVendy TV en modo YouTube), se asume sesión con ads
        if (sessionId) {
            const { data: session } = await admin
                .from('live_sessions')
                .select('is_free_session')
                .eq('id', sessionId)
                .single();

            // Si es sesión pagada (horas extra), no mostrar anuncios
            if (session && session.is_free_session === false) {
                return NextResponse.json({ ads: [], ad_free: true });
            }
        }

        // Obtener anuncios activos
        let query = admin
            .from('live_ad_campaigns')
            .select('id, type, title, subtitle, content_url, target_url, cta_text, duration_secs, frequency_mins, advertiser_name, priority')
            .eq('is_active', true)
            .order('priority', { ascending: false });

        // Filtrar por tipo si se especifica
        if (type) {
            query = query.eq('type', type);
        }

        // Filtrar por fecha (solo campañas vigentes)
        const now = new Date().toISOString();
        query = query.or(`start_date.is.null,start_date.lte.${now}`);
        query = query.or(`end_date.is.null,end_date.gte.${now}`);

        const { data: ads, error } = await query;

        if (error) throw error;

        return NextResponse.json({ ads: ads || [], ad_free: false });
    } catch (e: any) {
        console.error('[Live Ads] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// ─── POST: registrar impresión ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const { campaign_id, session_id, viewer_id, type } = await req.json();

        if (!campaign_id || !type) {
            return NextResponse.json({ error: 'campaign_id y type requeridos' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // Registrar impresión/click
        await admin.from('live_ad_impressions').insert({
            campaign_id,
            session_id: session_id || null,
            viewer_id: viewer_id || null,
            type,
        });

        // Incrementar contador en la campaña (select + increment)
        const { data: campaign } = await admin
            .from('live_ad_campaigns')
            .select('impressions, clicks')
            .eq('id', campaign_id)
            .single();

        if (campaign) {
            const updates: Record<string, number> = {};
            if (type === 'impression') updates.impressions = (campaign.impressions || 0) + 1;
            if (type === 'click') updates.clicks = (campaign.clicks || 0) + 1;

            if (Object.keys(updates).length > 0) {
                await admin.from('live_ad_campaigns').update(updates).eq('id', campaign_id);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('[Live Ads] Track error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

