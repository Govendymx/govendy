'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type NavItem = { label: string; href: string; tone?: 'pink' | 'neutral' };

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function isAbortAuthError(e: unknown) {
  const name = String((e as any)?.name || '').toLowerCase();
  const msg = String((e as any)?.message || '').toLowerCase();
  return name.includes('abort') || msg.includes('abort');
}

export function AdminTopMenu() {
  const pathname = usePathname() || '/admin';
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => setMounted(true), []);

  function displayNameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown>; id?: string }): string {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const full = meta?.full_name ?? meta?.name;
    if (typeof full === 'string' && full.trim()) return full.trim();
    const email = user?.email?.trim();
    if (email) return email;
    const id = user?.id ?? '';
    return id ? `${id.slice(0, 8)}…` : 'Admin';
  }

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const boot = async () => {
      try {
        // Usar getSession (cacheado local) en vez de getUser (roundtrip al servidor)
        const { data: sess } = await supabase.auth.getSession();
        if (cancelled) return;
        const user = sess.session?.user;
        if (!user) {
          setIsAdmin(false);
          setUserDisplayName(null);
          return;
        }
        // Mostrar nombre inmediatamente
        if (!cancelled) setUserDisplayName(displayNameFromUser(user));

        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled) {
          setIsAdmin(Boolean(adminRow));
        }
      } catch (e: unknown) {
        if (isAbortAuthError(e)) return;
        if (!cancelled) {
          setIsAdmin(false);
          setUserDisplayName(null);
        }
      }
    };

    void boot();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void boot());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (!pathname.startsWith('/admin')) return;
    if (!isAdmin) return;

    let cancelled = false;
    let timer: any = null;

    const loadUnread = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          if (!cancelled) setUnreadCount(0);
          return;
        }
        const res = await fetch(`/api/notifications/list?limit=1&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar notificaciones.');
        const c = Number(json?.unread_count ?? 0) || 0;
        if (!cancelled) setUnreadCount(c);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };

    void loadUnread();
    timer = setInterval(() => void loadUnread(), 25000);

    // Escuchar eventos de actualización de notificaciones desde otras páginas
    const handleNotificationsUpdated = () => {
      // console.log('[AdminTopMenu] Evento de actualización recibido, forzando refresh...');
      void loadUnread();
    };

    window.addEventListener('notifications-updated', handleNotificationsUpdated);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('notifications-updated', handleNotificationsUpdated);
    };
  }, [isAdmin, mounted, pathname]);

  useEffect(() => {
    if (!mounted) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [mounted]);

  const items = useMemo<NavItem[]>(
    () => [
      // === DASHBOARD Y ANÁLISIS ===
      { label: 'Inicio', href: '/admin', tone: 'pink' },
      { label: 'Métricas', href: '/admin/metricas' },
      { label: 'Estadísticas', href: '/admin/estadisticas', tone: 'pink' },
      { label: 'Supervisión', href: '/admin/supervision' },
      { label: 'Seguridad', href: '/admin/seguridad' },
      { label: '🚨 Estafas', href: '/admin/seguridad/estafas', tone: 'pink' },

      // === OPERACIONES ===
      { label: 'Pagos', href: '/admin/pagos' },
      { label: 'PocketCash', href: '/admin/pocketcash' },
      { label: 'Gift Cards', href: '/admin/gift-cards', tone: 'pink' },
      { label: '💰 Finanzas', href: '/admin/finanzas', tone: 'pink' },
      { label: 'Retiros', href: '/admin/retiros' },
      { label: 'Logística', href: '/admin/logistica' },
      { label: '🚀 T1 Envíos', href: '/admin/envios/t1', tone: 'pink' },
      { label: '⚖️ Sobrepesos', href: '/admin/shipping/sobrepesos', tone: 'pink' },
      { label: 'Tienda Estafeta', href: '/admin/estafeta' },
      { label: 'Disputas', href: '/admin/disputas' },
      { label: 'Devoluciones', href: '/admin/devoluciones' },
      { label: 'Soporte', href: '/admin/soporte' },
      { label: 'Academy', href: '/admin/academy', tone: 'pink' },

      // === CONTENIDO Y USUARIOS ===
      { label: 'Usuarios', href: '/admin/usuarios' },
      { label: 'Solicitudes', href: '/admin/solicitudes', tone: 'pink' },
      { label: 'Usuarios PRO', href: '/admin/usuarios-pro' },
      { label: 'Platinum', href: '/admin/platinum', tone: 'pink' },
      { label: 'Lives', href: '/admin/lives' },
      { label: '📺 GoVendy TV', href: '/admin/gopocket-tv', tone: 'pink' },
      { label: 'Tiendas Oficiales', href: '/admin/tiendas-oficiales' },
      { label: 'Publicaciones', href: '/admin/listings' },
      { label: 'Categorías', href: '/admin/categories' },

      // === MARKETING Y COMUNICACIÓN ===
      { label: 'Banners', href: '/admin/banners' },
      { label: 'Avisos', href: '/admin/avisos' },
      { label: 'Mensajes Flotantes', href: '/admin/mensajes-flotantes' },
      { label: 'Publicidad', href: '/admin/publicidad' },
      { label: '📺 Anuncios Lives', href: '/admin/ad-campaigns', tone: 'pink' },
      { label: 'Correo', href: '/admin/correo' },

      // === CONFIGURACIÓN ===
      { label: 'Plantillas', href: '/admin/plantillas' },
      { label: 'Negocio', href: '/admin/negocio' },
      { label: 'Auditoría', href: '/admin/auditoria' },
      { label: 'Interruptores', href: '/admin/interruptores', tone: 'pink' },
      { label: 'Configuración', href: '/admin/settings' },
    ],
    [],
  );

  const currentLabel = useMemo(() => {
    const found = items.find((it) => pathname === it.href);
    if (found) return found.label;
    if (pathname.startsWith('/admin')) return 'Panel Admin';
    return 'Admin';
  }, [items, pathname]);

  if (!mounted) return null;
  if (!pathname.startsWith('/admin')) return null;
  if (!isAdmin) return null;

  const hasAlerts = unreadCount > 0;

  return (
    <div className="sticky top-[52px] z-[80] border-b border-black/5 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/admin" className="flex items-center gap-3 hover:opacity-95 group">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5 bg-white -mt-1 transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl animate-pulse-slow">
            {logoError ? (
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-brand-emerald to-teal-400 text-white animate-gradient-rotate">
                <span className="text-xl font-black">GP</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo.png"
                alt="GoVendy"
                className="h-full w-full object-contain p-1.5 transition-transform group-hover:rotate-6"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-emerald">Panel Admin</div>
            <div className="text-xs text-gray-500">{currentLabel}</div>
          </div>
        </Link>

        {/* Global Search Bar */}
        <div className="hidden max-w-md flex-1 px-8 md:block">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value;
              if (val.trim()) {
                // Redirigir a la página de búsqueda
                window.location.href = `/admin/busqueda?q=${encodeURIComponent(val.trim())}`;
              }
            }}
            className="relative group"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 group-focus-within:text-brand-emerald">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              name="q"
              placeholder="Buscar usuarios, órdenes, IDs..."
              className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 outline-none ring-1 ring-transparent transition-all hover:bg-white focus:bg-white focus:ring-brand-emerald/50 focus:shadow-sm"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                Enter
              </span>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3">
          {userDisplayName ? (
            <span className="hidden text-right text-[12px] text-gray-600 sm:block" title="Conectado como">
              Conectado como <span className="font-semibold text-gray-900">{userDisplayName}</span>
            </span>
          ) : null}

          <div ref={wrapRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 transition-all duration-300 hover:scale-105 hover:shadow-md animate-shimmer"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              Menú Admin
              <span className="text-xs text-gray-500 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>{open ? '▲' : '▼'}</span>
            </button>

            {open ? (
              <div role="menu" className="absolute right-0 mt-2 w-[260px] rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-black/10">
                {userDisplayName ? (
                  <div className="mb-2 rounded-2xl bg-gray-50 px-3 py-2 text-[11px] text-gray-600 ring-1 ring-black/5">
                    Conectado como <span className="font-semibold text-gray-900">{userDisplayName}</span>
                  </div>
                ) : null}
                <div className="px-2 pb-2 text-[11px] font-semibold text-gray-500">Navegación</div>
                <div className="max-h-[70vh] overflow-auto pr-1">
                  <div className="grid gap-2">
                    <Link
                      href="/?view=user"
                      onClick={() => {
                        setOpen(false);
                        // Guardar preferencia en localStorage
                        try {
                          window.localStorage.setItem('admin_view_as_user', 'true');
                        } catch {
                          // noop
                        }
                      }}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-left text-[13px] font-semibold text-blue-700 shadow-sm transition hover:opacity-90"
                      title="Ver la aplicación como usuario normal"
                    >
                      <span className="truncate">👤 Ver como usuario</span>
                      <span className="text-xs font-bold text-blue-400">→</span>
                    </Link>
                    {items.map((it) => {
                      const active = pathname === it.href;
                      const tone = it.tone ?? 'neutral';
                      const base =
                        'flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-[13px] font-semibold shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md';
                      const styles =
                        tone === 'pink'
                          ? 'border-brand-emerald/20 bg-white text-brand-emerald hover:opacity-90 animate-gradient-shift'
                          : 'border-black/5 bg-white text-gray-900 hover:bg-gray-50';
                      const activeStyles = active ? 'ring-2 ring-brand-emerald border-transparent animate-pulse-ring' : '';
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          onClick={() => setOpen(false)}
                          className={classNames(base, styles, activeStyles)}
                        >
                          <span className="truncate">{it.label}</span>
                          <span className="text-xs font-bold text-gray-400">→</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

