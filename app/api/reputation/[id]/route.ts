import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

function toNumber(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function badgeForPercent(pct: number): 'plata' | 'gold' | 'platinum' | null {
  if (pct >= 91) return 'platinum';
  if (pct >= 71) return 'gold';
  if (pct >= 51) return 'plata';
  return null;
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

const CANCELLED = ['cancelled', 'canceled', 'refunded'];

async function getOperationsCount(db: any, userId: string): Promise<number> {
  try {
    const r: any = await db
      .from('orders')
      .select('id,status')
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
      .limit(5000);
    if (r?.error || !Array.isArray(r?.data)) return 0;
    const rows = (r.data as any[]) ?? [];
    const n = rows.filter((o: any) => !CANCELLED.includes(String(o?.status ?? '').toLowerCase())).length;
    return Math.max(0, n);
  } catch {
    return 0;
  }
}

function buildMinimalRep(userId: string, note: string) {
  return {
    ok: true,
    id: userId,
    name: 'Usuario',
    state: null as string | null,
    city: null as string | null,
    is_verified: false,
    operations_count: 0,
    seller: { avg_stars: null, count: 0, percent: 0, badge: null as string | null },
    buyer: { avg_stars: null, count: 0, percent: 100, badge: badgeForPercent(100) },
    overall: { avg_stars: null, count: 0, percent: 0, badge: null as string | null },
    note,
    reviews: { seller: [] as any[], buyer: [] as any[] },
  };
}

function userIdFromRequest(req: NextRequest): string {
  try {
    const path =
      (req as any)?.nextUrl?.pathname ||
      (typeof req?.url === 'string' && req.url.startsWith('http') ? new URL(req.url).pathname : (req?.url || '').replace(/^\?.*$/, ''));
    const segs = path.split('/').filter(Boolean);
    const last = segs[segs.length - 1];
    return typeof last === 'string' && /^[0-9a-f-]{36}$/i.test(last) ? last : '';
  } catch {
    return '';
  }
}

function json200(data: object) {
  const r = NextResponse.json(data, { status: 200 });
  r.headers.set('Cache-Control', 'no-store, max-age=0');
  return r;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const fallbackUserId = userIdFromRequest(req);
  const url = (req as any)?.nextUrl || (typeof req?.url === 'string' && req.url.startsWith('http') ? new URL(req.url) : null);
  const minimalOnly = url?.searchParams?.get('minimal') === '1';
  if (minimalOnly && fallbackUserId) {
    return json200(buildMinimalRep(fallbackUserId, 'minimal_query'));
  }
  try {
    return await handleReputation(req, ctx, fallbackUserId);
  } catch (e: unknown) {
    console.error('[reputation] GET top-level error:', e);
    if (fallbackUserId && fallbackUserId.length >= 10) {
      return json200(buildMinimalRep(fallbackUserId, 'top_level_fallback'));
    }
    return NextResponse.json({ error: 'user id is required' }, { status: 400 });
  }
}

async function handleReputation(req: NextRequest, ctx: { params: Promise<{ id: string }> }, fallbackUserId: string) {
  let userId = '';
  try {
    const p = await ctx.params;
    userId = String(p?.id ?? '').trim();
  } catch (e) {
    console.error('[reputation] params parse error:', e);
  }
  if (!userId || userId.length < 10) {
    userId = fallbackUserId || userIdFromRequest(req);
  }
  if (!userId || userId.length < 10) {
    return NextResponse.json({ error: 'user id is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) {
    return json200(buildMinimalRep(userId, 'env_missing'));
  }

  const token = getBearerToken(req);
  let db: any = null;
  try {
    db = supabaseAdmin();
  } catch {
    try {
      db = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
      });
    } catch (e2) {
      console.error('[reputation] createClient anon failed:', e2);
      return json200(buildMinimalRep(userId, 'db_init_failed'));
    }
  }

  try {

    // Nombre (best-effort)
    let name = 'Usuario';
    let state: string | null = null;
    let city: string | null = null;
    let isVerified = false;
    let isOfficial = false;
    let officialName: string | null = null;
    let officialBanner: string | null = null;
    let officialColor: string | null = null;
    let manualRep: number | null = null;
    let manualSales: number | null = null;
    let isWholesaler = false;
    let isManufacturer = false;

    let profileRes: any = await db
      .from('profiles')
      .select('full_name,reputation_score,rating_good_count,rating_total_count,state,city,is_verified,manual_reputation_score,manual_sales_count,is_official_store,official_store_name,official_store_banner_url,official_store_brand_color,is_wholesaler,is_manufacturer')
      .eq('id', userId)
      .maybeSingle();

    if (profileRes?.error) {
      const code = String((profileRes.error as any)?.code || '');
      const msg = String((profileRes.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
        // Fallback for missing columns
        profileRes = await db.from('profiles').select('full_name,state,city,is_verified').eq('id', userId).maybeSingle();
      }
    }
    const profileData = profileRes?.error ? null : (profileRes?.data as any);
    if (profileData) {
      name = String(profileData.full_name || '').trim() || name;
      state = profileData.state ? String(profileData.state).trim() || null : null;
      city = profileData.city ? String(profileData.city).trim() || null : null;
      isVerified = Boolean(profileData.is_verified ?? false);

      // Audit / Official Store fields
      isOfficial = Boolean(profileData.is_official_store ?? false);
      officialName = profileData.official_store_name || null;
      officialBanner = profileData.official_store_banner_url || null;
      officialColor = profileData.official_store_brand_color || null;
      manualRep = profileData.manual_reputation_score != null ? Number(profileData.manual_reputation_score) : null;
      manualSales = profileData.manual_sales_count != null ? Number(profileData.manual_sales_count) : null;
      isWholesaler = Boolean(profileData.is_wholesaler ?? false);
      isManufacturer = Boolean(profileData.is_manufacturer ?? false);
    }

    let operations_count = await getOperationsCount(db, userId);
    if (manualSales !== null && manualSales >= 0) {
      operations_count = manualSales;
    }

    // Preferir RPC (si ya corriste supabase_user_ratings.sql)
    const rpc: any = await db.rpc('get_user_reputation', { p_user: userId });
    let seller_percent = 0;
    let buyer_percent = 100;
    let overall_percent = 0;

    if (!rpc?.error && rpc?.data) {
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      seller_percent = clamp(toNumber((row as any)?.seller_percent), 0, 100);
      buyer_percent = clamp(toNumber((row as any)?.buyer_percent), 0, 100);
      overall_percent = clamp(toNumber((row as any)?.overall_percent), 0, 100);

      // Apply manual reputation override
      if (manualRep !== null) {
        const overridden = clamp(manualRep, 0, 100);
        seller_percent = overridden;
        overall_percent = overridden;
      }

      // Comentarios (best-effort; requiere ejecutar `supabase_user_reviews_public.sql`)
      let seller_reviews: any[] = [];
      let buyer_reviews: any[] = [];
      try {
        const s: any = await db.rpc('get_user_reviews_public', { p_user: userId, p_direction: 'buyer_to_seller', p_limit: 10 });
        if (!s?.error && Array.isArray(s.data)) seller_reviews = s.data as any[];
      } catch {
        // noop
      }
      try {
        const b: any = await db.rpc('get_user_reviews_public', { p_user: userId, p_direction: 'seller_to_buyer', p_limit: 10 });
        if (!b?.error && Array.isArray(b.data)) buyer_reviews = b.data as any[];
      } catch {
        // noop
      }

      // Estadísticas de órdenes como vendedor
      let sellerStats: any = {
        total_orders: 0,
        cancelled_orders: 0,
        cancellation_rate: 0,
        fast_shipping_count: 0,
        delayed_shipping_count: 0,
        average_shipping_days: null,
        has_problems: false,
        disputes_count: 0,
      };
      try {
        const ordersRes: any = await db
          .from('orders')
          .select('id,status,created_at,shipped_at,label_downloaded_at,shipping_label_uploaded_at')
          .eq('seller_id', userId)
          .limit(1000);
        if (!ordersRes?.error && Array.isArray(ordersRes.data)) {
          const orders = ordersRes.data as any[];
          sellerStats.total_orders = orders.length;
          sellerStats.cancelled_orders = orders.filter((o) => {
            const st = String(o?.status || '').toLowerCase();
            return ['cancelled', 'canceled', 'refunded'].includes(st);
          }).length;
          sellerStats.cancellation_rate = sellerStats.total_orders > 0
            ? Math.round((sellerStats.cancelled_orders / sellerStats.total_orders) * 100)
            : 0;

          // Calcular velocidad de envío (tiempo entre que se sube la guía y se marca como enviado)
          // Usar shipping_label_uploaded_at o label_downloaded_at como punto de inicio
          const shippedOrders = orders.filter((o) => {
            const st = String(o?.status || '').toLowerCase();
            const hasShipped = ['shipped', 'delivered', 'completed'].includes(st) && o?.shipped_at;
            const hasLabelStart = o?.shipping_label_uploaded_at || o?.label_downloaded_at;
            return hasShipped && hasLabelStart;
          });
          if (shippedOrders.length > 0) {
            const shippingDays: number[] = [];
            for (const o of shippedOrders) {
              const labelStart = o?.shipping_label_uploaded_at || o?.label_downloaded_at;
              const shipped = new Date(o.shipped_at).getTime();
              const start = new Date(labelStart).getTime();
              const days = (shipped - start) / (1000 * 60 * 60 * 24);
              if (days >= 0 && days <= 10) {
                shippingDays.push(days);
                if (days <= 2) sellerStats.fast_shipping_count++;
                if (days > 3) sellerStats.delayed_shipping_count++;
              }
            }
            if (shippingDays.length > 0) {
              sellerStats.average_shipping_days = Math.round((shippingDays.reduce((a, b) => a + b, 0) / shippingDays.length) * 10) / 10;
            }
          }

          // Verificar disputas (best-effort)
          try {
            const orderIds = orders.map((o) => String(o?.id || '').trim()).filter(Boolean);
            if (orderIds.length > 0) {
              const disputesRes: any = await db
                .from('disputes')
                .select('id')
                .in('order_id', orderIds.slice(0, 500))
                .limit(100);
              if (!disputesRes?.error && Array.isArray(disputesRes.data)) {
                sellerStats.disputes_count = disputesRes.data.length;
              }
            }
          } catch {
            // Ignorar errores de disputas
          }

          sellerStats.has_problems = sellerStats.cancellation_rate > 20 || sellerStats.delayed_shipping_count > sellerStats.fast_shipping_count || sellerStats.disputes_count > 0;
        }
      } catch (e) {
        // Ignorar errores de estadísticas
        console.error('Error calculando estadísticas de vendedor:', e);
      }

      return json200({
        ok: true,
        id: userId,
        name: officialName || name,
        state,
        city,
        is_verified: isVerified,
        is_official_store: isOfficial,
        official_store_name: officialName,
        official_store_banner_url: officialBanner,
        official_store_brand_color: officialColor,
        is_wholesaler: isWholesaler,
        is_manufacturer: isManufacturer,
        operations_count,
        seller: {
          avg_stars: (row as any)?.seller_avg_stars ?? null,
          count: toNumber((row as any)?.seller_count),
          percent: seller_percent,
          badge: (row as any)?.seller_badge ?? badgeForPercent(seller_percent),
        },
        buyer: {
          avg_stars: (row as any)?.buyer_avg_stars ?? null,
          count: toNumber((row as any)?.buyer_count),
          percent: buyer_percent,
          badge: (row as any)?.buyer_badge ?? badgeForPercent(buyer_percent),
        },
        overall: {
          avg_stars: (row as any)?.overall_avg_stars ?? null,
          count: toNumber((row as any)?.overall_count),
          percent: overall_percent,
          badge: (row as any)?.overall_badge ?? badgeForPercent(overall_percent),
        },
        reviews: {
          seller: seller_reviews,
          buyer: buyer_reviews,
        },
        stats: sellerStats,
      });
    }

    // Fallback legacy: perfiles con rating_good_count/rating_total_count
    const total = toNumber(profileData?.rating_total_count);
    const good = toNumber(profileData?.rating_good_count);
    const rep = toNumber(profileData?.reputation_score);
    const pct = total > 0 ? clamp(Math.round((good / total) * 100), 0, 100) : clamp(Math.round(rep || 100), 0, 100);

    const resp = NextResponse.json({
      ok: true,
      id: userId,
      name,
      state,
      city,
      is_verified: isVerified,
      operations_count,
      seller: { avg_stars: null, count: total, percent: pct, badge: badgeForPercent(pct) },
      buyer: { avg_stars: null, count: 0, percent: 100, badge: badgeForPercent(100) },
      overall: { avg_stars: null, count: total, percent: pct, badge: badgeForPercent(pct) },
      note: 'fallback_legacy_profiles_reputation',
      reviews: { seller: [], buyer: [] },
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
  catch (e: unknown) {
    console.error('[reputation] GET error:', e);
    return json200(buildMinimalRep(userId, 'error_fallback'));
  }
}


