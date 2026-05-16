// API Route refactorizada para crear checkout usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { OrderItemsRepository } from '@/lib/repositories/order-items.repository';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { CheckoutService } from '@/lib/services/checkout/checkout.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  cartItems: Array<{ listingId: string; quantity: number; selected_size?: string | null; selected_color?: string | null }>;
  payment_method: 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo' | 'pocketcash' | 'direct_contact';
  coupon_code?: string | null;
  shipping_option_id?: string | null;
  // T1 Premium shipping fields
  t1_shipping_cost?: number | null;
  t1_carrier_id?: string | null;
  t1_carrier_name?: string | null;
  t1_carrier_token?: string | null;
  t1_per_seller?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: buyerId } = await requireAuth(req);

    // Obtener token para cupones
    const auth = req.headers.get('authorization') || '';
    const tokenMatch = auth.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch?.[1] ?? '';

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const cartItemsRaw = Array.isArray(body.cartItems) ? body.cartItems : [];
    const cartItems = cartItemsRaw.map((c) => ({
      listingId: String((c as any)?.listingId || '').trim(),
      quantity: Math.max(1, Number((c as any)?.quantity ?? 1)),
      selected_size: String((c as any)?.selected_size || '').trim() || null,
      selected_color: String((c as any)?.selected_color || '').trim() || null,
    })).filter((c) => c.listingId);

    const paymentMethod = String(body?.payment_method || '').trim() as Body['payment_method'];
    const couponCode = String(body?.coupon_code || '').trim().toUpperCase() || null;
    const shippingOptionId = String(body?.shipping_option_id || '').trim() || null;
    // T1 Premium shipping data
    const t1ShippingCost = body?.t1_shipping_cost != null ? Number(body.t1_shipping_cost) : null;
    const t1CarrierName = body?.t1_carrier_name ? String(body.t1_carrier_name).trim() : null;
    const t1CarrierId = body?.t1_carrier_id ? String(body.t1_carrier_id).trim() : null;
    const t1CarrierToken = body?.t1_carrier_token ? String(body.t1_carrier_token).trim() : null;
    const t1PerSeller = body?.t1_per_seller ? String(body.t1_per_seller).trim() : null;

    // Extract IP for fraud detection
    let ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    if (ipAddress.includes(',')) ipAddress = ipAddress.split(',')[0].trim();

    // Inicializar servicios
    const ordersRepo = new OrdersRepository();
    const orderItemsRepo = new OrderItemsRepository();
    const listingsRepo = new ListingsRepository();
    const notificationsRepo = new NotificationsRepository();
    const checkoutService = new CheckoutService(ordersRepo, orderItemsRepo, listingsRepo, notificationsRepo);

    // Crear checkout
    const result = await checkoutService.createCheckout({
      buyerId,
      cartItems,
      paymentMethod,
      couponCode,
      shippingOptionId,
      accessToken,
      origin: req.nextUrl.origin,
      ipAddress,
      t1ShippingCost: t1ShippingCost && Number.isFinite(t1ShippingCost) && t1ShippingCost > 0 ? t1ShippingCost : undefined,
      t1CarrierName: t1CarrierName || undefined,
      t1CarrierId: t1CarrierId || undefined,
      t1CarrierToken: t1CarrierToken || undefined,
      t1PerSeller: t1PerSeller || undefined,
    });

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      orderIds: result.orderIds,
      amount: result.amount,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    const resp = NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
