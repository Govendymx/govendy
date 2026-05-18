'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { applyShippingMarkup } from '@/lib/shippingMarkup';
import { calculateMercadoPagoFee } from '@/lib/fees';
import { calculateUnitPrice } from '@/lib/utils/pricing';
import PaymentDeadlineWarning from '@/components/common/PaymentDeadlineWarning';

type CartItemRow = {
  id: string;
  listing_id: string;
  quantity: number;
  selected_size?: string | null;
  selected_color?: string | null;
};

type ListingRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  price?: number | string | null;
  user_id?: string | null;
  seller_id?: string | null;
  free_shipping?: boolean | null;
  shipping_subsidy?: number | null;
  allow_personal_delivery?: boolean | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  shipping_by_seller?: boolean | null;
  shipping_price?: number | null;
  product_type?: 'physical' | 'digital' | null;
  sale_type?: string | null;
};

type SettingsRow = {
  shipping_base: number;
  shipping_markup_percent: number;
  shipping_markup_fixed: number;
  payment_methods: any;
  estafeta_config: any;
};

type PaymentKey = 'direct_contact' | 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo' | 'pocketcash';

const PAYMENT_METHOD_LOGO: Partial<Record<PaymentKey, string>> = {
  mercadopago: '/payment-logos/mercadopago.png',
  bank_transfer: '/payment-logos/transferencia.png',
  bank_deposit: '/payment-logos/deposito.png',
  oxxo: '/payment-logos/oxxo.png',
  pocketcash: '/payment-logos/pocketcash.svg',
};

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getErrMessage(err: unknown) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  const anyErr = err as any;
  if (typeof anyErr?.message === 'string') return anyErr.message;
  if (typeof anyErr?.error === 'string') return anyErr.error;
  try {
    return JSON.stringify(anyErr);
  } catch {
    return '';
  }
}

function getListingTitle(l: ListingRow) {
  return (l.title ?? l.name ?? 'Publicación').toString();
}

