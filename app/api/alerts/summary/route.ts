import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export type AlertItem = {
  id: string;
  label: string;
  count: number;
  link: string;
};

/**
 * Resumen de alertas para el punto rosa del menú.
 * Cuenta: ventas, respuestas a tus preguntas, preguntas como vendedor,
 * calificaciones (comprador/vendedor), puja perdida, subastas por terminar,
 * mensajes de soporte, notificaciones importantes.
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const identifier = getRateLimitIdentifier(req);
    const rateLimit = checkRateLimit(identifier, 120, 60000); // 120 requests por minuto (evitar 429 con polling)
    if (!rateLimit.allowed) {
      const resp = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      resp.headers.set('X-RateLimit-Limit', '120');
      resp.headers.set('X-RateLimit-Remaining', '0');
      resp.headers.set('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));
      return resp;
    }

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = userData.user.id;
    const admin = supabaseAdmin();
    const alerts: AlertItem[] = [];
    const now = new Date();
    const nowIso = now.toISOString();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // 1. Notificaciones no leídas (para ventas, soporte, outbid, calificaciones, otras)
    // IMPORTANTE: Solo contar notificaciones con is_read = false explícitamente
    // Ignorar is_read = NULL o is_read = true
    let unreadRows: any[] = [];
    try {
      // OPTIMIZACIÓN: Reducir límite y usar select específico
      const nRes: any = await admin
        .from('notifications')
        .select('id,type,data,is_read')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(500); // Reducido de 2000 a 500 para mejor rendimiento
      if (!nRes?.error && Array.isArray(nRes?.data)) {
        // Filtrar adicionalmente en memoria para asegurar que solo contamos is_read = false
        // Esto previene problemas con valores NULL o inconsistentes
        unreadRows = nRes.data.filter((r: any) => r?.is_read === false);
      }
    } catch {
      // noop
    }

    const kind = (r: any) => String((r?.data?.kind ?? r?.type) ?? '').trim().toLowerCase();
    const salesKinds = ['new_sale', 'sale_paid'];
    const supportKinds = ['support_message', 'support_reply', 'support_new_message'];
    let salesCount = 0;
    let supportCount = 0;
    let outbidCount = 0;
    let ratedBuyerCount = 0;
    let ratedSellerCount = 0;
    let otherNotifCount = 0;

    for (const r of unreadRows) {
      const k = kind(r);
      if (salesKinds.includes(k)) {
        salesCount++;
        continue;
      }
      if (supportKinds.includes(k)) {
        supportCount++;
        continue;
      }
      if (k === 'outbid') {
        outbidCount++;
        continue;
      }
      if (k === 'rating_received') {
        ratedBuyerCount++;
        continue;
      }
      if (k === 'ratings_complete') {
        ratedSellerCount++;
        continue;
      }
      otherNotifCount++;
    }

    if (salesCount > 0) alerts.push({ id: 'sales', label: 'Tienes ventas para revisar', count: salesCount, link: '/dashboard/ventas' });
    if (supportCount > 0) alerts.push({ id: 'support', label: 'Tienes mensajes de soporte', count: supportCount, link: '/dashboard/soporte' });
    if (outbidCount > 0) alerts.push({ id: 'lost_bid', label: 'Te ganaron una puja', count: outbidCount, link: '/subastas' });
    if (ratedBuyerCount > 0) alerts.push({ id: 'rated_buyer', label: 'Te calificaron como comprador', count: ratedBuyerCount, link: '/dashboard/reputacion' });
    if (ratedSellerCount > 0) alerts.push({ id: 'rated_seller', label: 'Te calificaron como vendedor', count: ratedSellerCount, link: '/dashboard/reputacion' });
    if (otherNotifCount > 0) alerts.push({ id: 'other_notifications', label: 'Tienes notificaciones importantes', count: otherNotifCount, link: '/dashboard/notificaciones' });

    // 2. Respuestas a tus preguntas (asker + answered)
    try {
      const rRes: any = await admin
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('asker_id', userId)
        .eq('is_deleted', false)
        .not('answer_text', 'is', null);
      const respCount = rRes?.error ? 0 : Math.max(0, Number((rRes as any)?.count ?? 0));
      if (respCount > 0) alerts.push({ id: 'responses', label: 'Te respondieron preguntas', count: respCount, link: '/dashboard/respuestas' });
    } catch {
      // noop
    }

    // 3. Preguntas como vendedor (sin responder)
    try {
      const qRes: any = await admin
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('is_deleted', false)
        .is('answer_text', null);
      const qCount = qRes?.error ? 0 : Math.max(0, Number((qRes as any)?.count ?? 0));
      if (qCount > 0) alerts.push({ id: 'questions', label: 'Tienes preguntas sin responder', count: qCount, link: '/dashboard/preguntas' });
    } catch {
      // noop
    }

    // 4. Subastas en favoritos que terminan en <24h
    try {
      // OPTIMIZACIÓN: Reducir límite de favoritos
      const favRes: any = await admin.from('favorites').select('listing_id').eq('user_id', userId).limit(200);
      const favIds = Array.from(new Set((favRes?.data as any[])?.map((f: any) => f?.listing_id).filter(Boolean) ?? []));
      if (favIds.length > 0) {
        const listRes: any = await admin
          .from('listings')
          .select('id')
          .in('id', favIds)
          .eq('sale_type', 'auction')
          .gt('auction_end_at', nowIso)
          .lt('auction_end_at', in24h);
        const auctionCount = Array.isArray(listRes?.data) ? listRes.data.length : 0;
        if (auctionCount > 0) alerts.push({ id: 'auction_ending', label: 'Subastas que sigues por terminar', count: auctionCount, link: '/subastas' });
      }
    } catch {
      // noop
    }

    const totalAlerts = alerts.reduce((s, a) => s + a.count, 0);

    const resp = NextResponse.json({
      ok: true,
      alerts,
      totalAlerts,
    });
    resp.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    resp.headers.set('X-RateLimit-Limit', '120');
    resp.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    resp.headers.set('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));
    return resp;
  } catch (e: unknown) {
    console.error('[ALERTS SUMMARY]', e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
