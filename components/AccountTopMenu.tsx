'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getNotificationLink } from '@/lib/notifications/getNotificationLink';
import { NotificationCenter } from '@/components/NotificationCenter';
import { NavLiveButton } from '@/components/LiveBadge';
import { formatMoney } from '@/lib/utils/format';

type NavItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: 'pink' | 'neutral' | 'danger';
  badge?: number;
};

type AlertItem = {
  id: string;
  label: string;
  count: number;
  link: string;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function isAbortAuthError(e: unknown) {
  const name = String((e as any)?.name || '').toLowerCase();
  const msg = String((e as any)?.message || '').toLowerCase();
  return name.includes('abort') || msg.includes('abort');
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const tone = item.tone ?? 'neutral';
  const base =
    'group flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-[13px] font-semibold transition-all duration-300 shadow-sm hover:scale-[1.02] hover:shadow-md';
  const styles =
    tone === 'pink'
      ? 'border-pink-200 bg-pink-50 text-brand-orange hover:opacity-90 animate-gradient-shift'
      : tone === 'danger'
        ? 'border-black/10 bg-gray-900 text-white hover:bg-black'
        : 'border-black/5 bg-white text-gray-900 hover:bg-gray-50';

  const content = (
    <>
      <span className="truncate">{item.label}</span>
      <span className="inline-flex items-center gap-2">
        {typeof item.badge === 'number' && item.badge > 0 ? (
          <span className="text-[12px] font-extrabold text-brand-orange">{item.badge > 99 ? '99+' : item.badge}</span>
        ) : null}
        <span className={classNames('text-xs font-bold transition-transform group-hover:translate-x-1', tone === 'danger' ? 'text-white/80' : 'text-gray-400')}>→</span>
      </span>
    </>
  );

  const cls = classNames(base, styles);
  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          item.onClick?.();
          onNavigate();
        }}
        className={cls}
      >
        {content}
      </button>
    );
  }

  if (!item.href) {
    // Si no hay href, no renderizar link
    return null;
  }

  return (
    <Link href={item.href} onClick={onNavigate} className={cls}>
      {content}
    </Link>
  );
}

