// Repository para acceso a datos de coupons

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Coupon } from '@/lib/types/domain.types';

export class CouponsRepository {
  /**
   * Buscar cupón por código
   */
  async findByCode(code: string): Promise<Coupon | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('coupons')
      .select('id,code,discount_type,discount_value,starts_at,ends_at,is_active,created_at')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando cupón: ${error.message}`);
    }

    return data as Coupon | null;
  }

  /**
   * Buscar listings asociados a un cupón
   */
  async findListingsByCouponId(couponId: string): Promise<string[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('coupon_listings')
      .select('listing_id')
      .eq('coupon_id', couponId);

    if (error) {
      throw new Error(`Error buscando listings del cupón: ${error.message}`);
    }

    return ((data || []) as any[])
      .map((x) => String(x?.listing_id || '').trim())
      .filter(Boolean);
  }
}
