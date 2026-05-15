import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    // Validar token (usuario)
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sellerId = String(req.nextUrl.searchParams.get('sellerId') || userData.user.id).trim();
    if (!sellerId) return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });

    // Solo el vendedor puede ver sus propias preguntas
    if (sellerId !== userData.user.id) {
      return NextResponse.json({ error: 'No autorizado. Solo puedes ver tus propias preguntas.' }, { status: 403 });
    }

    const admin = supabaseAdmin();

    const debug: any = {
      sellerId,
      userId: userData.user.id,
      timestamp: new Date().toISOString(),
    };

    // 1) Verificar preguntas por seller_id
    const res1: any = await admin
      .from('listing_questions')
      .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
      .eq('seller_id', sellerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);

    const bySellerId = Array.isArray(res1?.data) ? res1.data : [];
    // Función auxiliar para verificar si una pregunta está respondida
    // CRÍTICO: Solo considerar respondida si tiene answer_text válido
    // El answered_at por sí solo NO es suficiente (puede tener datos corruptos)
    const isQuestionAnswered = (q: any): boolean => {
      const answerText = q?.answer_text;
      const hasAnswerText = answerText !== null && 
                           answerText !== undefined && 
                           String(answerText).trim() !== '';
      // Solo answer_text válido determina si está respondida
      return hasAnswerText;
    };

    debug.bySellerId = {
      total: bySellerId.length,
      sinRespuesta: bySellerId.filter((q: any) => !isQuestionAnswered(q)).length,
      conRespuesta: bySellerId.filter((q: any) => isQuestionAnswered(q)).length,
      error: res1?.error ? String(res1.error) : null,
    };

    // 2) Verificar listings del vendedor
    const lRes: any = await admin
      .from('listings')
      .select('id')
      .eq('seller_id', sellerId);
    
    const listingIds: string[] = Array.isArray(lRes?.data) ? (lRes.data as any[]).map((r: any) => String(r?.id || '').trim()).filter(Boolean) : [];
    debug.listings = {
      total: listingIds.length,
      ids: listingIds.slice(0, 5), // Primeros 5 para no saturar
    };

    // 3) Verificar preguntas por listing_id (fallback)
    let byListingId: any[] = [];
    if (listingIds.length > 0) {
      const res2: any = await admin
        .from('listing_questions')
        .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
        .in('listing_id', listingIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(200);
      
      byListingId = Array.isArray(res2?.data) ? res2.data : [];
    }

    debug.byListingId = {
      total: byListingId.length,
      sinRespuesta: byListingId.filter((q: any) => {
        const answer = q?.answer_text;
        return answer === null || answer === undefined || answer === '' || (typeof answer === 'string' && answer.trim() === '');
      }).length,
      conRespuesta: byListingId.filter((q: any) => {
        const answer = q?.answer_text;
        return answer !== null && answer !== undefined && answer !== '' && (typeof answer !== 'string' || answer.trim() !== '');
      }).length,
    };

    // 4) Merge y deduplicación
    const byId = new Map<string, any>();
    for (const q of bySellerId) byId.set(String(q?.id || ''), q);
    for (const q of byListingId) {
      const id = String(q?.id || '');
      if (id && !byId.has(id)) {
        byId.set(id, q);
      }
    }

    const allQuestions = Array.from(byId.values());
    debug.merged = {
      total: allQuestions.length,
      sinRespuesta: allQuestions.filter((q: any) => !isQuestionAnswered(q)).length,
      conRespuesta: allQuestions.filter((q: any) => isQuestionAnswered(q)).length,
    };

    // 5) Preguntas sin respuesta (las que deberían mostrarse)
    // IMPORTANTE: Usar la misma lógica que el endpoint /list
    const unansweredQuestions = allQuestions.filter((q: any) => !isQuestionAnswered(q));

    debug.unansweredQuestions = {
      count: unansweredQuestions.length,
      ids: unansweredQuestions.slice(0, 10).map((q: any) => ({
        id: q?.id,
        listing_id: q?.listing_id,
        seller_id: q?.seller_id,
        question_text: String(q?.question_text || '').substring(0, 50),
        answer_text: q?.answer_text,
        answered_at: q?.answered_at,
        isAnswered: isQuestionAnswered(q), // Para debug
      })),
    };

    // Agregar información sobre preguntas respondidas para diagnóstico
    const answeredQuestions = allQuestions.filter((q: any) => isQuestionAnswered(q));
    debug.answeredQuestions = {
      count: answeredQuestions.length,
      sample: answeredQuestions.slice(0, 5).map((q: any) => ({
        id: q?.id,
        answer_text: q?.answer_text ? String(q.answer_text).substring(0, 30) : null,
        answered_at: q?.answered_at,
        hasAnswerText: !!(q?.answer_text && String(q.answer_text).trim()),
        hasAnsweredAt: !!(q?.answered_at),
      })),
    };

    // 6) Verificar problemas con seller_id
    const sellerIdProblems = allQuestions.filter((q: any) => {
      const qSellerId = String(q?.seller_id || '').trim();
      return !qSellerId || qSellerId !== sellerId;
    });

    debug.sellerIdProblems = {
      count: sellerIdProblems.length,
      examples: sellerIdProblems.slice(0, 5).map((q: any) => ({
        id: q?.id,
        seller_id_en_pregunta: q?.seller_id,
        seller_id_esperado: sellerId,
      })),
    };

    // Agregar comparación con el endpoint /list para ver la discrepancia
    try {
      // Simular la misma lógica que /list para comparar
      const listEndpointLogic = {
        bySellerId: {
          total: bySellerId.length,
          sinRespuesta: bySellerId.filter((q: any) => {
            const answerText = q?.answer_text;
            return !(answerText !== null && answerText !== undefined && String(answerText).trim() !== '');
          }).length,
        },
        byListingId: {
          total: byListingId.length,
          sinRespuesta: byListingId.filter((q: any) => {
            const answerText = q?.answer_text;
            return !(answerText !== null && answerText !== undefined && String(answerText).trim() !== '');
          }).length,
        },
        merged: {
          total: allQuestions.length,
          sinRespuesta: unansweredQuestions.length,
        },
      };
      
      debug.listEndpointSimulation = listEndpointLogic;
    } catch (e) {
      debug.listEndpointSimulation = { error: String(e) };
    }

    return NextResponse.json({
      ok: true,
      debug,
    });
  } catch (e: unknown) {
    console.error('[DEBUG QUESTIONS] Error:', e);
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Unexpected error',
      debug: { error: String(e) },
    }, { status: 500 });
  }
}
