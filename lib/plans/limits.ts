import { SupabaseClient } from '@supabase/supabase-js';

export type PlanType = 'basic' | 'pro' | 'platinum';

export const PLAN_LIMITS = {
  basic: {
    listings: 50,
    commission_percent: 23,
    shipping_included: 0,
    auctions: 15,
    coupons: 25,
    featured: 3,
    allow_personal_delivery: false,
    allow_shipping_by_seller: false,
    allow_live: false,
    live_duration_mins: 0,
    live_free_mins_daily: 0,
    withdrawal_hours: 168, // 7 days (Semanales)
  },
  pro: {
    listings: Infinity,
    commission_percent: 18,
    featured: 25,
    shipping_included: 0,
    auctions: Infinity,
    coupons: Infinity,
    allow_personal_delivery: false,
    allow_shipping_by_seller: true,
    allow_live: true,   // habilitado pero requiere saldo de horas extra
    live_duration_mins: 0,
    live_free_mins_daily: 0, // Pro no tiene horas gratis
    withdrawal_hours: 48,
  },
  platinum: {
    listings: Infinity,
    commission_percent: 18,
    featured: Infinity,
    shipping_included: 0,
    auctions: Infinity,
    coupons: Infinity,
    allow_personal_delivery: true,
    allow_shipping_by_seller: true,
    allow_live: true,
    live_duration_mins: 120, // legacy — ahora gestionado por live_free_mins_daily
    live_free_mins_daily: 120, // 2 horas gratis diarias, no acumulables
    withdrawal_hours: 24,
  }
};

export async function getCommissions(supabase: SupabaseClient): Promise<{ basic: number; pro: number; platinum: number }> {
  try {
    const { data } = await supabase.from('app_settings').select('commission_basic_percent, commission_pro_percent, commission_platinum_percent').single();
    return {
      basic: Number(data?.commission_basic_percent ?? PLAN_LIMITS.basic.commission_percent),
      pro: Number(data?.commission_pro_percent ?? PLAN_LIMITS.pro.commission_percent),
      platinum: Number(data?.commission_platinum_percent ?? PLAN_LIMITS.platinum.commission_percent),
    };
  } catch (err) {
    console.error('Error fetching commissions:', err);
    return {
      basic: PLAN_LIMITS.basic.commission_percent,
      pro: PLAN_LIMITS.pro.commission_percent,
      platinum: PLAN_LIMITS.platinum.commission_percent,
    };
  }
}

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<PlanType> {
  const { data } = await supabase
    .from('profiles')
    .select('plan_type, pro_subscription_end')
    .eq('id', userId)
    .single();

  const p = data?.plan_type;

  if (p === 'platinum' || p === 'pro') {
    // Check validity
    if (data?.pro_subscription_end) {
      const endDate = new Date(data.pro_subscription_end);
      const now = new Date();
      if (now > endDate) {
        return 'basic'; // Expired
      }
    }
    return p as PlanType;
  }
  return 'basic';
}

export async function checkLimit(
  supabase: SupabaseClient,
  userId: string,
  feature: 'auctions' | 'listings' | 'featured' | 'coupons' | 'shipping_included'
): Promise<{ allowed: boolean; usage: number; limit: number; plan: PlanType }> {
  const plan = await getPlan(supabase, userId);
  const limits = PLAN_LIMITS[plan];

  const limit = (limits as any)[feature] ?? 0;

  if (limit === Infinity) {
    return { allowed: true, usage: 0, limit, plan };
  }

  // Get start of current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let count = 0;

  if (feature === 'listings') {
    const { count: activeCount } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'active')
      .neq('sale_type', 'auction');

    count = activeCount || 0;

  } else if (feature === 'auctions') {
    const { count: activeCount } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'active')
      .eq('sale_type', 'auction');
    count = activeCount || 0;

  } else if (feature === 'coupons') {
    const { count: c } = await supabase
      .from('coupons')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .gte('created_at', startOfMonth);
    count = c || 0;
  } else if (feature === 'featured') {
    const { count: c } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('status', 'active')
      .eq('is_featured', true);
    count = c || 0;
  }

  return { allowed: count < limit, usage: count, limit, plan };
}
