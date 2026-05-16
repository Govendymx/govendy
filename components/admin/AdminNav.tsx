'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type NavItem = { label: string; href: string; tone?: 'pink' | 'neutral' };

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function AdminNav() {
  const pathname = usePathname() || '/admin';
  const [isBooting, setIsBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/login?returnTo=/admin/metricas';
          return;
        }

        const { data: adminRow, error: aErr } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        // Log detallado para diagnóstico
        console.log('[ADMIN NAV] Verificación de admin:', {
          userId: userData.user.id,
          email: userData.user.email,
          adminRow,
          error: aErr,
          isAdmin: Boolean(adminRow),
        });

        if (aErr) {
          console.error('[ADMIN NAV] Error al verificar admin:', aErr);
          throw new Error(`Error al verificar permisos: ${aErr.message}`);
        }

        if (!cancelled) setIsAdmin(Boolean(adminRow));
        if (!adminRow && !cancelled) {
          const errorMsg = `No tienes permisos de administrador. User ID: ${userData.user.id}`;
          console.error('[ADMIN NAV]', errorMsg);
          setError(errorMsg);
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo validar el acceso admin.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo<NavItem[]>(() => {
    return [
      // === DASHBOARD Y ANÁLISIS ===
      { label: 'Métricas', href: '/admin/metricas', tone: 'pink' },
      { label: 'Supervisión', href: '/admin/supervision' },

      // === OPERACIONES ===
      { label: 'Pagos', href: '/admin/pagos' },
      { label: 'Retiros', href: '/admin/retiros' },
      { label: 'Logística', href: '/admin/logistica' },
      { label: '🚀 T1 Envíos', href: '/admin/envios/t1', tone: 'pink' },
      { label: '⚖️ Sobrepesos', href: '/admin/shipping/sobrepesos', tone: 'pink' },
      { label: 'Envíos', href: '/admin/envios' },
      { label: 'Tienda Estafeta', href: '/admin/estafeta' },
      { label: 'Disputas', href: '/admin/disputas' },
      { label: 'Devoluciones', href: '/admin/devoluciones' },
      { label: 'Soporte', href: '/admin/soporte' },

      // === CONTENIDO Y USUARIOS ===
      { label: 'Usuarios', href: '/admin/usuarios' },
      { label: 'Usuarios PRO', href: '/admin/usuarios-pro' },
      { label: 'Tiendas Oficiales', href: '/admin/tiendas-oficiales' },
      { label: 'Publicaciones', href: '/admin/listings' },

      // === MARKETING Y COMUNICACIÓN ===
      { label: 'Banners', href: '/admin/banners' },
      { label: 'Avisos', href: '/admin/avisos' },
      { label: 'Mensajes Flotantes', href: '/admin/mensajes-flotantes' },
      { label: 'Correo', href: '/admin/correo' },

      // === CONFIGURACIÓN ===
      { label: 'Plantillas', href: '/admin/plantillas' },
      { label: 'Negocio', href: '/admin/negocio' },
      { label: 'Configuración', href: '/admin/settings' },
    ];
  }, []);

  const card = (it: NavItem) => {
    const active = pathname === it.href;
    const base =
      'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md';
    const tone = it.tone ?? 'neutral';
    const styles =
      tone === 'pink'
        ? 'border-brand-emerald/20 bg-white text-brand-emerald hover:opacity-90 animate-gradient-shift'
        : 'border-black/5 bg-white text-gray-900 hover:bg-gray-50';
    const activeStyles = active ? 'ring-2 ring-brand-emerald border-transparent animate-pulse-ring' : '';
    return (
      <Link key={it.href} href={it.href} className={classNames(base, styles, activeStyles)}>
        <span className="truncate">{it.label}</span>
        <span className="text-xs font-bold text-gray-400 transition-transform group-hover:translate-x-1">→</span>
      </Link>
    );
  };

  const content = (
    <>
      <Link href="/" className="flex items-center gap-3 hover:opacity-95 group">
        <div className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg animate-gradient-pulse">
          <span className="text-sm font-extrabold tracking-widest">POCKET</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-emerald">Panel Admin</div>
          <div className="text-xs text-gray-500">Gestión de la plataforma</div>
        </div>
      </Link>

      <div className="mt-4">
        {isBooting ? <div className="text-sm text-gray-600">Validando acceso…</div> : null}
        {!isBooting && !isAdmin ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error || 'Acceso denegado.'}</div>
        ) : null}
        {!isBooting && isAdmin ? <div className="grid gap-3">{items.map(card)}</div> : null}
      </div>
    </>
  );

  return <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-black/5 animate-float-subtle">{content}</div>;
}

