// Servicio de lógica de negocio para checkout

import { PLAN_LIMITS, getCommissions } from '@/lib/plans/limits';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { OrderItemsRepository } from '@/lib/repositories/order-items.repository';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { Order, PaymentMethod } from '@/lib/types/domain.types';
import { calculateUnitPrice } from '@/lib/utils/pricing';
import { ValidationError, ForbiddenError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { getUserAdminState, isRestricted } from '@/lib/userAdminState';
import { applyShippingMarkup } from '@/lib/shippingMarkup';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calcEffectiveWeight, calcWeightBasedCost, buildShippingSettings } from '@/lib/shipping/shipping-calculator';
import { fraudDetectionService } from '@/lib/security/fraud-detection';
import { calculateWithholding, parseTaxSettings } from '@/lib/tax/withholding';
import type { ItemCondition, TaxSettings } from '@/lib/tax/withholding';
import { mergeFeatureFlags } from '@/lib/admin/feature-flags';

function isFilled(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

async function fetchCouponDiscountBySeller(params: {
  origin: string;
  token: string;
  code: string;
  cartItems: Array<{ listingId: string; quantity: number }>;
}): Promise<Record<string, number>> {
  const res = await fetch(`${params.origin}/api/coupons/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${params.token}` },
    body: JSON.stringify({ code: params.code, cartItems: params.cartItems }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(json?.error || 'No se pudo aplicar el cupón.');
  }

  const raw = (json?.discountBySeller ?? json?.discount_by_seller ?? {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [sid, v] of Object.entries(raw || {})) {
    const n = typeof v === 'number' ? v : Number(v ?? 0);
    out[sid] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export interface CartItem {
  listingId: string;
  quantity: number;
  selected_size?: string | null;
  selected_color?: string | null;
}

export interface CreateCheckoutParams {
  buyerId: string;
  cartItems: CartItem[];
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  shippingOptionId?: string | null;
  accessToken: string;
  origin: string;
  ipAddress?: string;
  // T1 Premium shipping
  t1ShippingCost?: number;
  t1CarrierName?: string;
  t1CarrierId?: string;
  t1CarrierToken?: string;
  t1PerSeller?: string;
}

export interface CheckoutResult {
  orderIds: string[];
  amount: number;
}

export class CheckoutService {
  private notificationService?: NotificationService;

  constructor(
    private ordersRepo: OrdersRepository,
    private orderItemsRepo: OrderItemsRepository,
    private listingsRepo: ListingsRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Crear checkout (órdenes + items)
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const { buyerId, cartItems, paymentMethod, couponCode, shippingOptionId, accessToken, origin, ipAddress, t1ShippingCost, t1CarrierName, t1CarrierId, t1CarrierToken, t1PerSeller } = params;

    // Validaciones básicas
    validateRequired(buyerId, 'buyerId');
    validateRequired(cartItems, 'cartItems');
    validateRequired(paymentMethod, 'paymentMethod');

    if (!validateUUID(buyerId)) {
      throw new ValidationError('buyerId debe ser un UUID válido');
    }

    if (cartItems.length === 0) {
      throw new ValidationError('El carrito está vacío');
    }

    const validPaymentMethods: PaymentMethod[] = ['mercadopago', 'bank_transfer', 'bank_deposit', 'oxxo', 'pocketcash', 'direct_contact'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      throw new ValidationError('payment_method inválido');
    }

    const admin = supabaseAdmin();

    // Validar estado del comprador
    const buyerState = await getUserAdminState(admin, buyerId);
    if (isRestricted(buyerState)) {
      throw new ForbiddenError(
        buyerState?.status === 'banned'
          ? 'Tu cuenta está bloqueada. No puedes comprar ni vender.'
          : 'Tu cuenta está suspendida. No puedes comprar ni vender hasta que finalice la suspensión.'
      );
    }

    // Obtener configuración
    const { data: settingsRow } = await admin
      .from('app_settings')
      .select('shipping_base, shipping_markup_percent, shipping_markup_fixed, estafeta_config, tax_withholding_enabled, tax_isr_rate, tax_isr_no_rfc_rate, tax_iva_rate, feature_flags')
      .eq('id', 1)
      .maybeSingle();
    const taxSettings = parseTaxSettings(settingsRow);
    const featureFlags = mergeFeatureFlags((settingsRow as any)?.feature_flags);
    const shipping_base = Number((settingsRow as any)?.shipping_base ?? 180);
    const shipping_markup_pct = Number((settingsRow as any)?.shipping_markup_percent ?? 0) || 0;
    const shipping_markup_fixed = Number((settingsRow as any)?.shipping_markup_fixed ?? 0) || 0;
    const estafeta_config = ((settingsRow as any)?.estafeta_config as any) || {
      enabled: true,
      weight_ranges: [
        { max_weight_kg: 1, price: 175 },
        { max_weight_kg: 5, price: 195 },
        { max_weight_kg: 10, price: 235 },
        { max_weight_kg: 15, price: 255 },
        { max_weight_kg: 20, price: 275 },
        { max_weight_kg: 25, price: 300 },
        { max_weight_kg: 30, price: 325 },
        { max_weight_kg: 35, price: 340 },
        { max_weight_kg: 40, price: 355 },
        { max_weight_kg: 45, price: 385 },
        { max_weight_kg: 50, price: 415 },
        { max_weight_kg: 55, price: 435 },
        { max_weight_kg: 60, price: 455 },
      ],
    };

    // Obtener opción de envío
    let selectedShippingOption: { id: string; cost: number } | null = null;
    const isT1Shipping = shippingOptionId === 't1' && t1ShippingCost && t1ShippingCost > 0;
    if (isT1Shipping) {
      // T1 Premium: use the cost from the T1 quote directly
      selectedShippingOption = {
        id: 't1',
        cost: t1ShippingCost,
      };
      console.log('[CheckoutService] T1 Premium shipping detected:', { cost: t1ShippingCost, carrier: t1CarrierName });
    } else if (shippingOptionId && shippingOptionId !== 't1') {
      const { data: shippingOption } = await admin
        .from('shipping_options')
        .select('id, cost')
        .eq('id', shippingOptionId)
        .eq('is_active', true)
        .maybeSingle();
      if (shippingOption) {
        selectedShippingOption = {
          id: shippingOption.id,
          cost: Number(shippingOption.cost) || 0,
        };
      }
    }

    // Obtener perfil para dirección de envío
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, phone, address_street, ext_number, int_number, neighborhood, zip_code, state, city, references, cross_streets')
      .eq('id', buyerId)
      .maybeSingle();

    const shippingFullName = String((profile as any)?.full_name ?? '').trim();
    const shippingPhone = String((profile as any)?.phone ?? '').trim();
    const shippingAddress = {
      address_street: String((profile as any)?.address_street ?? ''),
      ext_number: String((profile as any)?.ext_number ?? ''),
      int_number: String((profile as any)?.int_number ?? ''),
      neighborhood: String((profile as any)?.neighborhood ?? ''),
      zip_code: String((profile as any)?.zip_code ?? ''),
      state: String((profile as any)?.state ?? ''),
      city: String((profile as any)?.city ?? ''),
      references: String((profile as any)?.references ?? ''),
      cross_streets: String((profile as any)?.cross_streets ?? ''),
    };

    // Obtener listings (para saber si son todos digitales antes de validar dirección)
    const listingIds = Array.from(new Set(cartItems.map((c) => c.listingId)));
    let listingsRes: any = await admin
      .from('listings')
      .select('id,title,price,seller_id,free_shipping,status,weight_kg,shipping_by_seller,shipping_price,shipping_carrier,shipping_subsidy,allow_personal_delivery,length_cm,width_cm,height_cm,stock,size_stock,product_type,condition')
      .in('id', listingIds);

    // Fallback si seller_id no existe
    if (listingsRes?.error) {
      const code = String((listingsRes.error as any)?.code || '');
      const msg = String((listingsRes.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        // Intentar sin columnas nuevas si falla
        listingsRes = await admin.from('listings').select('id,title,price,user_id,free_shipping,status,weight_kg,shipping_by_seller,stock,size_stock').in('id', listingIds);
      }
    }

    if (listingsRes?.error) {
      throw new Error(`Error obteniendo listings: ${listingsRes.error.message}`);
    }

    const listings = ((listingsRes?.data as any[]) ?? []) as any[];
    const listingById: Record<string, any> = {};
    for (const row of listings) listingById[String(row.id)] = row;

    // Detectar si TODOS los artículos del carrito son digitales
    const isEntireCartDigital = cartItems.every((ci) => {
      const l = listingById[ci.listingId];
      return String(l?.product_type || 'physical').toLowerCase() === 'digital';
    });

    // Validar dirección completa — se omite si todos los productos son digitales
    if (!isEntireCartDigital) {
      const addressOk =
        isFilled(shippingFullName) &&
        isFilled(shippingPhone) &&
        isFilled(shippingAddress.address_street) &&
        isFilled(shippingAddress.ext_number) &&
        isFilled(shippingAddress.neighborhood) &&
        isFilled(shippingAddress.zip_code) &&
        isFilled(shippingAddress.state) &&
        isFilled(shippingAddress.city) &&
        isFilled(shippingAddress.references) &&
        isFilled(shippingAddress.cross_streets);

      if (!addressOk) {
        throw new ValidationError('address_required');
      }
    }

    // Validar listings
    for (const ci of cartItems) {
      const listing = listingById[ci.listingId];
      if (!listing) {
        throw new ValidationError('Publicación no encontrada en carrito.');
      }

      // Validar que el comprador no sea el vendedor (Anti-Autocompra / Manipulación de Reputación)
      const itemSellerId = String(listing.seller_id ?? listing.user_id ?? '').trim();
      if (itemSellerId === buyerId) {
        throw new ValidationError('No puedes comprar tus propios artículos.');
      }

      const status = String(listing.status ?? 'active').trim();
      if (status !== 'active') {
        throw new ValidationError('Una publicación de tu carrito ya no está activa.');
      }

      // Validar Stock
      // Si stock es null, asumimos que es artículo único (1) o que no se gestiona stock numérico?
      // Por seguridad, si hay un campo stock, lo respetamos.
      if (ci.selected_size) {
        // Validar stock por talla
        let sizeStockMap: Record<string, number> = {};
        if (typeof listing.size_stock === 'string') {
          try { sizeStockMap = JSON.parse(listing.size_stock); } catch { }
        } else if (typeof listing.size_stock === 'object' && listing.size_stock !== null) {
          sizeStockMap = listing.size_stock;
        }

        const available = sizeStockMap[ci.selected_size];
        if (available !== undefined && Number(available) < ci.quantity) {
          throw new ValidationError(`El artículo "${listing.title.slice(0, 20)}..." (Talla: ${ci.selected_size}) ya no está disponible (stock insuficiente).`);
        }
      } else {
        // Validar stock global
        const currentStock = typeof listing.stock === 'number' ? listing.stock : (listing.stock ? Number(listing.stock) : null);
        if (currentStock !== null && currentStock < ci.quantity) {
          throw new ValidationError(`El artículo "${listing.title.slice(0, 20)}..." ya no está disponible (stock insuficiente).`);
        }
      }
    }

    // Aplicar cupón si existe
    let couponDiscountBySeller: Record<string, number> = {};
    if (couponCode) {
      couponDiscountBySeller = await fetchCouponDiscountBySeller({
        origin,
        token: accessToken,
        code: couponCode,
        cartItems: cartItems.map((ci) => ({ listingId: ci.listingId, quantity: ci.quantity })),
      });
    }

    // Agrupar por vendedor
    const groups: Record<string, CartItem[]> = {};
    const sellerIds = new Set<string>();
    for (const ci of cartItems) {
      const listing = listingById[ci.listingId];
      const sellerId = String(listing.seller_id ?? listing.user_id ?? '').trim();
      if (!sellerId) {
        throw new ValidationError('No pude determinar el vendedor de una publicación.');
      }
      sellerIds.add(sellerId);
      if (!groups[sellerId]) groups[sellerId] = [];
      groups[sellerId].push(ci);
    }

    // Validar estado de vendedores
    const { data: sellerProfiles } = await admin
      .from('profiles')
      .select('id, state, city, zip_code, plan_type, rfc')
      .in('id', Array.from(sellerIds));

    const sellerProfileById: Record<string, any> = {};
    sellerProfiles?.forEach((p: any) => { sellerProfileById[p.id] = p; });

    for (const sellerId of Array.from(sellerIds)) {
      const sellerState = await getUserAdminState(admin, sellerId);
      if (isRestricted(sellerState)) {
        throw new ForbiddenError(
          'Una publicación de tu carrito pertenece a un vendedor suspendido o bloqueado. Quítala del carrito para continuar.'
        );
      }

      // Validar Fraude por IP
      if (ipAddress) {
        const fraudResult = await fraudDetectionService.checkTransactionFraud(buyerId, sellerId, ipAddress);
        if (fraudResult.blocked) {
          console.error(`[CHECKOUT BLOCKED] Fraud detection triggered: ${fraudResult.reason}`);
          throw new ForbiddenError(fraudResult.reason || 'Transacción bloqueada por seguridad.');
        }
      }
    }

    // Obtener comisiones dinámicas
    const commissions = await getCommissions(admin);

    // Crear órdenes por vendedor
    const createdOrderIds: string[] = [];
    const createdOrdersInfo: { id: string; amount: number }[] = [];
    let totalAmount = 0;

    for (const sellerId of Object.keys(groups)) {
      const groupItems = groups[sellerId];

      // Calcular subtotal
      const groupSubtotal = groupItems.reduce((sum, item) => {
        const listing = listingById[item.listingId];
        const unitPrice = calculateUnitPrice(listing, item.quantity);
        return sum + unitPrice * item.quantity;
      }, 0);

      const sellerPlan = (sellerProfileById[sellerId]?.plan_type || 'basic') as keyof typeof PLAN_LIMITS;
      const appliedRate = (sellerPlan === 'basic' ? commissions.basic : sellerPlan === 'pro' ? commissions.pro : commissions.platinum) / 100;
      // Commission = subtotal × rate%, rounded to centavos
      const percentageCommission = Math.round(groupSubtotal * appliedRate * 100) / 100;
      // Minimum flat commission — fixed regardless of rate changes in app_settings
      // BASIC: $23.00, PRO/PLATINUM: $18.00
      const minCommission = sellerPlan === 'basic' ? 23.00 : 18.00;
      // Apply MAX(percentage, minimum) — platform never loses on low-value sales
      let commissionFee = Math.max(percentageCommission, minCommission);
      // Final round to centavos (2 decimal precision)
      commissionFee = Math.round(commissionFee * 100) / 100;

      // Calcular envío (lógica de peso)
      const allFreeShipping = groupItems.every((item) => Boolean(listingById[item.listingId]?.free_shipping));

      // Calcular peso total del grupo usando calculadora centralizada
      const totalWeight = groupItems.reduce((sum, item) => {
        const l = listingById[item.listingId];
        const effectiveW = calcEffectiveWeight(
          Number(l.weight_kg) || 1,
          Number(l.length_cm) || 10,
          Number(l.width_cm) || 10,
          Number(l.height_cm) || 10
        );
        return sum + (effectiveW * item.quantity);
      }, 0);

      // Determinar costo base usando calculadora centralizada (mismos rangos que subastas)
      const shippingSettings = buildShippingSettings(settingsRow);
      const calculatedBaseCost = calcWeightBasedCost(totalWeight, shippingSettings);

      const rawCost = selectedShippingOption ? selectedShippingOption.cost : calculatedBaseCost;
      const shippingCost = applyShippingMarkup(Number.isFinite(rawCost) ? rawCost : 180, shipping_markup_pct, shipping_markup_fixed);

      const hasSelfShippingFlag = groupItems.some((item) => Boolean(listingById[item.listingId]?.shipping_by_seller));
      // ⚠️ CRÍTICO: Una orden es "gestionada por vendedor" SOLO si el vendedor lo permite
      // Y el usuario NO seleccionó una opción de GoVendy (o entrega personal).
      // ⚠️ TAMBIÉN excluir T1 Premium (shippingOptionId === 't1')
      const isSellerManagedOrder = hasSelfShippingFlag && !selectedShippingOption && shippingOptionId !== 'pickup' && shippingOptionId !== 't1';

      console.log('[CheckoutService] Shipping detection:', {
        sellerId: sellerId.slice(0, 8),
        shippingOptionId,
        isT1Shipping,
        isSellerManagedOrder,
        hasSelfShippingFlag,
        hasSelectedShippingOption: !!selectedShippingOption,
        t1ShippingCost,
        t1CarrierToken: t1CarrierToken ? t1CarrierToken.slice(0, 15) + '...' : null,
      });

      // Detectar si es un grupo de productos digitales → shipping_fee = 0 siempre
      const isAllDigital = groupItems.every(item => {
        const l = listingById[item.listingId];
        return String(l?.product_type || 'physical').toLowerCase() === 'digital';
      });

      let customCarrier: string | null = null;
      let customShippingTotal = 0;

      if (isSellerManagedOrder) {
        const carrierItem = groupItems.find(item => listingById[item.listingId]?.shipping_by_seller);
        customCarrier = carrierItem ? (listingById[carrierItem.listingId]?.shipping_carrier || 'Propio') : null;

        customShippingTotal = groupItems.reduce((sum, item) => {
          const l = listingById[item.listingId];
          if (l?.shipping_by_seller) {
            if (l.free_shipping) return sum;
            // Shipping price is a FLAT fee per listing, NOT per unit
            return sum + (Number(l.shipping_price) || 0);
          }
          return sum;
        }, 0);
      }

      // Validar que si usa envío propio, sea PRO o Platinum
      if (isSellerManagedOrder && sellerPlan !== 'pro' && sellerPlan !== 'platinum') {
        throw new ForbiddenError('El envío por cuenta propia solo está disponible para vendedores PRO y Platinum.');
      }

      let finalShippingFee = 0;
      let finalShippingSubsidy = 0;

      // Lógica de Entrega Personal (pickup)
      let isPickup = false;
      if (shippingOptionId === 'pickup') {
        const sProf = sellerProfileById[sellerId];
        const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const bState = normalize(shippingAddress.state);
        const bCity = normalize(shippingAddress.city);
        const sState = normalize(String(sProf?.state || ''));
        const sCity = normalize(String(sProf?.city || ''));
        const bZip = String(shippingAddress.zip_code || '').replace(/\D/g, '');
        const sZip = String(sProf?.zip_code || '').replace(/\D/g, '');
        const zipMatch = bZip.length === 5 && sZip.length === 5 && bZip === sZip;
        const locationMatch = zipMatch || (bState === sState && bCity === sCity);
        const allowedByItems = groupItems.every(i => listingById[i.listingId]?.allow_personal_delivery);

        console.log('[CheckoutService] Validando pickup:', {
          sellerId,
          plan: sellerPlan,
          bLoc: `${bCity}, ${bState}`,
          sLoc: `${sCity}, ${sState}`,
          match: locationMatch,
          allowedByItems
        });

        // Entrega Personal: solo requerimos que los items tengan allow_personal_delivery=true
        // No requerimos coincidencia de ubicación ni plan PRO — el comprador y vendedor coordinan directamente
        if (allowedByItems) {
          isPickup = true;
        } else {
          console.warn('[CheckoutService] Pickup rechazado: listing sin allow_personal_delivery');
        }
      }

      const anyGoVendyPhysical = groupItems.some((item) => {
        const l = listingById[item.listingId];
        return String(l?.product_type || 'physical').toLowerCase() !== 'digital' && !Boolean(l?.shipping_by_seller);
      });
      if (anyGoVendyPhysical && !featureFlags.gopocket_shipping && !isPickup && shippingOptionId !== 't1') {
        throw new ValidationError(
          'Los envíos GoVendy están desactivados. Esta compra incluye una publicación que los requiere. Elige entrega personal, envío T1 (si aplica) o elimina esos artículos del carrito.',
        );
      }

      if (isAllDigital) {
        // Producto digital: sin envío
        finalShippingFee = 0;
        finalShippingSubsidy = 0;
      } else if (isSellerManagedOrder || isPickup) {
        finalShippingFee = isSellerManagedOrder ? customShippingTotal : 0;
        finalShippingSubsidy = 0;
      } else {
        let totalSubsidy = 0;
        for (const item of groupItems) {
          const l = listingById[item.listingId];
          const sub = Number(l.shipping_subsidy) || 0;

          if (l.free_shipping && sub === 0) {
            totalSubsidy += 999999;
          } else if (sub > 0) {
            totalSubsidy += sub;
          }
        }

        finalShippingSubsidy = Math.min(totalSubsidy, shippingCost);
        finalShippingFee = Math.max(0, shippingCost - finalShippingSubsidy);
      }

      const groupShipping = finalShippingFee;
      const shippingSubsidy = finalShippingSubsidy;

      // Aplicar descuento de cupón
      const rawGroupDiscount = couponDiscountBySeller?.[sellerId] ?? 0;
      const groupDiscount = rawGroupDiscount > 0 ? Math.min(groupSubtotal, rawGroupDiscount) : 0;
      // Redondear a 2 decimales para asegurar precisión financiera
      const groupTotal = Number((Math.max(0, groupSubtotal - groupDiscount) + groupShipping).toFixed(2));

      // --- VALIDACIONES FINANCIERAS ---

      // 1. Validación de Ganancias del Vendedor (Anti-Pérdidas Generales)
      // El vendedor debe ser capaz de cubrir costos de envío (si aplica) y comisión con el precio del producto.
      // Esta validación bloquea CUALQUIER transacción que resulte en saldo negativo para el vendedor,
      // ya sea por cupones, envío gratis mal configurado, o precios demasiado bajos.

      const platformShippingCost = (isPickup || isSellerManagedOrder || isAllDigital) ? 0 : shippingCost;
      // Costo de envío que el vendedor "subsidia" (Real - Lo que paga el cliente)
      const sellerShippingSubsidy = Math.max(0, platformShippingCost - groupShipping);

      // Ganancia proyectada (Ingreso Neto del Vendedor)
      // Subtotal - Comisión - Subsidio de Envío - Descuento Cupón
      const projectedEarnings = groupSubtotal - commissionFee - sellerShippingSubsidy - groupDiscount;

      if (projectedEarnings < 0) {
        if (groupDiscount > 0) {
          throw new ValidationError(
            `No se puede aplicar el cupón: El descuento ($${groupDiscount.toFixed(2)}) excede las ganancias. El vendedor perdería dinero en esta venta.`
          );
        } else {
          // Caso: Precio muy bajo + Envío Gratis (sin cupón)
          throw new ValidationError(
            `No se puede procesar la compra: El precio del producto no cubre los costos de envío y comisión. El vendedor tendría saldo negativo.`
          );
        }
      }

      // 2. Validación de Flujo de Caja (Legacy / Safety Net)
      // Evitar que la plataforma desembolse más en envío de lo que recibe en total.
      // (Esto protege principalmente ventas sin cupón mal configuradas o errores de cálculo).
      if (!isPickup && !isSellerManagedOrder && !isAllDigital && groupTotal < shippingCost) {
        throw new ValidationError(
          `No se puede procesar la compra: El total ($${groupTotal.toFixed(2)}) es insuficiente para cubrir el costo de envío ($${shippingCost.toFixed(2)}).`
        );
      }

      // Crear orden con fallbacks para columnas faltantes
      const basePayload: any = {
        buyer_id: buyerId,
        seller_id: sellerId,
        shipping_option_id: (isPickup || isSellerManagedOrder || isT1Shipping) ? null : (selectedShippingOption ? selectedShippingOption.id : null),
        shipping_carrier: isAllDigital ? 'digital' : (isPickup ? 'pickup' : (isSellerManagedOrder ? customCarrier : (isT1Shipping ? (t1CarrierName || 'gopocket_premium') : 'gopocket'))),
        shipping_by_seller: isSellerManagedOrder,
        shipping_method: isAllDigital ? 'digital' : (isPickup ? 'personal_delivery' : (isSellerManagedOrder ? 'seller_managed' : (isT1Shipping ? 'gopocket_premium' : 'gopocket'))),
        status: 'pending_payment',
        payment_method: paymentMethod,
        subtotal: groupSubtotal,
        shipping_fee: groupShipping,
        commission_fee: commissionFee,
        total: groupTotal,
        shipping_full_name: shippingFullName,
        shipping_phone: shippingPhone,
        shipping_address: shippingAddress,
        order_source: 'checkout',
      };

      // ── Retenciones Fiscales ──
      // Determinar condición del grupo (si hay mezcla, usar 'nuevo' para ser conservador)
      const groupConditions = groupItems.map(item => {
        const l = listingById[item.listingId];
        return (l?.condition || 'nuevo') as ItemCondition;
      });
      const groupCondition: ItemCondition = groupConditions.every(c => c === 'usado' || c === 'casi_nuevo')
        ? 'usado' : 'nuevo';
      const sellerRfc = String(sellerProfileById[sellerId]?.rfc || '').trim();
      const taxResult = calculateWithholding(groupSubtotal, groupCondition, !!sellerRfc, taxSettings);
      basePayload.isr_withheld = taxResult.isrAmount;
      basePayload.iva_withheld = taxResult.ivaAmount;

      // Agregar campos opcionales si existen
      if (couponCode) basePayload.coupon_code = couponCode;
      if (groupDiscount > 0) basePayload.coupon_discount = groupDiscount;
      if (shippingSubsidy > 0) basePayload.shipping_subsidy = shippingSubsidy;
      // Save T1 quote token for automatic label generation on payment approval
      if (isT1Shipping && t1CarrierToken) basePayload.t1_quote_token = t1CarrierToken;

      // Crear orden con intentos de fallback
      let order: Order;
      try {
        order = await this.ordersRepo.create(basePayload);
      } catch (error) {
        // Fallback: intentar sin campos opcionales
        const fallbackPayload: any = { ...basePayload };
        delete fallbackPayload.coupon_code;
        delete fallbackPayload.coupon_discount;
        // No eliminar shipping_subsidy aquí, ya que es crítico para el balance del vendedor.
        // El repositorio ya maneja la ausencia de la columna si es necesario.
        order = await this.ordersRepo.create(fallbackPayload);
      }

      createdOrderIds.push(order.id);
      createdOrdersInfo.push({ id: order.id, amount: groupTotal });
      totalAmount += groupTotal;

      // Crear items de orden
      const orderItems = groupItems.map((item) => {
        const listing = listingById[item.listingId];
        const title = String(listing?.title || 'Publicación');
        const unitPrice = calculateUnitPrice(listing, item.quantity);
        return {
          order_id: order.id,
          listing_id: item.listingId,
          title,
          unit_price: unitPrice,
          quantity: item.quantity,
          line_total: unitPrice * item.quantity,
          selected_size: item.selected_size || null,
          selected_color: item.selected_color || null,
        };
      });

      await this.orderItemsRepo.createMany(orderItems);

      // Notificar al vendedor (best-effort)
      if (this.notificationService) {
        try {
          await this.notificationService.create({
            user_id: sellerId,
            type: 'new_sale',
            title: '🛒 ¡Nueva venta!',
            body: `Recibiste una nueva compra. Orden: ${order.id.slice(0, 8)}… Esperando confirmación de pago.`,
            link_to: `/dashboard/ventas?order=${order.id}`,
            data: {
              kind: 'new_sale',
              orderId: order.id,
              status: 'pending_payment',
            },
          });
        } catch (notifyErr) {
          console.warn('[CheckoutService] Error enviando notificación:', notifyErr);
        }
      }
    }

    const decrementStockForOrders = async (orderIds: string[]) => {
      const { data: orderItems, error: itemsError } = await admin
        .from('order_items')
        .select('listing_id, quantity, selected_size, title')
        .in('order_id', orderIds);
      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const failed: Array<{ listing_id: string; title?: string | null; quantity: number; selected_size?: string | null; message: string }> = [];

      for (const item of (orderItems as any[]) ?? []) {
        const listingId = String(item?.listing_id ?? '').trim();
        const quantity = Number(item?.quantity ?? 0);
        const selectedSize = typeof item?.selected_size === 'string' ? String(item.selected_size).trim() : null;
        const title = typeof item?.title === 'string' ? String(item.title).trim() : null;

        if (!listingId || !Number.isFinite(quantity) || quantity <= 0) continue;

        let rpc: any = await admin.rpc('decrement_stock', {
          p_listing_id: listingId,
          p_quantity: quantity,
          p_size: selectedSize || null,
        });

        if (rpc?.error) {
          const code = String((rpc.error as any)?.code ?? '');
          const msg = String((rpc.error as any)?.message ?? '').toLowerCase();
          const maybeSignatureMismatch =
            code === '42883' || msg.includes('p_size') || msg.includes('decrement_stock(') || msg.includes('function');
          if (maybeSignatureMismatch) {
            rpc = await admin.rpc('decrement_stock', {
              p_listing_id: listingId,
              p_quantity: quantity,
            });
          }
        }

        if (rpc?.error) {
          failed.push({
            listing_id: listingId,
            title,
            quantity,
            selected_size: selectedSize,
            message: String((rpc.error as any)?.message ?? 'Error actualizando stock'),
          });
          continue;
        }

        const result = rpc?.data as any;
        if (!result?.success) {
          failed.push({
            listing_id: listingId,
            title,
            quantity,
            selected_size: selectedSize,
            message: String(result?.message ?? 'Stock insuficiente'),
          });
        }
      }

      if (failed.length > 0) {
        const first = failed[0];
        const base = first?.title ? `"${first.title}"` : 'un artículo';
        const sizeTxt = first?.selected_size ? ` (Talla: ${first.selected_size})` : '';
        throw new ValidationError(`Stock insuficiente para ${base}${sizeTxt}.`);
      }
    };

    // Procesar pago con PocketCash
    if (paymentMethod === 'pocketcash') {
      const wallet = await WalletService.getWallet(buyerId);
      const balance = Number(wallet?.balance || 0);

      if (balance < totalAmount) {
        // Nota: Las órdenes ya se crearon como pending_payment.
        // El frontend deberá manejar este error y redirigir al usuario a pagar/recargar.
        throw new ValidationError(`Saldo insuficiente en PocketCash. Tienes $${balance.toFixed(2)} pero se requieren $${totalAmount.toFixed(2)}`);
      }

      // Procesar deducción y marcar como pagado (Batch Atómico)
      const ordersToPay = createdOrdersInfo.filter(o => o.amount > 0);

      // Intentar cobrar todo junto. Si falla por saldo insuficiente, lanza error y no se actualiza ninguna orden.
      try {
        if (ordersToPay.length > 0) {
          await WalletService.payOrdersBatch(buyerId, ordersToPay);
        }

        await decrementStockForOrders(createdOrderIds);

        const now = new Date().toISOString();
        for (const info of createdOrdersInfo) {
          await admin
            .from('orders')
            .update({
              status: 'paid',
              paid_at: now,
              payment_method: 'pocketcash',
            } as any)
            .eq('id', info.id);
        }
      } catch (e: unknown) {
        const refundTargets = ordersToPay.filter((o) => Number(o.amount) > 0);
        for (const o of refundTargets) {
          await WalletService.addFunds(
            buyerId,
            Number(o.amount),
            `Reembolso automático por stock insuficiente (orden #${o.id.slice(0, 8)})`,
            'refund',
            o.id,
          );
        }

        if (createdOrderIds.length > 0) {
          await admin.from('orders').update({ status: 'cancelled' } as any).in('id', createdOrderIds);
        }

        throw e;
      }
    } else if (paymentMethod === 'direct_contact') {
      try {
        await decrementStockForOrders(createdOrderIds);
        
        // Update order status to indicate it's waiting for contact/payment
        const now = new Date().toISOString();
        for (const info of createdOrdersInfo) {
          await admin
            .from('orders')
            .update({
              status: 'pending_contact', // Using pending_contact, assuming we can use custom strings or pending_payment
            } as any)
            .eq('id', info.id);
        }
      } catch (e: unknown) {
        if (createdOrderIds.length > 0) {
          await admin.from('orders').update({ status: 'cancelled' } as any).in('id', createdOrderIds);
        }
        throw e;
      }
    }

    return {
      orderIds: createdOrderIds,
      amount: totalAmount,
    };
  }
}
