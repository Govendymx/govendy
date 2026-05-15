'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import UnifiedDashboardWidget from '../components/UnifiedDashboardWidget';
import { Pagination, usePagination } from '@/components/ui/Pagination';

function fmtDate(d: any) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtMoney(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '—';
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending_payment', label: 'Pendiente de pago' },
  { value: 'paid', label: 'Pagado (por enviar)' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'refunded', label: 'Reembolsado' },
  { value: 'cancelled', label: 'Cancelado' },
];

function SupervisionContent() {
  const sp = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchTerm);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const statusParam = String(sp?.get('status') || '').trim();
  const hasDisputeParam = sp?.get('has_dispute') === '1';
  const buyerIdParam = String(sp?.get('buyer_id') || '').trim();
  const sellerIdParam = String(sp?.get('seller_id') || '').trim();

  const [status, setStatus] = useState(statusParam);
  const [hasDispute, setHasDispute] = useState(hasDisputeParam);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ops, setOps] = useState<any[]>([]);
  const [estafeta, setEstafeta] = useState<{
    estafeta_paid_pending_guide: number;
    estafeta_paid_today: number;
    recent: any[];
  } | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{
    disputes_open: number;
    payments_offline_pending: number;
    orders_paid_pending_ship: number;
    payouts_sellers_to_release: number;
    support_unread_estimate: number;
    estafeta_paid_pending_guide: number;
    estafeta_paid_today: number;
  } | null>(null);

  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('admin_supervision_dismissed');
    if (stored) {
      try {
        setDismissedAlerts(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing dismissed alerts', e);
      }
    }
  }, []);

  const handleDismiss = (id: string) => {
    const next = [...dismissedAlerts, id];
    setDismissedAlerts(next);
    localStorage.setItem('admin_supervision_dismissed', JSON.stringify(next));
  };

  const load = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/supervision';
        return;
      }
      const qs = new URLSearchParams({ limit: '200', t: String(Date.now()) });
      if (status) qs.set('status', status);
      if (hasDispute) qs.set('has_dispute', '1');
      if (appliedSearch) qs.set('search', appliedSearch);

      if (buyerIdParam) qs.set('buyer_id', buyerIdParam);
      if (sellerIdParam) qs.set('seller_id', sellerIdParam);

      const [resOps, resEstafeta, resSummary] = await Promise.all([
        fetch(`/api/admin/supervision/operations?${qs.toString()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch(`/api/admin/supervision/estafeta?limit=20&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch('/api/admin/dashboard/summary', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }),
      ]);
      const jsonOps = await resOps.json().catch(() => ({}));
      if (!resOps.ok) throw new Error((jsonOps as any)?.error || 'No se pudieron cargar operaciones.');
      setOps((jsonOps?.operations ?? []) as any[]);
      const jsonEst = await resEstafeta.json().catch(() => ({}));
      if (resEstafeta.ok && (jsonEst as any)?.ok) {
        setEstafeta({
          estafeta_paid_pending_guide: (jsonEst as any).estafeta_paid_pending_guide ?? 0,
          estafeta_paid_today: (jsonEst as any).estafeta_paid_today ?? 0,
          recent: (jsonEst as any).recent ?? [],
        });
      } else {
        setEstafeta(null);
      }
      const jSummary = await resSummary.json().catch(() => ({}));
      if (resSummary.ok && (jSummary as any)?.ok) {
        setSummary({
          disputes_open: (jSummary as any).disputes_open ?? 0,
          payments_offline_pending: (jSummary as any).payments_offline_pending ?? 0,
          orders_paid_pending_ship: (jSummary as any).orders_paid_pending_ship ?? 0,
          payouts_sellers_to_release: (jSummary as any).payouts_sellers_to_release ?? 0,
          support_unread_estimate: (jSummary as any).support_unread_estimate ?? 0,
          estafeta_paid_pending_guide: (jSummary as any).estafeta_paid_pending_guide ?? 0,
          estafeta_paid_today: (jSummary as any).estafeta_paid_today ?? 0,
        });
      } else {
        setSummary(null);
      }
    } catch (e: unknown) {
      setOps([]);
      setEstafeta(null);
      setSummary(null);
      setError(e instanceof Error ? e.message : 'Error al cargar.');
    } finally {
      setIsLoading(false);
    }
  }, [status, hasDispute, appliedSearch, buyerIdParam, sellerIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRepairReleases = useCallback(async () => {
    setRepairMsg(null);
    setRepairing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        setRepairMsg('Sesión expirada.');
        return;
      }
      const res = await fetch('/api/admin/payouts/repair-releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRepairMsg((json as any)?.error ?? 'Error al reparar.');
        return;
      }
      setRepairMsg((json as any)?.message ?? 'Listo.');
      void load();
    } catch (e) {
      setRepairMsg(e instanceof Error ? e.message : 'Error.');
    } finally {
      setRepairing(false);
    }
  }, [load]);

  const handleAccredit = async (checkoutId: string) => {
    if (!confirm('¿Estás seguro de acreditar este pago manualmente? Esto marcará las órdenes como PAGADAS y enviará notificaciones.')) {
      return;
    }

    setProcessingIds(prev => new Set(prev).add(checkoutId));

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const { data: { user } } = await supabase.auth.getUser();
      const adminName = user?.user_metadata?.full_name || user?.email || 'Admin';

      const res = await fetch('/api/admin/payments/offline/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          checkoutId,
          action: 'mark_paid',
          adminName
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al acreditar el pago');

      alert('Pago acreditado correctamente. Las órdenes han sido actualizadas.');
      void load();
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(checkoutId);
        return next;
      });
    }
  };

  const handleReject = async (checkoutId: string) => {
    if (!confirm('¿Estás seguro de RECHAZAR este pago? Esto cancelará la orden y notificará al usuario.')) {
      return;
    }

    setProcessingIds(prev => new Set(prev).add(checkoutId));

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/admin/payments/offline/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          checkoutId,
          action: 'cancel'
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al rechazar el pago');

      alert('Pago rechazado correctamente.');
      void load();
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(checkoutId);
        return next;
      });
    }
  };

  const handleSync = async (checkoutId: string) => {
    if (!confirm('¿Forzar sincronización de órdenes para este pago? Esto asegurará que todas las órdenes asociadas estén marcadas como PAGADAS.')) {
      return;
    }

    setProcessingIds(prev => new Set(prev).add(checkoutId));

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/admin/payments/offline/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          checkoutId,
          action: 'sync_orders'
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al sincronizar');

      alert(json.message || 'Sincronización completada.');
      void load();
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(checkoutId);
        return next;
      });
    }
  };

  const stats = useMemo(() => {
    const total = ops.length;
    const withDispute = ops.filter((o) => o.has_dispute).length;
    const paid = ops.filter((o) => /^(paid|shipped|delivered)$/i.test(String(o?.status || ''))).length;
    const shipped = ops.filter((o) => /^(shipped|delivered)$/i.test(String(o?.status || ''))).length;
    const released = ops.filter((o) => o?.paid_to_seller_at).length;
    const withdrawn = ops.filter((o) => o?.withdrawn).length;
    return { total, withDispute, paid, shipped, released, withdrawn };
  }, [ops]);

  const atencion = useMemo(() => {
    const s = summary;
    const items: { id: string; count: number; msg: string; href: string }[] = [];
    const n = (v: number | undefined) => Math.max(0, Number(v) || 0);
    if (n(s?.disputes_open) > 0) {
      items.push({
        id: 'disputes_open',
        count: n(s?.disputes_open),
        msg: `Tienes ${n(s?.disputes_open)} disputa(s) abierta(s) que debes resolver.`,
        href: '/admin/disputas?status=open',
      });
    }
    if (n(s?.orders_paid_pending_ship) > 0) {
      items.push({
        id: 'orders_paid_pending_ship',
        count: n(s?.orders_paid_pending_ship),
        msg: `${n(s?.orders_paid_pending_ship)} orden(es) pagada(s) por enviar. Revisa que los vendedores suban guía o marquen envío.`,
        href: '/admin/logistica?status=paid',
      });
    }
    if (n(s?.payouts_sellers_to_release) > 0) {
      items.push({
        id: 'payouts_sellers_to_release',
        count: n(s?.payouts_sellers_to_release),
        msg: `${n(s?.payouts_sellers_to_release)} vendedor(es) con pago por liberar. Revisa liberaciones en Métricas.`,
        href: '/admin/metricas',
      });
    }
    if (n(s?.payments_offline_pending) > 0) {
      items.push({
        id: 'payments_offline_pending',
        count: n(s?.payments_offline_pending),
        msg: `${n(s?.payments_offline_pending)} pago(s) offline pendientes de acreditar (transferencia, OXXO, etc.).`,
        href: '/admin/pagos?status=pending',
      });
    }
    const estGuide = n(s?.estafeta_paid_pending_guide) || n(estafeta?.estafeta_paid_pending_guide);
    if (estGuide > 0) {
      items.push({
        id: 'estafeta_paid_pending_guide',
        count: estGuide,
        msg: `${estGuide} cotización(es) Estafeta pagadas sin guía. Sube las guías en Tienda Estafeta.`,
        href: '/admin/estafeta?status=paid',
      });
    }
    if (n(s?.support_unread_estimate) > 0) {
      items.push({
        id: 'support_unread_estimate',
        count: n(s?.support_unread_estimate),
        msg: `${n(s?.support_unread_estimate)} conversación(es) de soporte abiertas.`,
        href: '/admin/soporte?status=open',
      });
    }
    return items;
  }, [summary, estafeta?.estafeta_paid_pending_guide]);

  const visibleAtencion = useMemo(() => atencion.filter(a => !dismissedAlerts.includes(a.id)), [atencion, dismissedAlerts]);

  const { paginatedItems: paginatedOps, paginationProps: opsPaginationProps, setCurrentPage: setOpsPage } = usePagination(ops, 50);
  useEffect(() => { setOpsPage(1); }, [status, hasDispute, appliedSearch, setOpsPage]);

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Supervisión de operaciones</h1>
          <p className="mt-1 text-sm text-gray-600">
            Pagos acreditados, compras, ventas, disputas, envíos y cobros en un solo lugar. Control total del proceso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-60"
          >
            {isLoading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button
            type="button"
            onClick={() => void handleRepairReleases()}
            disabled={repairing || isLoading}
            title="Asigna paid_to_seller_at a órdenes delivered que no lo tienen. Solo donde aún es null."
            className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-200 disabled:opacity-60"
          >
            {repairing ? 'Reparando…' : 'Reparar liberaciones'}
          </button>
          {repairMsg ? (
            <span className="text-sm text-gray-600">{repairMsg}</span>
          ) : null}
          <Link
            href="/admin"
            className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Ir al panel
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="mt-6">
        <UnifiedDashboardWidget />
      </div>

      {/* Atención requerida: qué debes resolver y enlaces directos */}
      <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 ring-2 ring-amber-200/60">
        <h2 className="flex items-center gap-2 text-base font-bold text-amber-900">
          <span aria-hidden>⚠️</span>
          {visibleAtencion.length > 0 ? 'Atención requerida — Qué debes revisar o resolver' : 'Estado de la plataforma'}
        </h2>
        {visibleAtencion.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {visibleAtencion.map((a) => (
              <li key={a.id} className="relative group">
                <Link
                  href={a.href}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-100/80 pr-12"
                >
                  <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-amber-200 px-2 font-extrabold text-amber-900">
                    {a.count}
                  </span>
                  <span className="flex-1">{a.msg}</span>
                  <span className="shrink-0 font-semibold text-amber-700">Ir a revisar →</span>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDismiss(a.id);
                  }}
                  className="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-amber-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Descartar notificación"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-amber-900/90">
            Nada pendiente de atención urgente. Si quieres revisar algo igualmente:
          </p>
        )}
        {visibleAtencion.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/disputas?status=open" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              Disputas
            </Link>
            <Link href="/admin/logistica?status=paid" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              Logística
            </Link>
            <Link href="/admin/metricas" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              Métricas y payouts
            </Link>
            <Link href="/admin/pagos?status=pending" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              Pagos offline
            </Link>
            <Link href="/admin/estafeta?status=paid" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              Tienda Estafeta
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
          <div className="text-[11px] font-semibold text-gray-500">Operaciones</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{stats.total}</div>
        </div>
        <Link
          href="/admin/logistica?status=paid"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:border-amber-400 hover:bg-amber-100/80"
        >
          <div className="text-[11px] font-semibold text-amber-900">Pagadas / En tránsito</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-900">{stats.paid}</div>
          <div className="mt-0.5 text-[10px] text-amber-700">Revisar en Logística →</div>
        </Link>
        <Link
          href="/admin/logistica"
          className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-100/80"
        >
          <div className="text-[11px] font-semibold text-blue-900">Enviadas</div>
          <div className="mt-1 text-2xl font-extrabold text-blue-900">{stats.shipped}</div>
          <div className="mt-0.5 text-[10px] text-blue-700">Ver Logística →</div>
        </Link>
        <Link
          href="/admin/disputas?status=open"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 transition hover:border-red-400 hover:bg-red-100/80"
        >
          <div className="text-[11px] font-semibold text-red-900">Con disputa</div>
          <div className="mt-1 text-2xl font-extrabold text-red-900">{stats.withDispute}</div>
          <div className="mt-0.5 text-[10px] text-red-700">Resolver en Disputas →</div>
        </Link>
        <Link
          href="/admin/metricas"
          className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 transition hover:border-green-400 hover:bg-green-100/80"
        >
          <div className="text-[11px] font-semibold text-green-900">Liberadas (pago al vendedor)</div>
          <div className="mt-1 text-2xl font-extrabold text-green-900">{stats.released}</div>
          <div className="mt-0.5 text-[10px] text-green-700">Métricas y payouts →</div>
        </Link>
        <div className="rounded-2xl border border-brand-orange/20 bg-pink-50 px-4 py-3">
          <div className="text-[11px] font-semibold text-brand-orange">Cobradas (retiradas)</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-orange">{stats.withdrawn}</div>
        </div>
        <Link
          href="/admin/estafeta?status=paid"
          className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 transition hover:border-indigo-400 hover:bg-indigo-100/80"
        >
          <div className="text-[11px] font-semibold text-indigo-900">Estafeta: pagadas sin guía</div>
          <div className="mt-1 text-2xl font-extrabold text-indigo-900">{estafeta?.estafeta_paid_pending_guide ?? '—'}</div>
          <div className="mt-0.5 text-[10px] text-indigo-700">Subir guías en Tienda Estafeta →</div>
        </Link>
        <Link
          href="/admin/estafeta"
          className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 transition hover:border-violet-400 hover:bg-violet-100/80"
        >
          <div className="text-[11px] font-semibold text-violet-900">Estafeta: acreditaciones hoy</div>
          <div className="mt-1 text-2xl font-extrabold text-violet-900">{estafeta?.estafeta_paid_today ?? '—'}</div>
          <div className="mt-0.5 text-[10px] text-violet-700">Ver Tienda Estafeta →</div>
        </Link>
      </div>

      {/* Tienda Estafeta: resumen y recientes */}
      <div className="mt-6 rounded-2xl border border-indigo-200 bg-white p-4 ring-1 ring-indigo-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Tienda Estafeta</h2>
            <p className="mt-0.5 text-xs text-gray-600">
              Cotizaciones, guías y acreditaciones de pago. Pagos por Mercado Pago se reflejan aquí al acreditarse.
            </p>
          </div>
          <Link
            href="/admin/estafeta"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Ver Tienda Estafeta →
          </Link>
        </div>
        {estafeta && (estafeta.estafeta_paid_pending_guide > 0 || estafeta.recent.length > 0) ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-indigo-100">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-indigo-100 bg-indigo-50/50">
                  <th className="px-3 py-2 font-semibold text-indigo-900">Cotización</th>
                  <th className="px-3 py-2 font-semibold text-indigo-900">Remitente → Destino</th>
                  <th className="px-3 py-2 font-semibold text-indigo-900">Costo</th>
                  <th className="px-3 py-2 font-semibold text-indigo-900">Estado</th>
                  <th className="px-3 py-2 font-semibold text-indigo-900">Pagado</th>
                  <th className="px-3 py-2 font-semibold text-indigo-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {estafeta.recent.slice(0, 10).map((q: any) => (
                  <tr key={q?.id || ''} className="border-b border-indigo-50 hover:bg-indigo-50/30">
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{q?.id ? `${String(q.id).slice(0, 8)}…` : '—'}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {[q?.sender_city, q?.sender_state].filter(Boolean).join(', ') || '—'} → {[q?.recipient_city, q?.recipient_state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{fmtMoney(q?.calculated_cost)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${q?.status === 'paid' ? 'bg-amber-100 text-amber-800' : q?.status === 'processing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        {q?.status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{fmtDate(q?.paid_at)}</td>
                    <td className="px-3 py-2">
                      <Link href="/admin/estafeta" className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-200">
                        Ir a Estafeta
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No hay cotizaciones recientes (pagadas o en proceso).</p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar ID, guía, nombre..."
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 pl-10 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-brand-orange w-64 shadow-sm"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-brand-orange"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={hasDispute}
            onChange={(e) => setHasDispute(e.target.checked)}
            className="rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
          />
          <span className="text-sm font-medium text-gray-700">Solo con disputa</span>
        </label>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-black/5 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
          </div>
        ) : ops.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No hay operaciones con los filtros actuales.</div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-gray-50">
                <th className="px-4 py-3 font-semibold text-gray-900">Orden</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Fecha</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Comprador</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Vendedor</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Estado</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Pago / Envío</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Disputa</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Liberado / Cobrado</th>
                <th className="px-4 py-3 font-semibold text-gray-900">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOps.map((o) => {
                const oid = String(o?.id || '').trim();
                const st = String(o?.status || '').trim().toLowerCase();
                const d = o?.dispute;
                return (
                  <tr key={oid || Math.random()} className="border-b border-black/5 hover:bg-pink-50/30">
                    <td className="px-4 py-2 font-mono text-xs text-gray-600" title={oid}>
                      {oid ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(oid);
                            // Feedback visual simple
                            const el = document.getElementById(`id-${oid}`);
                            if (el) {
                              const original = el.innerText;
                              el.innerText = 'Copiado!';
                              setTimeout(() => {
                                el.innerText = original;
                              }, 1000);
                            }
                          }}
                          className="hover:text-brand-orange hover:underline focus:outline-none text-left"
                        >
                          <span id={`id-${oid}`}>{oid.slice(0, 8)}…</span>
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{fmtDate(o?.created_at)}</td>
                    <td className="px-4 py-2">
                      {o?.buyer_id ? (
                        <Link href={`/perfil/${o.buyer_id}`} className="font-medium text-brand-orange hover:underline">
                          {o?.buyer_name || `${String(o.buyer_id).slice(0, 8)}…`}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {o?.seller_id ? (
                        <Link href={`/perfil/${o.seller_id}`} className="font-medium text-brand-orange hover:underline">
                          {o?.seller_name || `${String(o.seller_id).slice(0, 8)}…`}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{fmtMoney(o?.total)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${st === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : st === 'shipped' || st === 'paid'
                              ? 'bg-amber-100 text-amber-800'
                              : st === 'refunded' || st === 'cancelled'
                                ? 'bg-gray-200 text-gray-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        {st || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      <div className="text-xs">
                        {o?.payment_method ? <span>{o.payment_method}</span> : null}
                        {o?.tracking_number ? (
                          <div className="mt-0.5 font-mono text-gray-600">{o.tracking_number}</div>
                        ) : null}
                        {o?.shipped_at ? <div className="mt-0.5 text-gray-500">Enviado: {fmtDate(o.shipped_at)}</div> : null}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {d ? (
                        <Link
                          href={`/admin/disputas/${d.id}`}
                          className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-200"
                        >
                          {d.status} {d.admin_decision ? `· ${d.admin_decision}` : ''}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {o?.paid_to_seller_at ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 font-semibold text-green-800">
                          ✓ Liberado {fmtDate(o.paid_to_seller_at)}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                      {o?.withdrawn ? (
                        <div className="mt-1 rounded bg-pink-100 px-2 py-0.5 font-semibold text-brand-orange">Cobrado</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {/* Botones de autorización de pagos (Acreditar / Rechazar / Sincronizar) */}
                        {(() => {
                          const cs = o.checkout_session;
                          if (!cs) return null;

                          const pm = String(cs.payment_method || '').toLowerCase();
                          const st = String(cs.status || '').toLowerCase();
                          const cid = cs.id;

                          // Permitir acciones en métodos offline o mercadopago
                          const isOffline = ['mercadopago', 'bank_transfer', 'bank_deposit', 'oxxo'].includes(pm);
                          // Permitir "Acreditar" si está pendiente o fallido
                          const isPending = ['pending', 'in_process', 'validation_failed', 'rejected'].includes(st);
                          // Permitir "Sincronizar" si ya está pagado (para forzar correcciones)
                          const canSync = st === 'paid' || st === 'approved';

                          if (!isOffline) return null;

                          return (
                            <>
                              {(isPending || canSync) && (
                                <button
                                  type="button"
                                  onClick={() => (canSync ? handleSync(cid) : handleAccredit(cid))}
                                  disabled={processingIds.has(cid)}
                                  className={`rounded-lg px-2 py-1 text-xs font-bold text-white shadow-sm transition-all ${processingIds.has(cid)
                                      ? 'bg-gray-400 cursor-not-allowed opacity-75'
                                      : canSync
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                                    }`}
                                  title={canSync ? 'Forzar sincronización de órdenes' : 'Aprobar pago manualmente'}
                                >
                                  {processingIds.has(cid) ? '...' : canSync ? 'Sincronizar' : 'Acreditar'}
                                </button>
                              )}

                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleReject(cid)}
                                  disabled={processingIds.has(cid)}
                                  className="rounded-lg bg-gradient-to-r from-red-500 to-rose-600 px-2 py-1 text-xs font-bold text-white shadow-sm hover:from-red-600 hover:to-rose-700 disabled:opacity-60"
                                  title="Rechazar pago y cancelar orden"
                                >
                                  Rechazar
                                </button>
                              )}
                            </>
                          );
                        })()}

                        <Link
                          href={`/admin/logistica`}
                          className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          Logística
                        </Link>
                        {oid ? (
                          <Link
                            href={`/admin/chat/${oid}`}
                            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                          >
                            Chat
                          </Link>
                        ) : null}
                        {d ? (
                          <Link
                            href={`/admin/disputas/${d.id}`}
                            className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                          >
                            Disputa
                          </Link>
                        ) : null}
                        <Link
                          href={`/admin/metricas`}
                          className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200"
                        >
                          Métricas
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination {...opsPaginationProps} />
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Resoluciones de disputas → saldo:</strong> Al resolver una disputa a favor del vendedor (liberar pago, mantener dinero, etc.),
        el saldo se actualiza automáticamente. Los cobros por guía al vendedor se descuentan del disponible. Revisa{' '}
        <Link href="/admin/disputas" className="font-semibold text-amber-800 underline hover:no-underline">
          Disputas
        </Link>
        ,{' '}
        <Link href="/admin/logistica" className="font-semibold text-amber-800 underline hover:no-underline">
          Logística
        </Link>
        ,{' '}
        <Link href="/admin/metricas" className="font-semibold text-amber-800 underline hover:no-underline">
          Métricas
        </Link>
        ,{' '}
        <Link href="/admin/estafeta" className="font-semibold text-amber-800 underline hover:no-underline">
          Tienda Estafeta
        </Link>
        {' '}y{' '}
        <Link href="/admin/pagos" className="font-semibold text-amber-800 underline hover:no-underline">
          Pagos offline
        </Link>
        .
      </div>
    </div>
  );
}

export default function AdminSupervisionPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[200px] items-center justify-center rounded-2xl bg-white/80 p-8 text-gray-500">Cargando…</div>}>
      <SupervisionContent />
    </Suspense>
  );
}