export function AccountTopMenu() {
  const pathname = usePathname() || '/';
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState('Usuario');

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [totalAlerts, setTotalAlerts] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [planType, setPlanType] = useState<string>('basic');
  const [planStart, setPlanStart] = useState<string | null>(null);
  const [planEnd, setPlanEnd] = useState<string | null>(null);

  // Antes lo ocultábamos en dashboard para reducir carga, pero eso hacía que el usuario
  // “no viera” el punto rosa en submenús. Solo lo ocultamos en admin.
  const hide = pathname.startsWith('/admin');

  useEffect(() => setMounted(true), []);

  const refreshAlerts = useCallback(async (uid: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setAlerts([]);
        setTotalAlerts(0);
        setNotifications([]);
        return;
      }

      // Cargar alertas resumidas (forzar sin caché con múltiples parámetros)
      const timestamp = Date.now();
      const random = Math.random();
      const alertsRes = await fetch(`/api/alerts/summary?t=${timestamp}&_nocache=${random}&_force=${timestamp}`, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store',
      });
      const alertsJson = await alertsRes.json().catch(() => ({}));
      if (alertsRes.ok) {
        const list = (alertsJson?.alerts ?? []) as AlertItem[];
        const calculatedTotal = list.reduce((s, a) => s + a.count, 0);
        const apiTotal = Number(alertsJson?.totalAlerts ?? 0);
        const finalTotal = apiTotal > 0 ? apiTotal : calculatedTotal;

        // Log solo si hay alertas o si es la primera carga (para diagnóstico)
        if (list.length > 0 || totalAlerts === 0) {
          // console.log('[AccountTopMenu] 🔍 Alertas cargadas:', {
          //   alerts: list,
          //   apiTotal,
          //   calculatedTotal,
          //   finalTotal,
          //   desglose: list.map(a => `${a.label}: ${a.count}`).join(', '),
          // });
        }

        // Si el total es 0, forzar limpieza del estado
        if (finalTotal === 0) {
          // console.log('[AccountTopMenu] ✅ Total es 0, limpiando estado...');
          setAlerts([]);
          setTotalAlerts(0);
          setNotifications([]);
        } else {
          setAlerts(list);
          setTotalAlerts(finalTotal);
        }
      } else {
        // console.warn('[AccountTopMenu] Error al cargar alertas:', alertsJson?.error);
        setAlerts([]);
        setTotalAlerts(0);
      }

      // Cargar notificaciones recientes (últimas 10) para mostrar en el dropdown
      const notifRes = await fetch(`/api/notifications/list?limit=10&_t=${Date.now()}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const notifJson = await notifRes.json().catch(() => ({}));
      if (notifRes.ok && Array.isArray(notifJson?.rows)) {
        // Filtrar solo las no leídas y de compras/ventas
        const relevantNotifs = notifJson.rows
          .filter((n: any) => {
            const k = String((n?.data?.kind ?? n?.type) ?? '').trim().toLowerCase();
            const isRelevant = [
              'new_sale', 'sale_paid', 'payment_approved', 'payment_rejected',
              'order_shipped', 'order_completed', 'order_message'
            ].includes(k);
            return isRelevant && n.is_read === false;
          })
          .slice(0, 5); // Máximo 5 en el dropdown
        setNotifications(relevantNotifs);
      } else {
        setNotifications([]);
      }

      // Cargar saldo de monedero
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', uid).maybeSingle();
      if (wallet) {
        setWalletBalance(wallet.balance);
      }
    } catch (err) {
      // console.error('[AccountTopMenu] Error al cargar alertas:', err);
      setAlerts([]);
      setTotalAlerts(0);
      setNotifications([]);
    }
  }, []);

  const clearBadgeOnNavigate = useCallback((href: string | undefined) => {
    if (!href) return;
    setNotifOpen(false);
  }, []);

  const handleAlertClick = useCallback(async (alertId: string, link: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = link;
        return;
      }

      // Cerrar el dropdown inmediatamente
      setNotifOpen(false);
      clearBadgeOnNavigate(link);

      // Eliminar todas las notificaciones relacionadas con esta alerta
      const notificationTypes: Record<string, string[]> = {
        sales: ['new_sale', 'sale_paid'],
        support: ['support_message', 'support_reply', 'support_new_message'],
        lost_bid: ['outbid'],
        rated_buyer: ['rating_received'],
        rated_seller: ['ratings_complete'],
        other_notifications: [], // Se maneja con todas las demás
      };

      const types = notificationTypes[alertId];
      if (types || alertId === 'other_notifications' || alertId === 'responses' || alertId === 'questions') {
        // Obtener todas las notificaciones NO LEÍDAS del usuario
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = link;
          return;
        }

        const res = await fetch(`/api/notifications/list?limit=2000&_t=${Date.now()}`, {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));

        let idsToDelete: string[] = [];

        if (res.ok && Array.isArray(json?.rows)) {
          if (alertId === 'other_notifications') {
            // Para "otras notificaciones", eliminamos TODAS las no leídas que no sean de los otros tipos conocidos
            const allKnownTypes = [
              'new_sale', 'sale_paid', 'support_message', 'support_reply', 'support_new_message',
              'outbid', 'rating_received', 'ratings_complete', 'listing_question', 'listing_answer',
            ];
            idsToDelete = json.rows
              .filter((n: any) => {
                if (n.is_read === true) return false; // Solo no leídas
                const k = String((n?.data?.kind ?? n?.type) ?? '').trim().toLowerCase();
                return !allKnownTypes.includes(k);
              })
              .map((n: any) => n.id);
          } else if (alertId === 'responses') {
            idsToDelete = json.rows
              .filter((n: any) => {
                if (n.is_read === true) return false;
                const k = String((n?.data?.kind ?? n?.type) ?? '').trim().toLowerCase();
                return k === 'listing_answer' || k === 'listing_question';
              })
              .map((n: any) => n.id);
          } else if (alertId === 'questions') {
            idsToDelete = json.rows
              .filter((n: any) => {
                if (n.is_read === true) return false;
                const k = String((n?.data?.kind ?? n?.type) ?? '').trim().toLowerCase();
                return k === 'listing_question';
              })
              .map((n: any) => n.id);
          } else if (types && types.length > 0) {
            idsToDelete = json.rows
              .filter((n: any) => {
                if (n.is_read === true) return false;
                const k = String((n?.data?.kind ?? n?.type) ?? '').trim().toLowerCase();
                return types.includes(k);
              })
              .map((n: any) => n.id);
          }
        }

        // Eliminar todas las notificaciones relacionadas
        if (idsToDelete.length > 0) {
          try {
            const deleteRes = await fetch('/api/notifications/delete', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
              body: JSON.stringify({ ids: idsToDelete }),
            });

            if (deleteRes.ok) {
              // Actualizar estado local inmediatamente
              setNotifications((prev) => prev.filter((n) => !idsToDelete.includes(n.id)));
              setAlerts((prev) => prev.map((a) => {
                if (a.id === alertId) {
                  return { ...a, count: Math.max(0, a.count - idsToDelete.length) };
                }
                return a;
              }));

              // Disparar evento para actualizar el contador
              window.dispatchEvent(new CustomEvent('notifications-updated', {
                detail: { deleted: true, deletedIds: idsToDelete }
              }));

              // Refrescar alertas inmediatamente
              if (userId) {
                setTimeout(() => {
                  void refreshAlerts(userId);
                }, 100);
                setTimeout(() => {
                  void refreshAlerts(userId);
                }, 500);
              }
            }
          } catch (deleteErr) {
            console.error('[AccountTopMenu] Error al eliminar notificaciones:', deleteErr);
          }
        }
      }

      // Redirigir
      window.location.href = link;
    } catch (err) {
      console.error('[AccountTopMenu] Error al manejar click en alerta:', err);
      window.location.href = link;
    }
  }, [clearBadgeOnNavigate, userId, refreshAlerts]);

  useEffect(() => {
    if (!mounted) return;
    if (hide) return;
    let cancelled = false;

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const uid = data.user?.id ?? null;
        setUserId(uid);
        setIsAdmin(false);
        const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
        const email = data.user?.email || '';
        const emailName = email ? email.split('@')[0] : '';
        const resolvedName =
          (meta?.full_name as string | undefined) ||
          (meta?.fullName as string | undefined) ||
          (meta?.name as string | undefined) ||
          (meta?.nickname as string | undefined) ||
          (meta?.username as string | undefined) ||
          (emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : '') ||
          'Usuario';
        setDisplayName(resolvedName);
        if (!uid) return;
        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
        if (!cancelled) setIsAdmin(Boolean(adminRow));

        // Fetch Plan Info
        const { data: profile } = await supabase.from('profiles').select('plan_type, pro_subscription_end').eq('id', uid).maybeSingle();
        if (!cancelled && profile) {
          setPlanType(profile.plan_type || 'basic');
          setPlanEnd(profile.pro_subscription_end);
        }

        await refreshAlerts(uid);
      } catch (e: unknown) {
        // Evitar "Unhandled Runtime Error" por AbortError interno de supabase auth (hot reload / navegación)
        if (isAbortAuthError(e)) return;
        console.error(e);
      }
    };

    void boot();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void boot();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [mounted, hide, refreshAlerts]);

  // Realtime + polling fallback: notificaciones + preguntas sin responder
  useEffect(() => {
    if (!mounted) return;
    if (hide) return;
    if (!userId) return;

    const notifChannel = supabase
      .channel(`notifs-${userId}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => void refreshAlerts(userId),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') {
          // noop
        }
      });

    const qSeller = supabase
      .channel(`questions-seller-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_questions', filter: `seller_id=eq.${userId}` }, () => void refreshAlerts(userId))
      .subscribe();
    const qAsker = supabase
      .channel(`questions-asker-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listing_questions', filter: `asker_id=eq.${userId}` }, () => void refreshAlerts(userId))
      .subscribe();

    const walletChannel = supabase
      .channel(`wallet-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.new && typeof (payload.new as any).balance === 'number') {
          setWalletBalance((payload.new as any).balance);
        }
      })
      .subscribe();

    void refreshAlerts(userId);
    const poll = window.setInterval(() => void refreshAlerts(userId), 15000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(qSeller);
      supabase.removeChannel(qAsker);
      supabase.removeChannel(walletChannel);
    };
  }, [mounted, hide, userId, refreshAlerts]);

  // Escuchar eventos de actualización de notificaciones desde otras páginas
  useEffect(() => {
    if (!mounted || hide || !userId) return;

    const handleNotificationsUpdated = (e?: Event) => {
      // Actualizar inmediatamente cuando se elimina o marca como leída una notificación
      const detail = (e as CustomEvent)?.detail;
      const forceRefresh = detail?.forceRefresh === true;

      console.log('[AccountTopMenu] Evento notifications-updated recibido', { e, detail, forceRefresh });

      // Si se fuerza actualización, limpiar estado local primero
      if (forceRefresh) {
        console.log('[AccountTopMenu] Forzando limpieza de estado local...');
        setAlerts([]);
        setTotalAlerts(0);
        setNotifications([]);
      }

      void refreshAlerts(userId);
      setTimeout(() => void refreshAlerts(userId), 300);
    };

    window.addEventListener('notifications-updated', handleNotificationsUpdated);

    // Listen for direct wallet balance updates (from Live purchases, etc.)
    const handleWalletUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (typeof detail?.balance === 'number') {
        setWalletBalance(detail.balance);
      }
    };
    window.addEventListener('wallet-balance-updated', handleWalletUpdate);

    return () => {
      window.removeEventListener('notifications-updated', handleNotificationsUpdated);
      window.removeEventListener('wallet-balance-updated', handleWalletUpdate);
    };
  }, [mounted, hide, userId, refreshAlerts]);

  // Forzar actualización cuando el componente se monta (por si hay caché)
  useEffect(() => {
    if (!mounted || hide || !userId) return;

    // Forzar actualización inmediata al montar
    const timer = setTimeout(() => {
      // console.log('[AccountTopMenu] Forzando actualización al montar...');
      void refreshAlerts(userId);
    }, 500);

    return () => clearTimeout(timer);
  }, [mounted, hide, userId, refreshAlerts]);

  useEffect(() => {
    if (!mounted) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapperRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
      setNotifOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [mounted]);

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/';
    }
  };

  const alertCount = (id: string) => alerts.find((a) => a.id === id)?.count ?? 0;
  const responsesCount = alertCount('responses');
  const questionsCount = alertCount('questions');
  const salesCount = alertCount('sales');

  const menuSections = useMemo(() => {
    const sections: Array<{ title?: string; items: NavItem[] }> = [
      {
        title: 'Navegación',
        items: [
          { label: 'Categorias', href: '/categorias' },
          { label: 'Vender', href: '/sell', tone: 'pink' },
          { label: 'Carrito', href: '/cart' },
        ],
      },
      {
        title: 'Mi cuenta',
        items: [
          { label: 'Mi panel', href: '/dashboard', tone: 'pink' },
          { label: 'Mi perfil', href: '/dashboard/perfil' },
          { label: 'Planes', href: '/dashboard/pro', tone: 'pink' },
          { label: '📹 GoVendy Live', href: '/dashboard/live', tone: 'pink' },
          { label: 'Mis publicaciones', href: '/dashboard/listings' },
        ],
      },
      {
        title: 'Operaciones',
        items: [
          { label: 'Monedero', href: '/dashboard/monedero', tone: 'pink', badge: walletBalance ?? undefined },
          { label: 'Ventas', href: '/dashboard/ventas' },
          { label: 'Compras', href: '/dashboard/compras' },
          { label: 'Pagos', href: '/dashboard/pagos' },
          { label: '📦 Mis Guías Estafeta', href: '/estafeta/mis-guias' },
        ],
      },
      {
        title: 'Comunicación',
        items: [
          { label: 'Preguntas', href: '/dashboard/preguntas' },
          { label: 'Respuestas', href: '/dashboard/respuestas' },
        ],
      },
      {
        title: 'Otros',
        items: [
          { label: 'Favoritos', href: '/dashboard/favoritos' },
          { label: '👥 Siguiendo', href: '/dashboard/siguiendo' },
          { label: 'Reputación', href: '/dashboard/reputacion' },
          { label: 'Disputas', href: '/dashboard/devoluciones' },
          { label: 'Cupones', href: '/dashboard/coupons' },
          { label: 'Publicidad', href: '/dashboard/publicidad', tone: 'pink' },
        ],
      },
      {
        items: [
          { label: 'Ayuda', href: '/dashboard/ayuda' },
          ...(isAdmin ? [{ label: 'Admin', href: '/admin/settings' }] : []),
          { label: 'Cerrar sesión', onClick: onSignOut, tone: 'danger' },
        ],
      },
    ];
    return sections;
  }, [isAdmin, responsesCount, questionsCount, salesCount]);

  const hasAlerts = totalAlerts > 0;

  if (!mounted) {
    return null;
  }
  if (hide) {
    return null;
  }
  if (!userId) {
    return null;
  }

  return (
    <div className="sticky top-0 z-[70] border-b border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-2">
        <div className="hidden sm:block text-sm font-semibold text-gray-700">
          Hola, <span className="text-gray-900">{displayName}</span>
        </div>
        {walletBalance !== null && (
          <Link href="/dashboard/monedero" className="hidden sm:flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-all duration-300 ring-1 ring-black/5 hover:scale-105 hover:shadow-md animate-pulse-slow">
            <span className="animate-bounce-slow">💰</span>
            <span>{formatMoney(walletBalance)}</span>
          </Link>
        )}
        {(planType === 'pro' || planType === 'platinum') && (
          <div className="hidden sm:flex flex-col items-end mr-1 leading-tight">
            <span className={`bg-clip-text text-transparent text-[10px] font-black uppercase tracking-wider ${planType === 'platinum' ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-gradient-to-r from-brand-orange to-pink-600'}`}>
              {planType === 'platinum' ? '⭐ PLATINUM' : 'MEMBER PRO'}
            </span>
            <div className="flex flex-col items-end">
              {planStart && (
                <span className="text-[9px] text-gray-500 font-medium leading-none">
                  Inicio: {new Date(planStart).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
              {planEnd && (
                <span className="text-[9px] text-gray-500 font-medium leading-none">
                  Vence: {new Date(planEnd).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => {
              // Limpiar la preferencia de ver como usuario cuando vuelve al admin
              try {
                window.localStorage.removeItem('admin_view_as_user');
              } catch {
                // noop
              }
            }}
            className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all duration-300 hover:scale-105 hover:shadow-lg animate-shimmer"
            title="Volver al panel de administrador"
          >
            ⚙️ Panel Admin
          </Link>
        )}
        <div ref={wrapperRef} className="relative flex items-center gap-2">
          <NavLiveButton />
          <NotificationCenter hide={hide} userId={userId} />
          {/* Botón de notificaciones legacy (oculto) */}
          {false && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setOpen(false);
                }}
                className="relative inline-flex items-center justify-center rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                aria-label="Alertas"
                aria-expanded={notifOpen}
              >
                <span className="sr-only">{hasAlerts ? 'Tienes alertas' : 'Sin alertas'}</span>
              </button>

              {notifOpen ? (
                <div className="absolute right-0 top-full mt-2 w-[min(380px,calc(100vw-16px))] overflow-hidden rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-black/10">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="text-[11px] font-semibold text-gray-500">Notificaciones</div>
                    <div className="flex items-center gap-2">
                      {totalAlerts > 0 && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            if (!confirm(`¿Eliminar todas las ${totalAlerts} notificaciones no leídas? Esta acción no se puede deshacer.`)) {
                              return;
                            }

                            try {
                              const { data: sess } = await supabase.auth.getSession();
                              const token = sess.session?.access_token;
                              if (!token) {
                                alert('Error: Sesión no válida');
                                return;
                              }

                              // Cerrar dropdown inmediatamente
                              setNotifOpen(false);

                              console.log('[LIMPIAR] Iniciando eliminación de todas las notificaciones no leídas...');

                              // Usar all: true para eliminar TODAS las notificaciones no leídas directamente
                              // Esto es más eficiente y evita problemas de sincronización
                              const deleteRes = await fetch('/api/notifications/delete', {
                                method: 'POST',
                                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                                body: JSON.stringify({ all: true }),
                              });

                              const deleteJson = await deleteRes.json().catch(() => ({}));

                              if (!deleteRes.ok || !deleteJson?.ok) {
                                const errorMsg = deleteJson?.error || 'Error desconocido';
                                console.error('[LIMPIAR] Error al eliminar:', errorMsg);
                                alert(`❌ Error al eliminar notificaciones: ${errorMsg}\n\nEjecuta ELIMINAR_MIS_NOTIFICACIONES.sql en Supabase para eliminarlas manualmente.`);
                                return;
                              }

                              const deleted = Number(deleteJson?.deleted ?? 0);
                              const remaining = Number(deleteJson?.remaining ?? 0);

                              console.log('[LIMPIAR] Resultado:', { deleted, remaining });

                              // Actualizar estado local inmediatamente
                              setNotifications([]);
                              setAlerts([]);
                              setTotalAlerts(0);

                              // Disparar evento para actualizar otros componentes
                              window.dispatchEvent(new CustomEvent('notifications-updated', {
                                detail: { deleted: true, deletedCount: deleted, remaining }
                              }));

                              // Esperar un momento antes de refrescar para asegurar que la BD se actualizó
                              await new Promise(resolve => setTimeout(resolve, 500));

                              // Refrescar múltiples veces para asegurar actualización
                              if (userId) {
                                setTimeout(() => void refreshAlerts(userId), 200);
                                setTimeout(() => void refreshAlerts(userId), 500);
                                setTimeout(() => void refreshAlerts(userId), 1000);
                                setTimeout(() => void refreshAlerts(userId), 2000);
                              }

                              // Mostrar mensaje si quedan notificaciones
                              if (remaining > 0) {
                                alert(`⚠️ Se eliminaron ${deleted} notificaciones, pero ${remaining} aún permanecen.\n\nEsto puede deberse a:\n- Notificaciones con fechas futuras\n- Problemas de políticas RLS\n\nEjecuta ELIMINAR_MIS_NOTIFICACIONES.sql en Supabase para eliminarlas manualmente.`);
                              } else if (deleted > 0) {
                                console.log('[LIMPIAR] ✅ Todas las notificaciones eliminadas correctamente');
                                // No mostrar alerta si todo salió bien, solo actualizar el contador
                              } else {
                                console.log('[LIMPIAR] ℹ️ No había notificaciones para eliminar');
                              }
                            } catch (err) {
                              console.error('[AccountTopMenu] Error al eliminar todas:', err);
                              const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
                              alert(`❌ Error al eliminar notificaciones: ${errorMsg}\n\nEjecuta DIAGNOSTICAR_Y_ELIMINAR_NOTIFICACIONES_ATORADAS.sql en Supabase para eliminarlas manualmente.`);
                            }
                          }}
                          className="text-xs text-brand-orange hover:text-brand-orange/80 font-semibold"
                          title="Eliminar todas las notificaciones no leídas"
                        >
                          Limpiar
                        </button>
                      )}
                      {/* Enlace a notificaciones deshabilitado */}
                    </div>
                  </div>
                  <div className="max-h-[55vh] overflow-auto pr-1 scrollbar-menu">
                    {notifications.length === 0 && alerts.length === 0 ? (
                      <div className="rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-600 ring-1 ring-black/5">Sin notificaciones nuevas.</div>
                    ) : (
                      <div className="grid gap-2">
                        {/* Notificaciones individuales de compras/ventas */}
                        {notifications.map((n) => {
                          const link = getNotificationLink(n);
                          const kind = String((n?.data?.kind ?? n?.type) ?? '').trim().toLowerCase();
                          const isSale = kind === 'new_sale' || kind === 'sale_paid';
                          const isPurchase = kind === 'payment_approved' || kind === 'order_shipped' || kind === 'order_completed';

                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                // Cerrar dropdown
                                setNotifOpen(false);

                                // Eliminar notificación
                                try {
                                  const { data: sess } = await supabase.auth.getSession();
                                  const token = sess.session?.access_token;
                                  if (token) {
                                    const deleteRes = await fetch('/api/notifications/delete', {
                                      method: 'POST',
                                      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ ids: [n.id] }),
                                    });

                                    if (deleteRes.ok) {
                                      // Actualizar estado local inmediatamente
                                      setNotifications((prev) => prev.filter((notif) => notif.id !== n.id));
                                      setTotalAlerts((prev) => Math.max(0, prev - 1));

                                      // Disparar evento
                                      window.dispatchEvent(new CustomEvent('notifications-updated', {
                                        detail: { deleted: true, deletedIds: [n.id] }
                                      }));

                                      // Refrescar alertas múltiples veces para asegurar actualización
                                      if (userId) {
                                        setTimeout(() => void refreshAlerts(userId), 100);
                                        setTimeout(() => void refreshAlerts(userId), 300);
                                        setTimeout(() => void refreshAlerts(userId), 600);
                                      }
                                    }
                                  }
                                } catch (err) {
                                  console.error('[AccountTopMenu] Error al eliminar notificación:', err);
                                }

                                // Redirigir
                                if (link) {
                                  window.location.href = link;
                                }
                              }}
                              className="w-full rounded-2xl border-2 border-brand-orange bg-pink-50 px-3 py-2.5 text-left hover:bg-pink-100 transition-colors relative"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-brand-orange animate-pulse" />
                                    <span className="text-[10px] font-extrabold text-brand-orange uppercase tracking-wide">Atención</span>
                                  </div>
                                  <div className="mt-1 text-[13px] font-extrabold text-gray-900 line-clamp-1">{n.title || 'Notificación'}</div>
                                  {n.body ? (
                                    <div className="mt-0.5 text-[12px] text-gray-700 line-clamp-2">{n.body}</div>
                                  ) : null}
                                  <div className="mt-1.5 flex items-center gap-2">
                                    {isSale && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Venta
                                      </span>
                                    )}
                                    {isPurchase && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                        </svg>
                                        Compra
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="shrink-0 text-[11px] font-semibold text-brand-orange">→</span>
                              </div>
                            </button>
                          );
                        })}

                        {/* Alertas agrupadas (si hay más) */}
                        {alerts.length > 0 && (
                          <>
                            {notifications.length > 0 && (
                              <div className="my-1 border-t border-gray-200" />
                            )}
                            {alerts.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void handleAlertClick(a.id, a.link);
                                }}
                                className="w-full rounded-2xl border border-pink-200 bg-pink-50 px-3 py-2 text-left hover:bg-pink-100 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-extrabold text-gray-900">{a.label}</div>
                                    <div className="mt-0.5 text-[12px] text-gray-700">
                                      <span className="font-extrabold text-brand-orange">{a.count}</span> {a.count === 1 ? 'nueva' : 'nuevas'}
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-[11px] font-semibold text-gray-500">Ver →</span>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[13px] font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              Mi cuenta
              <span className="text-xs text-gray-500">{open ? '▲' : '▼'}</span>
            </button>

            {open ? (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-16px))] rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-black/10"
              >
                {/* Nombre y Plan */}
                <div className="mb-2 rounded-2xl bg-gray-50 px-3 py-2 text-[11px] text-gray-600 ring-1 ring-black/5">
                  <div>Conectado como <span className="font-semibold text-gray-900">{displayName}</span></div>
                  {(planType === 'pro' || planType === 'platinum') && (
                    <div className={`mt-1 flex items-center gap-1 font-bold ${planType === 'platinum' ? 'text-amber-600' : 'text-brand-orange'}`}>
                      <span>{planType === 'platinum' ? '⭐ PLATINUM' : '🌟 PRO'}</span>
                      {planEnd && (
                        <span className="text-[10px] font-normal text-gray-500">
                          (Vence: {new Date(planEnd).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-2 pb-2 text-[11px] font-semibold text-gray-500">Mi Cuenta</div>
                <div className="max-h-[70vh] overflow-auto pr-1 space-y-4 scrollbar-menu">
                  {menuSections.map((section, sectionIdx) => (
                    <div key={sectionIdx} className="space-y-2">
                      {section.title && (
                        <div className="px-2 pt-1 pb-1">
                          <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                            {section.title}
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {section.items.map((it) => (
                          <NavRow
                            key={`${it.label}-${it.href || 'btn'}`}
                            item={it}
                            onNavigate={() => {
                              setOpen(false);
                              clearBadgeOnNavigate(it.href);
                            }}
                          />
                        ))}
                      </div>
                      {sectionIdx < menuSections.length - 1 && (
                        <div className="my-2 border-t border-gray-100" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