function getListingPrice(l: ListingRow) {
  const raw = l.price;
  const num = typeof raw === 'number' ? raw : Number(raw ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function getSellerId(l: ListingRow) {
  return (l.seller_id ?? l.user_id ?? null) as string | null;
}

export default function CheckoutPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  // Persistir orderIds en sessionStorage para sobrevivir la redirección a MercadoPago
  const STORAGE_KEY = 'gopocket_checkout_orderIds';
  const [existingOrderIds, setExistingOrderIds] = useState<string[]>(() => {
    try {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return [];
  });
  const [showPocketCashSuccess, setShowPocketCashSuccess] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponInfo, setCouponInfo] = useState<string | null>(null);
  const [couponDiscountBySeller, setCouponDiscountBySeller] = useState<Record<string, number>>({});
  const [didAutoApplyCoupon, setDidAutoApplyCoupon] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItemRow[]>([]);
  const [listingsById, setListingsById] = useState<Record<string, ListingRow>>({});
  const [settings, setSettings] = useState<SettingsRow>({
    shipping_base: 180,
    shipping_markup_percent: 0,
    shipping_markup_fixed: 0,
    payment_methods: {},
    estafeta_config: null,
  });
  const [oldestCartItemDate, setOldestCartItemDate] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentKey>('direct_contact');
  const [shippingOptions, setShippingOptions] = useState<Array<{ id: string; name: string; logo_url: string; cost: number; delivery_days: number; max_weight_kg?: number | null }>>([]);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<string | null>(null);

  // Perfiles para validar entrega personal
  const [buyerProfile, setBuyerProfile] = useState<{ state?: string; city?: string; zip_code?: string } | null>(null);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, { state?: string; city?: string; zip_code?: string; plan_type?: string }>>({});
  const [sellerAcceptedMethods, setSellerAcceptedMethods] = useState<Record<string, string[]>>({});

  // T1 Envíos (GoVendy Premium) — por vendedor
  type T1Quote = { carrier_name: string; carrier_id: string; service_level: string; cost: number; base_cost: number; markup: number; delivery_days: number; estimated_delivery: string | null; token: string };
  const [t1QuotesBySeller, setT1QuotesBySeller] = useState<Record<string, T1Quote[]>>({});
  const [t1Loading, setT1Loading] = useState(false);
  const [selectedT1BySeller, setSelectedT1BySeller] = useState<Record<string, string>>({});
  // Compat helpers
  const hasAnyT1Selection = Object.values(selectedT1BySeller).some(Boolean);
  const allT1Quotes = Object.values(t1QuotesBySeller).flat();

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, ci) => {
      const listing = listingsById[ci.listing_id];
      const price = calculateUnitPrice(listing, ci.quantity);
      return sum + price * ci.quantity;
    }, 0);
  }, [cartItems, listingsById]);

  const potentialCashback = useMemo(() => {
    return subtotal * 0.03;
  }, [subtotal]);

  // Calcular envío BASE (sin T1) — se usa para mostrar costo de opciones regulares
  const shippingFee = useMemo(() => {
    if (cartItems.length === 0) return 0;

    const pct = Number(settings.shipping_markup_percent ?? 0) || 0;
    const fix = Number(settings.shipping_markup_fixed ?? 0) || 0;

    // Agrupar por vendedor
    const groups: Record<string, CartItemRow[]> = {};
    for (const ci of cartItems) {
      const listing = listingsById[ci.listing_id];
      const sid = listing ? getSellerId(listing) : null;
      if (!sid) continue;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(ci);
    }

    const isSellerManagedSelection = selectedShippingOptionId === 'seller_managed';

    // Configuración de Estafeta (default si no existe)
    const estafetaConfig = settings.estafeta_config || {
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

    let sum = 0;
    let isPickup = false;

    if (shippingOptions.length > 0 && selectedShippingOptionId === 'pickup') {
      isPickup = true;
    }

    for (const sid of Object.keys(groups)) {
      const groupItems = groups[sid];

      // Productos digitales: envío siempre $0
      const isGroupAllDigital = groupItems.every((ci) =>
        String(listingsById[ci.listing_id]?.product_type || 'physical').toLowerCase() === 'digital'
      );
      if (isGroupAllDigital) continue;

      // Si el vendedor gestiona el envío, calcular costo personalizado - SOLO SI ES PRO
      const isPro = sellerProfiles[sid]?.plan_type === 'pro' || sellerProfiles[sid]?.plan_type === 'platinum';
      const hasSelfShipping = groupItems.some((ci) => Boolean(listingsById[ci.listing_id]?.shipping_by_seller));

      // Si el usuario eligió "Envío gestionado por el vendedor" o estamos en modo forzado por vendedor
      if (hasSelfShipping && isPro && (isSellerManagedSelection || !selectedShippingOptionId)) {
        // Si el comprador eligió entrega personal, es gratis aunque el vendedor gestione envío
        if (isPickup) {
          continue;
        }
        // Sumar costos de envío personalizados de cada artículo
        let customShippingTotal = 0;
        for (const item of groupItems) {
          const l = listingsById[item.listing_id];
          if (l?.shipping_by_seller) {
            // El precio ya viene en 0 si es free_shipping (manejado al crear/editar)
            const p = Number(l.shipping_price) || 0;
            // FIX: Cobrar envío por "Línea de producto" (Flat Rate) en lugar de por cantidad.
            customShippingTotal += p;
          }
        }
        sum += customShippingTotal;
        continue;
      }

      // Lógica de Entrega Personal
      if (isPickup) {
        const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const bState = normalize(buyerProfile?.state || '');
        const bCity = normalize(buyerProfile?.city || '');
        const sProf = sellerProfiles[sid];
        const sState = normalize(sProf?.state || '');
        const sCity = normalize(sProf?.city || '');
        const bZip = String(buyerProfile?.zip_code || '').replace(/\D/g, '');
        const sZip = String(sProf?.zip_code || '').replace(/\D/g, '');
        const zipMatch = bZip.length === 5 && sZip.length === 5 && bZip === sZip;
        const locationMatch = zipMatch || (bState === sState && bCity === sCity);
        const allowedByItems = groupItems.every(ci => listingsById[ci.listing_id]?.allow_personal_delivery);

        if (locationMatch && allowedByItems) {
          continue;
        } else {
          // Si no aplica pickup, usamos costo 0 por consistencia con lógica anterior, o debería fallar?
          // Asumimos 0.
          continue;
        }
      }

      // Calcular costo base
      let calculatedBaseCost = Number(settings.shipping_base || 0) || 0;
      let useEstafeta = true;

      if (shippingOptions.length > 0 && selectedShippingOptionId && selectedShippingOptionId !== 'pickup' && selectedShippingOptionId !== 'standard') {
        const selectedOption = shippingOptions.find((opt) => opt.id === selectedShippingOptionId);
        if (selectedOption) {
          calculatedBaseCost = Number(selectedOption.cost) || 0;
          useEstafeta = false;
        }
      }

      if (useEstafeta && estafetaConfig.enabled && Array.isArray(estafetaConfig.weight_ranges)) {
        let totalWeight = 0;
        for (const item of groupItems) {
          const l = listingsById[item.listing_id];
          const w = Number(l?.weight_kg) || 1;
          const len = Number(l?.length_cm) || 10;
          const wid = Number(l?.width_cm) || 10;
          const h = Number(l?.height_cm) || 10;

          const volW = (len * wid * h) / 5000;
          const finalW = Math.max(w, volW);
          totalWeight += (finalW * item.quantity);
        }

        const ranges = [...estafetaConfig.weight_ranges].sort((a: any, b: any) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
        const match = ranges.find((r: any) => totalWeight <= (r.max_weight_kg || 0));
        if (match) {
          calculatedBaseCost = Number(match.price) || calculatedBaseCost;
        } else if (ranges.length > 0) {
          const maxRange = ranges[ranges.length - 1];
          if (totalWeight > (maxRange.max_weight_kg || 0)) {
            calculatedBaseCost = Number(maxRange.price) || calculatedBaseCost;
          }
        }
      }

      const costWithMarkup = applyShippingMarkup(calculatedBaseCost, pct, fix);

      let totalSubsidy = 0;
      for (const item of groupItems) {
        const l = listingsById[item.listing_id];
        const sub = Number(l?.shipping_subsidy) || 0;
        const isFree = Boolean(l?.free_shipping);
        // FIX: Para subastas el shipping_subsidy ya está incluido en el precio
        // que se muestra en la publicación. No volver a restarlo en el checkout.
        const isAuction = l?.sale_type === 'auction';

        if (isAuction) {
          // Solo aplicar si es envío gratis marcado explícitamente
          if (isFree) totalSubsidy += 999999;
          // El subsidy ya fue descontado en el precio de la publicación — NO restar de nuevo
        } else {
          if (isFree && sub === 0) {
            totalSubsidy += 999999;
          } else if (sub > 0) {
            totalSubsidy += sub;
          }
        }
      }

      const finalSubsidy = Math.min(totalSubsidy, costWithMarkup);
      const finalFee = Math.max(0, costWithMarkup - finalSubsidy);
      sum += finalFee;
    }
    return sum;
  }, [cartItems, listingsById, settings, shippingOptions, selectedShippingOptionId, buyerProfile, sellerProfiles]);

  // Costo T1 total (suma de carriers seleccionados por vendedor)
  const t1Fee = useMemo(() => {
    let total = 0;
    for (const [sid, qkey] of Object.entries(selectedT1BySeller)) {
      if (!qkey) continue;
      const quotes = t1QuotesBySeller[sid] || [];
      const q = quotes.find((q, i) => `${q.carrier_id}_${i}` === qkey);
      if (q) total += q.cost;
    }
    return total;
  }, [selectedT1BySeller, t1QuotesBySeller]);

  // Costo EFECTIVO de envío forzado a 0 por petición (se acuerda con el vendedor)
  const effectiveShippingFee = 0;
  // ¿Todos los artículos del carrito son digitales?
  const allDigitalCart = useMemo(() => {
    if (cartItems.length === 0) return false;
    return cartItems.every((ci) =>
      String(listingsById[ci.listing_id]?.product_type || 'physical').toLowerCase() === 'digital'
    );
  }, [cartItems, listingsById]);

  const allSelfShipping = useMemo(() => {
    if (cartItems.length === 0) return false;
    // Agrupar items por vendedor
    const groups: Record<string, CartItemRow[]> = {};
    for (const ci of cartItems) {
      const listing = listingsById[ci.listing_id];
      const sid = listing ? getSellerId(listing) : null;
      if (!sid) continue;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(ci);
    }

    const sids = Object.keys(groups);
    if (sids.length === 0) return false;

    // Verificar si TODOS los vendedores tienen shipping_by_seller Y son PRO
    return sids.every((sid) => {
      const groupItems = groups[sid];
      const hasSelfShipping = groupItems.some((ci) => listingsById[ci.listing_id]?.shipping_by_seller);
      const isPro = sellerProfiles[sid]?.plan_type === 'pro' || sellerProfiles[sid]?.plan_type === 'platinum';
      return hasSelfShipping && isPro;
    });
  }, [cartItems, listingsById, sellerProfiles]);

  const paymentDetails = useMemo(() => {
    const baseTotal = Math.max(0, subtotal - couponDiscount) + effectiveShippingFee;
    if (paymentMethod === 'mercadopago') {
      return calculateMercadoPagoFee(baseTotal);
    }
    return { originalAmount: baseTotal, fee: 0, total: baseTotal };
  }, [subtotal, couponDiscount, effectiveShippingFee, paymentMethod]);

  const shippingModeSummary = useMemo(() => {
    if (allDigitalCart) {
      return { label: '💎 Entrega digital — sin envío físico', tone: 'gopocket' as const };
    }
    return { label: 'A acordar con el vendedor', tone: 'mixed' as const };
  }, [allDigitalCart]);

  const enabledMethods = useMemo(() => {
    const pm = settings.payment_methods || {};
    const list: Array<{ key: PaymentKey; label: string }> = [];

    // Obtener IDs de vendedores actuales en el carrito
    const currentSids = Array.from(new Set(cartItems.map(ci => {
      const l = listingsById[ci.listing_id];
      return l ? getSellerId(l) : null;
    }).filter(Boolean))) as string[];

    let allSellersAcceptMP = currentSids.length > 0;
    for (const sid of currentSids) {
      if (!sellerAcceptedMethods[sid]?.includes('mercadopago')) {
        allSellersAcceptMP = false;
        break;
      }
    }

    // MercadoPago incluye pagos con tarjeta (débito/crédito) y opciones según país/cuenta.
    if (pm?.mercadopago?.enabled && allSellersAcceptMP) list.push({ key: 'mercadopago', label: 'Tarjeta (MercadoPago)' });
    if (pm?.bank_transfer?.enabled) list.push({ key: 'bank_transfer', label: 'Transferencia bancaria' });
    if (pm?.bank_deposit?.enabled) list.push({ key: 'bank_deposit', label: 'Depósito bancario' });
    if (pm?.oxxo?.enabled) list.push({ key: 'oxxo', label: 'OXXO' });
    // PocketCash check
    if (pm?.pocketcash?.enabled) {
      // Solo mostrar si el balance cubre el total (estimado)
      // Nota: El total exacto se calcula en paymentDetails, pero paymentDetails depende del método seleccionado (fees).
      // Para habilitarlo en la lista, usamos el subtotal + envío como referencia base.
      // O mejor: Lo mostramos siempre pero lo deshabilitamos visualmente o mostramos error si se selecciona sin saldo.
      // El usuario pidió: "si se tiene el 100% del valor... agrega la forma de pago".
      // Así que lo agregamos a la lista, pero validaremos al seleccionar.
      list.push({ key: 'pocketcash', label: 'PocketCash' });
    }
    
    // Always enable P2P direct contact method
    list.push({ key: 'direct_contact' as any, label: 'Pago Directo al Vendedor' });
    
    return list;
  }, [settings, cartItems, listingsById, sellerAcceptedMethods]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setIsBooting(true);
        setPageError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/';
          return;
        }
        if (!cancelled) setUserId(userData.user.id);

        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (wallet) {
          setWalletBalance(Number(wallet.balance) || 0);
        }

        const [{ data: settingsRow }, { data: cartData, error: cartErr }, { data: shippingData }] = await Promise.all([
          supabase.from('app_settings').select('shipping_base, shipping_markup_percent, shipping_markup_fixed, payment_methods, estafeta_config').eq('id', 1).maybeSingle(),
          supabase.from('cart_items').select('id, listing_id, quantity, selected_size, selected_color, created_at').order('created_at', { ascending: true }),
          supabase.from('shipping_options').select('id, name, logo_url, cost, delivery_days, max_weight_kg').eq('is_active', true).order('display_order', { ascending: true }),
        ]);

        if (cartErr) throw cartErr;

        if (!cancelled && settingsRow) {
          setSettings({
            shipping_base: Number((settingsRow as any).shipping_base ?? 180),
            shipping_markup_percent: Number((settingsRow as any).shipping_markup_percent ?? 0),
            shipping_markup_fixed: Number((settingsRow as any).shipping_markup_fixed ?? 0),
            payment_methods: (settingsRow as any).payment_methods ?? {},
            estafeta_config: (settingsRow as any).estafeta_config ?? null,
          });
        }

        // Cargar opciones de envío activas
        if (!cancelled && shippingData && Array.isArray(shippingData) && shippingData.length > 0) {
          const opts = [...shippingData];
          setShippingOptions(opts as any);
          // Seleccionar la primera opción por defecto
          setSelectedShippingOptionId((shippingData[0] as any).id);
        }

        const items = (cartData as any[]) ?? [];
        if (cancelled) return;
        setCartItems(items.map((item) => ({ id: item.id, listing_id: item.listing_id, quantity: item.quantity })));

        // Obtener la fecha del item más antiguo para calcular el tiempo desde que se agregó al carrito
        if (items.length > 0) {
          const oldest = items[0];
          setOldestCartItemDate(oldest.created_at || null);
        } else {
          setOldestCartItemDate(null);
        }

        const listingIds = Array.from(new Set(items.map((i) => i.listing_id)));
        if (listingIds.length === 0) {
          setListingsById({});
          return;
        }

        const { data: listings, error: listingsErr } = await supabase.from('listings').select('*').in('id', listingIds);
        if (listingsErr) throw listingsErr;

        // Cargar perfiles de vendedores (para validar plan PRO y ubicación)
        const sIds = Array.from(new Set((listings as ListingRow[]).map((l) => getSellerId(l)).filter(Boolean))) as string[];
        const sMap: Record<string, { state?: string; city?: string; zip_code?: string; plan_type?: string }> = {};
        if (sIds.length > 0) {
          const { data: sProfs } = await supabase.from('profiles').select('id, state, city, zip_code, plan_type').in('id', sIds);
          sProfs?.forEach((p) => {
            sMap[p.id] = { state: p.state, city: p.city, zip_code: p.zip_code, plan_type: p.plan_type };
          });
          if (!cancelled) setSellerProfiles(sMap);

          // Cargar métodos de pago de los vendedores
          const { data: spMethods } = await supabase
            .from('seller_payment_methods')
            .select('seller_id, method_type')
            .in('seller_id', sIds)
            .eq('is_active', true);
          
          const methodsMap: Record<string, string[]> = {};
          sIds.forEach(id => methodsMap[id] = []);
          spMethods?.forEach(m => {
            if (!methodsMap[m.seller_id]) methodsMap[m.seller_id] = [];
            methodsMap[m.seller_id].push(m.method_type);
          });
          if (!cancelled) setSellerAcceptedMethods(methodsMap);
        }

        // Cargar perfil de comprador (para validar ubicación)
        const { data: bProf } = await supabase.from('profiles').select('state, city, zip_code').eq('id', userData.user.id).maybeSingle();
        if (!cancelled && bProf) {
          setBuyerProfile(bProf);
        }

        // Cargar cotizaciones T1 (GoVendy Premium) — por vendedor
        if (sIds.length > 0 && bProf?.zip_code) {
          try {
            if (!cancelled) setT1Loading(true);
            // Agrupar items por vendedor
            const itemsBySeller: Record<string, typeof items> = {};
            for (const item of items) {
              const l = (listings as any[])?.find((x: any) => x.id === item.listing_id);
              const sid = l?.seller_id || l?.user_id;
              if (!sid) continue;
              // No cotizar T1 para productos con envío gestionado por vendedor
              if (l?.shipping_by_seller) continue;
              if (!itemsBySeller[sid]) itemsBySeller[sid] = [];
              itemsBySeller[sid].push(item);
            }
            const quoteMap: Record<string, any[]> = {};
            await Promise.all(Object.entries(itemsBySeller).map(async ([sid, sellerItems]) => {
              const sellerZip = sMap[sid]?.zip_code;
              const sellerPlan = sMap[sid]?.plan_type || 'basic';
              if (!sellerZip) return;
              // Calcular peso y dimensiones por vendedor (altura × cantidad para apilar)
              let totalRealWeight = 0;
              let maxLength = 10, maxWidth = 10, stackedHeight = 0;
              for (const item of sellerItems) {
                const l = (listings as any[])?.find((x: any) => x.id === item.listing_id);
                if (l) {
                  const qty = item.quantity || 1;
                  totalRealWeight += (Number(l.weight_kg) || 1) * qty;
                  maxLength = Math.max(maxLength, Number(l.length_cm) || 10);
                  maxWidth = Math.max(maxWidth, Number(l.width_cm) || 10);
                  stackedHeight += (Number(l.height_cm) || 10) * qty;
                }
              }
              // Peso volumétrico con dimensiones apiladas: L × W × H(apilado) / 5000
              const volumetricWeight = (maxLength * maxWidth * stackedHeight) / 5000;
              const totalWeight = Math.max(totalRealWeight, volumetricWeight);
              try {
                const t1Res = await fetch('/api/shipping/t1/quote', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    origin_zip: sellerZip,
                    dest_zip: bProf.zip_code,
                    weight_kg: Math.max(1, totalWeight),
                    length_cm: maxLength,
                    width_cm: maxWidth,
                    height_cm: Math.max(10, stackedHeight),
                    seller_plan: sellerPlan,
                  }),
                });
                const t1Json = await t1Res.json();
                if (t1Json.success && Array.isArray(t1Json.quotes)) {
                  quoteMap[sid] = t1Json.quotes;
                }
              } catch (e) { console.warn(`[T1] quote failed for seller ${sid}`, e); }
            }));
            if (!cancelled) setT1QuotesBySeller(quoteMap);
          } catch (t1Err) {
            console.warn('[Checkout] T1 quotes failed (non-critical):', t1Err);
          } finally {
            if (!cancelled) setT1Loading(false);
          }
        }

        const map: Record<string, ListingRow> = {};
        for (const row of (listings as ListingRow[]) ?? []) map[row.id] = row;
        if (!cancelled) {
          setListingsById(map);
          setCouponDiscount(0);
          setCouponInfo(null);
          setCouponDiscountBySeller({});
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setPageError(err instanceof Error ? err.message : 'No se pudo cargar el checkout.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Limpiar error cuando cambia el saldo o método de pago
  useEffect(() => {
    setPageError(null);
  }, [walletBalance, paymentMethod]);

  // Suscripción a cambios en saldo (Realtime) para mantener la UI sincronizada si recarga en otra pestaña
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`wallet-checkout-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new && typeof payload.new.balance !== 'undefined') {
            setWalletBalance(Number(payload.new.balance) || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Si el comprador escribió cupón en Carrito, lo guardamos en localStorage para pre-llenar aquí
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('pocket_coupon_code') : null;
      if (saved && !couponCode) setCouponCode(saved);
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detectar si "Entrega Personal" está disponible y agregarlo a opciones
  useEffect(() => {
    if (cartItems.length === 0 || !buyerProfile) return;

    // Verificar si todos los grupos cumplen con ubicación y permiso
    const groups: Record<string, CartItemRow[]> = {};
    for (const ci of cartItems) {
      const listing = listingsById[ci.listing_id];
      const sid = listing ? getSellerId(listing) : null;
      if (!sid) continue;
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(ci);
    }

    const sellerIds = Object.keys(groups);
    if (sellerIds.length === 0) return;

    const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const bState = normalize(buyerProfile.state || '');
    const bCity = normalize(buyerProfile.city || '');
    const bZip = String(buyerProfile.zip_code || '').replace(/\D/g, '');

    let allGroupsEligible = true;
    for (const sid of sellerIds) {
      const sProf = sellerProfiles[sid];
      if (!sProf) {
        allGroupsEligible = false;
        break;
      }

      // Permitir si el listing tiene allow_personal_delivery habilitado
      // No requierimos coincidencia de ubicación: el vendedor y comprador pueden coordinar la entrega
      const groupItems = groups[sid];
      const allowedByItems = groupItems.every(ci => {
        const l = listingsById[ci.listing_id];
        return l?.allow_personal_delivery && (sProf.plan_type === 'platinum' || l.sale_type === 'auction');
      });
      if (!allowedByItems) {
        allGroupsEligible = false;
        break;
      }
    }

    if (allGroupsEligible) {
      setShippingOptions(prev => {
        const hasPickup = prev.some(o => o.id === 'pickup');
        const hasStandard = prev.some(o => o.id === 'standard');
        const hasOther = prev.some(o => o.id !== 'pickup' && o.id !== 'standard');

        // Detectar si algún vendedor gestiona su propio envío
        const anySellerManaged = sellerIds.some((sid) => {
          const groupItems = groups[sid];
          return groupItems.some((ci) => listingsById[ci.listing_id]?.shipping_by_seller);
        });

        let newOpts = [...prev];

        // Solo agregar "Envío Estándar" si NO hay vendedor que gestione su propio envío
        if (!anySellerManaged && !hasOther && !hasStandard) {
          newOpts.unshift({
            id: 'standard',
            name: 'Envío Estándar',
            logo_url: '',
            cost: settings.shipping_base,
            delivery_days: 3,
            max_weight_kg: null
          });
        }

        // Solo mostrar Entrega Personal si comprador y todos los vendedores están en el mismo estado
        const buyerState = buyerProfile?.state?.toLowerCase().trim();
        const sameState = buyerState && sellerIds.every(sid => {
          const sp = sellerProfiles[sid];
          return sp?.state && sp.state.toLowerCase().trim() === buyerState;
        });

        if (!hasPickup && sameState) {
          newOpts.push({
            id: 'pickup',
            name: 'Entrega Personal (Gratis)',
            logo_url: '',
            cost: 0,
            delivery_days: 1,
            max_weight_kg: 999
          });
        }

        // Si todos los vendedores gestionan su propio envío, agregar esa opción a la lista
        const allSelf = sellerIds.every((sid) => {
          const groupItems = groups[sid];
          const hasSelfShipping = groupItems.some((ci) => listingsById[ci.listing_id]?.shipping_by_seller);
          const isPro = sellerProfiles[sid]?.plan_type === 'pro' || sellerProfiles[sid]?.plan_type === 'platinum';
          return hasSelfShipping && isPro;
        });

        if (allSelf && !prev.some(o => o.id === 'seller_managed')) {
          newOpts.push({
            id: 'seller_managed',
            name: 'Envío Gestionado por el Vendedor',
            logo_url: '',
            cost: 0, // El costo se calcula en shippingFee useMemo sumando los shipping_price
            delivery_days: 3,
            max_weight_kg: 999
          });
        }

        if (!selectedShippingOptionId) {
          if (allSelf) {
            // Si el vendedor gestiona envío, preseleccionar esa opción
            setTimeout(() => setSelectedShippingOptionId('seller_managed'), 0);
          } else if (!hasOther && !hasStandard && !anySellerManaged) {
            setTimeout(() => setSelectedShippingOptionId('standard'), 0);
          } else if (!hasPickup) {
            setTimeout(() => setSelectedShippingOptionId('pickup'), 0);
          }
        }
        return newOpts;
      });
    } else {
      setShippingOptions(prev => {
        let next = prev.filter(o => o.id !== 'pickup' && o.id !== 'seller_managed');
        // Si solo queda 'standard', volver a modo implícito
        const hasOther = next.some(o => o.id !== 'standard');
        if (!hasOther && next.some(o => o.id === 'standard')) {
          next = next.filter(o => o.id !== 'standard');
        }
        return next;
      });
      if (selectedShippingOptionId === 'pickup') {
        setSelectedShippingOptionId(null);
      }
    }
  }, [cartItems, listingsById, buyerProfile, sellerProfiles, selectedShippingOptionId, settings]);

  // Asegurar que el método seleccionado siga habilitado
  useEffect(() => {
    if (enabledMethods.length === 0) return;
    if (!enabledMethods.find((m) => m.key === paymentMethod)) {
      setPaymentMethod(enabledMethods[0].key);
    }
  }, [enabledMethods, paymentMethod]);

  const applyCoupon = async () => {
    setPageError(null);
    setSuccess(null);
    setCouponInfo(null);
    setCouponDiscount(0);
    setCouponDiscountBySeller({});

    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setPageError('Ingresa un cupón.');
      return;
    }
    if (cartItems.length === 0) {
      setPageError('Tu carrito está vacío.');
      return;
    }

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!userData.user) {
        window.location.href = '/';
        return;
      }

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No se encontró el token de sesión para aplicar cupón.');

      const res = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          code,
          cartItems: cartItems.map((c) => ({ listingId: c.listing_id, quantity: c.quantity })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo aplicar el cupón.');

      const bySeller = (json?.discountBySeller ?? json?.discount_by_seller ?? {}) as Record<string, any>;
      const normalizedBySeller: Record<string, number> = {};
      let sum = 0;
      for (const [sid, v] of Object.entries(bySeller || {})) {
        const n = typeof v === 'number' ? v : Number(v ?? 0);
        const nn = Number.isFinite(n) ? n : 0;
        if (sid) normalizedBySeller[sid] = nn;
        sum += nn;
      }
      const discount = Number(json?.discount ?? sum ?? 0);
      const finalDiscount = Number.isFinite(discount) ? discount : sum;
      setCouponDiscount(finalDiscount);
      setCouponDiscountBySeller(normalizedBySeller);
      setCouponInfo(`Cupón aplicado. Descuento: ${formatMoney(finalDiscount)}.`);
      setSuccess('Cupón aplicado.');
    } catch (e: unknown) {
      // console.error(e);
      setPageError(e instanceof Error ? e.message : 'No se pudo aplicar el cupón.');
    }
  };

  // Auto-aplicar si viene desde Carrito (y ya cargó el carrito)
  useEffect(() => {
    if (didAutoApplyCoupon) return;
    if (!couponCode.trim()) return;
    if (cartItems.length === 0) return;
    setDidAutoApplyCoupon(true);
    void applyCoupon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didAutoApplyCoupon, couponCode, cartItems.length]);

  const placeOrder = async () => {
    setPageError(null);
    setSuccess(null);
    setIsPlacing(true);

    try {
      if (cartItems.length === 0) {
        setPageError('Tu carrito está vacío.');
        return;
      }

      // Validar saldo para PocketCash antes de crear nada
      if (paymentMethod === 'pocketcash') {
        if (walletBalance < paymentDetails.total) {
          setPageError(`Saldo insuficiente (${formatMoney(walletBalance)}). Necesitas ${formatMoney(paymentDetails.total)} para completar esta compra.`);
          setIsPlacing(false);
          return;
        }
      }

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = `/login?returnTo=${encodeURIComponent('/checkout')}`;
        return;
      }

      // Si ya tenemos órdenes creadas (usuario cambió de método de pago), reusar
      let createdOrderIds = existingOrderIds;

      if (createdOrderIds.length === 0) {
        // Crear órdenes en server-side (fuente de verdad de precios/cupón/envío)
        const createRes = await fetch('/api/checkout/create-v2', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            cartItems: cartItems.map((c) => ({
              listingId: c.listing_id,
              quantity: c.quantity,
              selected_size: c.selected_size || null,
              selected_color: c.selected_color || null,
            })),
            payment_method: paymentMethod,
            coupon_code: couponCode.trim().toUpperCase() || null,
            shipping_option_id: hasAnyT1Selection ? 't1' : (selectedShippingOptionId || null),
            t1_carrier_id: hasAnyT1Selection ? Object.entries(selectedT1BySeller).map(([sid, qkey]) => { const quotes = t1QuotesBySeller[sid] || []; return quotes.find((q, i) => `${q.carrier_id}_${i}` === qkey)?.carrier_id; }).filter(Boolean).join(',') : null,
            t1_carrier_token: hasAnyT1Selection ? Object.entries(selectedT1BySeller).map(([sid, qkey]) => { const quotes = t1QuotesBySeller[sid] || []; return quotes.find((q, i) => `${q.carrier_id}_${i}` === qkey)?.token; }).filter(Boolean).join(',') : null,
            t1_carrier_name: hasAnyT1Selection ? Object.entries(selectedT1BySeller).map(([sid, qkey]) => { const quotes = t1QuotesBySeller[sid] || []; return quotes.find((q, i) => `${q.carrier_id}_${i}` === qkey)?.carrier_name; }).filter(Boolean).join(', ') : null,
            t1_shipping_cost: hasAnyT1Selection ? t1Fee : null,
            t1_per_seller: hasAnyT1Selection ? JSON.stringify(Object.fromEntries(Object.entries(selectedT1BySeller).filter(([, v]) => v).map(([sid, qkey]) => { const quotes = t1QuotesBySeller[sid] || []; const q = quotes.find((q, i) => `${q.carrier_id}_${i}` === qkey); return [sid, { carrier_id: q?.carrier_id, carrier_name: q?.carrier_name, cost: q?.cost, token: q?.token }]; }))) : null,
          }),
        });
        const createJson = await createRes.json().catch(() => ({} as any));
        if (!createRes.ok) {
          const errText = String(createJson?.error || 'No se pudo crear la orden.');
          if (errText === 'address_required') {
            const returnTo = encodeURIComponent('/checkout');
            window.location.href = `/dashboard/perfil?returnTo=${returnTo}&reason=address_required`;
            return;
          }
          throw new Error(errText);
        }

        createdOrderIds = (createJson?.orderIds as string[] | undefined) ?? [];
        if (createdOrderIds.length === 0) throw new Error('No se recibieron orderIds.');
        setExistingOrderIds(createdOrderIds);
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(createdOrderIds)); } catch { }
      } else {
        // Actualizar método de pago en las órdenes existentes
        for (const oid of createdOrderIds) {
          await supabase.from('orders').update({ payment_method: paymentMethod }).eq('id', oid);
        }
      }

      try { sessionStorage.removeItem(STORAGE_KEY); } catch { }
      const cartItemIds = cartItems.map((c) => c.id);
      const { error: clearErr } = await supabase.from('cart_items').delete().in('id', cartItemIds);
      if (clearErr) {
        // console.warn('[CHECKOUT] Error vaciando carrito (no crítico):', clearErr);
      }

      if (paymentMethod === 'direct_contact') {
        window.location.href = `/orders/${createdOrderIds[0]}/pay`;
      } else {
        window.location.href = `/compra-exitosa?orderId=${createdOrderIds[0]}`;
      }
    } catch (err: unknown) {
      // console.error(err);
      setSuccess(null);
      setPageError(getErrMessage(err) || 'No se pudo crear la orden.');
    } finally {
      setIsPlacing(false);
    }
  };

  const methodInstructions = useMemo(() => {
    const pm = settings.payment_methods || {};
    if (paymentMethod === 'bank_transfer') return pm?.bank_transfer?.instructions ?? '';
    if (paymentMethod === 'bank_deposit') return pm?.bank_deposit?.instructions ?? '';
    if (paymentMethod === 'oxxo') return pm?.oxxo?.instructions ?? '';
    return '';
  }, [paymentMethod, settings]);

  if (isBooting) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="h-12 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
              Checkout
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Pagar</h1>
            <p className="mt-2 text-sm text-gray-600">Elige tu método de pago y confirma tu compra.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/cart"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Volver al carrito
            </Link>
          </div>
        </div>

        {pageError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {/* Advertencia de 48 horas */}
        <PaymentDeadlineWarning createdAt={oldestCartItemDate} className="mt-6" />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Método de Pago</h2>
              <p className="mt-1 text-sm text-gray-600">Selecciona cómo deseas pagar tu compra.</p>
              
              <div className="mt-4 grid gap-3">
                {enabledMethods.some(m => m.key === 'mercadopago') && (
                  <label className={`cursor-pointer rounded-2xl border p-4 text-sm transition ${paymentMethod === 'mercadopago' ? 'border-brand-emerald bg-emerald-50 ring-1 ring-brand-emerald' : 'border-black/5 bg-white hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <img src="/payment-logos/mercadopago.png" alt="MercadoPago" className="h-8 w-auto object-contain" />
                        <div>
                          <div className="font-bold text-gray-900">Pago en Línea Seguro</div>
                          <div className="text-xs text-gray-500">Paga con tarjeta de crédito, débito o saldo en MercadoPago.</div>
                        </div>
                      </div>
                      <input 
                        type="radio" 
                        name="paymentMethod" 
                        value="mercadopago" 
                        checked={paymentMethod === 'mercadopago'} 
                        onChange={() => setPaymentMethod('mercadopago')}
                        className="h-4 w-4 text-brand-emerald focus:ring-brand-emerald" 
                      />
                    </div>
                  </label>
                )}

                <label className={`cursor-pointer rounded-2xl border p-4 text-sm transition ${paymentMethod === 'direct_contact' ? 'border-brand-emerald bg-emerald-50 ring-1 ring-brand-emerald' : 'border-black/5 bg-white hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Pago Directo al Vendedor</div>
                        <div className="text-xs text-gray-500">Acuerda el pago y sube tu comprobante (Transferencia, Oxxo, etc).</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="direct_contact" 
                      checked={paymentMethod === 'direct_contact'} 
                      onChange={() => setPaymentMethod('direct_contact')}
                      className="h-4 w-4 text-brand-emerald focus:ring-brand-emerald" 
                    />
                  </div>
                </label>
              </div>
            </section>



            {!allDigitalCart && (
              <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <h2 className="text-lg font-bold text-gray-900">Envío</h2>
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
                  <div className="mt-0.5 text-blue-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-900">A acordar con el vendedor</div>
                    <div className="mt-1 text-sm text-blue-800">
                      El costo de envío no se cobra por GoVendy. Una vez confirmada tu compra, deberás coordinar y pagar el envío directamente con el vendedor.
                    </div>
                  </div>
                </div>
              </section>
            )}


            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Artículos</h2>
              <div className="mt-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="text-sm text-gray-600">Tu carrito está vacío.</div>
                ) : (
                  cartItems.map((ci) => {
                    const listing = listingsById[ci.listing_id];
                    const title = listing ? getListingTitle(listing) : 'Publicación';
                    const price = listing ? calculateUnitPrice(listing, ci.quantity) : 0;
                    const isDigital = listing?.product_type === 'digital';
                    return (
                      <div key={ci.id} className="flex items-center justify-between rounded-2xl border border-black/5 px-4 py-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">{title}</div>
                            {isDigital && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                                💎 PRODUCTO DIGITAL
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {ci.quantity} × {formatMoney(price)}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gray-900">{formatMoney(price * ci.quantity)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-semibold text-gray-900">Resumen</div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-gray-900">{formatMoney(subtotal)}</span>
              </div>
              <div className="rounded-2xl border border-black/5 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Cupón</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Código de cupón"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={!couponCode.trim() || cartItems.length === 0}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    Aplicar
                  </button>
                </div>
                {couponInfo && <div className="mt-2 text-xs font-medium text-green-600">{couponInfo}</div>}
              </div>
              {couponDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Descuento</span>
                  <span className="font-semibold text-gray-900">- {formatMoney(couponDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Envío</span>
                <span className="font-semibold text-blue-600">A acordar</span>
              </div>
              <div className="mt-1">
                <span
                  className={
                    shippingModeSummary.tone === 'gopocket'
                      ? 'inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 ring-1 ring-blue-700/10'
                      : 'inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-800 ring-1 ring-purple-700/10'
                  }
                  title={shippingModeSummary.label}
                >
                  {shippingModeSummary.label}
                </span>
              </div>
              <div className="border-t border-black/5 pt-2 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 font-semibold">Total</span>
                  <span className="text-gray-900 font-extrabold">{formatMoney(paymentDetails.total)}</span>
                </div>
                {paymentDetails.fee > 0 && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>(Incluye {formatMoney(paymentDetails.fee)} de comisión por pago con tarjeta)</span>
                  </div>
                )}
              </div>
            </div>


            <button
              type="button"
              disabled={isPlacing || cartItems.length === 0 || enabledMethods.length === 0}
              onClick={placeOrder}
              className="mt-6 w-full rounded-xl bg-brand-emerald px-4 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPlacing ? 'Creando orden…' : 'Confirmar compra'}
            </button>

            <p className="mt-3 text-xs text-gray-500">
              Se crearán órdenes separadas por vendedor. El método de pago se guarda en cada orden.
            </p>
          </aside>
        </div>
      </div>

      {/* PocketCash Success Modal */}
      {showPocketCashSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900">¡Pago Exitoso!</h3>
              <p className="mt-2 text-sm text-gray-600">
                Tu pago con PocketCash se ha procesado correctamente.
              </p>

              <div className="mt-6 w-full space-y-3">
                <Link
                  href="/dashboard/compras"
                  className="flex w-full items-center justify-center rounded-xl bg-brand-emerald px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-emerald/20 transition hover:bg-emerald-600 active:scale-95"
                >
                  Ver mis compras
                </Link>
                <Link
                  href="/"
                  className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95"
                >
                  Seguir comprando
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

