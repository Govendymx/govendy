import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type Body = {
  quote_id: string;
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

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing MERCADOPAGO_ACCESS_TOKEN env var' }, { status: 500 });
    }

    // Verificar que la cotización existe y pertenece al usuario
    const admin = supabaseAdmin();
    const { data: quote, error: quoteErr } = await admin
      .from('estafeta_quotes')
      .select('id, user_id, calculated_cost, status, sender_name, recipient_name')
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: 'Cotización no encontrada.' }, { status: 404 });
    }

    if (quote.user_id !== userId) {
      return NextResponse.json({ error: 'No tienes permiso para pagar esta cotización.' }, { status: 403 });
    }

    if (quote.status !== 'quote') {
      return NextResponse.json({ error: 'Esta cotización ya fue procesada.' }, { status: 400 });
    }

    // Validar que tenga todos los datos necesarios
    const { data: fullQuote } = await admin
      .from('estafeta_quotes')
      .select('sender_name, sender_phone, sender_address, sender_city, sender_state, sender_postal_code, recipient_name, recipient_phone, recipient_address, recipient_city, recipient_state, recipient_postal_code')
      .eq('id', quoteId)
      .single();

    if (!fullQuote || !fullQuote.sender_name || !fullQuote.recipient_name) {
      return NextResponse.json({ error: 'La cotización no tiene todos los datos necesarios. Por favor completa todos los campos.' }, { status: 400 });
    }

    const amount = Number(quote.calculated_cost || 0);
    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0.' }, { status: 400 });
    }

    // Actualizar estado a pending_payment
    await admin
      .from('estafeta_quotes')
      .update({ status: 'pending_payment' })
      .eq('id', quoteId);

    // Crear preferencia de pago en MercadoPago
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const origin = req.nextUrl.origin;
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
    const notificationUrl = webhookSecret
      ? `${origin}/api/mercadopago/webhook?token=${encodeURIComponent(webhookSecret)}`
      : `${origin}/api/mercadopago/webhook`;

    const result = await preference.create({
      body: {
        items: [
          {
            id: `estafeta-${quoteId.slice(0, 8)}`,
            title: 'Guía de envío Estafeta',
            description: `Envío de ${fullQuote.sender_city} a ${fullQuote.recipient_city}`,
            quantity: 1,
            currency_id: 'MXN',
            unit_price: amount,
          },
        ],
        external_reference: `estafeta_quote_${quoteId}`,
        notification_url: notificationUrl,
        back_urls: {
          success: `${origin}/compra-exitosa?type=estafeta&quoteId=${encodeURIComponent(quoteId)}`,
          pending: `${origin}/compra-pendiente?type=estafeta&quoteId=${encodeURIComponent(quoteId)}`,
          failure: `${origin}/compra-error?type=estafeta&quoteId=${encodeURIComponent(quoteId)}`,
        },
        auto_return: 'approved',
        metadata: { quote_id: quoteId, type: 'estafeta_guide' },
      },
    });

    const prefId = (result as any)?.id as string | undefined;
    const initPoint = (result as any)?.init_point as string | undefined;
    const sandboxInitPoint = (result as any)?.sandbox_init_point as string | undefined;

    if (prefId) {
      await admin
        .from('estafeta_quotes')
        .update({ mp_preference_id: prefId, status: 'pending_payment' })
        .eq('id', quoteId);
    }

    const resp = NextResponse.json({
      ok: true,
      preferenceId: prefId,
      init_point: initPoint,
      sandbox_init_point: sandboxInitPoint,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
