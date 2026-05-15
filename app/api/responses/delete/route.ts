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
 * Endpoint para eliminar una respuesta
 * Permite eliminar preguntas recibidas o respuestas recibidas
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
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    const userId = userData.user.id;
    const admin = supabaseAdmin();

    // Verificar que la pregunta existe y que el usuario tiene permiso para eliminarla
    const { data: question, error: questionErr } = await admin
      .from('listing_questions')
      .select('id,seller_id,asker_id,is_deleted')
      .eq('id', questionId)
      .single();

    if (questionErr || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verificar permisos: el usuario debe ser el vendedor (seller_id) o el que preguntó (asker_id)
    const isSeller = question.seller_id === userId;
    const isAsker = question.asker_id === userId;

    if (!isSeller && !isAsker) {
      return NextResponse.json({ error: 'Unauthorized. You can only delete your own questions or answers.' }, { status: 403 });
    }

    if (question.is_deleted === true) {
      return NextResponse.json({ ok: true, deleted: true, alreadyDeleted: true });
    }

    const { data: updatedRows, error: updateErr } = await admin
      .from('listing_questions')
      .update({ is_deleted: true })
      .eq('id', questionId)
      .select('id,is_deleted');

    if (updateErr) {
      console.error('[DELETE RESPONSE] Error al actualizar:', updateErr);
      return NextResponse.json({ error: 'Error al eliminar la respuesta' }, { status: 500 });
    }

    if (!updatedRows?.length) {
      console.warn('[DELETE RESPONSE] No se actualizó ninguna fila:', { questionId });
      return NextResponse.json({ error: 'No se pudo eliminar. La respuesta puede no existir o ya estar eliminada.' }, { status: 404 });
    }

    const row = updatedRows[0] as { id: string; is_deleted: boolean };
    if (row.is_deleted !== true) {
      console.error('[DELETE RESPONSE] is_deleted no quedó en true:', { questionId, row });
      return NextResponse.json({ error: 'Error al eliminar la respuesta' }, { status: 500 });
    }

    console.log('[DELETE RESPONSE] OK:', { questionId, userId });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (e: unknown) {
    console.error('[DELETE RESPONSE] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error inesperado' },
      { status: 500 }
    );
  }
}
