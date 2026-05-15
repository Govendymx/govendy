import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
import { containsContactInfo } from '@/lib/utils/validation';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { listingId?: string; question?: string };
    const listingId = String(body?.listingId || '').trim();
    const question = String(body?.question || '').trim();

    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    if (question.length < 3) return NextResponse.json({ error: 'Escribe una pregunta más clara (mínimo 3 caracteres).' }, { status: 400 });
    if (question.length > 500) return NextResponse.json({ error: 'La pregunta es demasiado larga (máx. 500 caracteres).' }, { status: 400 });

    const safetyCheck = containsContactInfo(question);
    if (safetyCheck.detected) {
      return NextResponse.json(
        { error: `Por seguridad, no se permiten ${safetyCheck.reason} en las preguntas.` }, 
        { status: 400 }
      );
    }

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

    const admin = supabaseAdmin();

    // Intentar obtener el listing con diferentes nombres de columna
    let l: any = await admin.from('listings').select('id,seller_id,user_id,title').eq('id', listingId).maybeSingle();
    if (l?.error) {
      const code = String((l.error as any)?.code || '');
      const msg = String((l.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        // Intentar sin user_id
        l = await admin.from('listings').select('id,seller_id,title').eq('id', listingId).maybeSingle();
        if (l?.error) {
          // Intentar con user_id en lugar de seller_id
          l = await admin.from('listings').select('id,user_id,title').eq('id', listingId).maybeSingle();
        }
      }
    }
    const listing = l?.data ?? null;
    const lErr = l?.error ?? null;
    if (lErr) {
      console.error('Error al obtener listing:', lErr);
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }
    if (!listing) return NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 });

    // Obtener seller_id (puede estar en seller_id o user_id)
    const sellerId = String((listing as any).seller_id ?? (listing as any).user_id ?? '').trim();
    const askerId = userData.user.id;
    
    // Validar seller_id
    if (!sellerId) {
      console.error('Listing sin seller_id/user_id:', listing);
      return NextResponse.json({ error: 'Publicación inválida (sin vendedor).' }, { status: 400 });
    }
    
    if (sellerId === askerId) {
      return NextResponse.json({ error: 'No puedes preguntarte a ti mismo en tu publicación.' }, { status: 400 });
    }

    // Insertar pregunta - asegurar que seller_id se guarde correctamente
    // Usar admin client para evitar problemas de RLS
    // CRÍTICO: No especificar created_at para que PostgreSQL use NOW() automáticamente
    // Esto evita problemas de fechas futuras
    const ins: any = await admin
      .from('listing_questions')
      .insert([
        {
          listing_id: listingId,
          seller_id: sellerId, // Asegurar que seller_id se guarde explícitamente
          asker_id: askerId,
          question_text: question,
          answer_text: null, // Asegurar que answer_text sea NULL inicialmente
          is_deleted: false, // Asegurar que no esté marcada como eliminada
          // NO especificar created_at - dejar que PostgreSQL use el valor por defecto (NOW())
        },
      ])
      .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
      .single();

    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Tu BD aún no tiene `listing_questions`. Ejecuta `supabase_listing_questions.sql` en Supabase y recarga.' },
          { status: 400 },
        );
      }
      console.error('Error al insertar pregunta:', ins.error);
      return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    // Verificar que la pregunta se insertó correctamente
    const insertedQuestion = ins.data;
    if (!insertedQuestion) {
      return NextResponse.json({ error: 'No se pudo crear la pregunta.' }, { status: 500 });
    }

    // Verificar que seller_id se guardó correctamente
    const savedSellerId = String((insertedQuestion as any)?.seller_id || '').trim();
    const savedAnswerText = (insertedQuestion as any)?.answer_text;
    const savedIsDeleted = (insertedQuestion as any)?.is_deleted;
    
    console.log('[ASK QUESTION] ✅ Pregunta creada:', {
      questionId: (insertedQuestion as any)?.id,
      listingId,
      expectedSellerId: sellerId,
      savedSellerId,
      sellerIdMatch: savedSellerId === sellerId,
      askerId,
      question: question.substring(0, 50),
      answer_text: savedAnswerText,
      is_deleted: savedIsDeleted,
      created_at: (insertedQuestion as any)?.created_at,
    });
    
    // Verificar que todo se guardó correctamente
    if (savedSellerId !== sellerId) {
      console.error('[ASK QUESTION] ❌ ERROR CRÍTICO: seller_id no coincide:', {
        expected: sellerId,
        saved: savedSellerId,
        questionId: (insertedQuestion as any)?.id,
      });
    }
    if (savedAnswerText !== null) {
      console.warn('[ASK QUESTION] ⚠️ ADVERTENCIA: answer_text no es NULL:', savedAnswerText);
    }
    if (savedIsDeleted !== false) {
      console.warn('[ASK QUESTION] ⚠️ ADVERTENCIA: is_deleted no es false:', savedIsDeleted);
    }
    
    // Si seller_id no coincide, corregirlo inmediatamente (usando admin para evitar RLS)
    if (savedSellerId !== sellerId) {
      console.warn('[ASK QUESTION] ⚠️ seller_id no coincide, corrigiendo...', { expected: sellerId, got: savedSellerId });
      try {
        const fixRes = await admin
          .from('listing_questions')
          .update({ seller_id: sellerId })
          .eq('id', (insertedQuestion as any)?.id)
          .select('id,seller_id')
          .single();
        if (!fixRes.error) {
          console.log('[ASK QUESTION] ✅ seller_id corregido exitosamente');
          // Actualizar el objeto en memoria
          (insertedQuestion as any).seller_id = sellerId;
        } else {
          console.error('[ASK QUESTION] ❌ Error al corregir seller_id:', fixRes.error);
        }
      } catch (fixErr) {
        console.error('[ASK QUESTION] ❌ Excepción al corregir seller_id:', fixErr);
      }
    }

    const questionId = (insertedQuestion as any)?.id;
    const listingTitle = (listing as any).title || 'Tu publicación';
    const questionPreview = question.length > 80 ? `${question.slice(0, 77)}…` : question;

    // Notificación al vendedor: nueva pregunta
    // NOTA: Los triggers SQL deberían crear la notificación automáticamente
    // Verificamos si el trigger creó la notificación, y si no, la creamos desde la API
    // Esto asegura que siempre haya notificación, incluso si los triggers fallan
    
    let notified = false;
    let notify_error: any = null;
    
    // SIEMPRE crear la notificación desde la API para asegurar que se cree
    // El trigger SQL puede fallar silenciosamente, así que no dependemos de él
    console.log('[ASK QUESTION] Creando notificación para vendedor:', {
      sellerId,
      listingId,
      questionId,
      listingTitle,
      questionPreview,
    });
    
    try {
      const r = await insertNotificationBestEffort(admin, {
        user_id: sellerId,
        type: 'listing_question',
        title: '💬 Nueva pregunta en tu publicación',
        body: `"${listingTitle}": ${questionPreview}`,
        data: {
          kind: 'listing_question',
          listingId,
          questionId,
          questionPreview,
          href: `/dashboard/preguntas`,
          link: `/dashboard/preguntas`,
          link_url: `/listings/${listingId}`,
        },
        is_read: false,
      });
      
      notified = (r as any)?.ok === true;
      if (!notified) {
        notify_error = r;
        console.error('[ASK QUESTION] ❌ Error al crear notificación:', {
          ok: (r as any)?.ok,
          code: (r as any)?.code,
          message: (r as any)?.message,
        });
      } else {
        console.log('[ASK QUESTION] ✅ Notificación creada exitosamente para vendedor');
      }
    } catch (e: unknown) {
      notify_error = { message: e instanceof Error ? e.message : 'notify_failed' };
      console.error('[ASK QUESTION] ❌ Excepción al crear notificación:', e);
    }
    
    // Verificar que la notificación se creó correctamente (opcional, para diagnóstico)
    if (notified) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const verify: any = await admin
        .from('notifications')
        .select('id,is_read')
        .eq('user_id', sellerId)
        .eq('is_read', false)
        .or(`type.eq.listing_question,data->>kind.eq.listing_question`)
        .eq('data->>questionId', questionId)
        .limit(1)
        .maybeSingle();
      
      if (verify?.data) {
        console.log('[ASK QUESTION] ✅ Verificación: Notificación existe en BD:', verify.data.id);
      } else {
        console.warn('[ASK QUESTION] ⚠️ Advertencia: Notificación no encontrada después de crearla');
      }
    }

    return NextResponse.json({ ok: true, question: ins.data, notified, notify_error });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

