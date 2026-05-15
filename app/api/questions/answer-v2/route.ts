import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/service';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * NUEVO SISTEMA SIMPLIFICADO PARA RESPONDER PREGUNTAS
 * Este endpoint es más simple y directo que el anterior
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { questionId, answerText } = body;

    if (!questionId || !answerText || String(answerText).trim() === '') {
      return NextResponse.json({ error: 'questionId and answerText are required' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const userId = userData.user.id;

    // Verificar que la pregunta existe (primero sin filtrar por is_deleted para diagnosticar)
    const { data: questionCheck, error: checkError } = await admin
      .from('listing_questions')
      .select('id, seller_id, listing_id, asker_id, question_text, answer_text, is_deleted')
      .eq('id', questionId)
      .single();

    if (checkError || !questionCheck) {
      console.error('[ANSWER-V2] Pregunta no encontrada:', {
        questionId,
        error: checkError,
        found: !!questionCheck,
      });
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verificar que no esté eliminada
    if (questionCheck.is_deleted) {
      console.error('[ANSWER-V2] Pregunta está marcada como eliminada:', {
        questionId,
        is_deleted: questionCheck.is_deleted,
      });
      return NextResponse.json({ error: 'Question has been deleted' }, { status: 404 });
    }

    const question = questionCheck;

    // Verificar que el usuario es el vendedor
    let isSeller = false;
    if (question.seller_id === userId) {
      isSeller = true;
    } else if (question.listing_id) {
      // Verificar por listing si seller_id está vacío
      const { data: listing } = await admin
        .from('listings')
        .select('seller_id')
        .eq('id', question.listing_id)
        .single();
      
      if (listing && listing.seller_id === userId) {
        isSeller = true;
        // Corregir seller_id en la pregunta
        await admin
          .from('listing_questions')
          .update({ seller_id: userId })
          .eq('id', questionId);
      }
    }

    if (!isSeller) {
      return NextResponse.json({ error: 'Unauthorized. Only the seller can answer.' }, { status: 403 });
    }

    // Verificar que la pregunta no esté ya respondida
    if (question.answer_text && String(question.answer_text).trim() !== '') {
      return NextResponse.json({ error: 'Question already answered' }, { status: 400 });
    }

    // Guardar la respuesta
    const trimmedAnswer = String(answerText).trim();
    const { data: updatedQuestion, error: updateError } = await admin
      .from('listing_questions')
      .update({
        answer_text: trimmedAnswer,
        answered_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select('id, answer_text, answered_at')
      .single();

    if (updateError || !updatedQuestion) {
      console.error('[ANSWER-V2] Error updating question:', updateError);
      return NextResponse.json({ error: 'Error saving answer' }, { status: 500 });
    }

    // Verificar que se guardó correctamente
    if (!updatedQuestion.answer_text || String(updatedQuestion.answer_text).trim() === '') {
      return NextResponse.json({ error: 'Answer was not saved correctly' }, { status: 500 });
    }

    console.log('[ANSWER-V2] ✅ Respuesta guardada correctamente:', {
      questionId,
      answerLength: trimmedAnswer.length,
      answeredAt: updatedQuestion.answered_at,
    });

    // Notificar SIEMPRE al usuario que preguntó cuando el vendedor responde (todos los usuarios)
    const raw = questionCheck.asker_id;
    const rawStr = raw != null ? String(raw).trim() : '';
    const askerId = /^[0-9a-f-]{36}$/i.test(rawStr) ? rawStr : null;

    console.log('[ANSWER-V2] asker_id:', { raw, rawStr, valid: !!askerId, askerId: askerId ?? '(null)' });

    let notified = false;
    let notifyReason: 'ok' | 'asker_id_missing' | 'insert_failed' | undefined;
    let notifyErrorDetail: string | undefined;
    if (!askerId) {
      notifyReason = 'asker_id_missing';
    }
    if (askerId && askerId !== userId) {
      try {
        let listingTitle = 'Publicación';
        if (questionCheck.listing_id) {
          const { data: listing } = await admin
            .from('listings')
            .select('title, public_id')
            .eq('id', questionCheck.listing_id)
            .maybeSingle();
          if (listing) {
            listingTitle = (listing as any).title || (listing as any).public_id || 'Publicación';
          }
        }

        const listingId = String(questionCheck.listing_id ?? '').trim();
        const linkUrl = listingId ? `/listings/${listingId}` : '/dashboard/respuestas';
        const title = 'El vendedor respondió tu pregunta';
        const body = `Respondieron tu pregunta en: ${listingTitle}.`;

        const res = await notify(admin, {
          user_id: askerId,
          type: 'listing_answer',
          title,
          body,
          data: {
            kind: 'listing_answer',
            questionId,
            listingId,
            listing_id: listingId,
            link_url: linkUrl,
            href: linkUrl,
            link: linkUrl,
          },
          is_read: false,
        });

        notified = res?.ok === true;
        if (notified) {
          notifyReason = 'ok';
          console.log('[ANSWER-V2] ✅ Notificación enviada al usuario que preguntó:', askerId);
        } else {
          console.warn('[ANSWER-V2] ⚠️ notify() falló, intentando insert directo:', res?.code, res?.message);
          const fallback = await insertNotificationBestEffort(admin, {
            user_id: askerId,
            type: 'listing_answer',
            title,
            body,
            is_read: false,
          });
          notified = fallback.ok === true;
          if (notified) {
            notifyReason = 'ok';
            console.log('[ANSWER-V2] ✅ Notificación creada por fallback directo.');
          } else {
            const code = (fallback as any)?.code;
            const msg = String((fallback as any)?.message ?? '');
            notifyErrorDetail = [code, msg].filter(Boolean).join(': ');
            console.warn('[ANSWER-V2] ❌ Fallback también falló:', code, msg);
            try {
              const direct = await admin.from('notifications').insert([{
                user_id: askerId,
                type: 'listing_answer',
                title,
                body,
                is_read: false,
              }]).select('id').single();
              if (!direct?.error) {
                notified = true;
                notifyReason = 'ok';
                console.log('[ANSWER-V2] ✅ Notificación creada por insert directo mínimo.');
              } else {
                const errMsg = String((direct.error as any)?.message ?? '');
                notifyErrorDetail = notifyErrorDetail ? `${notifyErrorDetail}; direct: ${errMsg}` : errMsg;
                console.error('[ANSWER-V2] ❌ Insert directo mínimo falló:', direct.error);
              }
            } catch (directErr: any) {
              const errMsg = directErr?.message ?? String(directErr);
              notifyErrorDetail = notifyErrorDetail ? `${notifyErrorDetail}; direct: ${errMsg}` : errMsg;
              console.error('[ANSWER-V2] ❌ Excepción en insert directo:', directErr);
            }
            if (!notified) notifyReason = 'insert_failed';
          }
        }
      } catch (notifErr: any) {
        notifyReason = 'insert_failed';
        notifyErrorDetail = notifErr?.message ?? String(notifErr);
        console.error('[ANSWER-V2] ⚠️ Error al notificar al asker (no crítico):', notifErr);
      }
    } else if (!askerId) {
      console.warn('[ANSWER-V2] ⚠️ asker_id vacío o inválido, no se puede notificar al comprador.');
    }

    const resp = NextResponse.json({
      ok: true,
      question: {
        id: updatedQuestion.id,
        answer_text: updatedQuestion.answer_text,
        answered_at: updatedQuestion.answered_at,
      },
      verified: true,
      notified,
      notify_reason: notifyReason ?? (notified ? 'ok' : undefined),
      ...(notifyErrorDetail && { notify_error_detail: notifyErrorDetail }),
    });

    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[ANSWER-V2] Error:', e);
    const resp = NextResponse.json({
      error: e instanceof Error ? e.message : 'Error inesperado',
    }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
