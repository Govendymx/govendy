// API Route refactorizada para aplicar cupón usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { CouponsRepository } from '@/lib/repositories/coupons.repository';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { CouponService } from '@/lib/services/coupons/coupon.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  code: string;
  cartItems: Array<{ listingId: string; quantity: number }>;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const code = String(body?.code || '').trim();
    const cartItems = Array.isArray(body?.cartItems) ? body.cartItems : [];

    // Inicializar servicios
    const couponsRepo = new CouponsRepository();
    const listingsRepo = new ListingsRepository();
    const couponService = new CouponService(couponsRepo, listingsRepo);

    // Aplicar cupón
    const result = await couponService.applyCoupon({
      code,
      cartItems,
    });

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      discountBySeller: result.discountBySeller,
      discount_by_seller: result.discountBySeller, // Compatibilidad
      coupon: result.coupon,
    });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
