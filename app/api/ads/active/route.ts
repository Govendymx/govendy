import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Obtener campañas publicitarias activas para mostrar
 * No requiere autenticación - es para mostrar publicidad en la app
 */
export async function GET(req: NextRequest) {
  try {
    const placement = req.nextUrl.searchParams.get('placement') || 'all';
    const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 10)));

    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    let query = admin
      .from('ad_campaigns')
      .select('id, title, description, ad_type, placement, image_url, link_url, priority')
      .eq('status', 'active')
      .eq('payment_status', 'paid')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (placement !== 'all') {
      query = query.or(`placement.eq.${placement},placement.eq.all`);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      console.error('[ADS ACTIVE] Error:', error);
      return NextResponse.json({ ok: true, campaigns: [] }); // Retornar vacío en caso de error
    }

    return NextResponse.json({ ok: true, campaigns: campaigns || [] });
  } catch (e: unknown) {
    console.error('[ADS ACTIVE] Error:', e);
    return NextResponse.json({ ok: true, campaigns: [] }); // Retornar vacío en caso de error
  }
}
