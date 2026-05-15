'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AuthModal } from '@/components/AuthModal';
import { FavoriteButton } from '@/components/FavoriteButton';
import { normalizeReturnTo } from '@/lib/auth/redirect';
import { CategoryDropdownMenu } from '@/components/CategoryDropdownMenu';
import { AdBanner } from '@/components/AdBanner';
import { BannerCarousel } from '@/components/home/BannerCarousel';
import { OfficialStoresCarousel } from '@/components/home/OfficialStoresCarousel';
import { LiveCarousel } from '@/components/home/LiveCarousel';
import { NavLiveButton } from '@/components/LiveBadge';
import { ListingCard, type ListingPreview } from '@/components/listings/ListingCard';

type HomeBanner = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_href: string;
  // Nuevos slots soportados:
  // - floating: banner flotante cerrable (X)
  // - mid2: banners extra (sección adicional)
  // - mid3: banners extra (sección adicional)
  // - mid4: banners extra (sección adicional)
  // - mid5: banners extra (sección adicional)
  placement?: 'hero' | 'top' | 'mid' | 'mid2' | 'mid3' | 'mid4' | 'mid5' | 'bottom' | 'floating' | 'estafeta';
  image_fit?: 'cover' | 'contain';
  image_position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  floating_frequency?: 'session' | '24h' | '7d';
  floating_position?: 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left';
  floating_delay_ms?: number;
};

