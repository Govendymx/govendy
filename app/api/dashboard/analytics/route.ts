import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toNumber } from '@/lib/payouts/calc';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.effectiveUserId;
    const admin = auth.admin;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const since = sixMonthsAgo.toISOString();

    let listings: any[] = [];
    try {
      const lr: any = await admin
        .from('listings')
        .select('id,title,view_count,share_count,status,is_deleted')
        .eq('seller_id', userId)
        .eq('is_deleted', false)
        .order('view_count', { ascending: false })
        .limit(20);
      if (!lr?.error && Array.isArray(lr?.data)) listings = lr.data;
    } catch {
      try {
        const lr2: any = await admin
          .from('listings')
          .select('id,title,view_count,status,is_deleted')
          .eq('seller_id', userId)
          .eq('is_deleted', false)
          .order('view_count', { ascending: false })
          .limit(20);
        if (!lr2?.error && Array.isArray(lr2?.data)) listings = lr2.data;
      } catch {
        listings = [];
      }
    }

    const [ordersSellerRes, ordersBuyerRes] = await Promise.all([
      admin
        .from('orders')
        .select('id,created_at,total,status')
        .eq('seller_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
      admin
        .from('orders')
        .select('id,created_at,total,status')
        .eq('buyer_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
    ]);

    const ordersSeller = ((ordersSellerRes as any)?.data ?? []) as any[];
    const ordersBuyer = ((ordersBuyerRes as any)?.data ?? []) as any[];

    const cancelled = (s: string) => {
      const t = String(s || '').toLowerCase();
      return t === 'cancelled' || t === 'canceled' || t === 'refunded';
    };

    const listings_views = listings.slice(0, 10).map((r: any) => ({
      id: r.id,
      title: String(r?.title ?? '').trim() || 'Sin título',
      view_count: Math.max(0, Number(r?.view_count ?? 0) || 0),
      share_count: Math.max(0, Number(r?.share_count ?? 0) || 0),
    }));

    const total_views = listings.reduce((s, r) => s + Math.max(0, Number(r?.view_count ?? 0) || 0), 0);
    const total_listings = listings.length;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sales_last_30 = ordersSeller.filter((o) => !cancelled(String(o?.status ?? '')) && new Date(o.created_at) >= thirtyDaysAgo);
    const purchases_last_30 = ordersBuyer.filter((o) => !cancelled(String(o?.status ?? '')) && new Date(o.created_at) >= thirtyDaysAgo);

    type MonthPoint = { year: number; month: number; label: string; sales_count: number; sales_total: number; purchases_count: number; purchases_total: number };
    const map = new Map<string, MonthPoint>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(k, {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`,
        sales_count: 0,
        sales_total: 0,
        purchases_count: 0,
        purchases_total: 0,
      });
    }

    for (const o of ordersSeller) {
      if (cancelled(String(o?.status ?? ''))) continue;
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const p = map.get(k);
      if (p) {
        p.sales_count += 1;
        p.sales_total += toNumber(o?.total);
      }
    }
    for (const o of ordersBuyer) {
      if (cancelled(String(o?.status ?? ''))) continue;
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const p = map.get(k);
      if (p) {
        p.purchases_count += 1;
        p.purchases_total += toNumber(o?.total);
      }
    }

    const by_month = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        label: v.label,
        sales_count: v.sales_count,
        sales_total: Math.round(v.sales_total * 100) / 100,
        purchases_count: v.purchases_count,
        purchases_total: Math.round(v.purchases_total * 100) / 100,
      }));

    const performance = {
      total_views,
      total_listings,
      sales_last_30_days: sales_last_30.length,
      purchases_last_30_days: purchases_last_30.length,
      sales_total_30: Math.round(sales_last_30.reduce((s, o) => s + toNumber(o?.total), 0) * 100) / 100,
      purchases_total_30: Math.round(purchases_last_30.reduce((s, o) => s + toNumber(o?.total), 0) * 100) / 100,
    };

    const res = NextResponse.json({
      ok: true,
      listings_views,
      by_month,
      performance,
    });
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    return res;
  } catch (e: unknown) {
    console.error('[dashboard/analytics]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar analíticas' },
      { status: 500 },
    );
  }
}
