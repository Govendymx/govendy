'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toNumber, payoutNet, isCancelledStatus, isPaidStatus, isReleasedStatus, statusLabel } from '@/lib/payouts/calc';
import { useImpersonation } from '@/components/ImpersonationProvider';

function formatMoney(v: any) {
  return toNumber(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
function formatDate(input: any) {
  const s = String(input || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}
function normStatus(s: any) {
  return String(s || '').trim() || '—';
}

export default function DashboardPagosPage() {
  const { isImpersonating, targetUserId, targetData, queryAsUser } = useImpersonation();

  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, any[]>>({});
  const [disputedOrderIds, setDisputedOrderIds] = useState<string[]>([]);
  const [allDisputedOrderIds, setAllDisputedOrderIds] = useState<string[]>([]);
  const [guideDeductionTotal, setGuideDeductionTotal] = useState<number>(0);
  const [mercadopagoAccount, setMercadopagoAccount] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>('basic');
  const [withdrawing, setWithdrawing] = useState(false);
  const [forcingRecalc, setForcingRecalc] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [tab, setTab] = useState<'resumen' | 'por_liberar' | 'liberados' | 'todo'>('resumen');
  const [q, setQ] = useState('');
  const [pagosPage, setPagosPage] = useState(1);
  const PAGOS_PAGE_SIZE = 10;
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [balance, setBalance] = useState<{
    disponible: number;
    por_liberar: number;
    estimado: number;
    can_withdraw: boolean;
    mercadopago_configured?: boolean;
  } | null>(null);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAccount, setWithdrawAccount] = useState('');

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        // ── IMPERSONATION MODE: use proxy queries with service role ──
        if (isImpersonating && targetUserId) {
          if (!cancelled) setSellerId(targetUserId);

          // Orders via admin proxy
          const ordersResult = await queryAsUser({
            table: 'orders',
            select: '*',
            filters: { userColumn: 'seller_id' },
            order: { column: 'created_at', ascending: false },
            limit: 500,
          });
          const list = (ordersResult.data as any[]) ?? [];
          if (cancelled) return;
          setOrders(list);

          // Disputes via admin proxy
          let openDisputedIds: string[] = [];
          let allDisputedIds: string[] = [];
          try {
            const dispResult = await queryAsUser({
              table: 'disputes',
              select: 'order_id,status',
              filters: { userColumn: 'seller_id' },
            });
            const rows = Array.isArray(dispResult.data) ? dispResult.data : [];
            for (const r of rows) {
              const oid = String(r?.order_id || '').trim();
              if (!oid) continue;
              allDisputedIds.push(oid);
              if (String(r?.status || '').trim() === 'open') openDisputedIds.push(oid);
            }
          } catch { /* ignore */ }
          if (!cancelled) { setDisputedOrderIds(openDisputedIds); setAllDisputedOrderIds(allDisputedIds); }

          // Guide deductions from targetData pre-loaded in provider
          const preDisputes = (targetData?.disputes_seller as any[]) ?? [];
          const deduction = preDisputes
            .filter((d: any) => d.status === 'resolved' && d.admin_decision === 'assign_guide_charged_seller')
            .reduce((acc: number, d: any) => acc + (Number(d.return_guide_cost) || 0), 0);
          if (!cancelled) setGuideDeductionTotal(deduction);

          // Order items via admin proxy
          const orderIds = list.map((o: any) => String(o?.id || '').trim()).filter(Boolean);
          if (orderIds.length > 0) {
            const itemsResult = await queryAsUser({
              table: 'order_items',
              select: 'order_id,title,quantity,line_total',
              filters: { in: { order_id: orderIds } },
            });
            if (Array.isArray(itemsResult.data)) {
              const map: Record<string, any[]> = {};
              for (const it of itemsResult.data) {
                const oid = String(it?.order_id || '').trim();
                if (!oid) continue;
                if (!map[oid]) map[oid] = [];
                map[oid].push(it);
              }
              if (!cancelled) setItemsByOrder(map);
            }
          }

          // Profile from targetData
          const prof: any = targetData?.profile || {};
          if (!cancelled) {
            setMercadopagoAccount(String(prof.mercadopago_account ?? '').trim() || null);
            setPlanType(String(prof.plan_type || 'basic'));
          }

          // Balance from pre-calculated seller_balance in provider
          const sb = targetData?.seller_balance;
          if (sb && !cancelled) {
            setBalance({
              disponible: sb.disponible,
              por_liberar: sb.por_liberar,
              estimado: sb.estimado,
              can_withdraw: false, // Admin cannot withdraw on behalf of user
              mercadopago_configured: false,
            });
          }

          if (!cancelled) setIsBooting(false);
          return;
        }

        // ── NORMAL MODE ──
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          window.location.href = '/login';
          return;
        }
        if (!cancelled) setSellerId(user.id);

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const ordersRes = await supabase
          .from('orders')
          .select('*')
          .eq('seller_id', user.id)
          .gte('created_at', oneYearAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(1000);
        if (ordersRes.error) throw ordersRes.error;
        const list = (ordersRes.data as any[]) ?? [];
        if (cancelled) return;
        setOrders(list);

        let openDisputedIds: string[] = [];
        let allDisputedIds: string[] = [];
        try {
          const disputesRes = await supabase
            .from('disputes')
            .select('order_id,status')
            .eq('seller_id', user.id);
          const rows = Array.isArray(disputesRes?.data) ? disputesRes.data : [];
          for (const r of rows as any[]) {
            const oid = String(r?.order_id || '').trim();
            if (!oid) continue;
            allDisputedIds.push(oid);
            const st = String(r?.status || '').trim();
            if (st === 'open') openDisputedIds.push(oid);
          }
        } catch {
          openDisputedIds = [];
          allDisputedIds = [];
        }
        if (!cancelled) {
          setDisputedOrderIds(openDisputedIds);
          setAllDisputedOrderIds(allDisputedIds);
        }

        let deduction = 0;
        try {
          const guideRes = await supabase
            .from('disputes')
            .select('order_id, return_guide_cost')
            .eq('seller_id', user.id)
            .eq('status', 'resolved')
            .eq('admin_decision', 'assign_guide_charged_seller');
          const rows = Array.isArray(guideRes?.data) ? guideRes.data : [];
          for (const r of rows as any[]) {
            const c = typeof r?.return_guide_cost === 'number' ? r.return_guide_cost : Number(r?.return_guide_cost ?? 0);
            if (Number.isFinite(c) && c > 0) deduction += c;
          }
        } catch {
          deduction = 0;
        }
        if (!cancelled) setGuideDeductionTotal(deduction);

        const orderIds = list.map((o) => String(o?.id || '').trim()).filter(Boolean);
        if (orderIds.length > 0) {
          const itemsRes: any = await supabase.from('order_items').select('order_id,title,quantity,line_total').in('order_id', orderIds);
          if (!itemsRes?.error && Array.isArray(itemsRes.data)) {
            const map: Record<string, any[]> = {};
            for (const it of itemsRes.data as any[]) {
              const oid = String(it?.order_id || '').trim();
              if (!oid) continue;
              if (!map[oid]) map[oid] = [];
              map[oid].push(it);
            }
            if (!cancelled) setItemsByOrder(map);
          }
        }

        let mpAccount: string | null = null;
        let userPlan = 'basic';
        try {
          const { data: prof } = await supabase.from('profiles').select('mercadopago_account, plan_type').eq('id', user.id).maybeSingle();
          const v = String((prof as any)?.mercadopago_account ?? '').trim();
          if (v) mpAccount = v;
          if ((prof as any)?.plan_type) userPlan = (prof as any).plan_type;
        } catch {
          // ignore
        }
        if (!cancelled) {
          setMercadopagoAccount(mpAccount);
          setPlanType(userPlan);
        }

        let bal: {
          disponible: number;
          por_liberar: number;
          estimado: number;
          can_withdraw: boolean;
          mercadopago_configured?: boolean;
        } | null = null;
        try {
          const { data: sess } = await supabase.auth.getSession();
          const t = sess?.session?.access_token;
          if (t) {
            const r = await fetch('/api/payouts/balance', { headers: { authorization: `Bearer ${t}` }, cache: 'no-store' });
            const j = await r.json().catch(() => ({}));
            if (r.ok && (j as any)?.ok) {
              bal = {
                disponible: Number((j as any)?.disponible ?? 0) || 0,
                por_liberar: Number((j as any)?.por_liberar ?? 0) || 0,
                estimado: Number((j as any)?.estimado ?? 0) || 0,
                can_withdraw: Boolean((j as any)?.can_withdraw),
                mercadopago_configured: Boolean((j as any)?.mercadopago_configured),
              };
            }
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) setBalance(bal);

        if (!cancelled) window.dispatchEvent(new CustomEvent('payouts-updated'));
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || 'No se pudo cargar Pagos.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, isImpersonating, targetUserId]);

  // Realtime: órdenes del vendedor → refrescar (admin marca pagado, etc.)
  useEffect(() => {
    if (!sellerId) return;
    const ch = supabase
      .channel(`pagos-orders-${sellerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, () => {
        setRefreshTrigger((n) => n + 1);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` }, () => {
        setRefreshTrigger((n) => n + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sellerId]);

  const handleWithdraw = async (accountDetails?: string) => {
    setError(null);
    setSuccessMsg(null);
    setWithdrawing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
      const res = await fetch('/api/payouts/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountDetails }),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo completar el retiro.');
      setSuccessMsg(json?.message ?? 'Solicitud de retiro enviada.');
      setRefreshTrigger((n) => n + 1);
      setShowWithdrawModal(false);
      setWithdrawAccount('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al solicitar retiro.');
    } finally {
      setWithdrawing(false);
    }
  };

  const summary = useMemo(() => {
    // Filtrar órdenes activas (no canceladas)
    const active = orders.filter((o) => {
      const status = normStatus(o?.status);
      return !isCancelledStatus(status);
    });

    // Calcular total de ventas
    const totalSales = active.length;

    // Filtrar órdenes pagadas (paid, shipped, delivered, completed)
    const paid = active.filter((o) => {
      const status = normStatus(o?.status);
      return isPaidStatus(status);
    });

    // Filtrar órdenes liberadas (delivered o completed) - NO verificar paid_to_seller_at para evitar desconfiguración
    const released = active.filter((o) => {
      const status = normStatus(o?.status);
      return isReleasedStatus(status);
    });

    // Filtrar órdenes por liberar (pagadas pero no entregadas)
    const toRelease = paid.filter((o) => {
      const status = normStatus(o?.status);
      return !isReleasedStatus(status);
    });

    // Función de suma robusta — ahora permite negativos para contabilidad correcta
    const sum = (list: any[]) => {
      return list.reduce((s, o) => {
        const net = payoutNet(o);
        return s + (Number.isFinite(net) ? net : 0);
      }, 0);
    };

    // Calcular disputas
    const disputedOpenSet = new Set(disputedOrderIds);
    const disputedAnySet = new Set(allDisputedOrderIds);
    const disputedOrders = active.filter((o) => disputedOpenSet.has(String(o?.id || '').trim()));
    const amountRetenidoPorDisputas = sum(disputedOrders);

    // Calcular montos
    const amountReleased = sum(released);
    const amountToReleaseFiltered = toRelease.filter((o) => {
      const id = String(o?.id || '').trim();
      return id && !disputedAnySet.has(id);
    });
    const amountToReleaseRaw = sum(amountToReleaseFiltered);
    const amountToReleaseAfterDisputes = Math.max(0, amountToReleaseRaw - amountRetenidoPorDisputas);

    // Validar que los cálculos sean consistentes
    const totalCalculated = amountReleased + amountToReleaseRaw;
    const totalAfterGuideDeduction = Math.max(0, totalCalculated - guideDeductionTotal);

    return {
      totalSales,
      deliveredCount: released.length,
      amountReleased, // Permite negativo para contabilidad correcta
      amountToRelease: amountToReleaseAfterDisputes,
      amountToReleaseRaw,
      hasDisputes: disputedOrderIds.length > 0,
      amountRetenidoPorDisputas: Math.max(0, amountRetenidoPorDisputas),
      guideDeductionTotal: Math.max(0, guideDeductionTotal),
      totalAfterGuideDeduction,
    };
  }, [orders, disputedOrderIds, allDisputedOrderIds, guideDeductionTotal]);

  // Barra «Liberado»: % basado en paid_to_seller_at (balance API). Coherente con «Disponible para retiro».
  const pct = useMemo(() => {
    if (balance && (balance.disponible + balance.por_liberar + balance.estimado) > 0) {
      const denom = balance.disponible + balance.por_liberar + balance.estimado;
      return Math.round((balance.disponible / denom) * 100);
    }
    return 0;
  }, [balance]);

  // Agrupar operaciones por mes para el estado de cuenta
  const operationsByMonth = useMemo(() => {
    const grouped: Record<string, { monthKey: string; monthLabel: string; orders: any[] }> = {};
    const activeOrders = orders.filter((o) => !isCancelledStatus(normStatus(o?.status)));

    for (const o of activeOrders) {
      const date = new Date(o?.created_at || '');
      if (Number.isNaN(date.getTime())) continue;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });

      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthKey, monthLabel, orders: [] };
      }
      grouped[monthKey].orders.push(o);
    }

    // Ordenar por mes (más reciente primero)
    return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [orders]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const disputedOpenSet = new Set(disputedOrderIds);
    const disputedAnySet = new Set(allDisputedOrderIds);
    let list = orders.slice();
    if (qq) {
      list = list.filter((o) => {
        const id = String(o?.id || '').toLowerCase();
        const st = String(o?.status || '').toLowerCase();
        const items = (itemsByOrder[String(o?.id || '')] ?? []).map((x: any) => String(x?.title || '')).join(' ').toLowerCase();
        return id.includes(qq) || st.includes(qq) || items.includes(qq);
      });
    }
    if (tab === 'liberados')
      return list.filter((o) => isReleasedStatus(normStatus(o?.status)));
    if (tab === 'por_liberar')
      return list.filter((o) => {
        const status = normStatus(o?.status);
        const id = String(o?.id || '').trim();
        if (!id || disputedAnySet.has(id)) return false;
        return isPaidStatus(status) && !isReleasedStatus(status);
      });
    if (tab === 'todo') return list;
    return list;
  }, [orders, itemsByOrder, q, tab, disputedOrderIds, allDisputedOrderIds]);

  // Reset page when tab or search changes
  useEffect(() => { setPagosPage(1); }, [tab, q]);

  const pagosTotalPages = Math.max(1, Math.ceil(rows.length / PAGOS_PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const page = Math.min(Math.max(1, pagosPage), pagosTotalPages);
    const start = (page - 1) * PAGOS_PAGE_SIZE;
    return rows.slice(start, start + PAGOS_PAGE_SIZE);
  }, [rows, pagosPage, pagosTotalPages]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Pagos</div>
              <div className="text-xs text-gray-500">Retiros y liberación de dinero</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}
        {successMsg ? (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{successMsg}</div>
        ) : null}

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold text-gray-900">Panel de pagos</div>
              <div className="mt-1 text-sm text-gray-600">
                Aquí ves tus <span className="font-semibold">ventas</span>, lo <span className="font-semibold">entregado</span> y la{' '}
                <span className="font-semibold">liberación de pagos</span>.
              </div>
              <div className="mt-2 text-xs font-medium">
                {planType === 'pro' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-blue-700 ring-1 ring-blue-700/10">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Plan PRO: Retiros en máx. 48 horas
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-600 ring-1 ring-gray-500/10">
                    Plan Básico: Retiros semanales (Sábados)
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRefreshTrigger((n) => n + 1)}
                disabled={isBooting}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
              >
                {isBooting ? 'Actualizando…' : 'Actualizar'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (forcingRecalc) return;
                  setError(null);
                  setSuccessMsg(null);
                  setForcingRecalc(true);
                  try {
                    const res = await fetch('/api/migrations/fix-gopocket-shipping', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || !(json as any)?.ok) {
                      throw new Error((json as any)?.error || 'No se pudo forzar el recálculo.');
                    }
                    setSuccessMsg('Se forzaron los cálculos de envíos GoVendy. Tus montos se actualizarán.');
                    setRefreshTrigger((n) => n + 1);
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Error al forzar recálculo de cálculos.');
                  } finally {
                    setForcingRecalc(false);
                  }
                }}
                disabled={forcingRecalc || isBooting}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
              >
                {forcingRecalc ? 'Forzando cálculos…' : 'Forzar cálculos GoVendy'}
              </button>
              <Link
                href="/dashboard/ventas"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
              >
                Ver ventas →
              </Link>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { data: sess } = await supabase.auth.getSession();
                    const token = sess?.session?.access_token;
                    if (!token) {
                      setError('Sesión no válida.');
                      return;
                    }

                    const res = await fetch('/api/payouts/statement', {
                      headers: { authorization: `Bearer ${token}` },
                    });

                    if (!res.ok) {
                      const json = await res.json().catch(() => ({}));
                      throw new Error(json?.error || 'No se pudo descargar el estado de cuenta.');
                    }

                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const now = new Date();
                    const dateStr = now.toISOString().split('T')[0];
                    a.download = `estado-cuenta-${dateStr}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch (e: unknown) {
                    console.error('[STATEMENT] Error:', e);
                    setError(e instanceof Error ? e.message : 'No se pudo descargar el estado de cuenta.');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-blue-700 hover:bg-blue-700"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Estado de cuenta
              </button>
              <button
                type="button"
                onClick={() => {
                  setWithdrawAccount(mercadopagoAccount ? `MercadoPago: ${mercadopagoAccount}` : '');
                  setShowWithdrawModal(true);
                }}
                disabled={withdrawing || (balance?.disponible ?? 0) < 0.01}
                title={
                  (balance?.disponible ?? 0) < 0.01
                    ? 'El saldo se libera cuando el comprador confirma recepción. Sin saldo disponible aún.'
                    : undefined
                }
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white shadow-sm disabled:opacity-60 hover:bg-black hover:opacity-90"
              >
                {withdrawing ? 'Enviando…' : 'Solicitar retiro'}
              </button>
            </div>
          </div>

          {balance && (balance.disponible ?? 0) >= 0.01 && !(balance.can_withdraw ?? false) && !(balance.mercadopago_configured ?? !!mercadopagoAccount) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
              <p className="text-sm font-semibold text-amber-900">
                Tienes <span className="font-extrabold text-brand-emerald">{formatMoney(balance.disponible)}</span> disponibles para retiro.
                Para poder solicitar el retiro, configura tu cuenta de Mercado Pago en{' '}
                <Link href="/dashboard/perfil#datos-cobro" className="font-extrabold text-brand-emerald underline hover:opacity-90">
                  Mi perfil → Datos de cobro
                </Link>
                .
              </p>
              <Link
                href="/dashboard/perfil#datos-cobro"
                className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-amber-700"
              >
                Ir a Datos de cobro
              </Link>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-semibold text-gray-600">Ventas</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">{summary.totalSales}</div>
              <div className="mt-1 text-xs text-gray-600">Órdenes (sin canceladas).</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-semibold text-gray-600">Entregados</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">{summary.deliveredCount}</div>
              <div className="mt-1 text-xs text-gray-600">Se libera cuando el comprador confirma recepción.</div>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ring-1 ${balance && balance.disponible < 0
              ? 'border-red-200 bg-red-50 ring-red-100'
              : 'border-black/5 bg-pink-50 ring-pink-100'
              }`}>
              <div className="text-[11px] font-semibold text-gray-600">Disponible para retiro</div>
              <div className={`mt-1 text-2xl font-extrabold ${balance && balance.disponible < 0 ? 'text-red-600' : 'text-brand-emerald'
                }`}>
                {balance ? formatMoney(balance.disponible) : '—'}
              </div>
              <div className="mt-1 text-xs text-gray-700">
                {balance && balance.disponible < 0
                  ? '⚠️ Saldo negativo. Tu cuenta tiene un adeudo por envíos/comisiones que superaron el precio de venta.'
                  : 'Dinero ya liberado (neto descontando comisión, envío y descuentos). Usa «Solicitar retiro» para enviarlo a tu Mercado Pago.'}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-[11px] font-semibold text-amber-900">Por liberar (estimado)</div>
              <div className="mt-1 text-2xl font-extrabold text-amber-900">
                {balance
                  ? formatMoney((balance.por_liberar ?? 0) + (balance.estimado ?? 0))
                  : formatMoney(summary.amountToRelease)}
              </div>
              <div className="mt-1 text-xs text-amber-900/80">
                {summary.hasDisputes
                  ? 'Pagado pero aún no confirmado. El retenido por disputas ya se descontó (podría no liberarse).'
                  : 'Entregados sin liberar + pagados no entregados. Se libera al confirmar recepción o cuando admin marca entregado.'}
              </div>
            </div>
            {summary.hasDisputes ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 ring-1 ring-red-100">
                <div className="text-[11px] font-semibold text-red-900">Dinero retenido por disputas</div>
                <div className="mt-1 text-2xl font-extrabold text-red-900">{formatMoney(summary.amountRetenidoPorDisputas)}</div>
                <div className="mt-1 text-xs text-red-900/80">
                  Retenido hasta que se resuelva la disputa (o el comprador confirme entrega).
                </div>
              </div>
            ) : null}
            {summary.guideDeductionTotal > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                <div className="text-[11px] font-semibold text-amber-900">Descuento por guías (cargo vendedor)</div>
                <div className="mt-1 text-2xl font-extrabold text-amber-900">-{formatMoney(summary.guideDeductionTotal)}</div>
                <div className="mt-1 text-xs text-amber-900/80">
                  Este monto ya se descuenta de tu saldo disponible por guías de devolución asignadas con cargo al vendedor.
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Liberado</span>
              <span className="font-semibold text-gray-900">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-brand-emerald" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-xs text-gray-700">
              <span className="font-extrabold text-brand-emerald">Tip:</span> el dinero se libera cuando el comprador confirma recepción o cuando Admin marca la orden como entregada en Logística. Entonces se activa «Solicitar retiro».
            </div>
            <div className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-xs text-gray-700">
              <span className="font-extrabold text-brand-emerald">Tip:</span> sube rastreo en <span className="font-semibold">Ventas</span> para acelerar entregas y liberación.
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['resumen', 'por_liberar', 'liberados', 'todo'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={[
                  'rounded-2xl px-4 py-2 text-sm font-extrabold ring-1',
                  tab === k ? 'bg-brand-emerald text-white ring-pink-200' : 'bg-white text-gray-900 ring-black/10 hover:bg-gray-50',
                ].join(' ')}
              >
                {k === 'resumen' ? 'Resumen' : k === 'por_liberar' ? 'Por liberar' : k === 'liberados' ? 'Liberados' : 'Todo'}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-[320px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por orden, estado o artículo…"
              className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
            />
          </div>
        </div>

        {isBooting ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Cargando…</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Aún no tienes ventas.</div>
          </div>
        ) : tab === 'resumen' ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-semibold text-gray-900">¿Qué significa cada estado?</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                <div className="text-xs font-extrabold text-gray-900">Pendiente de pago</div>
                <div className="mt-1 text-xs text-gray-700">Aún no está acreditado. No envíes todavía.</div>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                <div className="text-xs font-extrabold text-gray-900">Pagado</div>
                <div className="mt-1 text-xs text-gray-700">Ya puedes preparar y enviar.</div>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-black/5">
                <div className="text-xs font-extrabold text-gray-900">Enviado</div>
                <div className="mt-1 text-xs text-gray-700">Esperando entrega y confirmación.</div>
              </div>
              <div className="rounded-2xl bg-pink-50 px-4 py-3 ring-1 ring-pink-100">
                <div className="text-xs font-extrabold text-brand-emerald">Entregado</div>
                <div className="mt-1 text-xs text-gray-700">Pago liberado. Usa «Solicitar retiro» cuando tengas saldo disponible.</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-black/5 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="font-extrabold">Retiros</div>
              <div className="mt-1 text-xs">
                El saldo se libera en cuanto el comprador confirma que recibió su artículo. Cuando tengas disponible, usa <span className="font-semibold">Solicitar retiro</span> arriba;
                los fondos se envían a tu Mercado Pago. Configura tu cuenta en Mi perfil → Datos de cobro.
              </div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">No hay resultados con ese filtro.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Lista de operaciones agrupadas por mes (estilo estado de cuenta bancario) - Solo en tab "todo" */}
            {operationsByMonth.length > 0 && tab === 'todo' ? (
              <div className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-black/5 px-6 py-4">
                  <div className="text-lg font-extrabold text-gray-900">Estado de Cuenta (Último Año)</div>
                  <div className="mt-1 text-sm text-gray-600">Operaciones agrupadas por mes</div>
                </div>
                <div className="divide-y divide-black/5">
                  {operationsByMonth.map((monthGroup: any) => {
                    const monthOrders = monthGroup.orders || [];
                    const monthTotal = monthOrders.reduce((sum: number, o: any) => sum + payoutNet(o), 0);
                    const monthReleased = monthOrders
                      .filter((o: any) => isReleasedStatus(normStatus(o?.status)))
                      .reduce((sum: number, o: any) => sum + payoutNet(o), 0);
                    const monthToRelease = monthOrders
                      .filter((o: any) => isPaidStatus(normStatus(o?.status)) && !isReleasedStatus(normStatus(o?.status)))
                      .reduce((sum: number, o: any) => sum + payoutNet(o), 0);

                    return (
                      <div key={monthGroup.monthKey} className="p-6">
                        <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-2">
                          <div>
                            <div className="text-base font-extrabold text-gray-900 capitalize">{monthGroup.monthLabel}</div>
                            <div className="text-xs text-gray-600">{monthOrders.length} operación{monthOrders.length !== 1 ? 'es' : ''}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-600">Total del mes</div>
                            <div className="text-lg font-extrabold text-brand-emerald">{formatMoney(monthTotal)}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              Liberado: {formatMoney(monthReleased)} · Por liberar: {formatMoney(monthToRelease)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {monthOrders.slice(0, 10).map((o: any) => {
                            const id = String(o?.id || '').trim();
                            const st = normStatus(o?.status);
                            const net = payoutNet(o);
                            const createdAt = formatDate(o?.created_at);
                            const items = itemsByOrder[id] ?? [];
                            return (
                              <div key={id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-gray-700">{id.slice(0, 8)}…</span>
                                    <span className="text-xs text-gray-500">{createdAt}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isReleasedStatus(st) ? 'bg-green-100 text-green-800' :
                                      isPaidStatus(st) ? 'bg-amber-100 text-amber-800' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                      {statusLabel(st)}
                                    </span>
                                  </div>
                                  {items.length > 0 && (
                                    <div className="mt-1 text-xs text-gray-600">
                                      {items.slice(0, 1).map((it: any) => `${String(it?.title || 'Artículo')} x${Number(it?.quantity ?? 1) || 1}`).join(' · ')}
                                      {items.length > 1 ? ` · +${items.length - 1} más` : ''}
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4 text-right">
                                  <div className={`text-sm font-extrabold ${isReleasedStatus(st) ? 'text-green-700' :
                                    isPaidStatus(st) ? 'text-amber-700' :
                                      'text-gray-700'
                                    }`}>
                                    {formatMoney(net)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {monthOrders.length > 10 && (
                            <div className="text-center text-xs text-gray-500 py-2">
                              +{monthOrders.length - 10} operación{monthOrders.length - 10 !== 1 ? 'es' : ''} más
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Sección de Operaciones Detalladas (Estilo Estado Bancario) */}
            <div className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="border-b border-black/5 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold text-gray-900">Operaciones</div>
                    <div className="mt-1 text-sm text-gray-600">Desglose detallado de cada venta · {rows.length} operación{rows.length !== 1 ? 'es' : ''}</div>
                  </div>
                  {(balance?.disponible ?? 0) >= 0.01 && (
                    <button
                      type="button"
                      onClick={() => {
                        setWithdrawAccount(mercadopagoAccount ? `MercadoPago: ${mercadopagoAccount}` : '');
                        setShowWithdrawModal(true);
                      }}
                      disabled={withdrawing}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-extrabold text-white shadow-sm disabled:opacity-60 hover:bg-black hover:opacity-90"
                    >
                      {withdrawing ? 'Enviando…' : 'Solicitar retiro'}
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-black/5">
                {paginatedRows.map((o) => {
                  const id = String(o?.id || '').trim();
                  const st = normStatus(o?.status);
                  const cancelled = isCancelledStatus(st);
                  const paid = isPaidStatus(st);
                  const released = isReleasedStatus(st);
                  const net = payoutNet(o);
                  const hasAnyDispute = allDisputedOrderIds.includes(id);
                  const hasOpenDispute = disputedOrderIds.includes(id);
                  const subtotal = toNumber(o?.subtotal);
                  const total = toNumber(o?.total);
                  const shippingFee = toNumber(o?.shipping_fee);
                  const discount = toNumber(o?.coupon_discount);
                  const commission = toNumber(o?.commission_fee);
                  const shipSub = toNumber(o?.shipping_subsidy);
                  const createdAt = formatDate(o?.created_at);
                  const releasedAt = released ? formatDate((o as any)?.delivered_at || (o as any)?.completed_at || (o as any)?.updated_at || o?.created_at) : '—';
                  const items = itemsByOrder[id] ?? [];
                  const shippingOptionId = String((o as any)?.shipping_option_id || '').toLowerCase().trim();
                  const shippingCarrier = String((o as any)?.shipping_carrier || '').trim();
                  const isT1 = shippingOptionId === 't1';
                  const isPickup = shippingOptionId === 'pickup' || shippingCarrier.toLowerCase() === 'pickup';
                  const isSellerManaged = Boolean((o as any)?.shipping_by_seller) && !isPickup;

                  // Calcular monto cobrado (total - envío)
                  const amountCharged = Math.max(0, total - shippingFee);

                  return (
                    <div key={id || Math.random()} className="p-6 hover:bg-pink-50/30">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        {/* Columna izquierda: Información de la operación */}
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-900">ID: {id ? `${id.slice(0, 8)}…` : '—'}</span>
                            <span
                              className={[
                                'rounded-full px-3 py-1 text-xs font-extrabold ring-1',
                                cancelled
                                  ? 'bg-gray-100 text-gray-700 ring-black/10'
                                  : released
                                    ? 'bg-green-100 text-green-800 ring-green-200'
                                    : paid
                                      ? 'bg-amber-50 text-amber-900 ring-amber-200'
                                      : 'bg-white text-gray-900 ring-black/10',
                              ].join(' ')}
                            >
                              {statusLabel(st)}
                            </span>
                            <span className="text-xs text-gray-500">{createdAt}</span>
                            {released ? <span className="text-xs font-semibold text-green-700">✓ Liberado: {releasedAt}</span> : null}
                          </div>

                          {/* Productos vendidos */}
                          {items.length > 0 ? (
                            <div className="mb-3 rounded-xl bg-gray-50 px-4 py-3">
                              <div className="mb-2 text-xs font-extrabold text-gray-700">Productos vendidos:</div>
                              <div className="space-y-1">
                                {items.map((it: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-800">
                                      • {String(it?.title || 'Artículo')} x{Number(it?.quantity ?? 1) || 1}
                                    </span>
                                    <span className="font-semibold text-gray-900">{formatMoney(toNumber(it?.line_total))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Desglose de costos estilo estado bancario */}
                          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                            <div className="mb-2 text-xs font-extrabold text-gray-900">Desglose de la operación:</div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                <span className="text-gray-700">Monto cobrado (Total - Envío)</span>
                                <span className="font-extrabold text-gray-900">{formatMoney(amountCharged)}</span>
                              </div>
                              {shippingFee > 0 && (
                                <div className="flex items-center justify-between text-gray-600">
                                  <span className="flex items-center gap-1">
                                    {isT1
                                      ? <><span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 ring-1 ring-orange-300">🚀 PREMIUM</span>{shippingCarrier ? ` · ${shippingCarrier}` : ''}</>
                                      : isSellerManaged
                                        ? '(-) Envío gestionado por vendedor'
                                        : isPickup
                                          ? '(-) Entrega personal'
                                          : '(-) Envío GoVendy'
                                    }
                                  </span>
                                  <span className="font-semibold text-red-700">-{formatMoney(shippingFee)}</span>
                                </div>
                              )}
                              {discount > 0 && (
                                <div className="flex items-center justify-between text-gray-600">
                                  <span>(-) Descuento aplicado</span>
                                  <span className="font-semibold text-red-700">-{formatMoney(discount)}</span>
                                </div>
                              )}
                              {commission > 0 && (
                                <div className="flex items-center justify-between text-gray-600">
                                  <span>(-) Comisión de la plataforma</span>
                                  <span className="font-semibold text-red-700">-{formatMoney(commission)}</span>
                                </div>
                              )}
                              {shipSub > 0 && (
                                <div className="flex items-center justify-between text-gray-600">
                                  <span>(-) Envío gratis (subsidio)</span>
                                  <span className="font-semibold text-red-700">-{formatMoney(shipSub)}</span>
                                </div>
                              )}
                              <div className="mt-2 flex items-center justify-between border-t border-gray-300 pt-2">
                                <span className="text-sm font-extrabold text-gray-900">
                                  {released ? 'Monto disponible para retiro' : paid ? 'Monto por liberar' : 'Monto estimado'}
                                </span>
                                <span className={`text-lg font-extrabold ${released ? 'text-green-700' : paid ? 'text-amber-700' : 'text-gray-700'
                                  }`}>
                                  {formatMoney(net)}
                                </span>
                              </div>
                              {hasAnyDispute && (
                                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">
                                  {hasOpenDispute
                                    ? 'Esta operación está en disputa. El monto final dependerá de la resolución.'
                                    : 'Esta operación fue ajustada por una disputa. El monto mostrado ya considera la resolución.'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Columna derecha: Resumen visual */}
                        <div className="shrink-0 lg:w-48">
                          <div className={`rounded-2xl px-4 py-4 text-center ring-2 ${released
                            ? 'bg-green-50 ring-green-200'
                            : paid
                              ? 'bg-amber-50 ring-amber-200'
                              : 'bg-gray-50 ring-gray-200'
                            }`}>
                            <div className="text-xs font-semibold text-gray-600">
                              {released ? '✓ Disponible' : paid ? '⏳ Por liberar' : 'Pendiente'}
                            </div>
                            <div className={`mt-2 text-2xl font-extrabold ${released ? 'text-green-700' : paid ? 'text-amber-700' : 'text-gray-700'
                              }`}>
                              {formatMoney(net)}
                            </div>
                            <div className="mt-2 text-[10px] text-gray-600">
                              {released
                                ? 'Listo para retirar'
                                : paid
                                  ? 'Se libera al confirmar entrega'
                                  : 'Se calcula cuando esté pagado'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagosTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-black/5 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setPagosPage((p) => Math.max(1, p - 1))}
                    disabled={pagosPage <= 1}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <span className="text-sm font-semibold text-gray-700">
                    Página {pagosPage} de {pagosTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPagosPage((p) => Math.min(pagosTotalPages, p + 1))}
                    disabled={pagosPage >= pagosTotalPages}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Solicitar retiro</h3>
              <p className="mt-2 text-sm text-gray-600">
                Ingresa los datos de la cuenta a donde deseas que transfiramos tu saldo disponible.
              </p>
              <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs">
                {planType === 'pro' ? (
                  <p className="font-semibold text-blue-700">Plan PRO: Tu retiro se procesará en máximo 48 horas.</p>
                ) : (
                  <p className="font-semibold text-gray-700">Plan Básico: Tu retiro se procesará el próximo Sábado.</p>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-xs font-bold text-gray-700">Datos de la cuenta (Banco, CLABE, Nombre, etc.)</label>
                <textarea
                  className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-emerald focus:ring-brand-emerald sm:text-sm"
                  rows={4}
                  placeholder="Ej: Banco XYZ, CLABE: 1234..., Nombre: Juan Pérez"
                  value={withdrawAccount}
                  onChange={(e) => setWithdrawAccount(e.target.value)}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  disabled={withdrawing}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleWithdraw(withdrawAccount)}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
                  disabled={withdrawing || !withdrawAccount.trim()}
                >
                  {withdrawing ? 'Enviando...' : 'Confirmar retiro'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

