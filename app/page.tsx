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
  bgColor = 'from-pink-50 to-pink-100',
}: {
  title: string;
  subtitle: string;
  href?: string;
  icon: ReactNode;
  bgColor?: string;
}) {
  const content = (
    <div className="group relative h-full overflow-hidden rounded-3xl bg-white p-4 transition-all duration-300 hover:shadow-xl hover:shadow-brand-emerald/5 hover:-translate-y-1 ring-1 ring-black/5 hover:ring-brand-emerald/20">
      <div className="flex items-center gap-4">
        {/* Icon Container */}
        <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${bgColor} shadow-sm ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
          <div className="flex items-center justify-center [&>svg]:h-12 [&>svg]:w-12 [&>svg]:drop-shadow-sm transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
        </div>

        {/* Text Content */}
        <div className="flex flex-1 flex-col justify-center min-w-0 py-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[15px] font-extrabold text-gray-900 group-hover:text-brand-emerald transition-colors duration-300">
              {title}
            </h3>

            {/* Action Arrow */}
            <div className="flex h-6 w-6 shrink-0 -translate-x-2 items-center justify-center rounded-full bg-gray-50 text-gray-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-hover:bg-brand-emerald group-hover:text-white">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </div>
          </div>

          <p className="mt-0.5 text-xs font-medium leading-relaxed text-gray-500 line-clamp-2 pr-1">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Decorative Glow */}
      <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-gradient-to-br from-brand-emerald/10 to-transparent blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
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
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
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

      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* 🔴 Lives activos */}
        <LiveCarousel />

        {/* Tiendas Oficiales Carousel */}
        <OfficialStoresCarousel />

        {/* Accesos rápidos (tarjetas como Mercado Libre) */}
        <section className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Envío gratis"
              subtitle="Beneficio por ser tu primera compra."
              href="/envio-gratis"
              bgColor="from-rose-50 via-pink-50 to-white"
              icon={
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Camión con flecha de retorno - Estilo flat rosa */}
                  {/* Círculo con flecha de refresh */}
                  <circle cx="30" cy="28" r="18" fill="#1FB59B" />
                  <path d="M30 18c-5.5 0-10 4.5-10 10h4c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6v4c5.5 0 10-4.5 10-10s-4.5-10-10-10z" fill="white" />
                  <path d="M38 28l-4-4v8l4-4z" fill="white" />

                  {/* Cuerpo del camión */}
                  <rect x="8" y="45" width="50" height="30" rx="4" fill="none" stroke="#1FB59B" strokeWidth="5" />

                  {/* Cabina */}
                  <path d="M58 55h20c4 0 6 2 8 6l6 8v6H58V55z" fill="none" stroke="#1FB59B" strokeWidth="5" />

                  {/* Ventana cabina */}
                  <rect x="68" y="58" width="12" height="10" rx="2" fill="none" stroke="#1FB59B" strokeWidth="3" />

                  {/* Líneas velocidad */}
                  <rect x="2" y="52" width="8" height="3" rx="1.5" fill="#1FB59B" />
                  <rect x="0" y="60" width="10" height="3" rx="1.5" fill="#1FB59B" />

                  {/* Ruedas */}
                  <circle cx="22" cy="78" r="8" fill="none" stroke="#1FB59B" strokeWidth="5" />
                  <circle cx="22" cy="78" r="3" fill="#1FB59B" />
                  <circle cx="78" cy="78" r="8" fill="none" stroke="#1FB59B" strokeWidth="5" />
                  <circle cx="78" cy="78" r="3" fill="#1FB59B" />
                </svg>
              }
            />
            <FeatureCard
              title="Tienda Estafeta"
              subtitle="Calcula el costo de tu envío y compra tu guía."
              href="/estafeta/cotizar"
              bgColor="from-rose-50 via-pink-50 to-white"
              icon={
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Tienda con toldo - Estilo flat rosa */}
                  {/* Toldo superior */}
                  <path d="M10 15h80l-5 25H15L10 15z" fill="#1FB59B" />
                  {/* Líneas del toldo */}
                  <path d="M25 15v25M40 15v25M55 15v25M70 15v25" stroke="white" strokeWidth="3" />
                  {/* Ondas del toldo */}
                  <path d="M10 40q10 10 20 0t20 0t20 0t20 0" fill="#1FB59B" />

                  {/* Cuerpo de la tienda */}
                  <rect x="10" y="40" width="80" height="50" fill="#1FB59B" />

                  {/* Puerta */}
                  <rect x="25" y="50" width="20" height="35" rx="2" fill="white" stroke="#1FB59B" strokeWidth="2" />
                  <circle cx="40" cy="68" r="2" fill="#1FB59B" />

                  {/* Ventana */}
                  <rect x="55" y="55" width="25" height="18" rx="2" fill="white" stroke="#1FB59B" strokeWidth="2" />

                  {/* Base */}
                  <rect x="5" y="88" width="90" height="6" rx="2" fill="#1FB59B" />
                </svg>
              }
            />
            <FeatureCard
              title="Productos destacados"
              subtitle="Más vistos"
              href="/productos-destacados"
              bgColor="from-rose-50 via-pink-50 to-white"
              icon={
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Iconos de redes sociales - Estilo bicolor rosa/morado */}
                  {/* Chat central */}
                  <rect x="30" y="35" width="40" height="30" rx="6" fill="none" stroke="#5B21B6" strokeWidth="4" />
                  <path d="M40 55l-10 12v-12" fill="none" stroke="#5B21B6" strokeWidth="4" strokeLinejoin="round" />
                  <path d="M42 47h16M42 53h10" stroke="#5B21B6" strokeWidth="3" strokeLinecap="round" />

                  {/* Corazón - arriba izquierda */}
                  <circle cx="22" cy="22" r="16" fill="none" stroke="#5B21B6" strokeWidth="3" />
                  <path d="M22 30c-8-8-8-12 0-16 8 4 8 8 0 16z" fill="#1FB59B" />

                  {/* Play - arriba derecha */}
                  <circle cx="78" cy="22" r="16" fill="none" stroke="#5B21B6" strokeWidth="3" />
                  <path d="M73 15l12 7-12 7z" fill="none" stroke="#1FB59B" strokeWidth="3" strokeLinejoin="round" />

                  {/* Imagen - abajo izquierda */}
                  <circle cx="22" cy="78" r="16" fill="none" stroke="#5B21B6" strokeWidth="3" />
                  <path d="M12 82l8-10 6 5 8-8" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Plus - abajo derecha */}
                  <circle cx="78" cy="78" r="16" fill="none" stroke="#5B21B6" strokeWidth="3" />
                  <path d="M78 70v16M70 78h16" stroke="#1FB59B" strokeWidth="3" strokeLinecap="round" />
                </svg>
              }
            />
            <FeatureCard
              title="Subastas"
              subtitle="Todas las subastas, ordenadas por finalización."
              href="/subastas"
              bgColor="from-rose-50 via-pink-50 to-white"
              icon={
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Martillo de subasta con monedas - Estilo flat rosa */}
                  {/* Monedas con $ */}
                  <circle cx="20" cy="18" r="12" fill="#1FB59B" />
                  <text x="20" y="23" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">$</text>

                  <circle cx="55" cy="12" r="10" fill="#1FB59B" />
                  <text x="55" y="17" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">$</text>

                  <circle cx="85" cy="25" r="11" fill="#1FB59B" />
                  <text x="85" y="30" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">$</text>

                  {/* Martillo */}
                  <g transform="rotate(-45 50 55)">
                    {/* Cabeza */}
                    <rect x="25" y="40" width="30" height="18" rx="4" fill="#1FB59B" />
                    {/* Bandas */}
                    <rect x="30" y="40" width="4" height="18" fill="white" fillOpacity="0.3" />
                    <rect x="46" y="40" width="4" height="18" fill="white" fillOpacity="0.3" />
                    {/* Mango */}
                    <rect x="36" y="58" width="8" height="35" rx="3" fill="#1FB59B" />
                  </g>

                  {/* Líneas de impacto */}
                  <path d="M15 70l-8 5M20 78l-5 8" stroke="#1FB59B" strokeWidth="4" strokeLinecap="round" />

                  {/* Base */}
                  <rect x="5" y="85" width="30" height="5" rx="2" fill="#1FB59B" />
                  <rect x="10" y="80" width="20" height="5" rx="1" fill="#1FB59B" />
                </svg>
              }
            />
            <FeatureCard
              title="Más vistos"
              subtitle="Artículos con más vistas/compartidos."
              href="/mas-vistos"
              bgColor="from-rose-50 via-pink-50 to-white"
              icon={
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Chat con corazón - Estilo flat rosa */}
                  {/* Burbuja de chat */}
                  <rect x="10" y="10" width="80" height="60" rx="15" fill="none" stroke="#1FB59B" strokeWidth="6" />
                  {/* Cola del chat */}
                  <path d="M25 70v22l20-22" fill="white" stroke="#1FB59B" strokeWidth="6" strokeLinejoin="round" />
                  <path d="M25 70h20" stroke="white" strokeWidth="8" />

                  {/* Corazón centrado */}
                  <path d="M50 25c-8-15-30-5-20 20 10 15 20 20 20 20s10-5 20-20c10-25-12-35-20-20z" fill="#1FB59B" />
                </svg>
              }
            />
            <FeatureCard
              title="Compra protegida"
              subtitle="Te explicamos cómo funciona."
              href="/compra-protegida"
              bgColor="from-rose-50 via-pink-50 to-white"
              icon={
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Escudo con check y moneda - Estilo flat rosa */}
                  {/* Escudo principal */}
                  <path d="M50 5L15 20v25c0 28 35 45 35 45s35-17 35-45V20L50 5z" fill="#1FB59B" />

                  {/* Borde interior del escudo */}
                  <path d="M50 12L22 25v20c0 22 28 36 28 36s28-14 28-36V25L50 12z" fill="none" stroke="white" strokeWidth="3" />

                  {/* Check mark */}
                  <path d="M35 45l10 10 20-20" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Moneda con engranaje */}
                  <g transform="translate(65, 60)">
                    <circle cx="15" cy="15" r="18" fill="#1FB59B" stroke="white" strokeWidth="3" />
                    {/* Dientes del engranaje */}
                    <g stroke="white" strokeWidth="2">
                      <rect x="13" y="-2" width="4" height="6" fill="white" />
                      <rect x="13" y="30" width="4" height="6" fill="white" />
                      <rect x="-2" y="13" width="6" height="4" fill="white" />
                      <rect x="30" y="13" width="6" height="4" fill="white" />
                      <rect x="2" y="2" width="5" height="4" transform="rotate(45 4 4)" fill="white" />
                      <rect x="24" y="24" width="5" height="4" transform="rotate(45 26 26)" fill="white" />
                      <rect x="24" y="2" width="5" height="4" transform="rotate(-45 26 4)" fill="white" />
                      <rect x="2" y="24" width="5" height="4" transform="rotate(-45 4 26)" fill="white" />
                    </g>
                    <circle cx="15" cy="15" r="10" fill="#1FB59B" stroke="white" strokeWidth="2" />
                    <text x="15" y="20" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">$</text>
                  </g>
                </svg>
              }
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
