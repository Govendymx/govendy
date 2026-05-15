import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parsePaginationParams, createPaginationResponse } from '@/lib/pagination';

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

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sellerId = String(req.nextUrl.searchParams.get('sellerId') || '').trim();
    if (!sellerId) return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });

    // Solo el vendedor puede ver sus propias preguntas
    if (sellerId !== userData.user.id) {
      return NextResponse.json({ error: 'No autorizado. Solo puedes ver tus propias preguntas.' }, { status: 403 });
    }

    // OPTIMIZACIÓN AVANZADA: Paginación para escalar a 10k-50k usuarios
    const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1) || 1);
    const pageSize = Math.min(50, Math.max(10, Number(req.nextUrl.searchParams.get('pageSize') || 50) || 50));
    const offset = (page - 1) * pageSize;

    const admin = supabaseAdmin();

    // Obtener preguntas del vendedor (luego filtraremos por respuesta en código)
    // Nota: PostgREST no permite fácilmente filtrar por "NULL o vacío", así que lo hacemos en código
    // IMPORTANTE: Obtener TODAS las columnas necesarias, incluyendo answer_text y answered_at
    // OPTIMIZACIÓN AVANZADA: Paginación con límite reducido
    const { data: questionsBySeller, error: sellerErr, count: totalCount } = await admin
      .from('listing_questions')
      .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted', { count: 'exact' })
      .eq('seller_id', sellerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    
    // Log detallado para diagnóstico
    console.log('[LIST QUESTIONS] Consulta por seller_id:', {
      sellerId,
      total: questionsBySeller?.length || 0,
      sample: questionsBySeller?.slice(0, 3).map((q: any) => ({
        id: q.id,
        answer_text: q.answer_text ? String(q.answer_text).substring(0, 30) : null,
        answered_at: q.answered_at,
        hasAnswer: !!(q.answer_text && String(q.answer_text).trim() !== ''),
      })),
      error: sellerErr,
    });

    // También obtener preguntas por listing_id (fallback para preguntas antiguas)
    // IMPORTANTE: También filtrar por respuesta aquí
    const { data: listings } = await admin
      .from('listings')
      .select('id')
      .eq('seller_id', sellerId);

    let questionsByListing: any[] = [];
    if (listings && Array.isArray(listings) && listings.length > 0) {
      const listingIds = listings.map((l: any) => String(l?.id || '').trim()).filter(Boolean);
      if (listingIds.length > 0) {
        // OPTIMIZACIÓN: También aplicar paginación a consultas por listing_id
        const { data: byListing } = await admin
          .from('listing_questions')
          .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
          .in('listing_id', listingIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        
        console.log('[LIST QUESTIONS] Consulta por listing_id:', {
          listingIdsCount: listingIds.length,
          total: byListing?.length || 0,
          sample: byListing?.slice(0, 3).map((q: any) => ({
            id: q.id,
            answer_text: q.answer_text ? String(q.answer_text).substring(0, 30) : null,
            answered_at: q.answered_at,
            hasAnswer: !!(q.answer_text && String(q.answer_text).trim() !== ''),
          })),
        });
        
        if (byListing) {
          questionsByListing = byListing;
        }
      }
    }

    // FUNCIÓN IDÉNTICA A LA DE /debug - Determina si una pregunta está respondida
    // CRÍTICO: Una pregunta está respondida SOLO si tiene answer_text válido
    const isQuestionAnswered = (q: any): boolean => {
      const answerText = q?.answer_text;
      const hasAnswerText = answerText !== null && 
                           answerText !== undefined && 
                           String(answerText).trim() !== '';
      // Solo answer_text válido determina si está respondida
      return hasAnswerText;
    };

    // MERGE IDÉNTICO AL DE /debug - Simple y directo
    // Combinar y deduplicar preguntas usando la MISMA lógica que /debug
    const allQuestionsMap = new Map<string, any>();
    
    // Agregar preguntas por seller_id (igual que /debug)
    if (questionsBySeller && Array.isArray(questionsBySeller)) {
      for (const q of questionsBySeller) {
        const id = q?.id ? String(q.id) : null;
        if (id && id !== '') {
          allQuestionsMap.set(id, q);
        } else {
          console.warn('[LIST QUESTIONS] ⚠️ Pregunta sin ID válido en questionsBySeller:', q);
        }
      }
    }
    
    // Agregar preguntas por listing_id (solo las que no están ya) - igual que /debug
    if (Array.isArray(questionsByListing)) {
      for (const q of questionsByListing) {
        const id = q?.id ? String(q.id) : null;
        if (!id || id === '') {
          console.warn('[LIST QUESTIONS] ⚠️ Pregunta sin ID válido en questionsByListing:', q);
          continue;
        }
        if (!allQuestionsMap.has(id)) {
          // Corregir seller_id si está vacío o incorrecto (en memoria para esta consulta)
          const qSellerId = String(q?.seller_id || '').trim();
          if (!qSellerId || qSellerId !== sellerId) {
            // Corregir en memoria para que aparezca en esta consulta
            q.seller_id = sellerId;
            
            // Actualizar en BD en background (no bloquea la respuesta)
            (async () => {
              try {
                await admin
                  .from('listing_questions')
                  .update({ seller_id: sellerId })
                  .eq('id', id);
                console.log('[LIST] ✅ seller_id corregido para pregunta:', id);
              } catch (err: unknown) {
                console.error('[LIST] ❌ Error al corregir seller_id:', err);
              }
            })();
          }
          allQuestionsMap.set(id, q);
        }
      }
    }

    const allQuestions = Array.from(allQuestionsMap.values());
    
    console.log('[LIST QUESTIONS] 🔍 MERGE COMPLETADO (igual que /debug):', {
      totalEnMapa: allQuestionsMap.size,
      totalEnArray: allQuestions.length,
      ids: allQuestions.map(q => q.id),
      coinciden: allQuestionsMap.size === allQuestions.length,
    });
    
    console.log('[LIST QUESTIONS] Estado antes de filtrar:', {
      total: allQuestions.length,
      ids: allQuestions.map(q => q.id),
      muestra: allQuestions.slice(0, 10).map(q => ({
        id: q.id,
        seller_id: q.seller_id,
        listing_id: q.listing_id,
        answer_text: q.answer_text,
        answered_at: q.answered_at,
        isAnswered: isQuestionAnswered(q),
      })),
      todasLasPreguntasConEstado: allQuestions.map(q => ({
        id: q.id,
        seller_id: q.seller_id,
        listing_id: q.listing_id,
        answer_text: q.answer_text,
        isAnswered: isQuestionAnswered(q),
      })),
    });
    
    // FILTRAR SOLO PREGUNTAS SIN RESPUESTA
    // Usar la misma lógica exacta que /debug
    const unansweredQuestions = allQuestions.filter((q: any) => !isQuestionAnswered(q));
    
    console.log('[LIST QUESTIONS] 🔍 DESPUÉS DE FILTRAR:', {
      totalAllQuestions: allQuestions.length,
      totalUnanswered: unansweredQuestions.length,
      totalAnswered: allQuestions.length - unansweredQuestions.length,
      unansweredIds: unansweredQuestions.map(q => q.id),
      muestraUnanswered: unansweredQuestions.slice(0, 5).map(q => ({
        id: q.id,
        listing_id: q.listing_id,
        seller_id: q.seller_id,
        answer_text: q.answer_text,
        answered_at: q.answered_at,
        isAnswered: isQuestionAnswered(q),
      })),
    });

    // Mapear a formato de respuesta
    // CRÍTICO: Filtrar preguntas sin ID válido antes de mapear
    const questions = unansweredQuestions
      .filter((q: any) => {
        const id = q?.id;
        if (!id) {
          console.warn('[LIST QUESTIONS] ⚠️ Pregunta sin ID válido, omitiendo:', q);
          return false;
        }
        return true;
      })
      .map((q: any) => {
        const mapped = {
          id: String(q?.id || ''),
          listing_id: String(q?.listing_id || ''),
          seller_id: String(q?.seller_id || ''),
          asker_id: String(q?.asker_id || ''),
          question_text: String(q?.question_text || ''),
          answer_text: null, // Siempre null porque solo devolvemos sin respuesta
          created_at: String(q?.created_at || ''),
          answered_at: null,
        };
        return mapped;
      });
    
    console.log('[LIST QUESTIONS] 🔍 DESPUÉS DE MAPEAR:', {
      totalMapped: questions.length,
      mappedIds: questions.map(q => q.id),
      muestraMapped: questions.slice(0, 3),
    });

    console.log('[LIST QUESTIONS] Resumen final:', {
      sellerId,
      userId: userData.user.id,
      totalBySeller: questionsBySeller?.length || 0,
      totalByListing: questionsByListing.length,
      totalAfterMerge: allQuestions.length,
      unanswered: unansweredQuestions.length,
      answered: allQuestions.length - unansweredQuestions.length,
      sampleUnanswered: unansweredQuestions.slice(0, 3).map(q => ({
        id: q.id,
        listing_id: q.listing_id,
        seller_id: q.seller_id,
        answer_text: q.answer_text,
        answered_at: q.answered_at,
        isAnswered: isQuestionAnswered(q),
      })),
      todasLasPreguntasIds: allQuestions.map(q => q.id),
      preguntasSinRespuestaIds: unansweredQuestions.map(q => q.id),
    });

    // Log final antes de devolver
    console.log('[LIST QUESTIONS] 🚀 ENVIANDO RESPUESTA:', {
      questionsCount: questions.length,
      questionsIds: questions.map(q => q.id),
      debugInfo: {
        totalInDb: allQuestions.length,
        unanswered: unansweredQuestions.length,
        answered: allQuestions.length - unansweredQuestions.length,
      },
      muestraQuestions: questions.slice(0, 3),
    });
    
    const resp = NextResponse.json({ 
      ok: true, 
      questions,
      pagination: {
        page,
        pageSize,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
        hasMore: (totalCount || 0) > offset + pageSize,
      },
      debug: {
        totalInDb: allQuestions.length,
        unanswered: unansweredQuestions.length,
        answered: allQuestions.length - unansweredQuestions.length,
      }
    });
    // OPTIMIZACIÓN: Cachear por 15 segundos (las preguntas cambian poco frecuentemente)
    resp.headers.set('Cache-Control', 'private, s-maxage=15, stale-while-revalidate=30');
    return resp;
  } catch (e: unknown) {
    console.error('[LIST QUESTIONS] Error:', e);
    const resp = NextResponse.json({ 
      error: e instanceof Error ? e.message : 'Error inesperado' 
    }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
