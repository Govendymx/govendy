import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type Body = {
  quote_id: string;
  sender_name: string;
  sender_phone: string;
  sender_email: string;
  sender_address: string;
  sender_between_streets: string;
  sender_references: string;
  sender_city: string;
  sender_state: string;
  sender_postal_code: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  recipient_address: string;
  recipient_between_streets: string;
  recipient_references: string;
  recipient_city: string;
  recipient_state: string;
  recipient_postal_code: string;
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const quoteId = String(body.quote_id || '').trim();

    if (!quoteId) {
      return NextResponse.json({ error: 'quote_id es requerido.' }, { status: 400 });
    }

    // Validar campos requeridos
    if (
      !body.sender_name?.trim() ||
      !body.sender_phone?.trim() ||
      !body.sender_email?.trim() ||
      !body.sender_address?.trim() ||
      !body.sender_between_streets?.trim() ||
      !body.sender_references?.trim() ||
      !body.sender_city?.trim() ||
      !body.sender_state?.trim() ||
      !body.sender_postal_code?.trim() ||
      !body.recipient_name?.trim() ||
      !body.recipient_phone?.trim() ||
      !body.recipient_email?.trim() ||
      !body.recipient_address?.trim() ||
      !body.recipient_between_streets?.trim() ||
      !body.recipient_references?.trim() ||
      !body.recipient_city?.trim() ||
      !body.recipient_state?.trim() ||
      !body.recipient_postal_code?.trim()
    ) {
      return NextResponse.json({ error: 'Todos los campos requeridos deben estar completos.' }, { status: 400 });
    }

    // Verificar que la cotización existe y pertenece al usuario
    const admin = supabaseAdmin();
    const { data: existingQuote, error: checkErr } = await admin
      .from('estafeta_quotes')
      .select('id, user_id, status')
      .eq('id', quoteId)
      .maybeSingle();

    if (checkErr || !existingQuote) {
      return NextResponse.json({ error: 'Cotización no encontrada.' }, { status: 404 });
    }

    if (existingQuote.user_id !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para actualizar esta cotización.' }, { status: 403 });
    }

    if (existingQuote.status !== 'quote') {
      return NextResponse.json({ error: 'Esta cotización ya no puede ser actualizada.' }, { status: 400 });
    }

    // Actualizar cotización
    const { error: updateErr } = await admin
      .from('estafeta_quotes')
      .update({
        sender_name: String(body.sender_name || '').trim(),
        sender_phone: String(body.sender_phone || '').trim(),
        sender_email: String(body.sender_email || '').trim(),
        sender_address: String(body.sender_address || '').trim(),
        sender_between_streets: String(body.sender_between_streets || '').trim(),
        sender_references: String(body.sender_references || '').trim(),
        sender_city: String(body.sender_city || '').trim(),
        sender_state: String(body.sender_state || '').trim(),
        sender_postal_code: String(body.sender_postal_code || '').trim(),
        recipient_name: String(body.recipient_name || '').trim(),
        recipient_phone: String(body.recipient_phone || '').trim(),
        recipient_email: String(body.recipient_email || '').trim(),
        recipient_address: String(body.recipient_address || '').trim(),
        recipient_between_streets: String(body.recipient_between_streets || '').trim(),
        recipient_references: String(body.recipient_references || '').trim(),
        recipient_city: String(body.recipient_city || '').trim(),
        recipient_state: String(body.recipient_state || '').trim(),
        recipient_postal_code: String(body.recipient_postal_code || '').trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('user_id', userId);

    if (updateErr) {
      console.error('[ESTAFETA UPDATE] Error al actualizar cotización:', updateErr);
      return NextResponse.json({ error: 'No se pudo actualizar la cotización.' }, { status: 500 });
    }

    const resp = NextResponse.json({ ok: true, message: 'Cotización actualizada correctamente.' });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
