import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Crear pago para verificación de usuario
 */
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

    const admin = supabaseAdmin();

    // Verificar si ya está verificado
    const { data: profile } = await admin
      .from('profiles')
      .select('is_verified')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profile?.is_verified) {
      return NextResponse.json({ error: 'Ya estás verificado' }, { status: 400 });
    }

    // Verificar si ya tiene un pago pendiente o aprobado
    const { data: existingPayment } = await admin
      .from('verification_payments')
      .select('id, payment_status, verification_granted')
      .eq('user_id', userData.user.id)
      .in('payment_status', ['pending', 'approved'])
      .maybeSingle();

    if (existingPayment?.verification_granted) {
      return NextResponse.json({ error: 'Ya tienes una verificación pagada' }, { status: 400 });
    }

    // Obtener precio de verificación desde app_settings
    const { data: settings } = await admin.from('app_settings').select('verification_price').eq('id', 1).single();
    const verificationPrice = Number(settings?.verification_price || 50);

    if (verificationPrice <= 0) {
      return NextResponse.json({ error: 'El precio de verificación no está configurado' }, { status: 500 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 });
    }

    // Crear registro de pago
    const externalReference = `verification_${userData.user.id}`;
    const { data: payment, error: paymentErr } = await admin
      .from('verification_payments')
      .insert({
        user_id: userData.user.id,
        amount: verificationPrice,
        payment_method: 'mercadopago',
        payment_status: 'pending',
        external_reference: externalReference,
        verification_granted: false,
      })
      .select('id')
      .single();

    if (paymentErr) {
      return NextResponse.json({ error: paymentErr.message }, { status: 400 });
    }

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
            id: `verification_${userData.user.id}`,
            title: 'Verificación de cuenta',
            description: 'Obtén la insignia de verificado en tu perfil',
            quantity: 1,
            unit_price: verificationPrice,
            currency_id: 'MXN',
          },
        ],
        external_reference: externalReference,
        notification_url: notificationUrl,
        back_urls: {
          success: `${origin}/dashboard/perfil?verification=success`,
          failure: `${origin}/dashboard/perfil?verification=failure`,
          pending: `${origin}/dashboard/perfil?verification=pending`,
        },
        metadata: {
          type: 'verification',
          user_id: userData.user.id,
          payment_id: (payment as any).id,
        },
      },
    });

    const preferenceId = (result as any)?.id;
    const initPoint = (result as any)?.init_point || (result as any)?.sandbox_init_point;

    if (!preferenceId || !initPoint) {
      return NextResponse.json({ error: 'Error al crear preferencia de MercadoPago' }, { status: 500 });
    }

    // Actualizar pago con preference_id
    await admin
      .from('verification_payments')
      .update({ mercado_pago_preference_id: String(preferenceId) })
      .eq('id', (payment as any).id);

    return NextResponse.json({
      ok: true,
      payment_id: (payment as any).id,
      preference_id: preferenceId,
      init_point: initPoint,
      amount: verificationPrice,
    });
  } catch (e: unknown) {
    console.error('[VERIFICATION CREATE PAYMENT] Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al crear pago' }, { status: 500 });
  }
}
