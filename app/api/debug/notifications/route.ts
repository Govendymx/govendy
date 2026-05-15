import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Endpoint de depuración para diagnosticar el problema del contador
 * Muestra TODAS las notificaciones del usuario con su estado exacto
 */
export async function GET(req: NextRequest) {
  try {
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

    // Obtener TODAS las notificaciones del usuario
    const allNotifs: any = await admin
      .from('notifications')
      .select('id,type,data,is_read,created_at,body,user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    const allNotifsList = Array.isArray(allNotifs?.data) ? allNotifs.data : [];

    // Agrupar por estado
    const byState = {
      false: allNotifsList.filter((n: any) => n?.is_read === false),
      true: allNotifsList.filter((n: any) => n?.is_read === true),
      null: allNotifsList.filter((n: any) => n?.is_read === null || n?.is_read === undefined),
    };

    // Agrupar por tipo/kind
    const kind = (r: any) => String((r?.data?.kind ?? r?.type) ?? '').trim().toLowerCase();
    const byKind: Record<string, any[]> = {};
    for (const n of allNotifsList) {
      const k = kind(n);
      if (!byKind[k]) byKind[k] = [];
      byKind[k].push(n);
    }

    // Contar como lo hace /api/alerts/summary
    const unreadForSummary = allNotifsList.filter((n: any) => n?.is_read === false);
    const salesKinds = ['new_sale', 'sale_paid'];
    const supportKinds = ['support_message', 'support_reply', 'support_new_message'];
    let salesCount = 0;
    let supportCount = 0;
    let outbidCount = 0;
    let ratedBuyerCount = 0;
    let ratedSellerCount = 0;
    let otherNotifCount = 0;

    for (const r of unreadForSummary) {
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

    // También contar otras fuentes de alertas (como lo hace /api/alerts/summary)
    let questionsAnswered = 0;
    let questionsUnanswered = 0;
    let auctionsEnding = 0;
    
    try {
      // Preguntas respondidas
      const rRes: any = await admin
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('asker_id', userId)
        .eq('is_deleted', false)
        .not('answer_text', 'is', null);
      questionsAnswered = rRes?.error ? 0 : Math.max(0, Number((rRes as any)?.count ?? 0));
    } catch {
      // noop
    }
    
    try {
      // Preguntas sin responder
      const qRes: any = await admin
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('is_deleted', false)
        .is('answer_text', null);
      questionsUnanswered = qRes?.error ? 0 : Math.max(0, Number((qRes as any)?.count ?? 0));
    } catch {
      // noop
    }
    
    try {
      // Subastas por terminar
      const now = new Date();
      const nowIso = now.toISOString();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const favRes: any = await admin.from('favorites').select('listing_id').eq('user_id', userId).limit(500);
      const favIds = Array.from(new Set((favRes?.data as any[])?.map((f: any) => f?.listing_id).filter(Boolean) ?? []));
      if (favIds.length > 0) {
        const listRes: any = await admin
          .from('listings')
          .select('id')
          .in('id', favIds)
          .eq('sale_type', 'auction')
          .gt('auction_end_at', nowIso)
          .lt('auction_end_at', in24h);
        auctionsEnding = Array.isArray(listRes?.data) ? listRes.data.length : 0;
      }
    } catch {
      // noop
    }

    const calculated = { total: allNotifsList.length };

    const totalFromAllSources = calculated.total + questionsAnswered + questionsUnanswered + auctionsEnding;

    const resp = NextResponse.json({
      ok: true,
      userId,
      summary: {
        total: allNotifsList.length,
        unread: byState.false.length,
        read: byState.true.length,
        nullState: byState.null.length,
      },
      otherSources: {
        questionsAnswered,
        questionsUnanswered,
        auctionsEnding,
        total: questionsAnswered + questionsUnanswered + auctionsEnding,
      },
      grandTotal: {
        fromNotifications: calculated.total,
        fromOtherSources: questionsAnswered + questionsUnanswered + auctionsEnding,
        total: totalFromAllSources,
      },
      byState: {
        false: {
          count: byState.false.length,
          ids: byState.false.slice(0, 20).map((n: any) => ({
            id: n?.id,
            type: n?.type,
            kind: kind(n),
            created_at: n?.created_at,
            is_read: n?.is_read,
          })),
        },
        true: {
          count: byState.true.length,
          ids: byState.true.slice(0, 10).map((n: any) => ({
            id: n?.id,
            type: n?.type,
            kind: kind(n),
            created_at: n?.created_at,
            is_read: n?.is_read,
          })),
        },
        null: {
          count: byState.null.length,
          ids: byState.null.slice(0, 10).map((n: any) => ({
            id: n?.id,
            type: n?.type,
            kind: kind(n),
            created_at: n?.created_at,
            is_read: n?.is_read,
          })),
        },
      },
      byKind: Object.entries(byKind).map(([k, list]) => ({
        kind: k,
        total: list.length,
        unread: list.filter((n: any) => n?.is_read === false).length,
        read: list.filter((n: any) => n?.is_read === true).length,
        nullState: list.filter((n: any) => n?.is_read === null || n?.is_read === undefined).length,
      })),
      calculatedCounts: {
        sales: salesCount,
        support: supportCount,
        outbid: outbidCount,
        ratedBuyer: ratedBuyerCount,
        ratedSeller: ratedSellerCount,
        other: otherNotifCount,
        total: salesCount + supportCount + outbidCount + ratedBuyerCount + ratedSellerCount + otherNotifCount,
      },
      allNotifications: allNotifsList.slice(0, 30).map((n: any) => ({
        id: n?.id,
        type: n?.type,
        kind: kind(n),
        is_read: n?.is_read,
        created_at: n?.created_at,
        body: n?.body ? String(n.body).substring(0, 100) : null,
      })),
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[DEBUG NOTIFICATIONS]', e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
