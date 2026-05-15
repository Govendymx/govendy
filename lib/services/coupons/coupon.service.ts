// Servicio de lógica de negocio para coupons

import { CouponsRepository } from '@/lib/repositories/coupons.repository';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { Coupon, ApplyCouponParams, CouponDiscountResult } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError } from '@/lib/utils/errors';
import { validateRequired } from '@/lib/utils/validation';
import { supabaseAdmin } from '@/lib/supabase/admin';

export class CouponService {
  constructor(
    private couponsRepo: CouponsRepository,
    private listingsRepo: ListingsRepository
  ) { }

  /**
   * Aplicar cupón a items del carrito
   */
  async applyCoupon(params: ApplyCouponParams): Promise<CouponDiscountResult> {
    const { code, cartItems } = params;

    // Validaciones
    validateRequired(code, 'code');
    validateRequired(cartItems, 'cartItems');

    const couponCode = code.trim().toUpperCase();
    if (!couponCode) {
      throw new ValidationError('code is required');
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw new ValidationError('cartItems is required');
    }

    // Buscar cupón
    const coupon = await this.couponsRepo.findByCode(couponCode);
    if (!coupon) {
      throw new NotFoundError('Cupón', couponCode);
    }

    // Validar fechas
    const now = Date.now();
    const starts = coupon.starts_at ? Date.parse(coupon.starts_at) : null;
    const ends = coupon.ends_at ? Date.parse(coupon.ends_at) : null;

    if (starts && now < starts) {
      throw new ValidationError('Este cupón aún no inicia');
    }

    if (ends && now > ends) {
      throw new ValidationError('Este cupón ya expiró');
    }

    // Obtener listings elegibles
    const eligibleListingIds = await this.couponsRepo.findListingsByCouponId(coupon.id);
    if (eligibleListingIds.length === 0) {
      throw new ValidationError('Este cupón no tiene publicaciones asociadas');
    }

    const eligibleSet = new Set(eligibleListingIds);

    // Obtener listings del carrito
    const listingIds = Array.from(new Set(cartItems.map((c) => c.listingId).filter(Boolean)));
    if (listingIds.length === 0) {
      throw new ValidationError('Carrito inválido');
    }

    const admin = supabaseAdmin();
    let listingsRes: any = await admin
      .from('listings')
      .select('id,price,seller_id,sale_type')
      .in('id', listingIds);

    // Fallback si seller_id no existe
    if (listingsRes?.error) {
      const code = String((listingsRes.error as any)?.code || '');
      const msg = String((listingsRes.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        listingsRes = await admin.from('listings').select('id,price,user_id,sale_type').in('id', listingIds);
      }
    }

    if (listingsRes?.error) {
      throw new Error(`Error obteniendo listings: ${listingsRes.error.message}`);
    }

    const listings = ((listingsRes?.data as any[]) ?? []) as any[];

    // Bloquear cupones en subastas
    const auctionListings = listings.filter((l: any) => l.sale_type === 'auction');
    const nonAuctionListings = listings.filter((l: any) => l.sale_type !== 'auction');

    // Si TODOS los items son subastas, rechazar el cupón
    if (nonAuctionListings.length === 0 && auctionListings.length > 0) {
      throw new ValidationError('Los cupones no aplican en subastas. Los artículos de subasta están excluidos de descuentos por cupón.');
    }

    const priceById: Record<string, number> = {};
    const sellerById: Record<string, string> = {};
    const auctionIds = new Set(auctionListings.map((l: any) => String(l.id)));

    for (const row of listings) {
      const id = String(row.id || '').trim();
      if (!id) continue;
      const price = typeof row.price === 'number' ? row.price : Number(row.price ?? 0);
      priceById[id] = Number.isFinite(price) ? price : 0;
      sellerById[id] = String(row.seller_id ?? row.user_id ?? '').trim();
    }

    // Calcular descuento por vendedor
    const discountBySeller: Record<string, number> = {};

    for (const item of cartItems) {
      const listingId = String(item.listingId || '').trim();
      if (!listingId || !eligibleSet.has(listingId)) continue;
      // Excluir subastas de descuentos por cupón
      if (auctionIds.has(listingId)) continue;

      const sellerId = sellerById[listingId];
      if (!sellerId) continue;

      const unitPrice = priceById[listingId] || 0;
      const quantity = Math.max(1, Number(item.quantity || 1));
      const itemSubtotal = unitPrice * quantity;

      if (coupon.discount_type === 'percent') {
        const discount = (itemSubtotal * coupon.discount_value) / 100;
        // Cap discount at itemSubtotal to prevent negative math
        const finalDiscount = Math.min(discount, itemSubtotal);
        discountBySeller[sellerId] = (discountBySeller[sellerId] || 0) + finalDiscount;
      } else {
        // fixed: distribuir el descuento fijo proporcionalmente
        const totalCart = cartItems.reduce((sum, ci) => {
          const lid = String(ci.listingId || '').trim();
          if (!lid || !eligibleSet.has(lid)) return sum;
          const price = priceById[lid] || 0;
          const qty = Math.max(1, Number(ci.quantity || 1));
          return sum + price * qty;
        }, 0);

        if (totalCart > 0) {
          const proportion = itemSubtotal / totalCart;
          const discount = coupon.discount_value * proportion;
          // Cap discount at itemSubtotal
          const finalDiscount = Math.min(discount, itemSubtotal);
          discountBySeller[sellerId] = (discountBySeller[sellerId] || 0) + finalDiscount;
        }
      }
    }

    // Redondear descuentos
    for (const sellerId in discountBySeller) {
      discountBySeller[sellerId] = Math.round(discountBySeller[sellerId] * 100) / 100;
    }

    return {
      discountBySeller,
      coupon,
    };
  }
}