const FLOATING_DISMISS_KEY = 'pocket_dismissed_floating_banners_v1';
const FLOATING_DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días
const FLOATING_SESSION_DISMISS_KEY = 'pocket_dismissed_floating_banners_session_v1';

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getPrice(value: number | string) {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatTimeLeft(endAt: string | null | undefined) {
  if (!endAt) return '—';
  const end = Date.parse(endAt);
  if (!Number.isFinite(end)) return '—';
  const diff = end - Date.now();
  if (diff <= 0) return 'Subasta finalizada';
  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}


function FeatureCard({
  title,
  subtitle,
  href,
  icon,
  accentColor = '#1FB59B',
  badge,
}: {
  title: string;
  subtitle: string;
  href?: string;
  icon: ReactNode;
  accentColor?: string;
  badge?: string;
}) {
  const content = (
    <div
      className="group relative h-full overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ring-1 ring-black/[0.07] cursor-pointer"
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 inset-x-0 h-[3px] rounded-t-2xl scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}66)` }}
      />

      <div className="flex items-center gap-4 p-5">
        {/* Icon container */}
        <div
          className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 shadow-sm"
          style={{
            background: `${accentColor}15`,
            border: `1.5px solid ${accentColor}25`,
          }}
        >
          <div style={{ color: accentColor }}>{icon}</div>
        </div>

        {/* Text */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-[13.5px] font-bold text-gray-800 leading-tight truncate transition-colors duration-200"
              style={{ color: undefined }}
            >
              {title}
            </h3>
            {badge && (
              <span
                className="shrink-0 rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-wider text-white"
                style={{ background: accentColor }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="mt-[3px] text-[11.5px] leading-relaxed text-gray-500 line-clamp-2">
            {subtitle}
          </p>
        </div>

        {/* Arrow */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
          style={{ background: accentColor }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Glow */}
      <div
        className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `${accentColor}18` }}
      />
    </div>
  );
  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
}


// Local ListingCard removed in favor of @/components/listings/ListingCard

function Carousel({
  items,
  title,
  rightLink,
  renderItem,
  autoRotate = false,
  rotateInterval = 5000,
  onLoginRequired,
}: {
  items: ListingPreview[];
  title: string;
  rightLink?: { href: string; label: string };
  renderItem: (p: ListingPreview) => ReactNode;
  autoRotate?: boolean;
  rotateInterval?: number;
  onLoginRequired?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardWidth = 240; // w-56 (224px) + gap-4 (16px) = 240px por card

  const scrollBy = (dx: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: dx, behavior: 'smooth' });
    }
  };

  const scrollToIndex = useCallback((index: number) => {
    if (ref.current && items.length > 0) {
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      const scrollPosition = clampedIndex * cardWidth;
      ref.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      setCurrentIndex(clampedIndex);
    }
  }, [items.length, cardWidth]);

  // Auto-rotación
  useEffect(() => {
    if (!autoRotate || items.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % items.length;
        scrollToIndex(next);
        return next;
      });
    }, rotateInterval);

    return () => clearInterval(interval);
  }, [autoRotate, items.length, rotateInterval, scrollToIndex]);

  // Detectar scroll manual para actualizar índice
  useEffect(() => {
    if (!ref.current) return;

    const handleScroll = () => {
      if (ref.current && items.length > 0) {
        const scrollLeft = ref.current.scrollLeft;
        const newIndex = Math.round(scrollLeft / cardWidth);
        const clampedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
        setCurrentIndex(clampedIndex);
      }
    };

    const element = ref.current;
    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [cardWidth, items.length]);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">{title}</h2>
        {rightLink ? (
          <Link href={rightLink.href} className="text-sm font-semibold text-brand-emerald hover:opacity-90">
            {rightLink.label}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
              scrollToIndex(prevIndex);
            }}
            className="hidden rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 sm:inline-flex"
          >
            ‹
          </button>
          <div
            ref={ref}
            className="flex flex-1 gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory', scrollBehavior: 'smooth' }}
          >
            {items.map((p) => (
              renderItem(p)
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const nextIndex = (currentIndex + 1) % items.length;
              scrollToIndex(nextIndex);
            }}
            className="hidden rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 sm:inline-flex"
          >
            ›
          </button>
        </div>
        {/* Indicadores de posición (opcional, solo si hay auto-rotación) */}
        {autoRotate && items.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {items.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToIndex(idx)}
                className={`h-2 rounded-full transition-all ${idx === currentIndex ? 'w-8 bg-brand-emerald' : 'w-2 bg-gray-300'
                  }`}
                aria-label={`Ir a slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [isBooting, setIsBooting] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [gender, setGender] = useState<'Mujer' | 'Hombre'>('Mujer');
  const [search, setSearch] = useState('');
  const [featured, setFeatured] = useState<ListingPreview[]>([]);
  const [auctions, setAuctions] = useState<ListingPreview[]>([]);
  const [freeShipping, setFreeShipping] = useState<ListingPreview[]>([]);
  const [mostViewed, setMostViewed] = useState<ListingPreview[]>([]);
  const [newArrivals, setNewArrivals] = useState<ListingPreview[]>([]);
  const [explore, setExplore] = useState<ListingPreview[]>([]);
  const [isAuthOpen, setIsAuthOpenState] = useState(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'register'>('login');

  const setIsAuthOpen = (open: boolean, view: 'login' | 'register' = 'login') => {
    setAuthModalView(view);
    setIsAuthOpenState(open);
  };
  const [dismissedFloating, setDismissedFloating] = useState<Record<string, number>>({});
  const [dismissedFloatingSession, setDismissedFloatingSession] = useState<Record<string, number>>({});
  const [floatingTick, setFloatingTick] = useState(0);
  const mountedAtRef = useRef<number>(Date.now());
  const [pendingReturnTo, setPendingReturnTo] = useState<string | null>(null);
  const [followedSellers, setFollowedSellers] = useState<Set<string> | null>(null);


  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsBooting(true);
      try {
        // 2) Paralelizar TODAS las peticiones (Banners + Listings)
        const nowIso = new Date().toISOString();
        const baseListingSelect =
          'id,title,description,price,images,public_id,sale_type,condition,free_shipping,seller_id,stock';

        const [
          userRes,
          bannerResRaw,
          featuredResRaw,
          auctionResRaw,
          freeShippingResRaw,
          mostViewedResRaw,
          newResRaw,
          exploreResRaw
        ] = await Promise.all([
          // 1. User
          supabase.auth.getUser(),

          // 2. Banners (intentamos con la query más completa primero)
          supabase
            .from('home_banners')
            .select('id,title,subtitle,image_url,cta_text,cta_href,placement,image_fit,image_position,floating_frequency,floating_position,floating_delay_ms,is_active,sort_order')
            .order('sort_order', { ascending: true })
            .limit(100),

          // 3. Listings (Featured)
          supabase
            .from('listings')
            .select(baseListingSelect)
            .eq('status', 'active')
            .eq('is_featured', true)
            .order('created_at', { ascending: false })
            .limit(12),

          // 4. Auctions (solo filtramos por sale_type, sin columnas especiales)
          supabase
            .from('listings')
            .select(baseListingSelect)
            .eq('status', 'active')
            .eq('sale_type', 'auction')
            .order('created_at', { ascending: true })
            .limit(50),

          // 5. Free Shipping
          supabase
            .from('listings')
            .select(baseListingSelect)
            .eq('status', 'active')
            .eq('free_shipping', true)
            .order('created_at', { ascending: false })
            .limit(20),

          // 6. Most Viewed (fallback: ordenamos por created_at para evitar depender de view_count)
          supabase
            .from('listings')
            .select(baseListingSelect)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(20),

          // 7. New Arrivals
          supabase
            .from('listings')
            .select(baseListingSelect)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(12),

          // 8. Explore
          supabase
            .from('listings')
            .select(baseListingSelect)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(24),
        ]);

        if (cancelled) return;

        // --- Procesar Usuario ---
        const user = userRes.data.user;
        if (user) {
          const metaName =
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.username as string | undefined) ||
            '';
          setUserName(metaName || (user.email ? user.email.split('@')[0] : ''));
        } else {
          setUserName(null);
        }

        // --- Procesar Banners (con fallback logic) ---
        let finalBanners: any[] = [];
        // Si la query pro falla, intentamos fallbacks secuenciales (edge case raro)
        if (bannerResRaw.error) {
          // ... lógica de fallback simplificada o reintentos si es crítico ...
          // Por brevedad y performance, si falla la query compleja, asumimos error de columna y hacemos un fetch simple rápido
          // O simplemente mostramos vacío para no bloquear.
          // Dado que el usuario quiere velocidad, si falla por columnas nuevas, reintentamos UNA vez con select básico.
          const { data: legacyBanners } = await supabase
            .from('home_banners')
            .select('id,title,subtitle,image_url,cta_text,cta_href')
            .order('sort_order', { ascending: true })
            .limit(100);
          finalBanners = legacyBanners || [];
        } else {
          finalBanners = bannerResRaw.data || [];
        }

        setBanners(
          finalBanners
            .filter((b: any) => b?.is_active !== false)
            .map((b: any) => ({
              id: b.id,
              title: b.title,
              subtitle: b.subtitle,
              image_url: b.image_url,
              cta_text: b.cta_text,
              cta_href: b.cta_href,
              placement: b.placement ?? 'hero',
              image_fit: b.image_fit ?? 'cover',
              image_position: b.image_position ?? 'center',
              floating_frequency: b.floating_frequency ?? '7d',
              floating_position: b.floating_position ?? 'bottom_right',
              floating_delay_ms: typeof b.floating_delay_ms === 'number' ? b.floating_delay_ms : Number(b.floating_delay_ms ?? 0) || 0,
            }))
        );

        // --- Procesar Listings (Manejo de errores de columnas inexistentes) ---
        // Helper para silenciar error 42703 (columna no existe) y devolver array vacío
        const safeData = (res: any) => {
          if (res.error) {
            console.error('Data fetch error:', res.error);
            // Si es error de columna, retornamos [], si es otro error, logueamos pero retornamos [] para no romper UI
            return [];
          }
          return res.data as ListingPreview[];
        };

        setFeatured(safeData(featuredResRaw));
        setAuctions(safeData(auctionResRaw));
        setFreeShipping(safeData(freeShippingResRaw));
        setMostViewed(safeData(mostViewedResRaw));
        setNewArrivals(safeData(newResRaw));
        setExplore(safeData(exploreResRaw));

        // 4) Followed Sellers (depende de user)
        if (user) {
          const { data: follows } = await supabase
            .from('follows')
            .select('seller_id')
            .eq('follower_id', user.id);
          if (follows) {
            setFollowedSellers(new Set(follows.map((f) => f.seller_id)));
          }
        }

      } catch (e) {
        // No romper home si algo falla; dejamos arrays vacíos
        console.error(e);
        if (!cancelled) {
          setBanners([]);
          setFeatured([]);
          setAuctions([]);
          setNewArrivals([]);
          setExplore([]);
        }
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Home-first: si llega `/?auth=1&returnTo=/...` abrimos modal y guardamos returnTo.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const auth = sp.get('auth');
      const safe = normalizeReturnTo(sp.get('returnTo'));
      if (safe) setPendingReturnTo(safe);
      if (auth === '1') setIsAuthOpen(true);
      // Limpieza visual: quitar auth=1 de la URL (evita reabrir modal al refrescar)
      if (auth === '1') {
        sp.delete('auth');
        const next = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next);
      }
    } catch {
      // noop
    }
  }, []);

  // Si ya hay sesión y venimos con returnTo, redirigir.
  useEffect(() => {
    if (!pendingReturnTo) return;
    if (!userName) return;
    if (pendingReturnTo === '/') return;
    window.location.href = pendingReturnTo;
  }, [pendingReturnTo, userName]);

  // Redirigir administradores al panel de administrador después del login (solo si no hay returnTo)
  // NO redirigir si el admin quiere ver como usuario (parámetro ?view=user o localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pendingReturnTo) return; // Si hay returnTo pendiente, no hacer nada
    if (!userName) return; // Esperar a que el usuario esté cargado

    // Verificar si el admin quiere ver como usuario (parámetro URL o localStorage)
    const urlParams = new URLSearchParams(window.location.search);
    const viewAsUserParam = urlParams.get('view') === 'user';
    const viewAsUserStorage = window.localStorage.getItem('admin_view_as_user') === 'true';

    // Si viene con el parámetro, guardarlo en localStorage
    if (viewAsUserParam) {
      try {
        window.localStorage.setItem('admin_view_as_user', 'true');
      } catch {
        // noop
      }
    }

    // No redirigir si el admin quiere ver como usuario
    if (viewAsUserParam || viewAsUserStorage) return;

    // Solo redirigir si estamos en la ruta raíz exacta (sin parámetros de búsqueda relevantes)
    // Esto evita redirecciones cuando el usuario está navegando normalmente
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    // Ignorar el parámetro view=user al verificar
    const searchWithoutView = new URLSearchParams(currentSearch);
    searchWithoutView.delete('view');
    if (currentPath !== '/' || searchWithoutView.toString()) return;

    let cancelled = false;
    const checkAdmin = async () => {
      try {
        // Pequeño delay para evitar redirecciones inmediatas
        await new Promise(resolve => setTimeout(resolve, 500));
        if (cancelled) return;

        const { data: userData } = await supabase.auth.getUser();
        if (cancelled || !userData?.user) return;

        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        // Si es admin, redirigir al panel de administrador
        if (adminRow && !cancelled) {
          window.location.href = '/admin/metricas';
        }
      } catch (e) {
        // Silenciar errores, no queremos interrumpir la experiencia del usuario
        console.error('[HOME] Error al verificar admin:', e);
      }
    };

    // Ejecutar solo una vez cuando el usuario está autenticado y no hay returnTo
    void checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [userName, pendingReturnTo]);

  const heroBanners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'hero'), [banners]);
  const topBanners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'top'), [banners]);
  const midBanners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'mid'), [banners]);
  const mid2Banners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'mid2'), [banners]);
  const mid3Banners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'mid3'), [banners]);
  const mid4Banners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'mid4'), [banners]);
  const mid5Banners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'mid5'), [banners]);
  const bottomBanners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'bottom'), [banners]);
  const floatingBanners = useMemo(() => banners.filter((b) => (b.placement ?? 'hero') === 'floating'), [banners]);

  // Persistir banners flotantes cerrados (X)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FLOATING_DISMISS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const cleaned: Record<string, number> = {};
      for (const [id, ts] of Object.entries(parsed || {})) {
        const n = typeof ts === 'number' ? ts : Number(ts ?? 0);
        if (!id) continue;
        if (!Number.isFinite(n) || n <= 0) continue;
        if (now - n > FLOATING_DISMISS_TTL_MS) continue;
        cleaned[id] = n;
      }
      setDismissedFloating(cleaned);
      window.localStorage.setItem(FLOATING_DISMISS_KEY, JSON.stringify(cleaned));
    } catch {
      // noop
    }
  }, []);

  // Dismiss por sesión (para frequency=session)
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(FLOATING_SESSION_DISMISS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      const cleaned: Record<string, number> = {};
      for (const [id, ts] of Object.entries(parsed || {})) {
        const n = typeof ts === 'number' ? ts : Number(ts ?? 0);
        if (!id) continue;
        if (!Number.isFinite(n) || n <= 0) continue;
        cleaned[id] = n;
      }
      setDismissedFloatingSession(cleaned);
      window.sessionStorage.setItem(FLOATING_SESSION_DISMISS_KEY, JSON.stringify(cleaned));
    } catch {
      // noop
    }
  }, []);

  const visibleFloating = useMemo(() => {
    const now = Date.now();
    const sinceMount = now - mountedAtRef.current;

    const getTtl = (freq: HomeBanner['floating_frequency']) => {
      if (freq === '24h') return 1000 * 60 * 60 * 24;
      if (freq === '7d') return FLOATING_DISMISS_TTL_MS;
      return FLOATING_DISMISS_TTL_MS;
    };

    return floatingBanners
      .filter((b) => {
        const delay = Math.max(0, Number(b.floating_delay_ms ?? 0) || 0);
        if (delay > 0 && sinceMount < delay) return false;

        const freq = b.floating_frequency ?? '7d';
        if (freq === 'session') {
          return !dismissedFloatingSession[b.id];
        }
        const ts = dismissedFloating[b.id];
        if (!ts) return true;
        return now - ts > getTtl(freq);
      })
      .slice(0, 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatingBanners, dismissedFloating, dismissedFloatingSession, floatingTick]);

  const dismissFloating = (b: HomeBanner) => {
    const id = b.id;
    const freq = b.floating_frequency ?? '7d';
    if (freq === 'session') {
      setDismissedFloatingSession((prev) => {
        const next = { ...prev, [id]: Date.now() };
        try {
          window.sessionStorage.setItem(FLOATING_SESSION_DISMISS_KEY, JSON.stringify(next));
        } catch {
          // noop
        }
        return next;
      });
      return;
    }

    setDismissedFloating((prev) => {
      const next = { ...prev, [id]: Date.now() };
      try {
        window.localStorage.setItem(FLOATING_DISMISS_KEY, JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
  };

  // Re-render cuando existan banners flotantes con delay pendiente
  useEffect(() => {
    const now = Date.now();
    const sinceMount = now - mountedAtRef.current;
    const pending = floatingBanners
      .map((b) => Math.max(0, Number(b.floating_delay_ms ?? 0) || 0))
      .filter((d) => d > sinceMount);
    if (pending.length === 0) return;
    const nextIn = Math.min(...pending) - sinceMount;
    const t = window.setTimeout(() => setFloatingTick((x) => x + 1), Math.max(0, nextIn) + 20);
    return () => window.clearTimeout(t);
  }, [floatingBanners, floatingTick]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();

    if (q) {
      // Tracking de búsqueda (fire and forget)
      fetch('/api/metrics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'search', data: { query: q } }),
        keepalive: true,
      }).catch((err) => console.error('[Tracking] Error logging search:', err));
    }

    const qp = q ? `?q=${encodeURIComponent(q)}` : '';
    window.location.href = `/listings${qp}`;
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialView={authModalView} />
      {/* Banners flotantes (cerrables) */}
      {visibleFloating.length > 0 ? (
        <div
          className={[
            'fixed z-[60] flex flex-col gap-3',
            // default: bottom_right
            (visibleFloating[0]?.floating_position ?? 'bottom_right') === 'bottom_left'
              ? 'bottom-4 left-4 right-4 sm:right-auto sm:left-5 sm:w-[380px]'
              : (visibleFloating[0]?.floating_position ?? 'bottom_right') === 'top_right'
                ? 'top-24 left-4 right-4 sm:left-auto sm:right-5 sm:w-[380px]'
                : (visibleFloating[0]?.floating_position ?? 'bottom_right') === 'top_left'
                  ? 'top-24 left-4 right-4 sm:right-auto sm:left-5 sm:w-[380px]'
                  : 'bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:w-[380px]',
          ].join(' ')}
        >
          {visibleFloating.map((b) => (
            <div
              key={b.id}
              className="relative overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/10"
            >
              <button
                type="button"
                onClick={() => dismissFloating(b)}
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-white"
                aria-label="Cerrar banner"
              >
                ×
              </button>
              <Link href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href} className="block">
                <div className="grid grid-cols-[88px_1fr] gap-3 p-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-black/5">
                    {b.image_url ? (
                      <Image
                        src={b.image_url}
                        alt={b.title}
                        fill
                        className="object-cover"
                        style={{
                          objectFit: (b.image_fit ?? 'cover') as any,
                          objectPosition: (b.image_position ?? 'center') as any,
                        }}
                        draggable={false}
                        sizes="80px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-gray-900 line-clamp-1 pr-10">{b.title}</div>
                    {b.subtitle ? <div className="mt-0.5 text-xs text-gray-600 line-clamp-2 pr-10">{b.subtitle}</div> : null}
                    <div className="mt-3 inline-flex rounded-full bg-brand-emerald px-4 py-2 text-xs font-extrabold text-white shadow-sm">
                      {b.cta_text || 'Ver'}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : null}
      {/* Barra promo (estilo Mercado Libre, con nuestro color) */}
      <div className="bg-brand-onyx text-brand-volt">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="text-xs font-semibold tracking-wide">
            GoVendy — Compra y vende con tecnología avanzada
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-brand-volt/20 px-3 py-1 text-[11px] font-extrabold tracking-widest text-brand-volt shadow-[0_0_8px_rgba(204,255,0,0.3)]">
              ENVÍO GRATIS
            </span>
            <span className="text-[11px] font-semibold text-brand-volt/80">en artículos seleccionados:</span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            </Link>

            <form onSubmit={onSearch} className="flex flex-1 items-center gap-2 sm:mx-6">
              <div className="relative w-full">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar productos, marcas y más…"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 pr-10 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-emerald"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-brand-emerald px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Buscar
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Link href="/cart" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-extrabold text-brand-mango hover:bg-brand-mango/10 transition-colors">
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Carrito
              </Link>
              <NavLiveButton />
              {isBooting ? (
                <div className="h-9 w-24 rounded-xl bg-black/5" />
              ) : userName ? (
                <Link href="/dashboard" className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-black/5">
                  Mi cuenta
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true, 'register')}
                    className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                  >
                    Registrarte
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true, 'login')}
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-black/5"
                  >
                    Ingresar
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav className="mt-2 hidden items-center justify-between gap-6 text-sm sm:flex">
            <div className="flex items-center gap-5">
              <CategoryDropdownMenu />
              <Link href="/categorias" className="font-semibold text-gray-700 hover:text-brand-emerald">
                Categorias
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/sell" className="rounded-xl bg-brand-emerald px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90">
                Vender
              </Link>
              {!isBooting && userName ? <span className="text-xs font-semibold text-gray-500">Hola, {userName}</span> : null}
            </div>
          </nav>
        </div>
      </header>

      {/* Publicidad */}
      <section className="mx-auto max-w-6xl px-4">
        <AdBanner placement="home" />
      </section>

      {/* Carrusel Principal (Mercado Libre Style) - Combina hero y top */}
      {(heroBanners.length > 0 || topBanners.length > 0) && (
        <section className="w-full">
          <BannerCarousel banners={[...heroBanners, ...topBanners].filter(b => !!b.image_url)} />
        </section>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">

        {/* 🚀 Quick Categories (Estilo Shopee / ML) */}
        <section className="mb-10">
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
            {[
              { id: '1', name: 'Tecnología', icon: '💻', color: 'bg-blue-50 text-blue-600', link: '/categorias?q=tecnologia' },
              { id: '2', name: 'Moda', icon: '👗', color: 'bg-pink-50 text-pink-600', link: '/categorias?q=moda' },
              { id: '3', name: 'Hogar', icon: '🛋️', color: 'bg-amber-50 text-amber-600', link: '/categorias?q=hogar' },
              { id: '4', name: 'Deportes', icon: '⚽', color: 'bg-emerald-50 text-emerald-600', link: '/categorias?q=deportes' },
              { id: '5', name: 'Belleza', icon: '✨', color: 'bg-purple-50 text-purple-600', link: '/categorias?q=belleza' },
              { id: '6', name: 'Juguetes', icon: '🎮', color: 'bg-red-50 text-red-600', link: '/categorias?q=juguetes' },
              { id: '7', name: 'Herramientas', icon: '🔧', color: 'bg-gray-100 text-gray-700', link: '/categorias?q=herramientas' },
              { id: '8', name: 'Ver todo', icon: '👉', color: 'bg-brand-emerald/10 text-brand-emerald', link: '/categorias' },
            ].map((cat) => (
              <Link key={cat.id} href={cat.link} className="group flex flex-col items-center gap-2">
                <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 shadow-sm ring-1 ring-black/5 ${cat.color}`}>
                  <span className="text-3xl">{cat.icon}</span>
                </div>
                <span className="text-center text-[12px] font-semibold text-gray-700 group-hover:text-brand-emerald">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 🔴 Lives activos */}
        <LiveCarousel />

        {/* Tiendas Oficiales Carousel */}
        <OfficialStoresCarousel />

        {/* 🛡️ Trust Badges & Accesos rápidos */}
        <section className="mb-10 mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Envío gratis desde $299"
              subtitle="Solo agregando al carrito productos marcados."
              href="/envio-gratis"
              accentColor="#1FB59B"
              badge="NUEVO"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
                  <rect x="9" y="11" width="14" height="10" rx="2" />
                  <circle cx="12" cy="21" r="1.5" />
                  <circle cx="20" cy="21" r="1.5" />
                  <path d="M15 5h3l3 4v2" />
                </svg>
              }
            />
            <FeatureCard
              title="Compra Protegida"
              subtitle="Recibe el producto que esperabas o te devolvemos tu dinero."
              href="/compra-protegida"
              accentColor="#059669"
              badge="100% SEGURO"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              }
            />
            <FeatureCard
              title="Paga a MSI"
              subtitle="Con tarjetas participantes usando Mercado Pago o Stripe."
              href="#"
              accentColor="#3B82F6"
              icon={
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                  <path d="M7 15h.01" />
                  <path d="M11 15h2" />
                </svg>
              }
            />
          </div>
        </section>      }
            />
          </div>
        </section>

        {/* Banners tipo strip (como los de Mercado Libre) */}
        {
          midBanners.length > 0 ? (
            <section className="mt-8">
              <div className="grid gap-4 sm:grid-cols-2">
                {midBanners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href}
                    className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[21/9] bg-gray-100">
                      {b.image_url ? (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/0 to-black/0" />
                      <div className="absolute left-5 top-1/2 -translate-y-1/2">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                        <div className="mt-3 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm">
                          {b.cta_text || 'Ver más'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }

        {/* Carrusel de Envío Gratis */}
        {
          freeShipping.length > 0 ? (
            <Carousel
              title="Envío Gratis para ti"
              items={freeShipping}
              rightLink={{ href: '/envio-gratis', label: 'Ver todos' }}
              autoRotate={true}
              rotateInterval={4000}
              renderItem={(p) => (
                <ListingCard
                  key={p.id}
                  p={p}
                  onLoginRequired={() => setIsAuthOpen(true)}
                  isFollowing={followedSellers?.has(p.seller_id)}
                  badge={
                    <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-extrabold text-white shadow">
                      Envío Gratis
                    </span>
                  }
                />
              )}
              onLoginRequired={() => setIsAuthOpen(true)}
            />
          ) : null
        }

        {/* Banners extra (slot mid2) */}
        {
          mid2Banners.length > 0 ? (
            <section className="mt-10">
              <div className="grid gap-4 lg:grid-cols-2">
                {mid2Banners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href}
                    className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[24/9] bg-gray-100">
                      {b.image_url ? (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/0 to-black/0" />
                      <div className="absolute left-5 top-1/2 -translate-y-1/2">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                        <div className="mt-3 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm">
                          {b.cta_text || 'Ver más'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }

        {/* Carrusel de Subastas por Terminar - Arriba de Destacados */}
        {
          auctions.length > 0 ? (
            <Carousel
              title="Subastas imperdibles"
              items={auctions}
              autoRotate={true}
              rotateInterval={4000}
              rightLink={{ href: '/subastas', label: 'Explorar subastas' }}
              renderItem={(p) => (
                <ListingCard
                  key={p.id}
                  p={p}
                  onLoginRequired={() => setIsAuthOpen(true)}
                  isFollowing={followedSellers?.has(p.seller_id)}
                  badge={
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-extrabold text-white shadow">
                      Subasta
                    </span>
                  }
                />
              )}
              onLoginRequired={() => setIsAuthOpen(true)}
            />
          ) : null
        }

        {/* Banners extra (slot mid4) - Entre Destacados y Novedades */}
        {
          mid4Banners.length > 0 ? (
            <section className="mt-10">
              <div className="grid gap-4 lg:grid-cols-2">
                {mid4Banners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href}
                    className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[24/9] bg-gray-100">
                      {b.image_url ? (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/0 to-black/0" />
                      <div className="absolute left-5 top-1/2 -translate-y-1/2">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                        <div className="mt-3 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm">
                          {b.cta_text || 'Ver más'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }


        {/* Banners extra (slot mid3) - Ahora entre Subastas y Destacados */}
        {
          mid3Banners.length > 0 ? (
            <section className="mt-10">
              <div className="grid gap-4">
                {mid3Banners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/categorias' : b.cta_href}
                    className="group block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[24/7] bg-gray-100">
                      {b.image_url ? (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                          sizes="100vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                        {b.cta_text ? (
                          <div className="mt-3 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm">
                            {b.cta_text}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }

        {/* Carrusel de Más Vistos */}
        {
          mostViewed.length > 0 ? (
            <Carousel
              title="Lo más buscado"
              items={mostViewed}
              rightLink={{ href: '/mas-vistos', label: 'Ver todos' }}
              autoRotate={true}
              rotateInterval={5000}
              renderItem={(p) => (
                <ListingCard
                  key={p.id}
                  p={p}
                  onLoginRequired={() => setIsAuthOpen(true)}
                  isFollowing={followedSellers?.has(p.seller_id)}
                  badge={
                    <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-extrabold text-white shadow">
                      Popular
                    </span>
                  }
                />
              )}
              onLoginRequired={() => setIsAuthOpen(true)}
            />
          ) : null
        }

        {/* Carrusel de Destacados ($25) */}
        {
          featured.length > 0 ? (
            <Carousel
              title="Destacados"
              items={featured}
              rightLink={{ href: '/productos-destacados', label: 'Ver todos' }}
              autoRotate={true}
              rotateInterval={5500}
              renderItem={(p) => (
                <ListingCard
                  key={p.id}
                  p={p}
                  onLoginRequired={() => setIsAuthOpen(true)}
                  isFollowing={followedSellers?.has(p.seller_id)}
                  badge={
                    <span className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-extrabold text-white shadow">
                      Destacado
                    </span>
                  }
                />
              )}
            />
          ) : null
        }

        {/* Banners extra (slot mid4) - Entre Destacados y Novedades */}
        {
          mid4Banners.length > 0 ? (
            <section className="mt-10">
              <div className="grid gap-4 lg:grid-cols-2">
                {mid4Banners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href}
                    className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[24/9] bg-gray-100">
                      {b.image_url ? (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/0 to-black/0" />
                      <div className="absolute left-5 top-1/2 -translate-y-1/2">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                        <div className="mt-3 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm">
                          {b.cta_text || 'Ver más'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }

        {/* Novedades */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Novedades</h2>
            <Link href="/listings" className="text-sm font-semibold text-brand-emerald hover:opacity-90">
              Ver todo
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(newArrivals.length ? newArrivals : Array.from({ length: 8 }).map((_, i) => ({ id: `s-${i}`, title: '', price: 0, images: null, seller_id: '' } as ListingPreview))).map((p) => (
              <ListingCard key={p.id} p={p as any} onLoginRequired={() => setIsAuthOpen(true)} isFollowing={followedSellers?.has(p.seller_id)} />
            ))}
          </div>
        </section>

        {/* Banners extra (slot mid5) - Entre Novedades y Explorar */}
        {
          mid5Banners.length > 0 ? (
            <section className="mt-10">
              <div className="grid gap-4 lg:grid-cols-2">
                {mid5Banners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href}
                    className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[24/9] bg-gray-100">
                      {b.image_url ? (
                        <Image
                          src={b.image_url}
                          alt={b.title}
                          fill
                          className="object-cover"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/0 to-black/0" />
                      <div className="absolute left-5 top-1/2 -translate-y-1/2">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                        <div className="mt-3 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm">
                          {b.cta_text || 'Ver más'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }

        {/* Explorar: ahora Categorías */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <Link href="/categorias" className="text-2xl font-extrabold tracking-tight text-gray-900 hover:text-brand-emerald transition-colors">Categorías</Link>
            <Link href="/categorias" className="text-sm font-semibold text-brand-emerald hover:opacity-90">
              Ver todas
            </Link>
          </div>
          {explore.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
              <div className="text-sm text-gray-600">{isBooting ? 'Cargando…' : 'Aún no hay publicaciones activas.'}</div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {explore.map((p) => {
                const img = (p.images ?? []).filter(Boolean)[0] ?? null;
                const price = getPrice(p.price);
                return (
                  <Link key={p.id} href={`/listings/${p.id}`} className="block">
                    <div className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
                      <div className="relative aspect-[4/5] bg-gray-100">
                        {img ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img}
                              alt={p.title}
                              className="h-full w-full object-cover"
                              draggable={false}
                              style={{ userSelect: 'none' }}
                            />
                            {p.free_shipping && (
                              <div className="absolute top-2 left-2 z-10">
                                <div className="rounded-lg bg-blue-500/80 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                                  Envío gratis
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                            Sin imagen
                          </div>
                        )}
                        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 z-20" onClick={(e) => e.stopPropagation()}>
                          <FavoriteButton
                            listingId={p.id}
                            onLoginRequired={() => setIsAuthOpen(true)}
                            className="hover:bg-white"
                          />
                          {p.condition === 'nuevo' && (
                            <div className="rounded-lg bg-green-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                              Nuevo
                            </div>
                          )}
                          {p.condition === 'casi_nuevo' && (
                            <div className="rounded-lg bg-pink-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                              Casi Nuevo
                            </div>
                          )}
                          {p.condition === 'usado' && (
                            <div className="rounded-lg bg-yellow-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                              Usado
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="line-clamp-1 text-sm font-semibold text-gray-900">{p.title}</div>
                        <div className="mt-1 text-sm font-extrabold text-gray-900">{formatMoney(price)}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Slot mid3 moved up */} {/* Slot mid3 moved up */}

        {/* Banner final ancho (bottom) */}
        {
          bottomBanners.length > 0 ? (
            <section className="mt-10">
              <div className="grid gap-4">
                {bottomBanners.map((b) => (
                  <Link
                    key={b.id}
                    href={b.cta_href === '/listings' || !b.cta_href ? '/explorar' : b.cta_href}
                    className="group block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[24/7] bg-gray-100">
                      {b.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.image_url}
                          alt={b.title}
                          className="h-full w-full"
                          style={{
                            objectFit: (b.image_fit ?? 'cover') as any,
                            objectPosition: (b.image_position ?? 'center') as any,
                          }}
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-sm font-extrabold text-white">{b.title}</div>
                        {b.subtitle ? <div className="mt-1 text-xs text-white/85">{b.subtitle}</div> : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null
        }

      </main>
    </div>
  );
}
