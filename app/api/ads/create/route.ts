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
 * Crear una nueva campaña publicitaria
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

    const body = (await req.json().catch(() => ({}))) as {
      title: string;
      description?: string;
      ad_type?: string;
      placement: string;
      image_url?: string;
      link_url?: string;
      start_date?: string;
      end_date?: string;
      price_per_day: number;
      total_days: number;
    };

    const { title, description, ad_type = 'banner', placement, image_url, link_url, start_date, end_date, price_per_day, total_days } = body;

    if (!title || !placement || !price_per_day || !total_days) {
      return NextResponse.json({ error: 'Faltan campos requeridos: title, placement, price_per_day, total_days' }, { status: 400 });
    }

    const totalAmount = Number(price_per_day) * Number(total_days);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'El monto total debe ser mayor a 0' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const startDate = start_date ? new Date(start_date) : null;
    const endDate = end_date ? new Date(end_date) : null;

    // Crear la campaña
    const { data: campaign, error: campaignErr } = await admin
      .from('ad_campaigns')
      .insert({
        user_id: userData.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        ad_type,
        placement,
        image_url: image_url?.trim() || null,
        link_url: link_url?.trim() || null,
        start_date: startDate?.toISOString() || null,
        end_date: endDate?.toISOString() || null,
        price_per_day: Number(price_per_day),
        total_days: Number(total_days),
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'pending',
      })
      .select('id, title, total_amount, payment_status')
      .single();

    if (campaignErr) {
      return NextResponse.json({ error: campaignErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, campaign });
  } catch (e: unknown) {
    console.error('[ADS CREATE] Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al crear campaña' }, { status: 500 });
  }
}
