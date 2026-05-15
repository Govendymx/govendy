'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CopyButton } from '@/components/ui/CopyButton';
import { AdvancedMetrics } from './components/AdvancedMetrics';

function formatMoney(v: number) {
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function fmtDate(input: any) {
  if (!input) return '—';
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminMetricasPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutData, setPayoutData] = useState<any>(null);
  const [payoutView, setPayoutView] = useState<'released' | 'to_release' | 'all'>('released');
  const [payoutQ, setPayoutQ] = useState('');
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState<Set<string>>(new Set()); // Estado específico por sellerId
  const [processingLock, setProcessingLock] = useState(false); // Lock global para prevenir procesamiento simultáneo
  const [hidePaid, setHidePaid] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSellerId, setPendingSellerId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('');

  const [activeUsers, setActiveUsers] = useState<{ 
    count: number; 
    total: number; 
    timestamp: string;
    users?: Array<{
      id: string;
      nickname?: string | null;
      full_name?: string | null;
      username?: string | null;
      email?: string | null;
      is_verified?: boolean;
      last_activity?: string;
    }>;
  } | null>(null);
  const [showActiveUsersModal, setShowActiveUsersModal] = useState(false);
  const [activeUsersSearch, setActiveUsersSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const totals = data?.totals ?? null;
  const settings = data?.settings ?? null;

  const cards = useMemo(() => {
    const t = totals ?? {};
    // Ganancia = Comisión + Promos (el envío subsidiado lo paga el vendedor, no la plataforma)
    const profit = Number((t as any).comision_mes ?? 0) + Number((t as any).promos_destacados_mes_est ?? 0);

    return [
      { label: 'Usuarios conectados (tiempo real)', value: activeUsers ? String(activeUsers.count) : '—', highlight: true, isLiveUsers: true },
      { label: 'Ganancias disponibles (mes)', value: formatMoney(profit), highlight: true },
      { label: 'Ventas brutas (mes)', value: formatMoney(Number((t as any).ventas_brutas_mes ?? 0)) },
      { label: 'Comisión (mes)', value: formatMoney(Number((t as any).comision_mes ?? 0)) },
      { label: 'Envío cobrado (mes)', value: formatMoney(Number((t as any).envio_cobrado_mes ?? 0)) },
      { label: 'Envío subsidiado (mes)', value: formatMoney(Number((t as any).envio_subsidiado_mes ?? 0)) },
      { label: 'Envío neto (mes)', value: formatMoney(Number((t as any).envio_neto_mes ?? 0)) },
      { label: 'Promos destacados (est. mes)', value: formatMoney(Number((t as any).promos_destacados_mes_est ?? 0)) },
      { label: 'Usuarias activas (est. mes)', value: String((t as any).usuarias_activas_mes_est ?? 0) },
      { label: 'Operaciones (mes)', value: String((t as any).operaciones_mes ?? 0) },
    ];
  }, [totals, activeUsers]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          window.location.href = '/login?returnTo=/admin/metricas';
          return;
        }
        const [res, pres] = await Promise.all([
          fetch(`/api/admin/metrics?year=${selectedYear}&month=${selectedMonth}&t=${Date.now()}`, {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
          fetch(`/api/admin/payouts/report?view=${encodeURIComponent(payoutView)}&includeEmail=1&limit=5000&t=${Date.now()}`, {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
        ]);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar métricas.');
        const pjson = await pres.json().catch(() => ({}));
        if (!pres.ok) throw new Error(pjson?.error || 'No se pudieron cargar pagos a vendedores.');
        if (!cancelled) {
          setData(json);
          setPayoutData(pjson);
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar métricas.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, payoutView]);

  useEffect(() => {
    let cancelled = false;
    const loadPayouts = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/admin/payouts/report?view=${encodeURIComponent(payoutView)}&includeEmail=1&limit=5000&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar pagos a vendedores.');
        if (!cancelled) setPayoutData(json);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setPayoutError(e instanceof Error ? e.message : 'No se pudieron cargar pagos a vendedores.');
      }
    };
    void loadPayouts();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutView]);

  // Cargar usuarios conectados en tiempo real
  useEffect(() => {
    let cancelled = false;
    const loadActiveUsers = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/admin/metrics/active-users', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json.ok) {
          console.log('[ACTIVE USERS FRONTEND] Datos recibidos:', {
            count: json.activeUsers,
            total: json.totalUsers,
            timestamp: json.timestamp,
            users: json.users?.length || 0,
          });
          setActiveUsers({
            count: Number(json.activeUsers ?? 0) || 0,
            total: Number(json.totalUsers ?? 0) || 0,
            timestamp: String(json.timestamp || new Date().toISOString()),
            users: Array.isArray(json.users) ? json.users : undefined,
          });
        } else {
          console.warn('[ACTIVE USERS FRONTEND] Error en respuesta:', { resOk: res.ok, json });
        }
      } catch (e: unknown) {
        console.error('[ACTIVE USERS] Error:', e);
      }
    };
    void loadActiveUsers();
    const interval = setInterval(() => {
      if (!cancelled) void loadActiveUsers();
    }, 30000); // Actualizar cada 30 segundos
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const paidCountBySeller = useMemo(() => {
    const rows = ((payoutData as any)?.rows ?? []) as any[];
    const result: Record<string, number> = {};
    for (const r of rows) {
      const sid = String(r?.seller_id || '').trim();
      if (!sid) continue;
      if (!result[sid]) result[sid] = 0;
      if (r?.paid_to_seller_at) result[sid] += 1;
    }
    return result;
  }, [payoutData]);

  const lastPaidDateBySeller = useMemo(() => {
    const rows = ((payoutData as any)?.rows ?? []) as any[];
    const result: Record<string, string | null> = {};
    for (const r of rows) {
      const sid = String(r?.seller_id || '').trim();
      if (!sid) continue;
      if (r?.paid_to_seller_at) {
        const paidAt = String(r?.paid_to_seller_at || '');
        if (paidAt) {
          if (!result[sid] || paidAt > result[sid]!) {
            result[sid] = paidAt;
          }
        }
      }
    }
    return result;
  }, [payoutData]);

  const payoutSellers = useMemo(() => {
    const rows = ((payoutData as any)?.sellers ?? []) as any[];
    if (!rows.length) return [];

    let filtered = rows;
    const qq = String(payoutQ || '').trim().toLowerCase();
    if (qq) {
      filtered = filtered.filter((s) => {
        const name = String(s?.seller_name || '').toLowerCase();
        const id = String(s?.seller_id || '').toLowerCase();
        const email = String(s?.seller_email || '').toLowerCase();
        const phone = String(s?.seller_phone || '').toLowerCase();
        return name.includes(qq) || id.includes(qq) || email.includes(qq) || phone.includes(qq);
      });
    }

    if (hidePaid) {
      filtered = filtered.filter((s) => {
        const sid = String(s?.seller_id || '');
        const paidCount = paidCountBySeller[sid] || 0;
        const totalOrders = Number(s?.orders_count ?? 0) || 0;
        return paidCount < totalOrders;
      });
    }

    return filtered;
  }, [payoutData, payoutQ, hidePaid, paidCountBySeller]);

  const markPaid = async (sellerId: string, adminNameParam?: string) => {
    if (processingLock) {
      setPayoutError('Ya hay un pago en proceso. Por favor espera a que termine.');
      return;
    }
    if (!sellerId || typeof sellerId !== 'string' || sellerId.trim() === '') {
      setPayoutError('ID de vendedor inválido.');
      return;
    }
    const sellerIdTrimmed = sellerId.trim();
    if (isMarkingPaid.has(sellerIdTrimmed)) {
      setPayoutError('Este pago ya está siendo procesado. Por favor espera.');
      return;
    }
    setProcessingLock(true);
    setIsMarkingPaid((prev) => new Set(prev).add(sellerIdTrimmed));
    setPayoutError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Sesión no válida.');
      const res = await fetch('/api/admin/payouts/mark-paid', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ sellerId: sellerIdTrimmed, action: 'mark_paid', adminName: adminNameParam || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'No se pudo marcar como pagado.');
      }
      if (!json.ok) {
        throw new Error(json?.error || 'El servidor no confirmó la operación.');
      }
      const { data: sess2 } = await supabase.auth.getSession();
      const token2 = sess2.session?.access_token;
      if (token2) {
        const pres = await fetch(`/api/admin/payouts/report?view=${encodeURIComponent(payoutView)}&includeEmail=1&limit=5000&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token2}` },
          cache: 'no-store',
        });
        const pjson = await pres.json().catch(() => ({}));
        if (pres.ok) setPayoutData(pjson);
      }
    } catch (e: unknown) {
      console.error('[MARK PAID] Error:', e);
      setPayoutError(e instanceof Error ? e.message : 'No se pudo marcar como pagado.');
    } finally {
      setProcessingLock(false);
      setIsMarkingPaid((prev) => {
        const next = new Set(prev);
        next.delete(sellerIdTrimmed);
        return next;
      });
    }
  };

  const handleDownloadSatReport = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        alert('No hay sesión');
        return;
      }
      
      const year = selectedYear;
      const month = selectedMonth;
      
      const url = `/api/admin/reports/sat?year=${year}&month=${month}`;
      
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Error descargando reporte');
      }
      
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `reporte_sat_${year}_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div>
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-gray-900">Admin · Métricas</div>
            <div className="mt-1 text-sm text-gray-600">Resumen del mes (ventas, comisión, envíos, promos).</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Botón Reporte SAT */}
            <button
              onClick={handleDownloadSatReport}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Reporte SAT (Excel)
            </button>

            {/* Selector de mes y año */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <label htmlFor="select-month" className="text-xs font-semibold text-gray-700">
                Mes:
              </label>
              <select
                id="select-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="rounded-lg border-0 bg-transparent text-sm font-semibold text-gray-900 outline-none focus:ring-0"
              >
                <option value={1}>Enero</option>
                <option value={2}>Febrero</option>
                <option value={3}>Marzo</option>
                <option value={4}>Abril</option>
                <option value={5}>Mayo</option>
                <option value={6}>Junio</option>
                <option value={7}>Julio</option>
                <option value={8}>Agosto</option>
                <option value={9}>Septiembre</option>
                <option value={10}>Octubre</option>
                <option value={11}>Noviembre</option>
                <option value={12}>Diciembre</option>
              </select>
              <label htmlFor="select-year" className="ml-2 text-xs font-semibold text-gray-700">
                Año:
              </label>
              <select
                id="select-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="rounded-lg border-0 bg-transparent text-sm font-semibold text-gray-900 outline-none focus:ring-0"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/negocio" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
                Negocio
              </Link>
            <Link href="/admin/estafeta" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Guías Estafeta
            </Link>
              <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
                Configuración
              </Link>
            </div>
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {isBooting ? <div className="mt-5 text-sm text-gray-600">Cargando…</div> : null}

        {!isBooting && !error ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <div
                  key={c.label}
                  className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ${
                    (c as any).highlight
                      ? 'border-2 border-green-500 bg-green-50/30 ring-green-200 cursor-pointer hover:bg-green-50/50 transition-colors'
                      : 'ring-black/5'
                  }`}
                  onClick={(c as any).isLiveUsers ? () => setShowActiveUsersModal(true) : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-600">{c.label}</div>
                    {(c as any).highlight && activeUsers && (
                      <div className="flex h-2 w-2 items-center justify-center">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                      </div>
                    )}
                  </div>
                  <div
                    className={`mt-2 text-2xl font-extrabold ${
                      (c as any).highlight ? 'text-green-700' : 'text-gray-900'
                    }`}
                  >
                    {c.value}
                  </div>
                  {(c as any).isLiveUsers && activeUsers && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-500">
                        de {activeUsers.total} usuarios totales · Actualizado hace{' '}
                        {Math.round((new Date().getTime() - new Date(activeUsers.timestamp).getTime()) / 1000)}s
                      </div>
                      {activeUsers.users && activeUsers.users.length > 0 && (
                        <div className="mt-2 max-h-20 overflow-y-auto space-y-1">
                          {activeUsers.users.slice(0, 3).map((user) => (
                            <div key={user.id} className="flex items-center gap-2 text-xs">
                              <div className="h-2 w-2 rounded-full bg-green-500"></div>
                              <span className="font-medium text-gray-700 truncate">
                                {user.nickname || user.username || user.full_name || user.email?.split('@')[0] || 'Usuario'}
                              </span>
                            </div>
                          ))}
                          {activeUsers.users.length > 3 && (
                            <div className="text-xs text-gray-500 italic">
                              +{activeUsers.users.length - 3} más...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="text-sm font-bold text-gray-900">Configuración relevante</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Comisiones (por plan)</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">18% - 23%</div>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Precio destacado</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{formatMoney(Number(settings.featured_price ?? 25))}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Envío base (Estafeta 5kg)</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{formatMoney(Number(settings.shipping_base ?? 180))}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                  <div className="text-xs font-semibold text-gray-600">Zona extendida (extra)</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">{formatMoney(Number(settings.shipping_extended ?? 200))}</div>
                </div>
              </div>
              {Array.isArray(data?.notes) ? (
                <div className="mt-4 text-xs text-gray-600">
                  {data.notes.map((n: string, idx: number) => (
                    <div key={idx}>- {n}</div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Panel tipo Excel: Pagos a vendedores */}
            <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">Pagos a vendedores (control tipo Excel)</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {payoutView === 'released'
                      ? 'Liberado = entregado/completado (listo para pagar al vendedor).'
                      : 'Por liberar = pendiente de entrega/completar (aún no se debe pagar).'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-2xl bg-gray-50 p-1 ring-1 ring-black/5">
                    <button
                      type="button"
                      onClick={() => setPayoutView('released')}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${payoutView === 'released' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Liberado
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoutView('to_release')}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${payoutView === 'to_release' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Por liberar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayoutView('all')}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold ${payoutView === 'all' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Todos
                    </button>
                  </div>
                  <input
                    type="text"
                    value={payoutQ}
                    onChange={(e) => setPayoutQ(e.target.value)}
                    placeholder="Buscar vendedor (nombre, email, teléfono, id)…"
                    className="w-[min(320px,80vw)] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hidePaid}
                      onChange={(e) => setHidePaid(e.target.checked)}
                      className="rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                    />
                    Ocultar ya pagados
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rows = payoutData?.sellers ?? [];
                      if (!rows.length) {
                        alert('No hay datos para exportar.');
                        return;
                      }
                      const headers = [
                        'Vendedor',
                        'Email',
                        'Teléfono',
                        'Banco',
                        'Titular',
                        'CLABE',
                        'Pagaron',
                        'Envío cobrado',
                        'Órdenes',
                        'Neto a pagar',
                        'Comisión',
                        'Envío gratis',
                        'Estado pago',
                      ];
                      const lines: string[] = [headers.join(',')];
                      const esc = (v: any) => {
                        const s = String(v ?? '');
                        const quoteChar = String.fromCharCode(34); // "
                        if (s.includes(quoteChar) || s.includes(',') || s.includes('\n')) {
                          const escaped = s.replaceAll(quoteChar, quoteChar + quoteChar);
                          return quoteChar + escaped + quoteChar;
                        }
                        return s;
                      };
                      for (const r of rows) {
                        const s = r;
                        const sid = String(s?.seller_id || '').trim();
                        const paidCount = paidCountBySeller[sid] || 0;
                        const totalOrders = Number(s?.orders_count ?? 0) || 0;
                        const allPaid = paidCount >= totalOrders;
                        const somePaid = paidCount > 0 && paidCount < totalOrders;
                        const status = allPaid ? 'Pagado' : somePaid ? 'Parcial' : 'Pendiente';
                        lines.push(
                          [
                            esc(s?.seller_name || s?.seller_id || ''),
                            esc(s?.seller_email || ''),
                            esc(s?.seller_phone || ''),
                            esc(s?.payout_bank_name || ''),
                            esc(s?.payout_account_holder || ''),
                            esc(s?.payout_clabe || ''),
                            esc(Number(s?.total_paid_total ?? 0) || 0),
                            esc(Number(s?.shipping_fee_total ?? 0) || 0),
                            esc(totalOrders),
                            esc(Number(s?.payout_total ?? 0) || 0),
                            esc(Number(s?.commission_total ?? 0) || 0),
                            esc(Number(s?.shipping_subsidy_total ?? 0) || 0),
                            esc(status),
                          ].join(','),
                        );
                      }
                      const filename = `pagos-vendedores-${payoutView}-${new Date().toISOString().split('T')[0]}.csv`;
                      downloadCsv(filename, lines.join('\n'));
                    }}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black"
                    title="Descarga CSV para Excel"
                  >
                    Exportar CSV
                  </button>
                </div>
              </div>

              {payoutError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{payoutError}</div> : null}

              <div className="mt-4 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-xs text-gray-700">
                <span className="font-bold">Total a pagar (según filtro):</span>{' '}
                {formatMoney(Number(payoutSellers.reduce((s: number, r: any) => s + Number(r?.payout_total ?? 0), 0)))}
                <span className="mx-2 text-gray-400">|</span>
                <span className="font-bold">Vendedores:</span> {payoutSellers.length}
                <span className="mx-2 text-gray-400">|</span>
                <span className="font-bold">Órdenes:</span> {Number(payoutData?.stats?.orders ?? 0) || 0}
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-black/5">
                <table className="min-w-[1500px] w-full bg-white text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Vendedor</th>
                      <th className="px-4 py-3 text-left font-bold">Email</th>
                      <th className="px-4 py-3 text-left font-bold">Teléfono</th>
                      <th className="px-4 py-3 text-left font-bold">Banco</th>
                      <th className="px-4 py-3 text-left font-bold">Titular</th>
                      <th className="px-4 py-3 text-left font-bold">CLABE</th>
                      <th className="px-4 py-3 text-right font-bold">Pagaron</th>
                      <th className="px-4 py-3 text-right font-bold">Envío cobrado</th>
                      <th className="px-4 py-3 text-right font-bold">Órdenes</th>
                      <th className="px-4 py-3 text-right font-bold">Neto a pagar</th>
                      <th className="px-4 py-3 text-right font-bold">Comisión</th>
                      <th className="px-4 py-3 text-right font-bold">Envío gratis</th>
                      <th className="px-4 py-3 text-left font-bold">Estado pago</th>
                      <th className="px-4 py-3 text-left font-bold">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutSellers.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="px-4 py-6 text-center text-sm text-gray-600">
                          No hay datos para este filtro.
                        </td>
                      </tr>
                    ) : (
                      payoutSellers.map((s: any) => {
                        const sid = String(s?.seller_id || '').trim();
                        if (!sid) return null;
                        const orders = [] as any[];
                        const totalOrders = Number(s?.orders_count ?? 0) || 0;
                        const paidCount = paidCountBySeller[sid] || 0;
                        const allPaid = paidCount >= totalOrders;
                        const somePaid = paidCount > 0 && paidCount < totalOrders;
                        return (
                          <>
                            <tr key={sid} className="border-t border-black/5">
                              <td className="px-4 py-3">
                                <Link href={`/perfil/${encodeURIComponent(sid)}`} className="font-bold text-gray-900 hover:underline">
                                  {String(s?.seller_name || sid)}
                                </Link>
                                <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                  {sid}
                                  <CopyButton text={sid} size="sm" className="text-gray-400 hover:text-brand-emerald" />
                                </div>
                                <div className="mt-1">
                                  <Link href={`/perfil/${encodeURIComponent(sid)}`} className="text-[11px] font-semibold text-brand-emerald hover:opacity-90">
                                    Ver reputación →
                                  </Link>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700">{String(s?.seller_email || '—')}</td>
                              <td className="px-4 py-3 text-xs text-gray-700">{String(s?.seller_phone || '—')}</td>
                              <td className="px-4 py-3 text-xs text-gray-700">{String(s?.payout_bank_name || '—')}</td>
                              <td className="px-4 py-3 text-xs text-gray-700">{String(s?.payout_account_holder || '—')}</td>
                              <td className="px-4 py-3 text-xs text-gray-700">{String(s?.payout_clabe || '—')}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatMoney(Number(s?.total_paid_total ?? 0) || 0)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatMoney(Number(s?.shipping_fee_total ?? 0) || 0)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalOrders}</td>
                              <td className="px-4 py-3 text-right font-extrabold text-brand-emerald">{formatMoney(Number(s?.payout_total ?? 0) || 0)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatMoney(Number(s?.commission_total ?? 0) || 0)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatMoney(Number(s?.shipping_subsidy_total ?? 0) || 0)}</td>
                              <td className="px-4 py-3">
                                {allPaid ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex rounded-full bg-green-50 px-2 py-1 text-[11px] font-extrabold text-green-800 ring-1 ring-green-200">
                                      Pagado
                                    </span>
                                    {lastPaidDateBySeller[sid] ? (
                                      <span className="text-[10px] text-gray-600">
                                        Liberado: {fmtDate(lastPaidDateBySeller[sid])}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : somePaid ? (
                                  <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-900 ring-1 ring-amber-200">
                                    Parcial ({paidCount}/{totalOrders})
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-gray-50 px-2 py-1 text-[11px] font-extrabold text-gray-700 ring-1 ring-black/5">
                                    Pendiente
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (expandedSeller === sid) {
                                      setExpandedSeller(null);
                                    } else {
                                      setExpandedSeller(sid);
                                    }
                                  }}
                                  className="text-xs font-semibold text-brand-emerald hover:underline"
                                >
                                  {expandedSeller === sid ? 'Ocultar' : 'Ver'} órdenes ({totalOrders})
                                </button>
                              </td>
                            </tr>
                            {expandedSeller === sid && orders.length > 0 ? (
                              <tr>
                                <td colSpan={14} className="px-4 py-4 bg-gray-50">
                                  <div className="space-y-2">
                                    <div className="text-xs font-bold text-gray-900">Órdenes:</div>
                                    {orders.map((o: any) => (
                                      <div key={String(o?.id)} className="rounded-lg bg-white p-3 ring-1 ring-black/5">
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <div className="flex items-center gap-1 text-xs font-semibold text-gray-900">
                                              Orden {String(o?.id || '').slice(0, 8)}…
                                              <CopyButton text={String(o?.id || '')} size="sm" className="text-gray-400 hover:text-brand-emerald" />
                                            </div>
                                            <div className="mt-1 text-[11px] text-gray-600">
                                              Total: {formatMoney(Number(o?.total ?? 0) || 0)} · Comisión:{' '}
                                              {formatMoney(Number(o?.commission_fee ?? 0) || 0)} · Envío:{' '}
                                              {formatMoney(Number(o?.shipping_fee ?? 0) || 0)}
                                            </div>
                                            <div className="mt-1 text-[11px] text-gray-500">
                                              Estado: {String(o?.status || '—')} · Creada: {fmtDate(o?.created_at)}
                                            </div>
                                            {o?.paid_to_seller_at ? (
                                              <div className="mt-1 text-[11px] text-green-700 font-semibold">
                                                Pagado: {fmtDate(o?.paid_to_seller_at)}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {payoutSellers.some((s: any) => {
                const sid = String(s?.seller_id || '').trim();
                if (!sid) return false;
                const totalOrders = Number(s?.orders_count ?? 0) || 0;
                const paidCount = paidCountBySeller[sid] || 0;
                return paidCount < totalOrders;
              }) ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <div className="font-semibold">⚠️ Hay vendedores con pagos pendientes.</div>
                  <div className="mt-1 text-xs">
                    Usa el boton Marcar como pagado despues de realizar cada transferencia bancaria.
                  </div>
                </div>
              ) : null}
            </div>

            {/* Módulo de Métricas Avanzadas */}
            <div className="mt-8">
               <AdvancedMetrics />
            </div>
          </>
        ) : null}
      </div>

      {/* Modal de usuarios activos */}
      {showActiveUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowActiveUsersModal(false)}>
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Usuarios conectados en tiempo real</h2>
              <button
                onClick={() => setShowActiveUsersModal(false)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cerrar
              </button>
            </div>

            {!activeUsers ? (
              <div className="text-center py-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No hay usuarios conectados en este momento</p>
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                <p className="mt-1 text-sm text-gray-400">Los usuarios apareceran aqui cuando tengan actividad en los ultimos 5 minutos</p>
              </div>
            ) : activeUsers.users && activeUsers.users.length > 0 ? (
              <div>
                <div className="mb-4 text-sm text-gray-600">
                  <span className="font-semibold">
                    {activeUsers.users.filter((u) => {
                      if (!activeUsersSearch.trim()) return true;
                      const q = activeUsersSearch.toLowerCase();
                      return (
                        (u.nickname || '').toLowerCase().includes(q) ||
                        (u.username || '').toLowerCase().includes(q) ||
                        (u.full_name || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q) ||
                        (u.id || '').toLowerCase().includes(q)
                      );
                    }).length}
                  </span>{' '}
                  de <span className="font-semibold">{activeUsers.total}</span> usuarios totales conectados
                  <span className="ml-2 text-xs text-gray-500">
                    (Actualizado hace {Math.round((new Date().getTime() - new Date(activeUsers.timestamp).getTime()) / 1000)}s)
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {activeUsers.users
                    .filter((u) => {
                      if (!activeUsersSearch.trim()) return true;
                      const q = activeUsersSearch.toLowerCase();
                      return (
                        (u.nickname || '').toLowerCase().includes(q) ||
                        (u.username || '').toLowerCase().includes(q) ||
                        (u.full_name || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q) ||
                        (u.id || '').toLowerCase().includes(q)
                      );
                    })
                    .map((user) => (
                      <div key={user.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 ring-1 ring-black/5">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1 font-semibold text-gray-900">
                          {user.nickname || user.username || user.full_name || user.email?.split('@')[0] || 'Usuario'}
                          <CopyButton text={user.id} size="sm" iconSize={14} className="ml-1" />
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.email && <span>{user.email}</span>}
                          {user.last_activity && (
                            <span className="ml-2">
                              Última actividad: {new Date(user.last_activity).toLocaleString('es-MX')}
                            </span>
                          )}
                        </div>
                      </div>
                      {user.is_verified && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
                          Verificado
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No hay usuarios conectados en este momento</p>
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                <p className="mt-1 text-sm text-gray-400">Los usuarios apareceran aqui cuando tengan actividad en los ultimos 5 minutos</p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-xs text-gray-500">
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                💡 <strong>Nota:</strong> Se consideran conectados los usuarios con actividad en los últimos 5 minutos
              </div>
              <button
                onClick={() => setShowActiveUsersModal(false)}
                className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para marcar como pagado */}
      {showConfirmModal && pendingSellerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowConfirmModal(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Confirmar pago</h3>
            <p className="mt-2 text-sm text-gray-600">
              ¿Está seguro que desea marcar como pagado el pago del vendedor {pendingSellerId.slice(0, 8)}…?
            </p>
            
            <div className="mt-4">
              <label htmlFor="adminName" className="block text-sm font-semibold text-gray-700">
                Nombre del administrador
              </label>
              <input
                id="adminName"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Ingresa tu nombre"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20"
                autoFocus
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingSellerId(null);
                  setAdminName('');
                }}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!adminName.trim()) {
                    setPayoutError('Por favor ingresa tu nombre');
                    return;
                  }
                  if (!pendingSellerId) {
                    setPayoutError('No hay vendedor pendiente');
                    setShowConfirmModal(false);
                    return;
                  }
                  setShowConfirmModal(false);
                  const sellerIdToUse = pendingSellerId;
                  setPendingSellerId(null);
                  const nameToUse = adminName.trim();
                  setAdminName('');
                  setPayoutError(null);
                  try {
                    await markPaid(sellerIdToUse, nameToUse);
                  } catch (e: unknown) {
                    console.error('[ADMIN METRICAS] Error en markPaid:', e);
                    setPayoutError(e instanceof Error ? e.message : 'Error al marcar como pagado');
                  }
                }}
                disabled={isMarkingPaid.has(pendingSellerId || '') || processingLock || !adminName.trim()}
                className="flex-1 rounded-xl bg-brand-emerald px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
