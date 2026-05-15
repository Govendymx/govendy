import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}
function startOfNextMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}
function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    // Permitir seleccionar mes y año desde query params
    const yearParam = req.nextUrl.searchParams.get('year');
    const monthParam = req.nextUrl.searchParams.get('month');
    
    let targetDate: Date;
    if (yearParam && monthParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10) - 1; // Los meses en JS son 0-indexed
      if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
        return NextResponse.json({ error: 'Año o mes inválido' }, { status: 400 });
      }
      targetDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    } else {
      targetDate = new Date();
    }

    const from = startOfMonth(targetDate).toISOString();
    const to = startOfNextMonth(targetDate).toISOString();

    // Settings (precios y comisión)
    const { data: settings } = await admin
      .from('app_settings')
      .select('featured_price, shipping_base, shipping_extended, payment_methods')
      .eq('id', 1)
      .maybeSingle();

    // Órdenes del mes (best-effort con columnas existentes)
    const missing_columns: string[] = [];

    const runOrdersQuery = async (cols: string) => {
      return await admin
        .from('orders')
        .select(cols)
        .gte('created_at', from)
        .lt('created_at', to)
        .limit(5000);
    };

    let ordersRes: any = await runOrdersQuery(
      'id,status,total,subtotal,shipping_fee,shipping_subsidy,commission_fee,created_at,buyer_id,seller_id',
    );
    if (ordersRes?.error) {
      const code = String((ordersRes.error as any)?.code || '');
      const msg = String((ordersRes.error as any)?.message || '').toLowerCase();
      // Si falta shipping_subsidy, reintentar sin esa columna
      if (code === '42703' && msg.includes('shipping_subsidy')) {
        missing_columns.push('orders.shipping_subsidy');
        ordersRes = await runOrdersQuery('id,status,total,subtotal,shipping_fee,commission_fee,created_at,buyer_id,seller_id');
      }
    }
    if (ordersRes?.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 400 });
    const orders = ordersRes.data;

    const rows = (orders as any[]) ?? [];
    const isCountable = (st: string) => !['cancelled', 'canceled', 'refunded'].includes(st);

    let gross = 0;
    let commission = 0;
    let shippingCollected = 0;
    let shippingSubsidy = 0;
    let ops = 0;

    const activeUsers = new Set<string>();

    for (const r of rows) {
      const st = String(r?.status || '').toLowerCase();
      if (!isCountable(st)) continue;
      ops += 1;
      gross += toNumber(r?.total);
      commission += toNumber(r?.commission_fee);
      shippingCollected += toNumber(r?.shipping_fee);
      // Si la columna no existe (BD vieja), asumimos 0
      shippingSubsidy += toNumber((r as any)?.shipping_subsidy);
      if (r?.buyer_id) activeUsers.add(String(r.buyer_id));
      if (r?.seller_id) activeUsers.add(String(r.seller_id));
    }

    // Promociones: estimado por "destacados" del mes (si existe is_featured)
    let featuredCount = 0;
    let featuredRevenue = 0;
    try {
      const { data: featured, error: fErr } = await admin
        .from('listings')
        .select('id,is_featured,created_at')
        .eq('is_featured', true)
        .gte('created_at', from)
        .lt('created_at', to)
        .limit(5000);
      if (!fErr) {
        featuredCount = ((featured as any[]) ?? []).length;
        featuredRevenue = featuredCount * toNumber((settings as any)?.featured_price ?? 25);
      }
    } catch {
      // noop
    }

    return NextResponse.json({
      ok: true,
      range: { from, to },
      totals: {
        operaciones_mes: ops,
        ventas_brutas_mes: gross,
        comision_mes: commission,
        envio_cobrado_mes: shippingCollected,
        envio_subsidiado_mes: shippingSubsidy,
        envio_neto_mes: shippingCollected - shippingSubsidy,
        promos_destacados_mes_est: featuredRevenue,
        destacados_publicados_mes: featuredCount,
        usuarias_activas_mes_est: activeUsers.size,
      },
      settings: {
        featured_price: toNumber((settings as any)?.featured_price ?? 25),
        shipping_base: toNumber((settings as any)?.shipping_base ?? 180),
        shipping_extended: toNumber((settings as any)?.shipping_extended ?? 200),
        mercadopago: (settings as any)?.payment_methods?.mercadopago ?? null,
      },
      notes: [
        'Las métricas de “destacados” son estimadas por publicaciones con is_featured=true en el mes.',
        'La cuenta base de MercadoPago debe configurarse en “Negocio”.',
        'Disputas/Chats requieren tablas extra (se habilitan con SQL).',
        ...(missing_columns.includes('orders.shipping_subsidy')
          ? ['Para ver “envío subsidiado”, ejecuta `supabase_shipping_features.sql` (agrega orders.shipping_subsidy).']
          : []),
      ],
      missing_columns,
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

