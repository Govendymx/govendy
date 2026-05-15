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
 * NUEVO SISTEMA SIMPLIFICADO DE PREGUNTAS
 * Este endpoint es más simple y directo que el anterior
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

    const sellerId = String(req.nextUrl.searchParams.get('sellerId') || '').trim();
    if (!sellerId || sellerId !== userData.user.id) {
      return NextResponse.json({ error: 'Invalid sellerId' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    console.log('[LIST-V2] 🔍 Iniciando consulta para sellerId:', sellerId);

    // ESTRATEGIA SIMPLE: Dos consultas separadas y luego merge
    // 1. Preguntas por seller_id
    // NOTA: Filtramos fechas futuras en la consulta para evitar problemas
    const { data: questionsBySeller, error: sellerError } = await admin
      .from('listing_questions')
      .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
      .eq('seller_id', sellerId)
      .eq('is_deleted', false)
      .lte('created_at', new Date().toISOString()) // Filtrar fechas futuras automáticamente
      .order('created_at', { ascending: false });

    console.log('[LIST-V2] 📊 Consulta por seller_id:', {
      total: questionsBySeller?.length || 0,
      error: sellerError,
      sample: questionsBySeller?.slice(0, 3).map((q: any) => ({
        id: q.id,
        listing_id: q.listing_id,
        seller_id: q.seller_id,
        hasAnswer: !!(q.answer_text && String(q.answer_text).trim() !== ''),
        answer_text: q.answer_text ? String(q.answer_text).substring(0, 30) : null,
      })),
    });

    // 2. Obtener listings del vendedor
    const { data: listings, error: listingsError } = await admin
      .from('listings')
      .select('id')
      .eq('seller_id', sellerId);

    console.log('[LIST-V2] 📊 Listings del vendedor:', {
      total: listings?.length || 0,
      error: listingsError,
      listingIds: listings?.map((l: any) => l.id) || [],
    });

    // 3. Preguntas por listing_id (solo si hay listings)
    let questionsByListing: any[] = [];
    if (listings && listings.length > 0) {
      const listingIds = listings.map((l: any) => l.id).filter(Boolean);
      if (listingIds.length > 0) {
        const { data: byListing, error: byListingError } = await admin
          .from('listing_questions')
          .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
          .in('listing_id', listingIds)
          .eq('is_deleted', false)
          .lte('created_at', new Date().toISOString()) // Filtrar fechas futuras automáticamente
          .order('created_at', { ascending: false });
        
        console.log('[LIST-V2] 📊 Consulta por listing_id:', {
          listingIdsCount: listingIds.length,
          total: byListing?.length || 0,
          error: byListingError,
          sample: byListing?.slice(0, 3).map((q: any) => ({
            id: q.id,
            listing_id: q.listing_id,
            seller_id: q.seller_id,
            hasAnswer: !!(q.answer_text && String(q.answer_text).trim() !== ''),
            answer_text: q.answer_text ? String(q.answer_text).substring(0, 30) : null,
          })),
        });
        
        if (byListing) {
          questionsByListing = byListing;
        }
      }
    }

    // 4. Merge simple: usar un Map para deduplicar
    const questionsMap = new Map<string, any>();
    
    // Agregar preguntas por seller_id
    if (questionsBySeller) {
      for (const q of questionsBySeller) {
        if (q.id) {
          questionsMap.set(String(q.id), q);
        } else {
          console.warn('[LIST-V2] ⚠️ Pregunta sin ID válido en questionsBySeller:', q);
        }
      }
    }
    
    // Agregar preguntas por listing_id (solo las que no están ya)
    for (const q of questionsByListing) {
      if (q.id && !questionsMap.has(String(q.id))) {
        questionsMap.set(String(q.id), q);
      } else if (!q.id) {
        console.warn('[LIST-V2] ⚠️ Pregunta sin ID válido en questionsByListing:', q);
      }
    }

    const questions = Array.from(questionsMap.values());
    
    console.log('[LIST-V2] 🔄 Merge completado:', {
      totalBySeller: questionsBySeller?.length || 0,
      totalByListing: questionsByListing.length,
      totalAfterMerge: questions.length,
      uniqueIds: questions.map((q: any) => q.id),
    });

    if (sellerError) {
      console.error('[LIST-V2] Error fetching questions:', sellerError);
      return NextResponse.json({ error: 'Error fetching questions' }, { status: 500 });
    }

    // Función MÁS ESTRICTA para determinar si una pregunta está respondida
    // Debe detectar incluso respuestas con solo espacios, caracteres especiales, etc.
    const isAnswered = (q: any): boolean => {
      const answerText = q?.answer_text;
      
      // Si es null o undefined, no está respondida
      if (answerText === null || answerText === undefined) {
        return false;
      }
      
      // Convertir a string y hacer trim
      const trimmed = String(answerText).trim();
      
      // Si después de trim está vacío, no está respondida
      if (trimmed === '') {
        return false;
      }
      
      // Si tiene contenido válido, está respondida
      return true;
    };

    // Log detallado de TODAS las preguntas antes de filtrar
    console.log('[LIST-V2] 📋 TODAS las preguntas antes de filtrar:', {
      total: questions.length,
      detalles: questions.map((q: any) => ({
        id: q.id,
        listing_id: q.listing_id,
        created_at: q.created_at,
        answer_text: q.answer_text,
        answer_text_length: q.answer_text ? String(q.answer_text).length : 0,
        answer_text_trimmed_length: q.answer_text ? String(q.answer_text).trim().length : 0,
        answered_at: q.answered_at,
        isAnswered: isAnswered(q),
        isAnsweredDetailed: {
          isNull: q.answer_text === null,
          isUndefined: q.answer_text === undefined,
          trimmed: q.answer_text ? String(q.answer_text).trim() : '',
          trimmedLength: q.answer_text ? String(q.answer_text).trim().length : 0,
          finalResult: isAnswered(q),
        },
      })),
    });

    // Filtrar solo preguntas sin respuesta
    // ADICIONAL: Filtrar también fechas futuras (protección adicional)
    const unansweredQuestions = (questions || []).filter((q: any) => {
      // Excluir si está respondida
      if (isAnswered(q)) {
        return false;
      }
      
      // Excluir si tiene fecha futura (protección adicional)
      if (q.created_at) {
        const createdDate = new Date(q.created_at);
        const now = new Date();
        if (createdDate > now) {
          console.warn('[LIST-V2] ⚠️ Pregunta con fecha futura filtrada automáticamente:', {
            id: q.id,
            created_at: q.created_at,
            now: now.toISOString(),
          });
          return false;
        }
      }
      
      return true;
    });
    
    // Ordenar por created_at DESC (más recientes primero) después de filtrar
    // Si las fechas son iguales, usar el ID como desempate para mantener orden consistente
    unansweredQuestions.sort((a: any, b: any) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      
      // Si las fechas son iguales, ordenar por ID (para mantener orden consistente)
      if (dateB === dateA) {
        const idA = String(a.id || '').toLowerCase();
        const idB = String(b.id || '').toLowerCase();
        return idB.localeCompare(idA); // Ordenar por ID descendente si las fechas son iguales
      }
      
      return dateB - dateA; // Más recientes primero
    });
    
    // CRÍTICO: Eliminar duplicados (mismo listing_id, mismo asker_id, misma pregunta)
    // Mantener solo la más reciente si hay duplicados
    const seen = new Map<string, any>();
    const deduplicated: any[] = [];
    
    for (const q of unansweredQuestions) {
      // Crear una clave única basada en listing_id, asker_id y pregunta
      const key = `${q.listing_id}_${q.asker_id}_${String(q.question_text || '').trim().toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, q);
        deduplicated.push(q);
      } else {
        // Si ya existe, mantener la más reciente (ya están ordenadas)
        const existing = seen.get(key);
        const existingDate = existing?.created_at ? new Date(existing.created_at).getTime() : 0;
        const currentDate = q.created_at ? new Date(q.created_at).getTime() : 0;
        
        if (currentDate > existingDate) {
          // Reemplazar con la más reciente
          const index = deduplicated.findIndex(item => item.id === existing.id);
          if (index !== -1) {
            deduplicated[index] = q;
            seen.set(key, q);
          }
        }
        // Si la existente es más reciente, mantenerla (no hacer nada)
      }
    }
    
    console.log('[LIST-V2] 🔄 Deduplicación completada:', {
      antes: unansweredQuestions.length,
      despues: deduplicated.length,
      eliminados: unansweredQuestions.length - deduplicated.length,
    });
    
    // Usar las preguntas deduplicadas
    const finalUnanswered = deduplicated;
    
    console.log('[LIST-V2] 🔍 Filtrado de preguntas sin respuesta:', {
      totalQuestions: questions.length,
      unanswered: unansweredQuestions.length,
      answered: questions.length - unansweredQuestions.length,
      unansweredIds: unansweredQuestions.map((q: any) => q.id),
      unansweredWithDates: unansweredQuestions.map((q: any) => ({
        id: q.id,
        listing_id: q.listing_id,
        created_at: q.created_at,
        answer_text: q.answer_text,
        answered_at: q.answered_at,
        isAnswered: isAnswered(q),
      })),
    });
    
    console.log('[LIST-V2] 🔍 Preguntas finales después de deduplicación:', {
      totalFinal: finalUnanswered.length,
      finalIds: finalUnanswered.map((q: any) => q.id),
      finalWithDates: finalUnanswered.map((q: any) => ({
        id: q.id,
        listing_id: q.listing_id,
        created_at: q.created_at,
        question_text: String(q.question_text || '').substring(0, 50),
      })),
    });

    // Corregir seller_id si está vacío (en background, no bloquea la respuesta)
    const questionsToFix = finalUnanswered.filter((q: any) => !q.seller_id || q.seller_id !== sellerId);
    if (questionsToFix.length > 0) {
      (async () => {
        for (const q of questionsToFix) {
          try {
            await admin
              .from('listing_questions')
              .update({ seller_id: sellerId })
              .eq('id', q.id);
          } catch (err) {
            console.error('[LIST-V2] Error fixing seller_id:', err);
          }
        }
      })();
    }

    // Mapear a formato de respuesta (mantener orden por fecha más reciente)
    const mappedQuestions = finalUnanswered.map((q: any) => ({
      id: String(q.id || ''),
      listing_id: String(q.listing_id || ''),
      seller_id: String(q.seller_id || sellerId),
      asker_id: String(q.asker_id || ''),
      question_text: String(q.question_text || ''),
      answer_text: null, // Siempre null porque solo devolvemos sin respuesta
      created_at: String(q.created_at || ''),
      answered_at: null,
    }));
    
    console.log('[LIST-V2] 📤 Preguntas mapeadas para enviar (ordenadas por fecha):', {
      count: mappedQuestions.length,
      ids: mappedQuestions.map(q => q.id),
      fechas: mappedQuestions.map(q => q.created_at),
    });

    console.log('[LIST-V2] ✅ Respuesta enviada:', {
      totalInDb: questions?.length || 0,
      unanswered: finalUnanswered.length,
      answered: (questions?.length || 0) - unansweredQuestions.length,
      questionsReturned: mappedQuestions.length,
      deduplicated: true,
    });

    const resp = NextResponse.json({
      ok: true,
      questions: mappedQuestions,
      debug: {
        totalInDb: questions?.length || 0,
        unanswered: finalUnanswered.length,
        answered: (questions?.length || 0) - unansweredQuestions.length,
        deduplicated: unansweredQuestions.length - finalUnanswered.length,
      },
    });

    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[LIST-V2] Error:', e);
    const resp = NextResponse.json({
      error: e instanceof Error ? e.message : 'Error inesperado',
    }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
