import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/admin/activity-logger';
import { mergeFeatureFlags } from '@/lib/admin/feature-flags';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type Body = {
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
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
    const weightKg = Number(body.weight_kg || 0);
    const lengthCm = Number(body.length_cm || 0);
    const widthCm = Number(body.width_cm || 0);
    const heightCm = Number(body.height_cm || 0);

    if (weightKg <= 0 || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
      return NextResponse.json({ error: 'Todos los valores deben ser mayores a 0.' }, { status: 400 });
    }

    // Calcular peso volumétrico: ALTO X ANCHO X LARGO / 5000
    const volumetricWeight = (heightCm * widthCm * lengthCm) / 5000;

    // Usar el mayor entre peso físico y peso volumétrico
    const finalWeight = Math.max(weightKg, volumetricWeight);

    // Obtener configuración de Estafeta
    const admin = supabaseAdmin();
    const { data: settingsRes, error: settingsErr } = await admin
      .from('app_settings')
      .select('estafeta_config, feature_flags')
      .eq('id', 1)
      .maybeSingle();

    if (settingsErr) {
      return NextResponse.json({ error: 'No se pudo cargar la configuración.' }, { status: 500 });
    }

    const featureFlags = mergeFeatureFlags(settingsRes?.feature_flags);
    if (!featureFlags.gopocket_shipping) {
      await logActivity({
        event_type: 'quote_failed_disabled',
        entity_type: 'system',
        entity_id: 'gopocket_shipping',
        user_id: userId,
        severity: 'warning',
        details: { message: 'GoVendy shipping disabled by admin' },
      });
      return NextResponse.json(
        { ok: false, error: 'Los envíos GoVendy están desactivados por el administrador.' },
        { status: 403 },
      );
    }

    const DEFAULT_WEIGHT_RANGES = [
      { max_weight_kg: 1, price: 175 },
      { max_weight_kg: 5, price: 195 },
      { max_weight_kg: 10, price: 235 },
      { max_weight_kg: 15, price: 255 },
      { max_weight_kg: 20, price: 275 },
      { max_weight_kg: 25, price: 300 },
      { max_weight_kg: 30, price: 325 },
      { max_weight_kg: 35, price: 340 },
      { max_weight_kg: 40, price: 355 },
      { max_weight_kg: 45, price: 385 },
      { max_weight_kg: 50, price: 415 },
      { max_weight_kg: 55, price: 435 },
      { max_weight_kg: 60, price: 455 },
    ];

    const estafetaConfig = (settingsRes?.estafeta_config as any) || {
      enabled: true,
      weight_ranges: DEFAULT_WEIGHT_RANGES,
    };

    // Fallback if weight_ranges is empty or has too few entries (safety check)
    if (!estafetaConfig.weight_ranges || estafetaConfig.weight_ranges.length < 5) {
      estafetaConfig.weight_ranges = DEFAULT_WEIGHT_RANGES;
    }

    if (!estafetaConfig.enabled) {
      await logActivity({
        event_type: 'quote_failed_disabled',
        entity_type: 'system',
        entity_id: 'estafeta_config',
        user_id: userId,
        severity: 'warning',
        details: { message: 'Service disabled' }
      });
      return NextResponse.json({ error: 'El servicio de cotización Estafeta está temporalmente deshabilitado.' }, { status: 400 });
    }

    const weightRanges = Array.isArray(estafetaConfig.weight_ranges) ? estafetaConfig.weight_ranges : [];
    if (weightRanges.length === 0) {
      return NextResponse.json({ error: 'No hay rangos de peso configurados.' }, { status: 500 });
    }

    // Ordenar rangos por peso máximo (ascendente)
    const sortedRanges = [...weightRanges].sort((a, b) => Number(a.max_weight_kg || 0) - Number(b.max_weight_kg || 0));
    const minWeight = 0.01;
    const maxWeight = sortedRanges[sortedRanges.length - 1]?.max_weight_kg || 60;

    if (finalWeight < minWeight || finalWeight > maxWeight) {
      return NextResponse.json(
        { error: `El peso calculado (${finalWeight.toFixed(2)} kg) debe estar entre ${minWeight} kg y ${maxWeight} kg.` },
        { status: 400 },
      );
    }

    // Buscar el rango correspondiente al peso final (mayor entre físico y volumétrico)
    // Los rangos funcionan así: hasta max_weight_kg inclusive, se aplica ese precio
    let cost = 0;
    let foundRange = false;

    for (const range of sortedRanges) {
      const maxWeightRange = Number(range.max_weight_kg || 0);
      if (finalWeight <= maxWeightRange) {
        cost = Number(range.price || 0);
        foundRange = true;
        break;
      }
    }

    // Si no se encontró rango (peso excede el máximo), usar el último rango
    if (!foundRange && sortedRanges.length > 0) {
      const lastRange = sortedRanges[sortedRanges.length - 1];
      cost = Number(lastRange.price || 0);
    }

    if (cost <= 0) {
      return NextResponse.json({ error: 'No se pudo calcular el costo. Verifica la configuración de rangos.' }, { status: 500 });
    }

    // Crear cotización en la base de datos
    // Guardar el peso final (mayor entre físico y volumétrico) en weight_kg
    const { data: quoteData, error: quoteErr } = await admin
      .from('estafeta_quotes')
      .insert({
        user_id: userId,
        weight_kg: finalWeight, // Guardar el peso final (mayor entre físico y volumétrico)
        length_cm: lengthCm,
        width_cm: widthCm,
        height_cm: heightCm,
        calculated_cost: cost,
        status: 'quote',
        sender_name: '',
        sender_phone: '',
        sender_email: '',
        sender_address: '',
        sender_between_streets: '',
        sender_references: '',
        sender_city: '',
        sender_state: '',
        sender_postal_code: '',
        recipient_name: '',
        recipient_phone: '',
        recipient_email: '',
        recipient_address: '',
        recipient_between_streets: '',
        recipient_references: '',
        recipient_city: '',
        recipient_state: '',
        recipient_postal_code: '',
      })
      .select('id')
      .single();

    if (quoteErr) {
      console.error('[ESTAFETA CALCULATE] Error al crear cotización:', quoteErr);
      await logActivity({
        event_type: 'quote_creation_failed',
        entity_type: 'estafeta_quote',
        entity_id: 'new',
        user_id: userId,
        severity: 'error',
        details: { error: quoteErr }
      });
      return NextResponse.json({ error: 'No se pudo crear la cotización.' }, { status: 500 });
    }

    await logActivity({
      event_type: 'quote_created',
      entity_type: 'estafeta_quote',
      entity_id: quoteData.id,
      user_id: userId,
      severity: 'info',
      details: {
        cost,
        final_weight: finalWeight,
        dimensions: { l: lengthCm, w: widthCm, h: heightCm }
      }
    });

    const resp = NextResponse.json({
      ok: true,
      cost: Math.round(cost * 100) / 100, // Redondear a 2 decimales
      quote_id: quoteData.id,
      physical_weight: weightKg,
      volumetric_weight: Math.round(volumetricWeight * 100) / 100,
      final_weight: Math.round(finalWeight * 100) / 100,
      weight_used: finalWeight === volumetricWeight ? 'volumetric' : 'physical',
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    // Log error in activity feed
    try {
      await logActivity({
        event_type: 'quote_failed_error',
        entity_type: 'estafeta_quote',
        entity_id: 'new',
        severity: 'error',
        details: {
          error: e instanceof Error ? e.message : 'Unexpected error',
          stack: e instanceof Error ? e.stack : undefined
        }
      });
    } catch (logErr) {
      console.error('Failed to log activity:', logErr);
    }
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
