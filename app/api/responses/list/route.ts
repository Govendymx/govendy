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
 * Endpoint para obtener solo las respuestas que recibiste:
 * cuando TÚ haces preguntas en publicaciones de otros y ellos te responden.
 * Las preguntas que te hacen en tus publicaciones van a /dashboard/preguntas.
 */
export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = userData.user.id;
    const admin = supabaseAdmin();

    // TODAS las preguntas que TÚ hiciste (asker_id), con y sin respuesta
    const { data: questionsAsked } = await admin
      .from('listing_questions')
      .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
      .eq('asker_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100);

    const responses: any[] = [];
    if (questionsAsked) {
      for (const q of questionsAsked) {
        // Incluir todas las preguntas, con o sin respuesta
        const hasAnswer = q.answer_text && String(q.answer_text).trim() !== '';
        responses.push({
          id: `answer_${q.id}`,
          type: 'answer_received',
          question_id: q.id,
          listing_id: q.listing_id,
          seller_id: q.seller_id,
          asker_id: q.asker_id,
          question_text: q.question_text,
          answer_text: q.answer_text,
          created_at: q.created_at,
          answered_at: q.answered_at,
          is_answered: hasAnswer,
        });
      }
    }

    responses.sort((a, b) => {
      const dateA = new Date(a.created_at || a.answered_at || 0).getTime();
      const dateB = new Date(b.created_at || b.answered_at || 0).getTime();
      return dateB - dateA;
    });

    const listingIds = Array.from(new Set(responses.map(r => r.listing_id).filter(Boolean)));
    const listingsMap: Record<string, any> = {};
    if (listingIds.length > 0) {
      const { data: listings } = await admin
        .from('listings')
        .select('id,title,public_id,images,price')
        .in('id', listingIds);
      if (listings) {
        for (const l of listings) listingsMap[String(l.id)] = l;
      }
    }

    const enrichedResponses = responses.map(r => ({
      ...r,
      listing: listingsMap[String(r.listing_id)] || null,
    }));

    console.log('[RESPONSES LIST] Respuestas (que hiciste y te respondieron):', enrichedResponses.length);

    const resp = NextResponse.json({
      ok: true,
      responses: enrichedResponses,
      count: enrichedResponses.length,
    });
    // Cachear por 15 segundos (las respuestas cambian poco frecuentemente)
    resp.headers.set('Cache-Control', 'private, s-maxage=15, stale-while-revalidate=30');
    return resp;
  } catch (e: unknown) {
    console.error('[RESPONSES LIST] Error:', e);
    const resp = NextResponse.json({
      error: e instanceof Error ? e.message : 'Error inesperado',
    }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
