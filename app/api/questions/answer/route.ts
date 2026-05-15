import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/service';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { questionId?: string; answer?: string };
    const questionId = String(body?.questionId || '').trim();
    const answer = String(body?.answer || '').trim();

    if (!questionId) return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    if (answer.length < 1) return NextResponse.json({ error: 'Escribe una respuesta.' }, { status: 400 });
    if (answer.length > 800) return NextResponse.json({ error: 'La respuesta es demasiado larga (máx. 800 caracteres).' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const userId = String(userData.user.id || '').trim();

    // PASO 1: Obtener la pregunta
    const { data: question, error: qErr } = await admin
      .from('listing_questions')
      .select('id,listing_id,seller_id,asker_id,answer_text,question_text')
      .eq('id', questionId)
      .maybeSingle();

    if (qErr) {
      const code = String((qErr as any)?.code || '');
      const msg = String((qErr as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Tu BD aún no tiene `listing_questions`. Ejecuta `SOLUCION_DEFINITIVA_PREGUNTAS.sql` en Supabase.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: qErr.message }, { status: 400 });
    }

    if (!question) return NextResponse.json({ error: 'Pregunta no encontrada.' }, { status: 404 });

    // PASO 2: Verificar autorización (el usuario debe ser el vendedor)
    let sellerId = String((question as any).seller_id || '').trim();
    const listingId = String((question as any).listing_id || '').trim();
    
    // Si seller_id está vacío o incorrecto, obtenerlo del listing
    if (!sellerId || sellerId !== userId) {
      if (listingId) {
        const { data: listing } = await admin
          .from('listings')
          .select('seller_id')
          .eq('id', listingId)
          .maybeSingle();
        
        if (listing) {
          const listingSellerId = String((listing as any).seller_id ?? '').trim();
          if (listingSellerId === userId) {
            sellerId = listingSellerId;
            // Corregir seller_id en la pregunta
            await admin
              .from('listing_questions')
              .update({ seller_id: sellerId })
              .eq('id', questionId);
          }
        }
      }
    }

    if (sellerId !== userId) {
      return NextResponse.json({ 
        error: 'No autorizado. Solo el vendedor puede responder esta pregunta.' 
      }, { status: 403 });
    }

    // PASO 3: Verificar que la pregunta no esté ya respondida
    const existingAnswer = String((question as any).answer_text || '').trim();
    if (existingAnswer && existingAnswer.length > 0) {
      return NextResponse.json({ 
        error: 'Esta pregunta ya fue respondida.',
        alreadyAnswered: true
      }, { status: 400 });
    }

    // PASO 4: Guardar la respuesta
    // SOLUCIÓN GLOBAL: Usar SIEMPRE la función SQL que bypass RLS
    // Esto garantiza que funcione para TODOS los usuarios sin problemas de permisos
    const answeredAt = new Date().toISOString();
    const answerText = String(answer).trim();

    // CRÍTICO: Verificar que answerText no esté vacío después de trim
    if (!answerText || answerText.length === 0) {
      console.error('[ANSWER API] ❌ CRÍTICO: answerText está vacío después de trim:', {
        originalAnswer: answer,
        trimmedAnswer: answerText,
        answerLength: answerText.length,
      });
      return NextResponse.json({ 
        error: 'La respuesta no puede estar vacía.' 
      }, { status: 400 });
    }

    console.log('[ANSWER API] Guardando respuesta (usando función SQL para garantizar funcionamiento global):', {
      questionId,
      answerLength: answerText.length,
      answerPreview: answerText.substring(0, 50),
      answeredAt,
      userId,
      sellerId,
    });

    let updated: any = null;
    let updateErr: any = null;

    // Usar SIEMPRE la función SQL (más confiable, bypass RLS)
    try {
      console.log('[ANSWER API] Llamando función SQL update_question_answer...', {
        questionId,
        userId,
        answerLength: answerText.length,
      });
      
      // Llamar a la función RPC - asegurar que los parámetros estén correctos
      const functionResult = await admin.rpc('update_question_answer', {
        p_question_id: questionId,
        p_answer_text: answerText,
        p_user_id: userId,
      });
      
      // Log detallado para diagnóstico
      console.log('[ANSWER API] Respuesta completa de RPC:', {
        error: functionResult.error,
        data: functionResult.data,
        status: functionResult.status,
        statusText: functionResult.statusText,
      });
      
      console.log('[ANSWER API] Resultado de función SQL:', {
        hasError: !!functionResult.error,
        hasData: !!functionResult.data,
        error: functionResult.error ? String(functionResult.error.message || '') : null,
        data: functionResult.data,
      });
      
      if (functionResult.error) {
        const rpcError = functionResult.error;
        const errorCode = String((rpcError as any)?.code || '');
        const errorMsg = String((rpcError as any)?.message || '').toLowerCase();
        
        console.error('[ANSWER API] ❌ Error al llamar función SQL:', {
          code: errorCode,
          message: errorMsg,
          fullError: rpcError,
        });
        
        // Si la función no existe
        if (errorCode === '42883' || errorMsg.includes('function') || errorMsg.includes('does not exist')) {
          updateErr = { 
            message: 'La función SQL no está configurada. Ejecuta SOLUCION_GLOBAL_RESPONDER_PREGUNTAS.sql en Supabase.',
            code: errorCode,
          } as any;
        } else {
          updateErr = rpcError;
        }
      } else if (functionResult.data !== null && functionResult.data !== undefined) {
        // La función SQL retorna JSONB, puede venir como objeto o string
        let resultData: any = functionResult.data;
        
        // Si viene como string, parsearlo
        if (typeof resultData === 'string') {
          try {
            resultData = JSON.parse(resultData);
          } catch (parseErr) {
            console.error('[ANSWER API] Error al parsear respuesta JSON de función SQL:', parseErr);
            updateErr = { message: 'Error al procesar respuesta de función SQL' } as any;
            resultData = null;
          }
        }
        
        if (resultData && resultData.success === true) {
          console.log('[ANSWER API] ✅ Función SQL retornó éxito:', {
            question_id: resultData.question_id,
            answered_at: resultData.answered_at,
            fullData: resultData,
          });
          
          // Esperar un momento para que la BD procese el UPDATE
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verificar que se guardó consultando la BD
          const verifyResult = await admin
            .from('listing_questions')
            .select('id,answer_text,answered_at')
            .eq('id', questionId)
            .single();
          
          if (verifyResult.error) {
            console.error('[ANSWER API] Error al verificar después de función SQL:', verifyResult.error);
            updateErr = verifyResult.error;
          } else if (verifyResult.data) {
            const verified = verifyResult.data;
            const verifiedAnswer = String(verified.answer_text || '').trim();
            
            if (verifiedAnswer && verifiedAnswer.length > 0) {
              console.log('[ANSWER API] ✅ Verificación exitosa: respuesta guardada correctamente', {
                questionId,
                answerLength: verifiedAnswer.length,
                answeredAt: verified.answered_at,
              });
              updated = verified;
            } else {
              console.error('[ANSWER API] ❌ La respuesta verificada está vacía');
              updateErr = { message: 'La respuesta no se guardó correctamente (está vacía)' } as any;
            }
          } else {
            updateErr = { message: 'No se pudo verificar la respuesta guardada' } as any;
          }
        } else if (resultData && resultData.success === false) {
          const funcError = resultData.error || 'Error desconocido en función SQL';
          console.error('[ANSWER API] Función SQL retornó error en data:', funcError);
          updateErr = { message: String(funcError) } as any;
        } else {
          console.error('[ANSWER API] Función SQL retornó data pero sin success:', resultData);
          // Intentar verificar de todas formas
          const verifyResult = await admin
            .from('listing_questions')
            .select('id,answer_text,answered_at')
            .eq('id', questionId)
            .single();
          
          if (!verifyResult.error && verifyResult.data) {
            const verified = verifyResult.data;
            const verifiedAnswer = String(verified.answer_text || '').trim();
            if (verifiedAnswer && verifiedAnswer.length > 0) {
              console.log('[ANSWER API] ✅ Respuesta guardada (verificación directa)');
              updated = verified;
            } else {
              updateErr = { message: 'La función SQL no retornó éxito y la respuesta no se guardó' } as any;
            }
          } else {
            updateErr = { message: 'La función SQL no retornó resultado válido' } as any;
          }
        }
      } else {
        console.error('[ANSWER API] Función SQL no retornó data ni error');
        updateErr = { message: 'La función SQL no retornó resultado' } as any;
      }
    } catch (funcErr) {
      console.error('[ANSWER API] Excepción al llamar función SQL:', funcErr);
      updateErr = { 
        message: funcErr instanceof Error ? funcErr.message : 'Error desconocido al llamar función SQL',
        originalError: funcErr,
      } as any;
    }

    console.log('[ANSWER API] Resultado del UPDATE:', {
      hasData: !!updated,
      hasError: !!updateErr,
      error: updateErr ? String(updateErr.message || '') : null,
      errorCode: updateErr ? String((updateErr as any)?.code || '') : null,
      updatedAnswerText: updated ? String((updated as any).answer_text || '').substring(0, 30) : null,
      updatedAnsweredAt: updated ? (updated as any).answered_at : null,
    });

    if (updateErr) {
      const errorCode = String((updateErr as any)?.code || '');
      const errorMsg = String((updateErr as any)?.message || '').toLowerCase();
      
      console.error('[ANSWER API] ❌ Error al guardar respuesta:', {
        code: errorCode,
        message: errorMsg,
        fullError: updateErr,
        questionId,
        userId,
        sellerId,
      });
      
      // Si la función SQL no existe, intentar UPDATE directo como fallback
      if (errorCode === '42883' || errorMsg.includes('function') || errorMsg.includes('does not exist')) {
        console.log('[ANSWER API] Función SQL no disponible, intentando UPDATE directo como fallback...');
        
        try {
          const fallbackResult = await admin
            .from('listing_questions')
            .update({ 
              answer_text: answerText,
              answered_at: answeredAt
            })
            .eq('id', questionId)
            .select('id,answer_text,answered_at')
            .single();
          
          if (!fallbackResult.error && fallbackResult.data) {
            console.log('[ANSWER API] ✅ Fallback exitoso: respuesta guardada con UPDATE directo');
            updated = fallbackResult.data;
            updateErr = null;
          } else {
            return NextResponse.json({ 
              error: 'La función SQL no está configurada y el UPDATE directo falló. Ejecuta SOLUCION_GLOBAL_RESPONDER_PREGUNTAS.sql en Supabase.' 
            }, { status: 500 });
          }
        } catch (fallbackErr) {
          return NextResponse.json({ 
            error: 'La función SQL no está configurada. Ejecuta SOLUCION_GLOBAL_RESPONDER_PREGUNTAS.sql en Supabase.' 
          }, { status: 500 });
        }
      } else {
        // Si es error de autorización desde la función SQL
        if (errorMsg.includes('no autorizado') || errorMsg.includes('autorizado')) {
          return NextResponse.json({ 
            error: 'No autorizado. Solo el vendedor puede responder esta pregunta.' 
          }, { status: 403 });
        }
        
        // Si es error de "ya respondida"
        if (errorMsg.includes('ya respondida') || errorMsg.includes('already answered')) {
          return NextResponse.json({ 
            error: 'Esta pregunta ya fue respondida.',
            alreadyAnswered: true
          }, { status: 400 });
        }
        
        return NextResponse.json({ 
          error: `Error al guardar: ${updateErr.message || 'Error desconocido'}. Si el problema persiste, ejecuta SOLUCION_GLOBAL_RESPONDER_PREGUNTAS.sql en Supabase.` 
        }, { status: 400 });
      }
    }

    // Si aún no tenemos updated, intentar UPDATE directo como último recurso
    if (!updated && !updateErr) {
      console.log('[ANSWER API] ⚠️ No se obtuvo resultado de función SQL, intentando UPDATE directo...');
      try {
        const directUpdate = await admin
          .from('listing_questions')
          .update({ 
            answer_text: answerText,
            answered_at: answeredAt
          })
          .eq('id', questionId)
          .select('id,answer_text,answered_at')
          .single();
        
        if (!directUpdate.error && directUpdate.data) {
          console.log('[ANSWER API] ✅ UPDATE directo exitoso como último recurso');
          updated = directUpdate.data;
        } else {
          console.error('[ANSWER API] ❌ UPDATE directo también falló:', directUpdate.error);
          updateErr = directUpdate.error || { message: 'No se pudo actualizar la pregunta' } as any;
        }
      } catch (directErr) {
        console.error('[ANSWER API] ❌ Excepción en UPDATE directo:', directErr);
        updateErr = directErr as any;
      }
    }

    if (!updated) {
      if (updateErr) {
        const errorCode = String((updateErr as any)?.code || '');
        const errorMsg = String((updateErr as any)?.message || '').toLowerCase();
        
        // Si es error de permisos, dar mensaje más claro
        if (errorCode === '42501' || errorMsg.includes('permission') || errorMsg.includes('policy')) {
          return NextResponse.json({ 
            error: 'No tienes permisos para responder. Verifica que ejecutaste SOLUCION_GLOBAL_RESPONDER_PREGUNTAS.sql en Supabase.' 
          }, { status: 403 });
        }
        
        return NextResponse.json({ 
          error: `No se pudo actualizar la pregunta: ${updateErr.message || 'Error desconocido'}` 
        }, { status: 500 });
      }
      
      return NextResponse.json({ error: 'No se pudo actualizar la pregunta.' }, { status: 500 });
    }

    // PASO 5: Verificar que realmente se guardó (con múltiples intentos si es necesario)
    let verify: any = null;
    let verifyRetries = 3;
    
    while (verifyRetries > 0) {
      const verifyResult = await admin
        .from('listing_questions')
        .select('id,answer_text,answered_at,asker_id,listing_id')
        .eq('id', questionId)
        .single();
      
      if (verifyResult.error) {
        console.warn(`[ANSWER API] Error al verificar (intentos restantes: ${verifyRetries - 1}):`, verifyResult.error);
        verifyRetries--;
        if (verifyRetries > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
          continue;
        }
        return NextResponse.json({ 
          error: 'No se pudo verificar que la respuesta se guardó.' 
        }, { status: 500 });
      }
      
      verify = verifyResult.data;
      
      const verifiedAnswerText = verify ? String(verify.answer_text || '').trim() : '';
      if (verify && verifiedAnswerText !== '') {
        console.log('[ANSWER API] ✅ Verificación exitosa:', {
          questionId,
          answerText: verifiedAnswerText.substring(0, 50),
          answerLength: verifiedAnswerText.length,
          answeredAt: verify.answered_at,
          answerTextType: typeof verify.answer_text,
        });
        break;
      } else {
        console.warn(`[ANSWER API] ⚠️ Verificación fallida (intentos restantes: ${verifyRetries - 1}):`, {
          questionId,
          hasVerify: !!verify,
          hasAnswerText: !!(verify && verify.answer_text),
          answerTextValue: verify ? String(verify.answer_text || '') : 'null',
          answerTextLength: verifiedAnswerText.length,
          answerTextTrimmed: verifiedAnswerText,
        });
      }
      
      verifyRetries--;
      if (verifyRetries > 0) {
        console.warn(`[ANSWER API] La respuesta no se encontró, reintentando... (${verifyRetries} intentos restantes)`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!verify || !verify.answer_text || String(verify.answer_text).trim() === '') {
      console.error('[ANSWER API] ❌ CRÍTICO: La respuesta no se guardó correctamente después de todos los intentos');
      
      // Última verificación: consultar directamente la BD una vez más
      const finalCheck = await admin
        .from('listing_questions')
        .select('id,answer_text,answered_at')
        .eq('id', questionId)
        .single();
      
      if (finalCheck.data && finalCheck.data.answer_text && String(finalCheck.data.answer_text).trim() !== '') {
        console.log('[ANSWER API] ✅ Verificación final exitosa (después de error inicial)');
        verify = finalCheck.data;
      } else {
        return NextResponse.json({ 
          error: 'La respuesta no se guardó correctamente. Intenta nuevamente.' 
        }, { status: 500 });
      }
    }
    
    // Verificación adicional: asegurar que answered_at también se guardó
    if (verify && (!verify.answered_at || verify.answered_at === null)) {
      console.warn('[ANSWER API] ⚠️ answered_at no se guardó, actualizando...');
      await admin
        .from('listing_questions')
        .update({ answered_at: new Date().toISOString() })
        .eq('id', questionId);
      
      // Re-verificar
      const recheck = await admin
        .from('listing_questions')
        .select('id,answer_text,answered_at')
        .eq('id', questionId)
        .single();
      
      if (recheck.data) {
        verify = recheck.data;
      }
    }

    // PASO 6: Notificar SIEMPRE al usuario que preguntó cuando el vendedor responde
    // Garantiza que todos los usuarios reciban la notificación (trigger puede fallar o no existir)
    const askerId = String((verify as any)?.asker_id || (question as any)?.asker_id || '').trim();
    const realListingId = String((verify as any)?.listing_id || listingId || '').trim();
    let notified = false;
    let notify_error: any = null;

    if (askerId) {
      try {
        let listingTitle = 'tu publicación';
        if (realListingId) {
          const { data: listing } = await admin
            .from('listings')
            .select('title')
            .eq('id', realListingId)
            .maybeSingle();
          if (listing && (listing as any).title) {
            listingTitle = String((listing as any).title);
          }
        }

        const notifyResult = await notify(admin, {
          user_id: askerId,
          type: 'listing_answer',
          title: 'El vendedor respondió tu pregunta',
          body: `Respondieron tu pregunta en: ${listingTitle}.`,
          data: {
            kind: 'listing_answer',
            listingId: realListingId,
            listing_id: realListingId,
            questionId,
            link_url: `/listings/${realListingId}`,
            href: `/listings/${realListingId}`,
            link: `/listings/${realListingId}`,
          },
          is_read: false,
        });

        notified = notifyResult?.ok === true;
        if (!notified) {
          notify_error = { code: notifyResult?.code, message: notifyResult?.message };
          console.warn('[ANSWER API] ⚠️ Error al notificar al asker:', notify_error);
        } else {
          console.log('[ANSWER API] ✅ Notificación enviada al usuario que preguntó:', askerId);
        }
      } catch (notifyErr) {
        notify_error = { message: notifyErr instanceof Error ? notifyErr.message : 'notify_failed' };
        console.error('[ANSWER API] ❌ Excepción al notificar al asker:', notifyErr);
      }
    } else {
      console.warn('[ANSWER API] ⚠️ asker_id vacío, no se puede notificar al comprador.');
    }

    // PASO 7: Verificación final antes de retornar
    // CRÍTICO: Asegurar que la respuesta realmente se guardó antes de retornar éxito
    const finalAnswerText = verify ? String(verify.answer_text || '').trim() : '';
    if (!finalAnswerText || finalAnswerText.length === 0) {
      console.error('[ANSWER API] ❌ CRÍTICO: La respuesta está vacía al retornar éxito');
      return NextResponse.json({ 
        error: 'La respuesta no se guardó correctamente. Intenta nuevamente.' 
      }, { status: 500 });
    }
    
    console.log('[ANSWER API] ✅ ÉXITO: Respuesta guardada y verificada correctamente:', {
      questionId,
      answerLength: finalAnswerText.length,
      answerPreview: finalAnswerText.substring(0, 50),
      answeredAt: verify.answered_at,
      notified,
    });
    
    // PASO 8: Retornar éxito
    return NextResponse.json({ 
      ok: true,
      questionId,
      notified,
      notify_error: notify_error || null,
      answer: finalAnswerText,
      answeredAt: verify.answered_at,
      verified: true, // Indicar que se verificó correctamente
    });
  } catch (e: unknown) {
    console.error('[ANSWER API] Excepción:', e);
    return NextResponse.json({ 
      error: e instanceof Error ? e.message : 'Error inesperado' 
    }, { status: 500 });
  }
}
