'use client';

import Link from 'next/link';
import NextImage from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { redirectToLogin } from '@/lib/auth/redirect';
import { BlocksRenderer } from '@/components/templates/BlocksRenderer';
import { RichDescriptionContent } from '@/components/templates/RichDescriptionContent';
import type { TemplateBlock } from '@/lib/templates/blocks';
import { NEW_CATEGORIES_CONFIG, UNIVERSAL_ATTRIBUTES } from '@/lib/categories';
import { EmojiPicker } from '@/components/EmojiPicker';
import ShareButton from '@/components/ShareButton';
import { SellerDisplay } from '@/components/SellerDisplay';
import { RecommendationSection } from '@/components/listings/RecommendationSection';
import { ProductReviews } from '@/components/listings/ProductReviews';
import { BuyerProtection } from '@/components/listings/BuyerProtection';
import { ProductGallery } from '@/components/listings/ProductGallery';
import { TrustPanel } from '@/components/listings/TrustPanel';
import { FollowButton } from '@/components/FollowButton';
import { LiveBadge } from '@/components/LiveBadge';
import { RelatedProducts } from '@/components/listings/RelatedProducts';
import { SidebarBanner } from '@/components/listings/SidebarBanner';
import { SellerSidebarReputation } from '@/components/listings/SellerSidebarReputation';
import { SafeShoppingPromo } from '@/components/listings/SafeShoppingPromo';
import { Flame, Gavel, Flag, Play } from 'lucide-react';
import { ReportModal } from '@/components/listings/ReportModal';
import { ClothingSizeChart } from '@/components/listings/ClothingSizeChart';

type ListingRow = {
  id: string;
  public_id?: string | null;
  title: string;
  description: string | null;
  description_blocks?: any[] | null;
  price: number | string;
  currency: string;
  images: string[] | null;
  status: 'draft' | 'active' | 'sold' | 'paused' | 'blocked';
  seller_id: string;
  sale_type?: 'direct' | 'auction' | null;
  product_type?: 'physical' | 'digital' | null;
  gender?: 'Mujer' | 'Hombre' | 'Unisex' | null;
  size?: string | null;
  color?: string | null;
  color_variants?: string[] | null;
  size_variants?: string[] | null;
  category?: string | null;
  tags?: string[] | null;
  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_bid_increment?: number | string | null;
  auction_highest_bid?: number | string | null;
  auction_highest_bidder_id?: string | null;
  shipping_by_seller?: boolean;
  allow_personal_delivery?: boolean;
  free_shipping?: boolean;
  shipping_subsidy?: number | string | null;
  shipping_price?: number | string | null;
  weight_kg?: number | string | null;
  length_cm?: number | string | null;
  width_cm?: number | string | null;
  height_cm?: number | string | null;
  attributes?: Record<string, any> | null;
  wholesale_tiers?: { min: number; max: number | null; price: number }[] | null;
  stock?: number | string | null;
  size_stock?: any;
  created_at: string;
  seller?: {
    full_name?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    store_logo_url?: string;
    plan_type?: string;
    is_official_store?: boolean;
    official_store_name?: string;
    official_store_banner_url?: string;
    official_store_brand_color?: string;
    is_verified?: boolean;
    is_wholesaler?: boolean;
    is_manufacturer?: boolean;
    rating_total_count?: number;
    rating_good_count?: number;
    reputation_score?: number;
    manual_reputation_score?: number;
    manual_sales_count?: number;
  };
};

type ListingQuestionRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  asker_id: string;
  question_text: string;
  answer_text: string | null;
  created_at: string;
  answered_at: string | null;
};

type SellerListingRow = {
  id: string;
  public_id?: string | null;
  title: string;
  price: number | string;
  currency: string;
  images: string[] | null;
  status?: string | null;
  created_at?: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getPrice(row: ListingRow) {
  const p = typeof row.price === 'number' ? row.price : Number(row.price ?? 0);
  return Number.isFinite(p) ? p : 0;
}

function badgeForPercent(pct: number): 'plata' | 'gold' | 'platinum' | null {
  if (pct >= 91) return 'platinum';
  if (pct >= 71) return 'gold';
  if (pct >= 51) return 'plata';
  return null;
}

type WTier = { min: number; max: number | null; price: number };
function parseWholesaleTiers(listing: any): WTier[] {
  let raw = listing?.wholesale_tiers;
  if (!raw) return [];
  // If it's a string (some DB drivers return JSONB as string), parse it
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any) => ({
      min: Number(t?.min ?? 0),
      max: t?.max === null || t?.max === undefined ? null : Number(t.max),
      price: Number(t?.price ?? 0),
    }))
    .filter((t: WTier) => t.min > 0 && t.price > 0);
}

// Función auxiliar para normalizar arrays que pueden venir como strings JSON o arrays reales
function normalizeArray(value: any): string[] | null {
  if (!value) {
    return null;
  }

  // Si ya es un array
  if (Array.isArray(value)) {
    const filtered = value.filter((v) => {
      const isValid = typeof v === 'string' && v.trim().length > 0;
      return isValid;
    });
    return filtered.length > 0 ? filtered : null;
  }

  // Si es string, intentar parsear como JSON
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // Intentar parsear como JSON
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((v: any) => {
          const str = String(v).trim();
          const isValid = str.length > 0;
          return isValid;
        });
        return filtered.length > 0 ? filtered : null;
      }
      // Si es un objeto, intentar extraer valores
      if (typeof parsed === 'object' && parsed !== null) {
        const values = Object.values(parsed).filter((v: any) => String(v).trim().length > 0);
        return values.length > 0 ? values.map(v => String(v).trim()) : null;
      }
    } catch (e) {
      // Si no es JSON válido, tratar como string simple
      return [trimmed];
    }
  }

  // Si es un objeto, intentar extraer valores
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const values = Object.values(value).filter((v: any) => String(v).trim().length > 0);
    return values.length > 0 ? values.map(v => String(v).trim()) : null;
  }

  return null;
}

