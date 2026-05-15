import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Registrar estadísticas de publicidad (views, clicks)
 * No requiere autenticación - es para tracking
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      campaign_id: string;
      event_type: 'view' | 'click';
      user_id?: string;
    };

    const { campaign_id, event_type, user_id } = body;

    if (!campaign_id || !event_type || !['view', 'click'].includes(event_type)) {
      return NextResponse.json({ error: 'campaign_id y event_type (view|click) son requeridos' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Obtener IP y user agent
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const referrer = req.headers.get('referer') || null;

    // Registrar estadística
    const { error } = await admin.from('ad_stats').insert({
      campaign_id,
      event_type,
      user_id: user_id || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer: referrer,
    });

    if (error) {
      console.error('[ADS TRACK] Error:', error);
      // No fallar silenciosamente para no interrumpir la experiencia
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[ADS TRACK] Error:', e);
    return NextResponse.json({ ok: true }); // Retornar ok para no interrumpir
  }
}
