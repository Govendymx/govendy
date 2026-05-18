'use client';

import React from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAdminContext } from '@/lib/admin/AdminContext';
import { ContextualNavigation } from '@/components/admin/ContextualNavigation';
import { CopyButton } from '@/components/ui/CopyButton';
import { ShippingBadge } from '@/components/ui/ShippingBadge';
import { PagosRow } from './PagosRow';

type Tab = 'orders' | 'topups';

export default function AdminPagosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando pagos...</div>}>
      <AdminPagosContent />
    </Suspense>
  );
}

function AdminPagosContent() {
  const { orders, refreshPayments, refreshOrders } = useAdminContext();
  const searchParams = useSearchParams();
  // Unificamos en una sola vista
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expandable rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Combined State
  const [allOperations, setAllOperations] = useState<Array<Record<string, unknown>>>([]);

  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');

  useEffect(() => {
    const s = searchParams.get('status');
    if (s !== null) setStatusFilter(s);
  }, [searchParams]);

  const [searchTerm, setSearchTerm] = useState(''); // Estado para búsqueda
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [forcingRecalc, setForcingRecalc] = useState(false);

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);


  // Filtrado cliente-side unificado
  const filteredOperations = useMemo(() => {
    let result = allOperations;

    // 1. Filtrar por status
    if (statusFilter) {
      if (statusFilter === 'paid' || statusFilter === 'approved') {
        result = result.filter(r => {
          const s = String(r.status || '').toLowerCase();
          return s === 'paid' || s === 'approved';
        });
      } else if (statusFilter === 'pending') {
        result = result.filter(r => {
          const s = String(r.status || '').toLowerCase();
          return s === 'pending' || s === 'pending_approval' || s === 'pending_payment' || s === 'awaiting_voucher' || s === 'verifying_payment';
        });
      } else {
        // Otros filtros específicos si los hubiera
        result = result.filter(r => String(r.status || '').toLowerCase() === statusFilter);
      }
    }

    // 2. Filtrar por search term
    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase().trim();

    return result.filter((r) => {
      const type = (r as any)._type || ''; // 'order' | 'topup'
      const pid = String(r?.id || '').toLowerCase();
      const status = String(r?.status || '').toLowerCase();

      if (type === 'order') {
        const ref = String(r?.reference_code || '').toLowerCase();
        const buyerEmail = String((r as any)?.buyer_email || '').toLowerCase();
        return (
          pid.includes(term) ||
          ref.includes(term) ||
          buyerEmail.includes(term) ||
          status.includes(term)
        );
      } else if (type === 'topup') {
        // topup
        const pref = String((r as any)?.mercadopago_preference_id || '').toLowerCase();
        const user = (r as any)?.user;
        const email = String(user?.email || '').toLowerCase();
        const name = String(user?.full_name || '').toLowerCase();
        return (
          pid.includes(term) ||
          pref.includes(term) ||
          email.includes(term) ||
          name.includes(term) ||
          status.includes(term)
        );
      } else {
        // wallet transaction
        const concept = String((r as any)?.concept || '').toLowerCase();
        const refId = String((r as any)?.reference_id || '').toLowerCase();
        return (
          pid.includes(term) ||
          concept.includes(term) ||
          refId.includes(term) ||
          status.includes(term)
        );
      }
    });
  }, [allOperations, searchTerm, statusFilter]);

  const [profiles, setProfiles] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    if (isLoading) return;

    setError(null);
    setIsLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/pagos';
        return;
      }

      // Cargar Orders
      const ordersUrl = `/api/admin/payments/offline/list?limit=200`; // Traemos todo y filtramos en cliente para unificar
      const resOrders = await fetch(ordersUrl, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const jsonOrders = await resOrders.json().catch(() => ({}));
      const rawSessions = ((jsonOrders?.sessions ?? []) as any[]) ?? [];
      const ordersList = rawSessions
        .filter((o) => !o.is_virtual && !(typeof o.id === 'string' && o.id.startsWith('virtual-')))
        .map((o) => ({ ...o, _type: 'order' }));

      // Cargar Topups
      const topupsUrl = `/api/admin/wallet/topups/list?limit=100`;
      const resTopups = await fetch(topupsUrl, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const jsonTopups = await resTopups.json().catch(() => ({}));
      const topupsList = ((jsonTopups?.topups ?? []) as any[]).map(t => ({ ...t, _type: 'topup' }));

      // Cargar Wallet Transactions (Pagos con PocketCash)
      const walletUrl = `/api/admin/wallet/transactions/list?limit=200`;
      const resWallet = await fetch(walletUrl, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const jsonWallet = await resWallet.json().catch(() => ({}));
      const walletList = ((jsonWallet?.transactions ?? []) as any[])
        .map(t => ({ ...t, _type: 'wallet' }));

      // Combinar y ordenar por fecha descendente
      const combined = [...ordersList, ...topupsList, ...walletList].sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return db - da;
      });

      setAllOperations(combined);

      // Use profiles returned from APIs (enriched server-side)
      const mergedProfiles: Record<string, any> = {};
      if (jsonOrders?.profiles) {
        Object.entries(jsonOrders.profiles).forEach(([id, p]: [string, any]) => {
          mergedProfiles[id] = p;
        });
      }
      if (jsonTopups?.profiles) {
        Object.entries(jsonTopups.profiles).forEach(([id, p]: [string, any]) => {
          if (!mergedProfiles[id]) mergedProfiles[id] = p;
        });
      }
      if (jsonWallet?.profiles) {
        Object.entries(jsonWallet.profiles).forEach(([id, p]: [string, any]) => {
          if (!mergedProfiles[id]) mergedProfiles[id] = p;
        });
      }
      setProfiles(mergedProfiles);

    } catch (e: unknown) {
      console.error(e);
      setAllOperations([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar datos.');
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove dependencies to avoid loops, called on mount/refresh

  // Efecto inicial
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al cargar datos iniciales');
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmtDateTime = (d: any) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };


  // Cuando el término de búsqueda es un UUID, buscar también la orden directamente
  // (cubre órdenes pagadas por MercadoPago que no están en el listado offline)
  const [extraOrders, setExtraOrders] = useState<Record<string, unknown>[]>([]);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  useEffect(() => {
    const term = searchTerm.trim();
    if (!UUID_RE.test(term)) { setExtraOrders([]); return; }

    // Evitar duplicar si ya está en los resultados normales
    const already = allOperations.some(o => String(o.id || '').toLowerCase() === term.toLowerCase());
    if (already) { setExtraOrders([]); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/admin/orders/lookup?id=${encodeURIComponent(term)}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json?.order) {
          setExtraOrders([{ ...json.order, _type: 'order' }]);
        } else if (!cancelled) {
          setExtraOrders([]);
        }
      } catch { setExtraOrders([]); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, allOperations]);

  // Combinar resultados normales + búsqueda directa por UUID (MercadoPago, etc.)
  const displayedOperations = useMemo(() => {
    if (extraOrders.length === 0) return filteredOperations;
    // Dedupe: extraOrders que no estén ya en filteredOperations
    const existingIds = new Set(filteredOperations.map((o: any) => String(o.id || '')));
    const extra = extraOrders.filter((o: any) => !existingIds.has(String(o.id || '')));
    return [...extra, ...filteredOperations];
  }, [filteredOperations, extraOrders]);

  // Reset page when filters/search change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(displayedOperations.length / PAGE_SIZE));
  const paginatedOperations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayedOperations.slice(start, start + PAGE_SIZE);
  }, [displayedOperations, currentPage]);

  const countLabel = useMemo(() => {
    if (isLoading) return 'Cargando…';
    const total = displayedOperations.length;
    if (total === 0) return '0 operaciones';
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, total);
    return `${from}-${to} de ${total} operaciones`;
  }, [isLoading, displayedOperations.length, currentPage]);


  const renderStatus = (raw: any, row?: any) => {
    const s = String(raw || '').trim().toLowerCase();

    // Check for PocketCash operations (wallet transactions)
    // User requested: "en lugar del boton amarillo un rosado que diga Pago Pocketcash"
    const isPocketCash = row?._type === 'wallet';
    const isPending = !(s === 'paid' || s === 'approved' || s === 'cancelled' || s === 'canceled' || s === 'refunded' || s === 'rejected');

    if (isPocketCash && isPending) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-md">
          <span>💳</span>
          Pago Pocketcash
        </span>
      );
    }

    if (s === 'paid' || s === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-md">
          <span>✅</span>
          {s === 'approved' ? 'Aprobado' : 'Pagado'}
        </span>
      );
    }
    if (s === 'cancelled' || s === 'canceled' || s === 'refunded' || s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-md">
          <span>❌</span>
          {s === 'rejected' ? 'Rechazado' : 'Cancelado'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-xs font-bold text-white shadow-md">
        <span>⏳</span>
        Pendiente
      </span>
    );
  };

  // --- Actions for Orders ---
  const handleAccreditOrder = async (checkoutId: string) => {
    if (!confirm('¿Estás seguro de acreditar este pago manualmente? Esto marcará las órdenes como PAGADAS y enviará notificaciones.')) return;

    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');
      const { data: { user } } = await supabase.auth.getUser();
      const adminName = user?.user_metadata?.full_name || user?.email || 'Admin';

      const res = await fetch('/api/admin/payments/offline/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ checkoutId, action: 'mark_paid', adminName })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al acreditar');

      // Optimistic Update
      setAllOperations(prev => prev.map(op => {
        if (String(op.id) === checkoutId) {
          return { ...op, status: 'paid' };
        }
        return op;
      }));

      // No alert blocking, just background refresh
      void load();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => { const next = new Set(prev); next.delete(checkoutId); return next; });
    }
  };

  const handleRejectOrder = async (checkoutId: string) => {
    if (!confirm('¿Estás seguro de RECHAZAR este pago?')) return;
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');
      const res = await fetch('/api/admin/payments/offline/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ checkoutId, action: 'cancel' })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al rechazar');

      // Optimistic Update
      setAllOperations(prev => prev.map(op => {
        if (String(op.id) === checkoutId) {
          return { ...op, status: 'cancelled' };
        }
        return op;
      }));

      void load();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => { const next = new Set(prev); next.delete(checkoutId); return next; });
    }
  };

  // --- Actions for Topups ---
  const handleApproveTopup = async (topupId: string) => {
    if (!confirm('¿Estás seguro de acreditar esta recarga manualmente? Se agregará el saldo al usuario.')) return;
    setProcessingIds(prev => new Set(prev).add(topupId));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/admin/wallet/topups/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ topupId })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al aprobar recarga');

      // Optimistic Update
      setAllOperations(prev => prev.map(op => {
        if (String(op.id) === topupId) {
          return { ...op, status: 'approved' };
        }
        return op;
      }));

      void load();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => { const next = new Set(prev); next.delete(topupId); return next; });
    }
  };

  const handleCheckMpStatus = async (checkoutId: string, mpPaymentId: string | null, type: 'order' | 'topup' = 'order') => {
    setProcessingIds(prev => new Set(prev).add(checkoutId));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      // 1. Intentar verificación automática (backend buscará por ID o referencia)
      const res = await fetch('/api/admin/payments/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ checkoutId, paymentId: mpPaymentId, type })
      });
      const json = await res.json();

      if (!res.ok || json.status === 'not_found' || json.status === 'not_found_in_db') {
        // Llamar al diagnóstico automáticamente para mostrar info útil
        let debugInfo = '';
        try {
          const debugRes = await fetch('/api/admin/payments/debug-mp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ sessionId: checkoutId })
          });
          const debugJson = await debugRes.json();
          if (debugJson.log) {
            const s = debugJson.log.session;
            const pasos = debugJson.log.pasos || [];
            debugInfo = `\n\n=== DIAGNÓSTICO ===` +
              `\nSession: ${s?.id || 'N/A'}` +
              `\nMétodo: ${s?.payment_method || 'N/A'}` +
              `\nEstado BD: ${s?.status || 'N/A'}` +
              `\nMP Payment ID: ${s?.mp_payment_id || 'ninguno'}` +
              `\nMP Preference: ${s?.mp_preference_id || 'ninguno'}` +
              `\nMP Status: ${s?.mp_status || 'N/A'}`;

            // Mostrar pagos recientes encontrados en MP
            const recientes = pasos.find((p: any) => p.paso === '4_recientes');
            if (recientes && recientes.results && recientes.results.length > 0) {
              debugInfo += `\n\n--- Pagos recientes en MP (${recientes.total}) ---`;
              recientes.results.slice(0, 5).forEach((p: any) => {
                debugInfo += `\n• ${p.id} | ${p.status} | $${p.transaction_amount} | ${p.payment_method_id} | ref: ${p.external_reference || 'N/A'}`;
              });
            } else {
              debugInfo += `\n\nNo se encontraron pagos recientes en MercadoPago.`;
            }
          }
        } catch (dbgErr) {
          debugInfo = '\n\n(No se pudo obtener diagnóstico adicional)';
        }

        const shouldRetry = confirm(`No se detectó el pago automáticamente.${debugInfo}\n\n¿Deseas ingresar el ID de MercadoPago manualmente?`);

        if (shouldRetry) {
          const manualId = prompt("Ingresa el ID de la transacción de MercadoPago:");

          if (manualId) {
            // Reintento con ID manual
            const res2 = await fetch('/api/admin/payments/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ checkoutId, paymentId: manualId.trim(), type })
            });
            const json2 = await res2.json();

            if (!res2.ok) {
              throw new Error(json2.message || json2.error || 'Error al verificar con ID manual');
            }

            if (json2.status === 'approved') {
              alert('¡Pago vinculado y aprobado exitosamente!');
            } else {
              alert(`Resultado con ID manual: ${json2.status} (${json2.status_detail})`);
            }
            void load();
            return;
          }
        }
        throw new Error(json.message || json.error || 'Error al verificar estado');
      }

      // Éxito automático
      if (json.status === 'approved') {
        alert('¡Pago detectado y aprobado correctamente!');
      } else {
        alert(`Estado en MercadoPago: ${json.status} (${json.status_detail})`);
      }

      void load();

    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessingIds(prev => { const next = new Set(prev); next.delete(checkoutId); return next; });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-emerald-600 to-rose-600 p-8 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-white/20 backdrop-blur-sm p-3">
              <span className="text-3xl">💳</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Gestión de Pagos</h1>
              <p className="mt-1 text-sm text-white/90">
                Administra pagos offline de pedidos y recargas de saldo PocketCash.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent"></div>
      </div>

      {/* Contenido principal */}
      <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar referencia, usuario, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 rounded-xl border border-gray-300 px-4 py-2.5 pl-10 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
            <button
              type="button"
              onClick={() => load()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-gray-700 hover:to-gray-800 transition-all disabled:opacity-60"
            >
              <span>🔄</span>
              {isLoading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (forcingRecalc) return;
                setError(null);
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
                  await load();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Error al forzar recálculo de cálculos.');
                } finally {
                  setForcingRecalc(false);
                }
              }}
              disabled={forcingRecalc || isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-md ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
            >
              <span>⚙️</span>
              {forcingRecalc ? 'Forzando cálculos…' : 'Forzar cálculos GoVendy'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border-l-4 border-red-500 bg-red-50/80 backdrop-blur-sm px-5 py-4 shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <div className="font-bold text-red-900">Error</div>
                <div className="mt-1 text-sm text-red-800">{error}</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filtros */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">Filtros:</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('')} className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${!statusFilter ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Todos</button>
              <button onClick={() => setStatusFilter('pending')} className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>⏳ Pendientes</button>
              <button onClick={() => setStatusFilter('paid')} className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${statusFilter === 'paid' || statusFilter === 'approved' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>✅ Pagados/Aprobados</button>
            </div>
          </div>
          <div className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2 rounded-lg">
            {countLabel}
          </div>
        </div>

        {isBooting ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
              <p className="mt-4 text-sm font-semibold text-gray-600">Cargando...</p>
            </div>
          </div>
        ) : displayedOperations.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 px-8 py-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <div className="text-lg font-bold text-gray-900 mb-2">No se encontraron resultados</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="w-10 px-3 py-3"></th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Tipo / Referencia</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Concepto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Comprador → Vendedor</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedOperations.map((r: any) => {
                    const rowId = `${r._type}-${r.id}`;
                    return (
                      <PagosRow
                        key={rowId}
                        r={r}
                        isExpanded={expandedIds.has(rowId)}
                        onToggle={toggleExpand}
                        profiles={profiles}
                        fmtDateTime={fmtDateTime}
                        renderStatus={renderStatus}
                        handleAccreditOrder={handleAccreditOrder}
                        handleRejectOrder={handleRejectOrder}
                        handleApproveTopup={handleApproveTopup}
                        handleCheckMpStatus={handleCheckMpStatus}
                        processingIds={processingIds}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
                <div className="text-xs text-gray-500">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    ← Anterior
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .reduce<(number | string)[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      typeof p === 'string' ? (
                        <span key={`dot-${i}`} className="px-1 text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${p === currentPage
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
