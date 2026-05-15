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
 * Crear pago para una campaña publicitaria
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

    const body = (await req.json().catch(() => ({}))) as { campaign_id: string };
    const { campaign_id } = body;

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id es requerido' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Verificar que la campaña existe y pertenece al usuario
    const { data: campaign, error: campaignErr } = await admin
      .from('ad_campaigns')
      .select('id, user_id, total_amount, title, payment_status')
      .eq('id', campaign_id)
      .single();

    if (campaignErr || !campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    if (campaign.user_id !== userData.user.id) {
      return NextResponse.json({ error: 'No tienes permiso para pagar esta campaña' }, { status: 403 });
    }

    if (campaign.payment_status === 'paid') {
      return NextResponse.json({ error: 'Esta campaña ya está pagada' }, { status: 400 });
    }

    const amount = Number(campaign.total_amount || 0);
    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) {
      return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 });
    }

    // Crear registro de pago
    const externalReference = `ad_campaign_${campaign_id}`;
    const { data: payment, error: paymentErr } = await admin
      .from('ad_payments')
      .insert({
        campaign_id,
        user_id: userData.user.id,
        amount,
        payment_method: 'mercadopago',
        payment_status: 'pending',
        external_reference: externalReference,
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
            id: campaign_id,
            title: `Publicidad: ${campaign.title}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'MXN',
          },
        ],
        external_reference: externalReference,
        notification_url: notificationUrl,
        back_urls: {
          success: `${origin}/dashboard/publicidad?payment=success`,
          failure: `${origin}/dashboard/publicidad?payment=failure`,
          pending: `${origin}/dashboard/publicidad?payment=pending`,
        },
        metadata: {
          type: 'ad_campaign',
          campaign_id,
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
      .from('ad_payments')
      .update({ mercado_pago_preference_id: String(preferenceId) })
      .eq('id', (payment as any).id);

    return NextResponse.json({
      ok: true,
      payment_id: (payment as any).id,
      preference_id: preferenceId,
      init_point: initPoint,
    });
  } catch (e: unknown) {
    console.error('[ADS CREATE PAYMENT] Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al crear pago' }, { status: 500 });
  }
}
