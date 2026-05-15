import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { calculateMercadoPagoFee } from '@/lib/fees';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }

    // Rate Limiting (Seguridad)
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    // Límite: 10 intentos por minuto por IP para evitar spam de recargas/preferencias
    const rateLimit = checkRateLimit(`topup_${ip}`, 10, 60000);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Por favor espera un momento.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    // Validate token -> user
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    
    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const paymentMethod = body.payment_method || 'mercadopago'; // 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo'
    const instruction = body.instruction || '';

    if (!amount || amount < 10) { // Minimo $10 MXN
      return NextResponse.json({ error: 'El monto mínimo de recarga es $10.00 MXN' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    
    // Si es offline (transferencia, deposito, oxxo manual), solo creamos el registro y retornamos el ID
    const offlineMethods = ['offline', 'bank_transfer', 'bank_deposit', 'oxxo'];
    if (offlineMethods.includes(paymentMethod)) {
      // HACK: Store metadata as string in mercadopago_preference_id because 'metadata' column doesn't exist yet
      const metadataString = JSON.stringify({ 
        payment_method: paymentMethod,
        instruction: instruction
      });

      const { data: topup, error: topupErr } = await admin
        .from('wallet_topups')
        .insert({
          user_id: userData.user.id,
          amount,
          status: 'pending_proof', // Estado especial para esperar comprobante
          mercadopago_preference_id: metadataString // Storing JSON string here
        })
        .select('id')
        .single();

      if (topupErr) {
        console.error('Error creating offline topup record:', topupErr);
        return NextResponse.json({ error: 'Error al iniciar la recarga offline' }, { status: 500 });
      }

      return NextResponse.json({ topup_id: topup.id, status: 'pending_proof' });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 });
    }

    // Calcular comisión solo para MercadoPago (Tarjeta)
    const { total, fee } = calculateMercadoPagoFee(amount);

    // Crear registro de intento de recarga
    const { data: topup, error: topupErr } = await admin
      .from('wallet_topups')
      .insert({
        user_id: userData.user.id,
        amount, // Monto a acreditar (sin comisión)
        status: 'pending',
      })
      .select('id')
      .single();

    if (topupErr) {
      console.error('Error creating topup record:', topupErr);
      return NextResponse.json({ error: 'Error al iniciar la recarga' }, { status: 500 });
    }

    // Crear preferencia de pago en MercadoPago
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const origin = req.nextUrl.origin;
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
    const notificationUrl = webhookSecret
      ? `${origin}/api/mercadopago/webhook?token=${encodeURIComponent(webhookSecret)}`
      : `${origin}/api/mercadopago/webhook`;

    const externalReference = `wallet_topup_${topup.id}`;

    const result = await preference.create({
      body: {
        items: [
          {
            id: `topup-${topup.id}`,
            title: 'Recarga de Saldo PocketCash',
            description: `Recarga de $${amount.toFixed(2)} MXN`,
            quantity: 1,
            unit_price: total, // Cobramos el monto con comisión
            currency_id: 'MXN',
          },
        ],
        external_reference: externalReference,
        notification_url: notificationUrl,
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 1, // No meses sin intereses para recargas
        },
        back_urls: {
          success: `${origin}/dashboard/monedero?topup=success`,
          failure: `${origin}/dashboard/monedero?topup=failure`,
          pending: `${origin}/dashboard/monedero?topup=pending`,
        },
        metadata: {
          type: 'wallet_topup',
          user_id: userData.user.id,
          topup_id: topup.id,
          net_amount: amount, // Monto real a acreditar
        },
        expires: false, // Permitir tiempo para pagos offline (OXXO)
      },
    });

    const preferenceId = (result as any)?.id;
    const initPoint = (result as any)?.init_point || (result as any)?.sandbox_init_point;

    if (!preferenceId || !initPoint) {
      return NextResponse.json({ error: 'Error al crear preferencia de MercadoPago' }, { status: 500 });
    }

    // Actualizar topup con preference_id
    await admin
      .from('wallet_topups')
      .update({ mercadopago_preference_id: String(preferenceId) })
      .eq('id', topup.id);

    return NextResponse.json({
      ok: true,
      init_point: initPoint,
      preference_id: preferenceId,
    });

  } catch (error) {
    console.error('[WALLET TOPUP] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