export default function ListingDetailPage() {
  const p = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isBidding, setIsBidding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [sellerName, setSellerName] = useState<string>('Vendedor');
  const [sellerState, setSellerState] = useState<string | null>(null);
  const [sellerCity, setSellerCity] = useState<string | null>(null);
  const [sellerZip, setSellerZip] = useState<string | null>(null);
  const [sellerRatingPercent, setSellerRatingPercent] = useState<number>(100);
  const [sellerBadge, setSellerBadge] = useState<'plata' | 'gold' | 'platinum' | null>(null);
  const [sellerIsVerified, setSellerIsVerified] = useState<boolean>(false);
  const [sellerOperationsCount, setSellerOperationsCount] = useState<number | null>(null);
  const [sellerStoreLogo, setSellerStoreLogo] = useState<string | undefined>(undefined);
  const [sellerPlanType, setSellerPlanType] = useState<string | undefined>(undefined);
  const [sellerIsOfficial, setSellerIsOfficial] = useState<boolean>(false);
  const [sellerOfficialName, setSellerOfficialName] = useState<string | null>(null);
  const [sellerOfficialBanner, setSellerOfficialBanner] = useState<string | null>(null);
  const [sellerOfficialBrandColor, setSellerOfficialBrandColor] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<
    | null
    | {
      code: string;
      discount_type: 'percent' | 'fixed';
      discount_value: number;
      estimated_discount: number;
    }
  >(null);
  const [isFav, setIsFav] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerCity, setViewerCity] = useState<string | null>(null);
  const [viewerState, setViewerState] = useState<string | null>(null);
  const [viewerZip, setViewerZip] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [shippingBase, setShippingBase] = useState<number | null>(null);
  const [shippingMarkupPercent, setShippingMarkupPercent] = useState<number>(0);
  const [shippingMarkupFixed, setShippingMarkupFixed] = useState<number>(0);
  const [dynamicShippingCost, setDynamicShippingCost] = useState<number | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [auctionCountdown, setAuctionCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; expired: boolean; totalMs: number } | null>(null);
  const settleRetryRef = useRef<number>(0);
  const settleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleDoneRef = useRef(false);
  const [isVideoPlayed, setIsVideoPlayed] = useState(false);
  useEffect(() => {
    if (!listing) return;
    if (listing.sale_type !== 'auction' || !listing.auction_end_at) return;
    if (!auctionCountdown?.expired) return;

    // If listing is already sold/deleted, no need to settle — stop immediately
    // NOTE: Do NOT skip 'paused' — the cron pauses listings before creating orders,
    // so a paused listing with no order needs settle-one to retry.
    if (['sold', 'deleted'].includes(listing.status)) return;

    // Already done or already running
    if (settleDoneRef.current) return;
    if (settleTimerRef.current) return;

    const doSettle = async () => {
      try {
        const res = await fetch('/api/auctions/settle-one', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: listing.id }),
          keepalive: true,
        });
        const json = await res.json().catch(() => ({}));

        // Stop retrying if order was created or already exists
        if (
          (json.ok && json.settled && json.order_id) ||
          (json.ok && json.idempotent) ||
          (json.ok && json.skipped && json.reason === 'already_processed')
        ) {
          settleDoneRef.current = true;
          if (settleTimerRef.current) {
            clearInterval(settleTimerRef.current);
            settleTimerRef.current = null;
          }
          return;
        }
      } catch {
        // ignore, will retry
      }
      settleRetryRef.current++;
      // Stop after 30 retries (7.5 min) — cron will handle the rest
      if (settleRetryRef.current >= 30 && settleTimerRef.current) {
        clearInterval(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };

    // Fire immediately + every 15s
    void doSettle();
    settleTimerRef.current = setInterval(doSettle, 15000);

    return () => {
      if (settleTimerRef.current) {
        clearInterval(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [auctionCountdown?.expired, listing?.id, listing?.sale_type, listing?.auction_end_at, listing?.status]);
  const [bidHistory, setBidHistory] = useState<{ id: string; bidder_id: string; bidder_name: string; amount: number; created_at: string }[]>([]);
  const [isBidsHistoryOpen, setIsBidsHistoryOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);

  // Wholesale & Badges
  const [sellerIsWholesaler, setSellerIsWholesaler] = useState(false);
  const [sellerIsManufacturer, setSellerIsManufacturer] = useState(false);
  const [buyerQty, setBuyerQty] = useState(1);

  const { relevantAttributes, rootCategory } = useMemo(() => {
    if (!listing?.category) return { relevantAttributes: UNIVERSAL_ATTRIBUTES, rootCategory: null };

    for (const genderKey in NEW_CATEGORIES_CONFIG) {
      const categories = NEW_CATEGORIES_CONFIG[genderKey];
      for (const cat of categories) {
        const sub = cat.subcategories.find((s) => s.id === listing.category || s.label === listing.category);
        if (sub) {
          return {
            relevantAttributes: [...UNIVERSAL_ATTRIBUTES, ...(cat.attributes || []), ...(sub.attributes || [])],
            rootCategory: genderKey
          };
        }
        if (cat.id === listing.category || cat.label === listing.category) {
          return {
            relevantAttributes: [...UNIVERSAL_ATTRIBUTES, ...(cat.attributes || [])],
            rootCategory: genderKey
          };
        }
      }
    }
    return { relevantAttributes: UNIVERSAL_ATTRIBUTES, rootCategory: null };
  }, [listing?.category]);

  const isFashion = rootCategory ? ['Mujer', 'Hombre', 'Niños, Niñas y Bebés', 'Accesorios de Moda', 'Ropa Especializada / Otros'].includes(rootCategory) : false;
  const isColorRelevant = isFashion || relevantAttributes.some(a => a.id === 'color');
  const isSizeRelevant = isFashion || relevantAttributes.some(a => a.id === 'size');
  const shippingSubsidy = Number(listing?.shipping_subsidy || 0);
  const baseShippingCost = dynamicShippingCost ?? shippingBase;
  const totalShippingCost = baseShippingCost !== null
    ? Math.max(0, baseShippingCost * (1 + shippingMarkupPercent / 100) + shippingMarkupFixed)
    : null;
  const buyerShippingCost = totalShippingCost !== null
    ? Math.max(0, totalShippingCost - shippingSubsidy)
    : null;
  const listingShippingPrice = Number(listing?.shipping_price || 0);
  const hasListingShippingPrice = Number.isFinite(listingShippingPrice) && listingShippingPrice > 0;

  // Sincronizar stock con el carrito
  useEffect(() => {
    let cancelled = false;
    const fetchCart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('cart_items')
        .select('listing_id, quantity, selected_size')
        .eq('user_id', session.user.id);
      if (!cancelled && data) {
        setCartItems(data);
      }
    };

    fetchCart();

    const handleUpdate = () => fetchCart();
    window.addEventListener('cart-updated', handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('cart-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!listing) return;
    if (listing.shipping_by_seller || listing.free_shipping) return;

    const w = Number(listing.weight_kg || 0);
    const l = Number(listing.length_cm || 0);
    const wd = Number(listing.width_cm || 0);
    const h = Number(listing.height_cm || 0);

    if (w > 0 && l > 0 && wd > 0 && h > 0) {
      const calc = async () => {
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token;

          const res = await fetch('/api/estafeta/calculate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              weight_kg: w,
              length_cm: l,
              width_cm: wd,
              height_cm: h,
            }),
          });

          const json = await res.json();
          if (json.ok && json.cost) {
            setDynamicShippingCost(json.cost);
          }
        } catch (e) {
          console.error('Error calculating dynamic shipping', e);
        }
      };
      calc();
    }
  }, [listing]);

  const [questions, setQuestions] = useState<ListingQuestionRow[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const [moreFromSeller, setMoreFromSeller] = useState<SellerListingRow[]>([]);
  const [isMoreLoading, setIsMoreLoading] = useState(false);

  // Cargar viewerId inmediatamente al montar el componente (antes de cargar el listing)
  // Esto previene el delay donde arriba muestra "Hola, usuario" pero abajo pide iniciar sesión
  useEffect(() => {
    let cancelled = false;
    const loadAuth = async () => {
      try {
        // Usar getSession() que es más rápido que getUser() para verificar sesión
        const { data: sessionData } = await supabase.auth.getSession();
        let uid = sessionData?.session?.user?.id;

        if (!uid) {
          // Si no hay sesión, verificar con getUser() por si acaso
          const { data: userData } = await supabase.auth.getUser();
          uid = userData?.user?.id;
        }

        if (uid) {
          if (!cancelled) setViewerId(uid);
          // Fetch profile for location (para entrega personal)
          const { data: profile } = await supabase.from('profiles').select('city,state,zip_code').eq('id', uid).maybeSingle();
          if (profile && !cancelled) {
            setViewerCity(profile.city);
            setViewerState(profile.state);
            setViewerZip(profile.zip_code);
          }
        } else {
          if (!cancelled) {
            setViewerId(null);
            setViewerCity(null);
            setViewerState(null);
            setViewerZip(null);
          }
        }
      } catch {
        if (!cancelled) setViewerId(null);
      }
    };
    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, []); // Ejecutar solo una vez al montar

  // Tracking de vista (Metrics Module)
  useEffect(() => {
    if (listing?.id) {
      fetch('/api/metrics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'view', data: { listing_id: listing.id } }),
        keepalive: true,
      }).catch(err => console.error('[Tracking] Error logging view:', err));
    }
  }, [listing?.id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        const rawId = String(p?.id || '').trim();
        // Aceptar UUID o public_id (ej: PCK-XXXX...). Si viene public_id, resolvemos al UUID y redirigimos.
        if (!rawId || rawId === '[id]') {
          setListing(null);
          setError('Ruta inválida. Abre una publicación desde “Explorar” (/listings).');
          return;
        }

        // Cargar settings en paralelo siempre
        const settingsPromise = supabase
          .from('app_settings')
          .select('shipping_base, shipping_markup_fixed, shipping_markup_percent')
          .single();

        // Usar API server-side (bypass RLS) para cargar la publicación
        let authHeader = '';
        let currentViewerId: string | null = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            authHeader = `Bearer ${sessionData.session.access_token}`;
            currentViewerId = sessionData.session.user?.id ?? null;
            if (!cancelled && currentViewerId) setViewerId(currentViewerId);
          }
        } catch {
          // Continuar sin auth
        }

        const listingPromise = fetch(
          `${typeof window !== 'undefined' ? window.location.origin : ''}/api/listings/${encodeURIComponent(rawId)}`,
          { headers: authHeader ? { Authorization: authHeader } : {} }
        ).then((r) => r.json().catch(() => ({})));

        const [settingsRes, listingJson] = await Promise.all([settingsPromise, listingPromise]);

        // Procesar Settings
        const settings = settingsRes.data;
        if (settings) {
          const base = Number(settings.shipping_base) || 0;
          const markupFixed = Number(settings.shipping_markup_fixed) || 0;
          const markupPercent = Number((settings as any).shipping_markup_percent) || 0;
          if (!cancelled) {
            setShippingBase(base);
            setShippingMarkupFixed(markupFixed);
            setShippingMarkupPercent(markupPercent);
          }
        }

        // Procesar Listing o Redirección
        const isIdUuid = isUuid(rawId);
        if (!isIdUuid) {
          // Lógica de redirección por public_id (la API devuelve el objeto completo)
          const realId = String(listingJson?.id || '').trim();
          if (realId && isUuid(realId)) {
            window.location.href = `/listings/${realId}`;
            return;
          }
          // Si falló, mostrar error
          setListing(null);
          setError('Publicación no encontrada. Abre una publicación desde “Explorar” (/listings).');
          return;
        }

        // La API devuelve { error } en caso de fallo o el objeto listing en éxito
        if (listingJson?.error) {
          const errMsg = String(listingJson.error);
          setError(errMsg.includes('estado') && errMsg.includes('visible para el vendedor')
            ? errMsg
            : errMsg.includes('no encontrada') || errMsg.includes('404')
              ? 'Publicación no encontrada. Es posible que ya no esté disponible.'
              : errMsg);
          setListing(null);
          return;
        }
        if (!listingJson?.id) {
          setError('Publicación no encontrada. Es posible que ya no esté disponible.');
          setListing(null);
          return;
        }

        const row = listingJson as ListingRow;
        const isOwner = !!currentViewerId && !!row.seller_id && currentViewerId === row.seller_id;

        if (!cancelled) {
          // Tracking de vista (fire and forget)
          if (row.status === 'active' || isOwner) {
            fetch('/api/metrics/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'view', data: { listing_id: row.id, source: 'direct' } }),
              keepalive: true,
            }).catch((err) => console.error('[Tracking] Error logging view:', err));
          }

          setListing(row);
          const hb = typeof row.auction_highest_bid === 'number' ? row.auction_highest_bid : Number(row.auction_highest_bid ?? 0);
          const inc = typeof row.auction_bid_increment === 'number' ? row.auction_bid_increment : Number(row.auction_bid_increment ?? 0);
          if (row.sale_type === 'auction') {
            setBidAmount(Math.max(0, hb + Math.max(inc, 1)));
          }
          // Normalizar y inicializar color seleccionado: si hay variantes, usar el primero; si no, usar el color principal
          const normalizedColorVariants = normalizeArray(row.color_variants);
          if (normalizedColorVariants && normalizedColorVariants.length > 0) {
            setSelectedColor(normalizedColorVariants[0]);
          } else if (row.color) {
            setSelectedColor(row.color);
          } else {
            setSelectedColor(null);
          }
          // Normalizar y inicializar talla seleccionada: si hay variantes, usar la primera; si no, usar la talla principal
          const normalizedSizeVariants = normalizeArray(row.size_variants);
          if (normalizedSizeVariants && normalizedSizeVariants.length > 0) {
            setSelectedSize(normalizedSizeVariants[0]);
          } else if (row.size) {
            setSelectedSize(row.size);
          } else {
            setSelectedSize(null);
          }

          // Inicializar datos del vendedor desde el join (para evitar waterfall request)
          if (row.seller) {
            const s = row.seller;
            const isOfficial = Boolean(s.is_official_store);
            const officialName = s.official_store_name;
            const name = (isOfficial && officialName) ? officialName : (s.full_name || 'Vendedor');

            setSellerName(name);
            setSellerState(s.state?.trim() || null);
            setSellerCity(s.city?.trim() || null);
            setSellerZip(s.zip_code?.trim() || null);
            setSellerStoreLogo(s.store_logo_url);
            setSellerPlanType(s.plan_type);
            setSellerIsVerified(Boolean(s.is_verified));
            setSellerIsOfficial(isOfficial);
            setSellerOfficialName(s.official_store_name || null);
            setSellerOfficialBanner(s.official_store_banner_url || null);
            setSellerOfficialBrandColor(s.official_store_brand_color || null);
            setSellerIsWholesaler(Boolean(s.is_wholesaler));
            setSellerIsManufacturer(Boolean(s.is_manufacturer));

            // Rating & Operations Calculation (Client-side approximation)
            let pct = 100;
            const total = Number(s.rating_total_count || 0);
            const good = Number(s.rating_good_count || 0);
            const rep = Number(s.reputation_score || 0);
            const manualRep = s.manual_reputation_score !== undefined && s.manual_reputation_score !== null
              ? Number(s.manual_reputation_score)
              : null;

            if (manualRep !== null) {
              pct = Math.max(0, Math.min(100, manualRep));
            } else if (total > 0) {
              pct = Math.max(0, Math.min(100, Math.round((good / total) * 100)));
            } else {
              pct = Math.max(0, Math.min(100, Math.round(rep || 100)));
            }
            setSellerRatingPercent(pct);
            setSellerBadge(badgeForPercent(pct));

            const manualSales = s.manual_sales_count !== undefined && s.manual_sales_count !== null
              ? Number(s.manual_sales_count)
              : null;
            if (manualSales !== null) {
              setSellerOperationsCount(manualSales);
            }
          }
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la publicación.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [p?.id]);

  useEffect(() => {
    // Contabilizar vista (y autopausar si expiró) vía server-side
    const rawId = String(p?.id || '').trim();
    if (!rawId || rawId === '[id]' || !isUuid(rawId)) return;
    void fetch('/api/listings/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: rawId }),
    }).catch(() => null);
  }, [p?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadExtras = async () => {
      if (!listing) return;
      try {
        const fetchSeller = !listing.seller; // Si ya tenemos datos del vendedor (join), no hacer fetch

        const [sellerRes, couponRes] = await Promise.all([
          fetchSeller
            ? fetch(`/api/sellers/${encodeURIComponent(listing.seller_id)}`).then((r) => r.json().catch(() => ({})))
            : Promise.resolve(null),
          fetch(`/api/coupons/for-listing?listingId=${encodeURIComponent(listing.id)}`).then((r) => r.json().catch(() => ({}))),
        ]);

        if (!cancelled) {
          if (sellerRes) {
            if (sellerRes?.name) setSellerName(String(sellerRes.name));
            if (sellerRes?.state) setSellerState(String(sellerRes.state).trim() || null);
            else setSellerState(null);
            if (sellerRes?.city) setSellerCity(String(sellerRes.city).trim() || null);
            else setSellerCity(null);
            if (sellerRes?.zip_code) setSellerZip(String(sellerRes.zip_code).trim() || null);
            else setSellerZip(null);
            if (sellerRes?.store_logo_url) setSellerStoreLogo(sellerRes.store_logo_url);
            if (sellerRes?.plan_type) setSellerPlanType(sellerRes.plan_type);
            if (typeof sellerRes?.rating_percent === 'number') setSellerRatingPercent(sellerRes.rating_percent);
            else if (typeof sellerRes?.rating_percent === 'string') setSellerRatingPercent(Number(sellerRes.rating_percent) || 100);
            setSellerBadge((sellerRes?.badge as any) ?? null);
            setSellerIsVerified(Boolean(sellerRes?.is_verified ?? false));
            setSellerOperationsCount(typeof sellerRes?.operations_count === 'number' ? sellerRes.operations_count : null);
            if (sellerRes?.is_official_store) setSellerIsOfficial(true);
            if (sellerRes?.official_store_name) setSellerOfficialName(sellerRes.official_store_name);
            if (sellerRes?.official_store_banner_url) setSellerOfficialBanner(sellerRes.official_store_banner_url);
            if (sellerRes?.official_store_brand_color) setSellerOfficialBrandColor(sellerRes.official_store_brand_color);
            setSellerIsWholesaler(Boolean(sellerRes?.is_wholesaler ?? false));
            setSellerIsManufacturer(Boolean(sellerRes?.is_manufacturer ?? false));
          }

          if (couponRes?.available && couponRes?.best) setCoupon(couponRes.best);
          else setCoupon(null);
        }
      } catch {
        // opcional: silencioso para no romper el detalle si falla el server
      }
    };
    void loadExtras();
    return () => {
      cancelled = true;
    };
  }, [listing]);

  // Más publicaciones del mismo vendedor (para "similares del vendedor")
  useEffect(() => {
    let cancelled = false;
    const loadMore = async () => {
      if (!listing?.id || !listing?.seller_id) return;
      try {
        setIsMoreLoading(true);

        const sellerId = String(listing.seller_id || '').trim();
        const listingId = String(listing.id || '').trim();

        const run = async (selectCols: string, useStatusFilter: boolean, useSellerIdCol: 'seller_id' | 'user_id') => {
          let q: any = supabase
            .from('listings')
            .select(selectCols)
            .eq(useSellerIdCol, sellerId)
            .neq('id', listingId)
            .order('created_at', { ascending: false })
            .limit(8);
          if (useStatusFilter) q = q.eq('status', 'active');
          return await q;
        };

        // Intento 1: schema esperado
        let res: any = await run('id,public_id,title,price,currency,images,status,created_at,seller_id', true, 'seller_id');

        if (res?.error) {
          const code = String((res.error as any)?.code || '');
          const msg = String((res.error as any)?.message || '').toLowerCase();

          // Columnas faltantes (public_id, seller_id, etc)
          if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
            // 1) sin public_id
            res = await run('id,title,price,currency,images,status,created_at', true, 'seller_id');
            if (res?.error) {
              const msg2 = String((res.error as any)?.message || '').toLowerCase();
              // 2) seller_id no existe → user_id
              if (String((res.error as any)?.code || '') === '42703' || msg2.includes('seller_id') || msg2.includes('column')) {
                res = await run('id,title,price,currency,images,status,created_at', true, 'user_id');
              }
            }
          }

          // ENUM inválido para status 'active' → reintentar sin filtro status (RLS suele filtrar igual)
          if (res?.error) {
            const code2 = String((res.error as any)?.code || '');
            const msg2 = String((res.error as any)?.message || '').toLowerCase();
            if (code2 === '22P02' && msg2.includes('enum') && msg2.includes('active')) {
              res = await run('id,title,price,currency,images,status,created_at', false, 'seller_id');
              if (res?.error) res = await run('id,title,price,currency,images,status,created_at', false, 'user_id');
            }
          }
        }

        if (res?.error) throw res.error;
        if (!cancelled) setMoreFromSeller((((res.data as any[]) ?? []) as SellerListingRow[]) ?? []);
      } catch {
        if (!cancelled) setMoreFromSeller([]);
      } finally {
        if (!cancelled) setIsMoreLoading(false);
      }
    };

    void loadMore();
    return () => {
      cancelled = true;
    };
  }, [listing?.id, listing?.seller_id]);

  useEffect(() => {
    let cancelled = false;
    const loadFavorite = async () => {
      if (!listing) return;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          if (!cancelled) setIsFav(false);
          if (!cancelled) setViewerId(null);
          return;
        }
        if (!cancelled) setViewerId(user.id);
        const { data, error } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', listing.id)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setIsFav(Boolean(data));
      } catch {
        if (!cancelled) setIsFav(false);
      }
    };
    void loadFavorite();
    return () => {
      cancelled = true;
    };
  }, [listing]);

  useEffect(() => {
    const listingId = listing?.id || null;
    let cancelled = false;
    const loadQs = async () => {
      if (!listingId) return;
      try {
        setIsQuestionsLoading(true);
        setQuestionsError(null);
        let res: any = await supabase
          .from('listing_questions')
          .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
          .eq('listing_id', listingId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(50);

        if (res?.error) {
          const code = String(res.error?.code || '');
          const msg = String(res.error?.message || '');
          const low = msg.toLowerCase();
          if (code === '42P01' || low.includes('does not exist') || low.includes('schema cache') || code === 'PGRST106') {
            if (!cancelled) {
              setQuestions([]);
              setQuestionsError('Falta configurar la tabla de preguntas. Ejecuta `supabase_listing_questions.sql` en Supabase.');
            }
            return;
          }
          throw res.error;
        }

        if (!cancelled) setQuestions(((res.data as any[]) ?? []) as ListingQuestionRow[]);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setQuestionsError(e instanceof Error ? e.message : 'No se pudieron cargar las preguntas.');
      } finally {
        if (!cancelled) setIsQuestionsLoading(false);
      }
    };
    void loadQs();
    return () => {
      cancelled = true;
    };
  }, [listing?.id]);

  const askQuestion = async () => {
    if (!listing) return;
    setError(null);
    setSuccess(null);
    setQuestionsError(null);
    try {
      setIsAsking(true);
      const text = questionInput.trim();
      if (text.length < 3) {
        setQuestionsError('Escribe una pregunta más clara (mínimo 3 caracteres).');
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        redirectToLogin();
        return;
      }
      const res = await fetch('/api/questions/ask-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: listing.id, question: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar tu pregunta.');

      setQuestionInput('');
      setSuccess('Pregunta enviada. El vendedor será notificado.');

      // refrescar preguntas
      const qres: any = await supabase
        .from('listing_questions')
        .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at,answered_at,is_deleted')
        .eq('listing_id', listing.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!qres.error) setQuestions(((qres.data as any[]) ?? []) as ListingQuestionRow[]);
    } catch (e: unknown) {
      console.error(e);
      setQuestionsError(e instanceof Error ? e.message : 'No se pudo enviar tu pregunta.');
    } finally {
      setIsAsking(false);
    }
  };

  const toggleFavorite = async () => {
    if (!listing) return;
    setError(null);
    setSuccess(null);
    setIsFavLoading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        redirectToLogin();
        return;
      }

      if (isFav) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listing.id);
        if (error) throw error;
        setIsFav(false);
        setSuccess('Quitado de favoritos.');
      } else {
        const { error } = await supabase
          .from('favorites')
          .upsert({ user_id: user.id, listing_id: listing.id }, { onConflict: 'user_id,listing_id' });
        if (error) throw error;
        setIsFav(true);
        setSuccess('Guardado en favoritos.');
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar favoritos.');
    } finally {
      setIsFavLoading(false);
    }
  };

  const shareListing = async () => {
    if (!listing) return;
    // Importante: el comprador SOLO puede ver publicaciones "active" por RLS.
    // Si el vendedor comparte una publicación en draft/paused, al comprador le saldrá "Publicación no encontrada".
    if (String((listing as any).status || '').trim() !== 'active') {
      setError('Esta publicación no está pública (no está Activa). Actívala en Dashboard → Mis publicaciones y vuelve a compartir.');
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareId = String((listing as any).public_id || '').trim() || String(listing.id || '').trim();
    const url = origin && shareId ? `${origin}/listings/${encodeURIComponent(shareId)}` : '';

    if (!url) {
      setError('No se pudo obtener el link.');
      return;
    }

    // Tracking de share (fire and forget)
    fetch('/api/metrics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'share', data: { listing_id: listing.id, platform: 'copy_link' } }),
      keepalive: true,
    }).catch((err) => console.error('[Tracking] Error logging share:', err));

    try {
      // Copiar al portapapeles
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        // best-effort: contabilizar "compartido"
        void fetch('/api/listings/share', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id }),
        }).catch(() => null);
        setSuccess('Link copiado al portapapeles.');
        return;
      }
      // Fallback para navegadores antiguos
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        void fetch('/api/listings/share', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id }),
        }).catch(() => null);
        setSuccess('Link copiado al portapapeles.');
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo copiar el link.');
    }
  };

  const price = useMemo(() => (listing ? getPrice(listing) : 0), [listing]);
  const images = useMemo(() => (listing?.images ?? []).filter(Boolean), [listing]);
  const isAuction = useMemo(() => (listing?.sale_type ?? 'direct') === 'auction', [listing]);
  const highestBid = useMemo(() => {
    const hb = listing?.auction_highest_bid;
    const n = typeof hb === 'number' ? hb : Number(hb ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [listing]);
  const bidIncrement = useMemo(() => {
    const inc = listing?.auction_bid_increment;
    const n = typeof inc === 'number' ? inc : Number(inc ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [listing]);

  const currentStock = useMemo(() => {
    if (!listing) return 0;

    let stock = 0;
    let foundSpecific = false;

    // Si hay talla seleccionada, buscar su stock específico
    if (selectedSize && listing.size_stock) {
      let sStock: any = listing.size_stock;
      if (typeof sStock === 'string') {
        try { sStock = JSON.parse(sStock); } catch { sStock = {}; }
      }
      if (sStock && typeof sStock === 'object') {
        const val = sStock[selectedSize];
        if (typeof val === 'number') {
          stock = val;
          foundSpecific = true;
        }
      }
    }

    // Fallback al stock global si no se encontró stock específico
    if (!foundSpecific) {
      const st = typeof listing.stock === 'number' ? listing.stock : Number(listing.stock ?? 0);
      stock = Number.isFinite(st) ? st : 0;
    }

    // Ajustar con items del carrito
    if (cartItems.length > 0) {
      const relevantItems = cartItems.filter(item => item.listing_id === listing.id);

      if (foundSpecific) {
        // Si estamos viendo stock de talla específica, restar solo los de esa talla
        const inCart = relevantItems
          .filter(item => item.selected_size === selectedSize)
          .reduce((sum, item) => sum + item.quantity, 0);
        stock = Math.max(0, stock - inCart);
      } else {
        // Si estamos viendo stock global, restar todo lo que haya de este producto en el carrito
        const inCart = relevantItems.reduce((sum, item) => sum + item.quantity, 0);
        stock = Math.max(0, stock - inCart);
      }
    }

    return stock;
  }, [listing, selectedSize, cartItems]);

  // Auction countdown timer
  useEffect(() => {
    if (!listing || listing.sale_type !== 'auction' || !listing.auction_end_at) return;
    const tick = () => {
      const now = Date.now();
      const end = new Date(listing.auction_end_at!).getTime();
      const diff = end - now;
      if (diff <= 0) {
        setAuctionCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, totalMs: 0 });
        return;
      }
      setAuctionCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
        totalMs: diff,
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [listing?.sale_type, listing?.auction_end_at]);

  // Fetch bid history for auctions
  useEffect(() => {
    if (!listing?.id || listing.sale_type !== 'auction') return;
    fetch(`/api/bids/history?listingId=${listing.id}`)
      .then(r => r.json())
      .then(d => { if (d.ok && Array.isArray(d.bids)) setBidHistory(d.bids); })
      .catch(() => { });
  }, [listing?.id, listing?.sale_type]);

  const sellerBadgeLabel = useMemo(() => {
    if (sellerBadge === 'platinum') return 'Vendedor Platinum';
    if (sellerBadge === 'gold') return 'Vendedor Gold';
    if (sellerBadge === 'plata') return 'Vendedor Plata';
    return null;
  }, [sellerBadge]);

  const placeBid = async () => {
    setError(null);
    setSuccess(null);
    setIsBidding(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/';
        return;
      }
      if (!listing) {
        setError('Publicación no encontrada.');
        return;
      }
      if (listing.status !== 'active') {
        setError('La subasta no está activa.');
        return;
      }
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('No se encontró el token de sesión para pujar.');

      const res = await fetch('/api/bids/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ listingId: listing.id, amount: Number(bidAmount) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo registrar tu puja.');

      const newHighest = Number(json?.newHighest ?? bidAmount);
      setSuccess('¡Puja registrada!');
      setListing((prev) =>
        prev
          ? {
            ...prev,
            auction_highest_bid: newHighest,
            auction_highest_bidder_id: user.id,
          }
          : prev,
      );
      setBidAmount(newHighest + Math.max(bidIncrement, 1));
      // Refresh bid history after successful bid
      if (listing?.id) {
        fetch(`/api/bids/history?listingId=${listing.id}`)
          .then(r => r.json())
          .then(d => { if (d.ok && Array.isArray(d.bids)) setBidHistory(d.bids); })
          .catch(() => { });
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo pujar.');
    } finally {
      setIsBidding(false);
    }
  };

  const addToCart = async () => {
    setError(null);
    setSuccess(null);

    if (!listing) {
      setError('Publicación no encontrada.');
      return;
    }
    if (listing.sale_type === 'auction') {
      setError('Las subastas no usan carrito. Usa el botón de pujar.');
      return;
    }
    if (listing.status !== 'active') {
      setError('Esta publicación no está disponible para compra.');
      return;
    }
    if (listing.seller_id && viewerId && listing.seller_id === viewerId) {
      setError('No puedes agregar tu propia publicación al carrito.');
      return;
    }
    if (currentStock <= 0) {
      setError('No hay stock disponible.');
      return;
    }

    setIsAdding(true);

    try {
      let accessToken: string | undefined;
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        accessToken = refreshed.session?.access_token;
      }

      if (!accessToken) {
        const returnTo = typeof window !== 'undefined' ? window.location.pathname : '/listings';
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }

      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          listingId: listing.id,
          quantity: buyerQty,
          selected_size: selectedSize || undefined,
          selected_color: selectedColor || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Error al agregar al carrito');
      }

      setSuccess('Agregado al carrito.');
      window.dispatchEvent(new CustomEvent('cart-updated'));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'No se pudo agregar al carrito.';
      setError(msg);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/"><img src="/logo.png" alt="GoVendy" className="h-10 w-auto object-contain" /></Link>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Detalle</div>
              <div className="text-xs text-gray-500">Publicación</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link
              href="/listings"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Volver
            </Link>
            <Link
              href="/cart"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Carrito
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {listing && listing.attributes?.moderation_status === 'review_needed' && viewerId === listing.seller_id && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <div className="flex gap-3">
              <div className="shrink-0 text-2xl">⚠️</div>
              <div>
                <h3 className="font-bold text-amber-900">Publicación bajo revisión</h3>
                <p className="mt-1 text-sm text-amber-800">
                  Hemos detectado contenido que podría infringir nuestras políticas (datos de contacto o enlaces externos).
                  Tu publicación es visible, pero un administrador la revisará pronto.
                  Si crees que es un error, puedes editarla para eliminar cualquier dato personal.
                </p>
                <div className="mt-3">
                  <Link
                    href={`/dashboard/listings/${listing.id}/edit`}
                    className="inline-flex rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm ring-1 ring-amber-200 hover:bg-amber-50"
                  >
                    Editar Publicación
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="aspect-[4/5] rounded-3xl bg-white/70 ring-1 ring-black/5" />
            <div className="h-72 rounded-3xl bg-white/70 ring-1 ring-black/5" />
          </div>
        ) : !listing ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-bold text-gray-900">Publicación no encontrada</div>
            <p className="mt-2 text-sm text-gray-600">Es posible que ya no esté disponible.</p>
            <div className="mt-6">
              <Link
                href="/listings"
                className="inline-flex rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
              >
                Volver a explorar
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Center Content (Gallery + Related + Panels) */}
            <div className="lg:col-span-7 space-y-6">
              <ProductGallery images={images} title={listing.title} />

              {/* Trust Panels in Empty Space */}
              <div className="hidden lg:grid gap-4 grid-cols-2">
                <TrustPanel />
                <SafeShoppingPromo />
              </div>

              {/* Wholesale Pricing Table */}
              {(() => {
                const _wt = !isAuction ? parseWholesaleTiers(listing) : []; return _wt.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl ring-1 ring-blue-200 shadow-lg shadow-blue-100/50">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏪</span>
                        <div>
                          <div className="text-sm font-black text-white tracking-wide">Ahorra con este vendedor Precios de Mayoreo</div>
                          <div className="text-[10px] font-medium text-blue-200">Este vendedor maneja precios especiales por volumen</div>
                        </div>
                      </div>
                    </div>

                    {/* Price Table */}
                    <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-4 px-0">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                            <th className="text-left pb-2 pl-5">Cantidad</th>
                            <th className="text-center pb-2">Precio c/u</th>
                            <th className="text-right pb-2 pr-5">Ahorro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseWholesaleTiers(listing).map((tier, i) => {
                            const isActive = buyerQty >= tier.min && (tier.max === null || buyerQty <= tier.max);
                            const savePct = price > 0 ? Math.round((1 - tier.price / price) * 100) : 0;
                            return (
                              <tr
                                key={i}
                                className={`transition-all text-sm ${isActive
                                  ? 'bg-blue-600 text-white shadow-lg'
                                  : i % 2 === 0 ? 'bg-white/50' : 'bg-blue-50/30'
                                  }`}
                              >
                                <td className="py-2.5 pl-5 font-semibold">
                                  {isActive && <span className="mr-1">▶</span>}
                                  {tier.min}{tier.max === null ? '+' : ` – ${tier.max}`} pzas
                                </td>
                                <td className="py-2.5 text-center font-extrabold">
                                  {formatMoney(tier.price)}
                                </td>
                                <td className="py-2.5 pr-5 text-right">
                                  {savePct > 0 ? (
                                    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black ${isActive ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700'}`}>
                                      -{savePct}%
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">Precio base</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Quantity Selector */}
                      <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-blue-200/60 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-blue-900">Cantidad:</span>
                          <div className="flex items-center overflow-hidden rounded-xl ring-1 ring-blue-300">
                            <button
                              type="button"
                              onClick={() => setBuyerQty(q => Math.max(1, q - 1))}
                              className="px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                            >−</button>
                            <input
                              type="number"
                              min={1}
                              max={currentStock || 999}
                              value={buyerQty}
                              onChange={e => {
                                const v = Math.max(1, Math.min(currentStock || 999, parseInt(e.target.value, 10) || 1));
                                setBuyerQty(v);
                              }}
                              className="w-16 border-x border-blue-200 bg-white px-2 py-2 text-center text-sm font-extrabold text-gray-900 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setBuyerQty(q => Math.min(currentStock || 999, q + 1))}
                              className="px-3 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                            >+</button>
                          </div>
                        </div>

                        {/* Dynamic subtotal */}
                        {(() => {
                          const tiers = parseWholesaleTiers(listing);
                          const activeTier = tiers.find(t => buyerQty >= t.min && (t.max === null || buyerQty <= t.max));
                          const unitPrice = activeTier ? activeTier.price : price;
                          const subtotal = unitPrice * buyerQty;
                          return (
                            <div className="text-right">
                              <div className="text-[10px] font-semibold text-blue-700">{buyerQty} × {formatMoney(unitPrice)}</div>
                              <div className="text-lg font-black text-blue-900">{formatMoney(subtotal)}</div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        type="button"
                        onClick={addToCart}
                        disabled={isAdding || currentStock <= 0 || listing.seller_id === viewerId}
                        className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/40 transition-all hover:scale-[1.02] hover:shadow-blue-600/50 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
                      >
                        <div className="relative z-10 flex items-center gap-2">
                          {isAdding ? (
                            <>
                              <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Agregando...</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-5 w-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span>Agregar al Carrito</span>
                            </>
                          )}
                        </div>
                        <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent z-0 bg-[length:200%_100%]" />
                      </button>

                      {/* Secure Payment Notice */}
                      <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-base">🔒</span>
                          <div>
                            <div className="text-xs font-bold text-amber-900">Compra Segura — Pagos Protegidos</div>
                            <div className="mt-1 text-[11px] leading-relaxed text-amber-800">
                              La plataforma solo asegura tu compra al pagar con métodos seguros: <strong>MercadoPago</strong>, <strong>PocketCash</strong> o <strong>pagos fuera de línea autorizados</strong>. Protege tu inversión usando estos métodos de pago.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="space-y-8 mt-8">
                {/* Características del producto (tabla ML-style) */}
                {(() => {
                  const mlAttrs = (listing as any).attributes?.ml_attributes;
                  if (!mlAttrs || typeof mlAttrs !== 'object' || Object.keys(mlAttrs).length === 0) return null;

                  const entries = Object.entries(mlAttrs as Record<string, { name: string; value: string; value_name?: string }>);

                  return (
                    <div className="w-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                      <h2 className="text-sm font-bold text-gray-900 mb-3">Características del producto</h2>
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <table className="w-full text-xs">
                          <tbody>
                            {entries.map(([key, attr], i) => (
                              <tr key={key} className={i % 2 === 0 ? 'bg-gray-50/70' : 'bg-white'}>
                                <td className="px-3 py-1.5 text-gray-500 w-2/5 border-r border-gray-100">
                                  {attr.name}
                                </td>
                                <td className="px-3 py-1.5 font-medium text-gray-800">
                                  {attr.value_name || (attr.value === 'true' ? 'Sí' : attr.value === 'false' ? 'No' : attr.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Guía de Tallas — sólo para ropa */}
                <ClothingSizeChart
                  category={listing.category}
                  subcategory={(listing as any).subcategory ?? (listing.attributes as any)?.subcategory ?? null}
                  mlCategoryId={(listing.attributes as any)?.ml_category_id ?? null}
                  gender={listing.gender ?? null}
                  customChart={(listing.attributes as any)?.custom_size_chart ?? null}
                />

                {/* Video de YouTube */}
                {(listing as any).youtube_url && (() => {
                  const match = String((listing as any).youtube_url).match(
                    /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/
                  );
                  if (!match) return null;
                  const videoId = match[1];

                  return (
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">🎬</span>
                        <div className="text-sm font-semibold text-gray-900">Video del producto</div>
                      </div>
                      <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-900 group cursor-pointer shadow-inner">
                        {!isVideoPlayed ? (
                          <div
                            className="absolute inset-0 w-full h-full"
                            onClick={() => setIsVideoPlayed(true)}
                          >
                            {/* YouTube Thumbnail Mask */}
                            <img
                              src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                              alt="Video Preview"
                              className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
                              }}
                            />
                            {/* Glassmorphism Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
                                <Play fill="white" size={32} className="ml-1" />
                              </div>
                            </div>
                            {/* Bottom Label Overlay */}
                            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                              <div className="text-[10px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                Haz clic para reproducir
                              </div>
                            </div>
                          </div>
                        ) : (
                          <iframe
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Video del producto"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Descripción */}
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                  <div className="text-sm font-semibold text-gray-900">Descripción</div>
                  {(() => {
                    const blocks = (listing as any).description_blocks as TemplateBlock[] | null | undefined;
                    const hasBlocks = Array.isArray(blocks) && blocks.length > 0;
                    const descHtml = String(listing.description || '');
                    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(descHtml);

                    if (hasBlocks) {
                      return (
                        <div className="mt-3 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                          <BlocksRenderer blocks={blocks ?? []} />
                        </div>
                      );
                    }
                    if (looksLikeHtml) {
                      return (
                        <div className="mt-3 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                          <RichDescriptionContent html={descHtml} />
                        </div>
                      );
                    }
                    return (
                      <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{listing.description || '—'}</p>
                    );
                  })()}
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => {
                        if (!viewerId) {
                          redirectToLogin();
                          return;
                        }
                        setIsReportModalOpen(true);
                      }}
                      className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Flag size={14} />
                      Denunciar esta publicación
                    </button>
                  </div>
                </div>

                {/* Reseñas del producto */}
                <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <ProductReviews listingId={listing.id} sellerId={listing.seller_id} />
                </div>

                {/* Preguntas al vendedor (públicas) */}
                <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Preguntas al vendedor</div>
                      <div className="mt-1 text-xs text-gray-600">Visibles para todos.</div>
                    </div>
                    <Link href="/dashboard/preguntas" className="text-xs font-semibold text-brand-emerald hover:opacity-90">
                      Soy vendedor →
                    </Link>
                  </div>

                  {questionsError ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{questionsError}</div>
                  ) : null}

                  {/* Formulario: solo interesados (no vendedor) */}
                  {listing.seller_id !== viewerId ? (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-900">Haz una pregunta</label>
                      {viewerId ? (
                        <>
                          <div className="mt-2 flex gap-2">
                            <textarea
                              value={questionInput}
                              onChange={(e) => setQuestionInput(e.target.value)}
                              rows={3}
                              className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                              placeholder="Ej. ¿Cuál es la medida, viene con etiqueta, aceptas cambios?"
                            />
                            <div className="flex items-start pt-2">
                              <EmojiPicker
                                popupClassName="right-0 mr-12 origin-top-right"
                                onEmojiSelect={(emoji) => {
                                  setQuestionInput((prev) => prev + emoji);
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={askQuestion}
                              disabled={isAsking}
                              className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:opacity-60"
                            >
                              {isAsking ? 'Enviando…' : 'Enviar pregunta'}
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            <p>Nota: el vendedor recibirá una notificación y podrá responder desde su panel.</p>
                            <p className="mt-1 text-red-600 font-medium">Importante: No incluyas teléfonos, emails, direcciones o enlaces externos.</p>
                          </div>
                        </>
                      ) : (
                        <div className="mt-2 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                          Inicia sesión para preguntar.{' '}
                          <button
                            type="button"
                            onClick={() => redirectToLogin()}
                            className="font-semibold text-brand-emerald hover:opacity-90"
                          >
                            Iniciar sesión →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      Eres el vendedor de esta publicación. Las respuestas se gestionan desde{' '}
                      <span className="font-semibold">Dashboard → Preguntas</span>.
                    </div>
                  )}

                  <div className="mt-5">
                    {isQuestionsLoading ? (
                      <div className="text-sm text-gray-600">Cargando preguntas…</div>
                    ) : questions.length === 0 ? (
                      <div className="text-sm text-gray-600">Aún no hay preguntas.</div>
                    ) : (
                      <div className="space-y-3">
                        {questions.map((q) => (
                          <div key={q.id} className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">Pregunta</div>
                            <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{q.question_text}</div>
                            {q.answer_text ? (
                              <div className="mt-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5">
                                <div className="text-sm font-semibold text-brand-emerald">Respuesta del vendedor</div>
                                <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{q.answer_text}</div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs font-semibold text-gray-500">Sin respuesta aún.</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Reviews Section */}
                <div className="mt-8 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                  <ProductReviews listingId={listing.id} sellerId={listing.seller_id} />
                </div>
              </div>
            </div>

            {/* Right Sidebar (Product Details) */}
            <div className="lg:col-span-5 space-y-6">
              <section className="rounded-[2.5rem] bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                    {listing.status === 'active' ? 'Disponible' : 'No disponible'}
                  </div>
                  {coupon && (
                    <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-green-800 ring-1 ring-green-200">
                      <span>
                        Cupón disponible
                        <span className="ml-1 font-extrabold">
                          {coupon.discount_type === 'percent'
                            ? `-${Math.round(coupon.discount_value)}%`
                            : `-${formatMoney(coupon.discount_value)}`}
                        </span>
                      </span>
                      {coupon.code?.trim() ? (
                        <span className="rounded-md bg-green-100 px-2 py-0.5 font-mono font-bold tracking-wide ring-1 ring-green-300">
                          Código: {String(coupon.code).trim()}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {(() => {
                    const bySeller = Boolean(listing.shipping_by_seller);
                    const allowPickup = Boolean(listing.allow_personal_delivery) && (listing.seller?.plan_type === 'platinum' || listing.sale_type === 'auction');
                    const isFree = Boolean(listing.free_shipping);
                    const hasWeight = Number(listing.weight_kg || 0) > 0;
                    const hasShippingPrice = Number.isFinite(listingShippingPrice) && listingShippingPrice > 0;
                    // GoVendy is available if not seller-managed and has weight or published price
                    const hasGoVendy = !bySeller && !isFree && (hasWeight || hasShippingPrice);
                    const isFreeGoVendy = isFree;
                    const isFreeBySeller = isFree || (Number.isFinite(listingShippingPrice) && listingShippingPrice === 0);
                    const isDigital = listing.product_type === 'digital';
                    const chips: JSX.Element[] = [];

                    if (isDigital) {
                      chips.push(
                        <span key="chip-digital" className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 ring-1 ring-indigo-300">
                          PRODUCTO DIGITAL
                        </span>
                      );
                    } else {
                      if (allowPickup) {
                        chips.push(
                          <span key="chip-pickup" className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 ring-1 ring-purple-300">
                            ENTREGA PERSONAL
                          </span>
                        );
                      }

                      if (bySeller) {
                        chips.push(
                          <span key="chip-seller" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
                            {isFreeBySeller ? 'ENVÍO GRATIS POR VENDEDOR' : 'ENVÍO POR VENDEDOR'}
                          </span>
                        );
                      }

                      if (hasGoVendy || isFreeGoVendy) {
                        chips.push(
                          <span key="chip-gopocket" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200">
                            ENVÍO GOPOCKET{isFreeGoVendy ? ' · GRATIS' : ''}
                          </span>
                        );
                      }

                      // Fallback: if no chips, show default GoVendy
                      if (chips.length === 0) {
                        chips.push(
                          <span key="chip-default" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200">
                            ENVÍO GOPOCKET
                          </span>
                        );
                      }
                    }

                    return chips;
                  })()}
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{listing.title}</h1>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      disabled={isFavLoading}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60 transition-colors ${isFav ? 'text-brand-emerald' : 'text-gray-700'
                        }`}
                      aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill={isFav ? '#1FB59B' : 'none'}
                        stroke={isFav ? '#1FB59B' : 'currentColor'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all"
                        aria-hidden="true"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                    <ShareButton
                      url={(() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.gopocket.com.mx';
                        const shareId = String((listing as any).public_id || '').trim() || String(listing.id || '').trim();
                        return `${origin}/listings/${encodeURIComponent(shareId)}`;
                      })()}
                      title={listing.title}
                      shareText={`🛒 ¡Mira esto en GoVendy!\n${listing.title}\n💰 ${formatMoney(price)}`}
                      onShare={(platform) => {
                        fetch('/api/metrics/track', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'share', data: { listing_id: listing.id, platform } }),
                          keepalive: true,
                        }).catch(() => null);
                        fetch('/api/listings/share', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ listingId: listing.id }),
                        }).catch(() => null);
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  {(() => {
                    // Compute effective wholesale price
                    const tiers = !isAuction ? parseWholesaleTiers(listing) : [];
                    const activeTier = tiers.length > 0 ? tiers.find((t) => buyerQty >= t.min && (t.max === null || buyerQty <= t.max)) : null;
                    const effectivePrice = activeTier ? activeTier.price : price;
                    const hasTierDiscount = activeTier && effectivePrice < price;
                    return (
                      <div>
                        <div className="flex items-center gap-2">
                          {hasTierDiscount && (
                            <span className="text-lg text-gray-400 line-through">{formatMoney(price)}</span>
                          )}
                          <span className="text-2xl font-extrabold text-brand-emerald animate-price-highlight animate-price-glow">
                            {isAuction ? `Puja actual: ${formatMoney(highestBid)}` : formatMoney(effectivePrice)}
                          </span>
                          {hasTierDiscount && (
                            <span className="rounded-lg bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                              -{Math.round((1 - effectivePrice / price) * 100)}%
                            </span>
                          )}
                        </div>
                        {!isAuction && (
                          <div className="mt-1 text-xs font-medium text-gray-500">
                            {currentStock > 0 ? (
                              <span className={currentStock < 5 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                                {currentStock} disponibles
                              </span>
                            ) : (
                              <span className="text-red-600 font-bold">Agotado</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {!isAuction && (
                    <button
                      type="button"
                      onClick={addToCart}
                      disabled={isAdding || currentStock <= 0 || listing.seller_id === viewerId}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-orange-600/40 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Agregar al carrito"
                      title="Agregar al carrito"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <path d="M16 10a4 4 0 01-8 0" />
                      </svg>
                    </button>
                  )}
                </div>
                {listing.public_id ? <div className="mt-1 text-xs font-semibold text-gray-500">ID: {listing.public_id}</div> : null}


                {/* Seller Badges */}
                {(sellerIsManufacturer || sellerIsWholesaler) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sellerIsManufacturer && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-rose-500 to-emerald-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/30">
                        🏭 Fabricante Verificado
                      </span>
                    )}
                    {sellerIsWholesaler && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/30">
                        🏪 Mayorista Verificado
                      </span>
                    )}
                  </div>
                )}

                {/* Seller Badges (standalone — only shown if NO wholesale tiers) */}


                {/* Auction Countdown Timer — Orange Theme */}
                {isAuction && auctionCountdown && (
                  <div className={`mt-4 rounded-2xl overflow-hidden shadow-lg ${auctionCountdown.expired
                    ? 'ring-1 ring-gray-200'
                    : auctionCountdown.totalMs < 3600000
                      ? 'ring-2 ring-red-400/50 shadow-red-200/50'
                      : 'ring-1 ring-orange-300/60 shadow-orange-200/40'
                    }`}>
                    {/* Top gradient bar */}
                    <div className={`h-1 ${auctionCountdown.expired ? 'bg-gray-400'
                      : auctionCountdown.totalMs < 3600000 ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500'
                        : 'bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500'
                      }`} />
                    <div className={`px-5 py-4 ${auctionCountdown.expired
                      ? 'bg-gray-50'
                      : auctionCountdown.totalMs < 3600000
                        ? 'bg-gradient-to-br from-red-50 via-orange-50 to-amber-50'
                        : 'bg-gradient-to-br from-orange-50 via-amber-50/50 to-white'
                      }`}>
                      {auctionCountdown.expired ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                          <Gavel size={18} />
                          <span className="text-sm font-black uppercase tracking-widest">Subasta finalizada</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${auctionCountdown.totalMs < 3600000
                                ? 'bg-red-100 text-red-600'
                                : 'bg-orange-100 text-orange-600'
                                }`}>
                                <Flame size={16} className={auctionCountdown.totalMs < 3600000 ? 'animate-pulse' : ''} />
                              </span>
                              <div>
                                <div className="text-xs font-black uppercase tracking-wider text-gray-500">
                                  {auctionCountdown.totalMs < 3600000 ? '¡Última hora!' : 'La subasta termina en'}
                                </div>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${auctionCountdown.totalMs < 3600000
                              ? 'bg-red-100 text-red-700 animate-pulse'
                              : 'bg-orange-100 text-orange-700'
                              }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${auctionCountdown.totalMs < 3600000 ? 'bg-red-500' : 'bg-orange-500'
                                }`} />
                              Subasta activa
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-2 sm:gap-3">
                            {auctionCountdown.days > 0 && (
                              <>
                                <div className="flex flex-col items-center">
                                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 shadow-lg shadow-orange-500/25">
                                    <span className="text-xl font-black text-white tabular-nums">
                                      {String(auctionCountdown.days).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Días</span>
                                </div>
                                <span className="text-xl font-black text-orange-300 pb-5">:</span>
                              </>
                            )}
                            <div className="flex flex-col items-center">
                              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 shadow-lg shadow-orange-500/25">
                                <span className="text-xl font-black text-white tabular-nums">
                                  {String(auctionCountdown.hours).padStart(2, '0')}
                                </span>
                              </div>
                              <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Horas</span>
                            </div>
                            <span className="text-xl font-black text-orange-300 pb-5">:</span>
                            <div className="flex flex-col items-center">
                              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 shadow-lg shadow-orange-500/25">
                                <span className="text-xl font-black text-white tabular-nums">
                                  {String(auctionCountdown.minutes).padStart(2, '0')}
                                </span>
                              </div>
                              <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Min</span>
                            </div>
                            <span className="text-xl font-black text-orange-300 pb-5">:</span>
                            <div className="flex flex-col items-center">
                              <div className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-lg ${auctionCountdown.totalMs < 3600000
                                ? 'bg-red-600 shadow-red-600/30'
                                : 'bg-orange-600 shadow-orange-600/25'
                                }`}>
                                <span className="text-xl font-black text-white tabular-nums">
                                  {String(auctionCountdown.seconds).padStart(2, '0')}
                                </span>
                              </div>
                              <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Seg</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Current Winner Badge */}
                {isAuction && listing.auction_highest_bidder_id && bidHistory.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg">🏆</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Va ganando</div>
                        <Link
                          href={`/perfil/${listing.auction_highest_bidder_id}`}
                          className="text-sm font-extrabold text-gray-900 hover:text-brand-emerald transition-colors truncate block"
                        >
                          {bidHistory[0]?.bidder_name || 'Usuario'}
                        </Link>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-amber-700">{formatMoney(highestBid)}</div>
                        <Link
                          href={`/perfil/${listing.auction_highest_bidder_id}`}
                          className="text-[10px] font-semibold text-amber-600 hover:text-brand-emerald"
                        >
                          Ver reputación →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-black/5 bg-white divide-y divide-gray-100 overflow-hidden">
                  {listing.category && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Categoría</span>
                      <span className="text-xs font-bold text-gray-900">{listing.category}</span>
                    </div>
                  )}

                  {(listing as any).condition && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Condición</span>
                      <span className="text-xs font-bold text-gray-900">{(listing as any).condition}</span>
                    </div>
                  )}

                  {(listing as any).brand && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Marca</span>
                      <span className="text-xs font-bold text-gray-900">{(listing as any).brand}</span>
                    </div>
                  )}

                  {/* Render attributes based on config */}
                  {relevantAttributes.map((attr) => {
                    if (attr.id === 'color') return null;
                    if (attr.id === 'size') return null;
                    if (attr.id === 'condition') return null;
                    if (attr.id === 'brand') return null;
                    const val = (listing as any).attributes?.[attr.id] || (listing as any)[attr.id];
                    if (!val) return null;
                    return (
                      <div key={attr.id} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-500">{attr.label}</span>
                        <span className="text-xs font-bold text-gray-900">
                          {attr.type === 'boolean' ? (val ? 'Sí' : 'No') : `${val} ${attr.suffix || ''}`}
                        </span>
                      </div>
                    );
                  })}

                  {/* Stock Display */}
                  {currentStock > 0 ? (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">
                        {selectedSize ? `Disponibles (${selectedSize})` : 'Disponibles'}
                      </span>
                      <span className="text-xs font-bold text-gray-900">{currentStock} unidades</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-red-500">Agotado</span>
                    </div>
                  )}

                  {typeof (listing as any).sold_count === 'number' && (listing as any).sold_count > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Vendidos</span>
                      <span className="text-xs font-bold text-green-700">{(listing as any).sold_count}</span>
                    </div>
                  )}

                  {listing.sale_type && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Tipo de venta</span>
                      <span className="text-xs font-bold text-gray-900">{listing.sale_type === 'auction' ? 'Subasta' : 'Venta directa'}</span>
                    </div>
                  )}

                  {listing.weight_kg && Number(listing.weight_kg) > 0 && !listing.shipping_by_seller && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Peso</span>
                      <span className="text-xs font-bold text-gray-900">{listing.weight_kg} kg</span>
                    </div>
                  )}

                  {listing.created_at && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Publicado</span>
                      <span className="text-xs font-bold text-gray-900">
                        {new Date(listing.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  {isFashion && listing.gender && (
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-500">Género</span>
                      <span className="text-xs font-bold text-gray-900">{listing.gender}</span>
                    </div>
                  )}

                  {/* Size */}
                  {isSizeRelevant && (() => {
                    const sizeVariants = normalizeArray(listing.size_variants);
                    const hasSizeVariants = sizeVariants && sizeVariants.length > 0;
                    const displaySize = hasSizeVariants ? selectedSize || sizeVariants[0] : listing.size;
                    if (!displaySize) return null;
                    return (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-500">Talla {hasSizeVariants && <span className="text-red-500">*</span>}</span>
                        {hasSizeVariants ? (
                          <select
                            value={selectedSize || sizeVariants[0] || ''}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/20"
                          >
                            {sizeVariants.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-bold text-gray-900">{displaySize}</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Color */}
                  {(() => {
                    const variants = normalizeArray(listing.color_variants);
                    const hasVariants = variants && variants.length > 0;
                    const displayColor = hasVariants ? selectedColor || variants[0] : listing.color;
                    if (!displayColor) return null;
                    return (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-500">Color {hasVariants && <span className="text-red-500">*</span>}</span>
                        {hasVariants && variants && variants.length > 0 ? (
                          <select
                            value={selectedColor || variants[0] || ''}
                            onChange={(e) => setSelectedColor(e.target.value)}
                            required
                            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/20"
                          >
                            <option value="">Selecciona</option>
                            {variants.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-bold text-gray-900">{displayColor}</span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Shipping info — show ALL applicable methods */}
                  <div className="px-4 py-2.5 space-y-1.5">
                    {(() => {
                      const bySeller = Boolean(listing.shipping_by_seller);
                      const allowPickup = Boolean(listing.allow_personal_delivery);
                      const isFree = Boolean(listing.free_shipping);
                      const hasWeight = Number(listing.weight_kg || 0) > 0;
                      const hasShipPrice = Number.isFinite(listingShippingPrice) && listingShippingPrice > 0;
                      const hasGoVendy = !bySeller && (isFree || hasWeight || hasShipPrice);
                      const isDigital = listing.product_type === 'digital';
                      const lines: JSX.Element[] = [];

                      if (isDigital) {
                        lines.push(
                          <div key="s-digital" className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span className="text-xs font-bold text-gray-900">Producto digital — descarga después de comprar</span>
                          </div>
                        );
                      } else {
                        // GoVendy shipping
                        if (hasGoVendy || (!bySeller && !allowPickup)) {
                          const label = isFree
                            ? 'Envío GoVendy · Gratis'
                            : listing.sale_type === 'auction' && hasShipPrice
                              ? `Envío GoVendy desde ${formatMoney(listingShippingPrice)}`
                              : buyerShippingCost !== null
                                ? `Envío GoVendy desde ${formatMoney(buyerShippingCost)}`
                                : 'Envío GoVendy';
                          lines.push(
                            <div key="s-gopocket" className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                              <span className="text-xs font-bold text-gray-900">{label}</span>
                            </div>
                          );
                        }

                        // Seller-managed shipping
                        if (bySeller) {
                          const freeByS = isFree || (Number.isFinite(listingShippingPrice) && listingShippingPrice === 0);
                          const label = freeByS
                            ? 'Envío por vendedor · Gratis'
                            : hasShipPrice
                              ? `Envío por vendedor ${formatMoney(listingShippingPrice)}`
                              : 'Envío por vendedor — a acordar';
                          lines.push(
                            <div key="s-seller" className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                              <span className="text-xs font-bold text-gray-900">{label}</span>
                            </div>
                          );
                        }

                        // Personal delivery
                        if (allowPickup) {
                          lines.push(
                            <div key="s-pickup" className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              <span className="text-xs font-bold text-gray-900">Entrega personal disponible</span>
                            </div>
                          );
                          {/* Show location match */ }
                          {
                            (() => {
                              const isSeller = listing.seller_id === viewerId;
                              const vZip = String(viewerZip || '').replace(/\D/g, '');
                              const sZip = String(sellerZip || '').replace(/\D/g, '');
                              const zipMatch = vZip.length === 5 && sZip.length === 5 && vZip === sZip;
                              const isSameLocation = zipMatch || (
                                viewerCity && viewerState && sellerCity && sellerState &&
                                viewerCity.trim().toLowerCase() === sellerCity.trim().toLowerCase() &&
                                viewerState.trim().toLowerCase() === sellerState.trim().toLowerCase()
                              );
                              if (isSameLocation || isSeller) {
                                lines.push(
                                  <div key="s-pickup-loc" className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span className="text-xs font-bold text-gray-900">Entrega personal en {sellerCity}</span>
                                  </div>
                                );
                              }
                            })()
                          }
                        }
                      }

                      return lines;
                    })()}
                  </div>
                </div>

                <div className="mt-4">
                  <SellerDisplay
                    sellerId={listing.seller_id}
                    sellerName={sellerName}
                    state={sellerState}
                    city={sellerCity}
                    isVerified={sellerIsVerified}
                    operationsCount={sellerOperationsCount}
                    size="sm"
                    hideLogo={true}
                    isOfficialStore={sellerIsOfficial}
                    officialStoreName={sellerOfficialName}
                    officialStoreBrandColor={sellerOfficialBrandColor}
                    onLoginRequired={() => redirectToLogin(listing.id)}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <LiveBadge sellerId={listing.seller_id} />
                    <FollowButton sellerId={listing.seller_id} onLoginRequired={() => redirectToLogin(listing.id)} />
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/perfil/${listing.seller_id}`} className="text-sm font-semibold text-gray-900 hover:text-brand-emerald">
                      Termómetro de comportamiento →
                    </Link>
                    {sellerBadgeLabel && (
                      <div className={`${sellerBadge === 'platinum' ? 'seller-badge-platinum' :
                        sellerBadge === 'gold' ? 'seller-badge-gold' :
                          sellerBadge === 'plata' ? 'seller-badge-plata' :
                            'inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-900 ring-1 ring-black/10'
                        }`}>
                        {sellerBadgeLabel}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {Math.max(0, Math.min(100, Math.round(sellerRatingPercent)))}% de calificaciones buenas
                  </div>
                  <div className="mt-3">
                    <div className="relative h-2 w-full overflow-visible rounded-full bg-gray-200">
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 35%, #22c55e 100%)',
                          opacity: 0.9,
                        }}
                      />
                      {/* Línea indicadora del porcentaje */}
                      <div
                        className="absolute inset-y-0 w-[2px] bg-white/90 shadow"
                        style={{ left: `calc(${Math.max(0, Math.min(100, sellerRatingPercent))}% - 1px)` }}
                        aria-hidden="true"
                      />
                      {/* Círculo completo que sale de la franja y parpadea */}
                      <div
                        className="absolute top-1/2 h-6 w-6 -translate-y-1/2 animate-blink rounded-full bg-white ring-2 ring-brand-emerald/50 shadow-md"
                        style={{ left: `calc(${Math.max(0, Math.min(100, sellerRatingPercent))}% - 12px)` }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* ── YouTube Video ── */}
                {(() => {
                  const ytUrl = (listing as any).youtube_url;
                  if (!ytUrl) return null;
                  const match = String(ytUrl).match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
                  if (!match) return null;
                  return (
                    <div className="mt-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 mb-3">
                        <Play className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-bold text-gray-900">Video del producto</span>
                      </div>
                      <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                        <iframe
                          src={`https://www.youtube.com/embed/${match[1]}?rel=0`}
                          title="Video del producto"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    </div>
                  );
                })()}

                {isAuction ? (
                  <div className="mt-8 space-y-3">
                    {/* Commitment Warning */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex gap-2">
                        <span className="shrink-0 text-base">⚠️</span>
                        <p className="text-xs font-medium text-amber-800 leading-relaxed">
                          Al participar en esta subasta <span className="font-extrabold">te comprometes a realizar la compra</span> si resultas ganador. El incumplimiento afectará tu reputación y podrías recibir sanciones en tu cuenta.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      <div className="text-xs font-semibold text-gray-700">Regla de pujas</div>
                      <div className="mt-1">
                        Solo puedes pujar <span className="font-semibold">una vez</span> hasta que alguien más te supere.
                      </div>
                    </div>

                    {auctionCountdown?.expired ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-4 text-center">
                        <Gavel size={24} className="mx-auto text-gray-400 mb-2" />
                        <div className="text-sm font-bold text-gray-600">Subasta finalizada</div>
                        <div className="text-xs text-gray-500 mt-1">Ya no se aceptan más pujas.</div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-gray-900">Tu puja</label>
                          <input
                            type="number"
                            min={Math.max(1, highestBid + Math.max(bidIncrement, 1))}
                            step={1}
                            value={bidAmount}
                            onChange={(e) => setBidAmount(Number(e.target.value))}
                            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                          />
                          <div className="mt-1 text-xs text-gray-600">
                            Mínimo: {formatMoney(highestBid + Math.max(bidIncrement, 1))}
                          </div>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={placeBid}
                            disabled={isBidding || listing.status !== 'active' || listing.seller_id === viewerId}
                            className="w-full rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {listing.seller_id === viewerId
                              ? 'Es tu subasta'
                              : (isBidding ? 'Pujando…' : 'Pujar')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bid History Panel */}
                    <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsBidsHistoryOpen(!isBidsHistoryOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">📋</span>
                          <span className="text-sm font-bold text-gray-900">Historial de pujas</span>
                          {bidHistory.length > 0 && (
                            <span className="rounded-full bg-brand-emerald/10 px-2 py-0.5 text-[10px] font-black text-brand-emerald">
                              {bidHistory.length}
                            </span>
                          )}
                        </div>
                        <svg
                          className={`h-4 w-4 text-gray-400 transition-transform ${isBidsHistoryOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isBidsHistoryOpen && (
                        <div className="border-t border-black/5 px-4 py-3">
                          {bidHistory.length === 0 ? (
                            <div className="py-4 text-center">
                              <Gavel size={24} className="mx-auto text-gray-300 mb-2" />
                              <div className="text-sm font-semibold text-gray-400">Aún no hay pujas</div>
                              <div className="text-xs text-gray-400 mt-0.5">¡Sé el primero en pujar!</div>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {bidHistory.map((bid, idx) => {
                                const isWinner = idx === 0;
                                const timeAgo = (() => {
                                  const diff = Date.now() - new Date(bid.created_at).getTime();
                                  const mins = Math.floor(diff / 60000);
                                  if (mins < 1) return 'ahora';
                                  if (mins < 60) return `hace ${mins}m`;
                                  const hours = Math.floor(mins / 60);
                                  if (hours < 24) return `hace ${hours}h`;
                                  const days = Math.floor(hours / 24);
                                  return `hace ${days}d`;
                                })();
                                return (
                                  <div
                                    key={bid.id}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${isWinner
                                      ? 'bg-gradient-to-r from-amber-50 to-orange-50 ring-1 ring-amber-200'
                                      : 'bg-gray-50 hover:bg-gray-100'
                                      }`}
                                  >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
                                      {isWinner ? (
                                        <span className="text-sm">🏆</span>
                                      ) : (
                                        <span className="text-[10px] font-black text-gray-400">#{idx + 1}</span>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <Link
                                        href={`/perfil/${bid.bidder_id}`}
                                        className="text-xs font-bold text-gray-900 hover:text-brand-emerald transition-colors truncate block"
                                      >
                                        {bid.bidder_name}
                                      </Link>
                                      <div className="text-[10px] text-gray-400">{timeAgo}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-sm font-black ${isWinner ? 'text-amber-700' : 'text-gray-700'}`}>
                                        {formatMoney(bid.amount)}
                                      </div>
                                      <Link
                                        href={`/perfil/${bid.bidder_id}`}
                                        className="text-[9px] font-semibold text-gray-400 hover:text-brand-emerald"
                                      >
                                        Reputación →
                                      </Link>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={addToCart}
                      disabled={isAdding || listing.status !== 'active' || listing.seller_id === viewerId || currentStock <= 0}
                      className="relative w-full rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden animate-rotating-border animate-border-glow"
                    >
                      {listing.seller_id === viewerId
                        ? 'Es tu publicación'
                        : currentStock <= 0
                          ? 'Agotado'
                          : (isAdding ? 'Agregando…' : 'Agregar al carrito')}
                    </button>
                    <Link
                      href="/cart"
                      className="w-full rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                    >
                      Ver carrito
                    </Link>
                  </div>
                )}

                <p className="mt-4 text-xs text-gray-500">
                  Nota: la protección total de imágenes requiere watermark server-side. Aquí solo deshabilitamos la interacción como disuasión.
                </p>
              </section>

              {/* Buyer Protection Panel */}
              <div className="hidden lg:block">
                <BuyerProtection />
              </div>

              <SellerSidebarReputation sellerId={listing.seller_id} onLoginRequired={() => redirectToLogin(listing.id)} />

              {/* Más del vendedor */}
              <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">
                      Más publicaciones de{' '}
                      <Link href={`/perfil/${listing.seller_id}`} className="font-semibold text-brand-emerald hover:opacity-90">
                        {sellerName}
                      </Link>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-600">Artículos del mismo vendedor.</div>
                  </div>
                </div>

                {isMoreLoading ? (
                  <div className="mt-4 text-xs text-gray-600">Cargando…</div>
                ) : moreFromSeller.length === 0 ? (
                  <div className="mt-4 text-xs text-gray-600">Aún no hay más publicaciones.</div>
                ) : (
                  <div className="mt-4 grid gap-3 grid-cols-2">
                    {moreFromSeller.slice(0, 6).map((r) => {
                      const img = (r.images ?? []).filter(Boolean)[0] ?? null;
                      const p = typeof r.price === 'number' ? r.price : Number(r.price ?? 0);
                      const price2 = Number.isFinite(p) ? p : 0;
                      return (
                        <Link
                          key={r.id}
                          href={`/listings/${r.id}`}
                          className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="aspect-[4/5] bg-gray-100">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img}
                                alt={r.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                draggable={false}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">Sin imagen</div>
                            )}
                          </div>
                          <div className="p-2">
                            <div className="line-clamp-1 text-[10px] font-semibold text-gray-900">{r.title}</div>
                            <div className="mt-0.5 text-[11px] font-extrabold text-brand-emerald">{formatMoney(price2)}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                <Link href={`/perfil/${listing.seller_id}`} className="mt-3 block text-center text-[10px] font-bold text-brand-emerald hover:opacity-80">
                  Ver todas las publicaciones →
                </Link>
              </div>

              <RecommendationSection listingId={listing.id} />


              <RelatedProducts
                currentListingId={listing.id}
                category={listing.category}
                sellerId={listing.seller_id}
                gridCols="grid-cols-2"
                className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"
              />

              <SidebarBanner />

            </div>


          </div>
        )}
      </main>

      {listing && (
        <ReportModal
          listingId={listing.id}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </div>
  );
}

