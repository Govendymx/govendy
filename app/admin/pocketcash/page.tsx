'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { CopyButton } from '@/components/ui/CopyButton';
import { Pagination, usePagination } from '@/components/ui/Pagination';

export default function AdminPocketCashPage() {
  const [activeTab, setActiveTab] = useState<'topups' | 'manage' | 'operations'>('topups');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de PocketCash</h1>
        <div className="flex gap-2 rounded-lg bg-white p-1 shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('topups')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'topups'
              ? 'bg-brand-emerald text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Recargas Pendientes
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'operations'
              ? 'bg-brand-emerald text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Operaciones
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'manage'
              ? 'bg-brand-emerald text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            Gestionar Saldos
          </button>
        </div>
      </div>

      <PocketCashMetrics />

      {activeTab === 'topups' ? (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando recargas...</div>}>
          <PendingTopupsView />
        </Suspense>
      ) : activeTab === 'operations' ? (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando operaciones...</div>}>
          <OperationsView />
        </Suspense>
      ) : (
        <ManageBalancesView />
      )}
    </div>
  );
}

function PocketCashMetrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) return;
        const res = await fetch('/api/admin/dashboard/summary', {
          headers: { authorization: `Bearer ${sess.session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>;
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Global Liability */}
      <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <svg className="w-12 h-12 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>
        </div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pasivo Global (Deuda)</div>
        <div className="mt-1 text-2xl font-bold text-red-600">
          {metrics.pocketcash_global_liability !== undefined
            ? `$${metrics.pocketcash_global_liability.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '—'}
        </div>
        <div className="mt-1 text-xs text-gray-400">Total en billeteras de usuarios</div>
      </div>

      {/* Issued This Week */}
      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Emitido (Semana)</div>
        <div className="mt-1 text-2xl font-bold text-blue-600">
          {metrics.weekly_pocketcash_issued !== undefined
            ? `$${metrics.weekly_pocketcash_issued.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '—'}
        </div>
        <div className="mt-1 text-xs text-gray-400">Recargas + Cashback + Regalos</div>
      </div>

      {/* Spent This Week */}
      <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gastado (Semana)</div>
        <div className="mt-1 text-2xl font-bold text-green-600">
          {metrics.weekly_pocketcash_spent !== undefined
            ? `$${metrics.weekly_pocketcash_spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '—'}
        </div>
        <div className="mt-1 text-xs text-gray-400">Compras + Retiros</div>
      </div>

      {/* Total Withdrawn */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Retirado</div>
        <div className="mt-1 text-2xl font-bold text-gray-700">
          {metrics.pocketcash_total_withdrawn !== undefined
            ? `$${metrics.pocketcash_total_withdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '—'}
        </div>
        <div className="mt-1 text-xs text-gray-400">Transferido a Bancos</div>
      </div>
    </div>
  );
}

function PendingTopupsView() {
  const searchParams = useSearchParams();
  const [topups, setTopups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all' | 'completed' | 'rejected'>((searchParams.get('status') as any) || 'all');
  const [balancesByUser, setBalancesByUser] = useState<Record<string, number>>({});

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && ['pending', 'all', 'completed', 'rejected'].includes(s)) {
      setFilterStatus(s as any);
    }
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // User Details Modal State
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<any>(null);
  const [userDetailsExtra, setUserDetailsExtra] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTopups();
  }, [filterStatus, debouncedQuery]);

  // Fetch extra user details when modal opens
  useEffect(() => {
    if (selectedUserForDetails) {
      fetchUserDetails(selectedUserForDetails.id);
    } else {
      setUserDetailsExtra(null);
    }
  }, [selectedUserForDetails]);

  async function fetchUserDetails(userId: string) {
    try {
      setLoadingDetails(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/admin/wallet/get-balance?userId=${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUserDetailsExtra(data.wallet);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function fetchTopups() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `/api/admin/wallet/topups/list?status=${filterStatus}`;
      if (debouncedQuery) {
        url += `&q=${encodeURIComponent(debouncedQuery)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar recargas');

      // HACK: Parse metadata from mercadopago_preference_id if needed
      const parsedTopups = (data.topups || []).map((t: any) => {
        let metadata = t.metadata;
        if (!metadata && t.mercadopago_preference_id && t.mercadopago_preference_id.startsWith('{')) {
          try {
            metadata = JSON.parse(t.mercadopago_preference_id);
          } catch (e) { console.error(e); }
        }
        return { ...t, metadata };
      });

      setTopups(parsedTopups);
      const ids = Array.from(new Set(parsedTopups.map((t: any) => t.user?.id || t.user_id).filter(Boolean)));
      if (ids.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const results = await Promise.all(ids.map(async (uid: string) => {
            try {
              const r = await fetch(`/api/admin/wallet/get-balance?userId=${uid}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              const j = await r.json().catch(() => ({}));
              if (r.ok && j?.wallet) return { uid, bal: Number(j.wallet.balance) || 0 };
            } catch { }
            return { uid, bal: NaN };
          }));
          const map: Record<string, number> = {};
          results.forEach(x => { if (!Number.isNaN(x.bal)) map[x.uid] = x.bal; });
          setBalancesByUser(map);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(topupId: string) {
    try {
      const topup = topups.find((t: any) => String(t.id) === String(topupId));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let currentBalance = 0;
      if (topup?.user_id) {
        const rb = await fetch(`/api/admin/wallet/get-balance?userId=${topup.user_id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const jb = await rb.json().catch(() => ({}));
        if (rb.ok && jb?.wallet) currentBalance = Number(jb.wallet.balance) || 0;
      }
      const amount = Number(topup?.amount || 0);
      const expected = currentBalance + amount;

      const confirmMsg = [
        '¿Aprobar esta recarga y acreditar el saldo?',
        topup?.user_id ? `\n\nSaldo actual: $${currentBalance.toFixed(2)}` : '',
        topup?.user_id ? `\nMonto a acreditar: $${amount.toFixed(2)}` : '',
        topup?.user_id ? `\nNuevo saldo esperado: $${expected.toFixed(2)}` : '',
      ].join('');
      if (!confirm(confirmMsg)) return;

      // Chequeo rápido de duplicados por referencia
      if (topup?.id && topup?.user_id) {
        const params = new URLSearchParams({ limit: '1', q: String(topup.id) });
        const rtx = await fetch(`/api/admin/wallet/transactions/list?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const jtx = await rtx.json().catch(() => ({}));
        const exists = Array.isArray(jtx?.transactions)
          ? jtx.transactions.some((x: any) => {
            const refType = String(x.reference_type);
            const refId = String(x.reference_id ?? '');
            const isCredit = String(x.type) === 'credit';
            const sameWallet = String(x.wallet_id) === String(topup.user_id);
            const matchesOld = refType === 'manual_adjustment' && refId === String(topup.id);
            const matchesNew = refType === 'manual_adjustment' && refId === `topup:${topup.id}`;
            return sameWallet && isCredit && (matchesOld || matchesNew);
          })
          : false;
        if (exists) {
          if (!confirm('Ya existe un crédito para este TopUp. La aprobación será idempotente y no sumará saldo. ¿Continuar?')) {
            return;
          }
        }
      }

      setProcessingId(topupId);
      const res = await fetch('/api/admin/wallet/topups/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ topupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar');

      let finalBalanceMsg = '';
      if (topup?.user_id) {
        try {
          const rf = await fetch(`/api/admin/wallet/get-balance?userId=${topup.user_id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const jf = await rf.json().catch(() => ({}));
          if (rf.ok && jf?.wallet) {
            const fb = Number(jf.wallet.balance) || 0;
            setBalancesByUser(prev => ({ ...prev, [topup.user_id]: fb }));
            finalBalanceMsg = ` Saldo final: $${fb.toFixed(2)}`;
          }
        } catch { }
      }
      alert(`Recarga aprobada exitosamente.${finalBalanceMsg}`);
      fetchTopups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(topupId: string) {
    if (!confirm('¿Rechazar esta recarga?')) return;
    try {
      setProcessingId(topupId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/wallet/topups/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ topupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rechazar');

      alert('Recarga rechazada exitosamente');
      fetchTopups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(topupId: string) {
    if (!confirm('¿Estás seguro de MARCAR COMO ELIMINADA esta recarga? Se ocultará de la lista principal.')) return;
    try {
      setProcessingId(topupId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/wallet/topups/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ topupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      alert('Recarga marcada como eliminada');
      fetchTopups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved':
      case 'completed':
        return <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Aprobado</span>;
      case 'rejected':
      case 'cancelled':
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Rechazado</span>;
      case 'deleted':
        return <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">Eliminado</span>;
      case 'pending_proof':
        return <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Esperando Pago</span>;
      case 'pending_approval':
      case 'pending':
        return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Por Revisar</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{status}</span>;
    }
  }

  // Metrics
  const totalAmount = topups.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalCount = topups.length;

  const { paginatedItems: paginatedTopups, paginationProps: topupsPagination, setCurrentPage: setTopupsPage } = usePagination(topups, 50);
  useEffect(() => { setTopupsPage(1); }, [filterStatus, debouncedQuery, setTopupsPage]);

  return (
    <div className="space-y-4">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="text-xs font-medium text-gray-500 uppercase">Total Mostrado</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="text-xs font-medium text-gray-500 uppercase">Registros</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{totalCount}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterStatus === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterStatus === 'pending' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterStatus === 'completed' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Completadas
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterStatus === 'rejected' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Rechazadas
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por nombre, email o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-1.5 text-sm focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none"
          />
          <svg className="absolute left-3 top-2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {error && <div className="p-4 bg-red-50 text-red-600 border-b border-red-100">{error}</div>}

        {loading && topups.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Cargando recargas...</div>
        ) : topups.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No hay recargas encontradas con este filtro.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-gray-900">Usuario</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Estado</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Monto</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Saldo</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Método</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Comprobante</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Fecha</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTopups.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {t.user?.full_name || (t.user ? 'Sin nombre' : 'Usuario desconocido')}
                        </div>
                        <div className="text-xs text-gray-500">{t.user?.email || 'Sin email'}</div>
                        {t.user?.id && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mt-0.5">
                            ID: {t.user.id.slice(0, 8)}...
                            <CopyButton text={t.user.id} size="sm" className="text-gray-400 hover:text-brand-emerald" />
                          </div>
                        )}
                        {t.user ? (
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Opening details for user:', t.user);
                              setSelectedUserForDetails(t.user);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:underline mt-1"
                          >
                            Ver Datos
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 mt-1 block">Sin datos de usuario</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(t.status)}
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-green-600">
                        ${t.amount?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const uid = t.user?.id || t.user_id;
                          const bal = uid ? balancesByUser[uid] : undefined;
                          if (bal === undefined) return <span className="text-xs text-gray-400">—</span>;
                          const amt = Number(t.amount) || 0;
                          const exp = bal + amt;
                          return (
                            <span className="font-mono text-xs text-gray-700">
                              ${bal.toFixed(2)} → <span className="font-semibold text-green-700">${exp.toFixed(2)}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                          {t.metadata?.payment_method || 'Desconocido'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {t.metadata?.proof_url ? (
                          <a
                            href={t.metadata.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-emerald hover:underline text-xs font-medium"
                          >
                            Ver Comprobante
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin comprobante</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(t.created_at).toLocaleDateString()} <span className="text-xs">{new Date(t.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(t.status === 'pending' || t.status === 'pending_approval' || t.status === 'pending_proof') && (
                            <>
                              <button
                                onClick={() => handleApprove(t.id)}
                                disabled={processingId === t.id}
                                title="Aprobar"
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleReject(t.id)}
                                disabled={processingId === t.id}
                                title="Rechazar"
                                className="p-1.5 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 disabled:opacity-50"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={processingId === t.id}
                            title="Eliminar permanentemente"
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...topupsPagination} />
          </>
        )}
      </div>

      {/* Modal de Detalles de Usuario */}
      {selectedUserForDetails && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl relative">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Datos del Usuario</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-full bg-brand-emerald/10 flex items-center justify-center text-brand-emerald font-bold text-xl">
                  {(selectedUserForDetails.full_name || selectedUserForDetails.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{selectedUserForDetails.full_name || 'Sin Nombre'}</div>
                  <div className="text-sm text-gray-500">{selectedUserForDetails.email}</div>
                </div>
              </div>

              {loadingDetails ? (
                <div className="py-4 text-center text-gray-500 text-sm">Cargando saldo...</div>
              ) : userDetailsExtra && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="text-xs text-green-600 font-medium uppercase">Saldo Actual</div>
                    <div className="text-xl font-bold text-green-700">${Number(userDetailsExtra.balance).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 font-medium uppercase">Estado</div>
                    <div className="text-sm font-bold text-gray-700">{userDetailsExtra.is_frozen ? 'Congelado ❄️' : 'Activo ✅'}</div>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                {selectedUserForDetails.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Teléfono:</span>
                    <span className="font-medium">{selectedUserForDetails.phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">ID Usuario:</span>
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{selectedUserForDetails.id}</code>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedUserForDetails(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageBalancesView() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  // Action state
  const [actionAmount, setActionAmount] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [actionType, setActionType] = useState<'credit' | 'debit'>('credit');
  const [processing, setProcessing] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setUsers([]);
    setSelectedUser(null);
    setWallet(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }

  async function selectUser(user: any) {
    setSelectedUser(user);
    setUsers([]);
    // Fetch wallet
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/admin/wallet/get-balance?userId=${user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setWallet(data.wallet);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function executeAction() {
    if (!selectedUser || !actionAmount || !actionReason) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (!confirm(`¿Estás seguro de ${actionType === 'credit' ? 'AGREGAR' : 'QUITAR'} $${actionAmount} a ${selectedUser.email}?`)) return;

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/wallet/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: parseFloat(actionAmount),
          type: actionType,
          concept: actionReason
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la operación');

      alert('Operación exitosa');
      setActionAmount('');
      setActionReason('');

      // Refresh balance
      const balRes = await fetch(`/api/admin/wallet/get-balance?userId=${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const balData = await balRes.json();
      if (balRes.ok) {
        setWallet(balData.wallet);
      }

    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Buscar Usuario</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email, nombre o ID..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {searching ? '...' : 'Buscar'}
            </button>
          </form>

          {users.length > 0 && (
            <div className="mt-4 divide-y divide-gray-100 border rounded-lg overflow-hidden">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{u.name || u.full_name || 'Sin nombre'}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                  <div className="text-gray-400">→</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {selectedUser ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Acciones de Saldo</h2>
              <button onClick={() => setSelectedUser(null)} className="text-sm text-gray-500 hover:text-gray-700">Cambiar usuario</button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-sm text-gray-500">Usuario seleccionado</div>
              <div className="font-medium text-gray-900">{selectedUser.name || selectedUser.full_name}</div>
              <div className="text-xs text-gray-500 font-mono">{selectedUser.email}</div>
              <div className="text-xs text-gray-400 mt-1">ID: {selectedUser.id}</div>

              {wallet && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">Saldo actual</div>
                  <div className="text-2xl font-bold text-gray-900">${Number(wallet.balance || 0).toFixed(2)}</div>
                  {wallet.is_frozen && (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 mt-2">
                      Monedero Congelado
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActionType('credit')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border ${actionType === 'credit'
                    ? 'bg-green-50 border-green-200 text-green-700 ring-1 ring-green-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  + Agregar (Crédito)
                </button>
                <button
                  onClick={() => setActionType('debit')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border ${actionType === 'debit'
                    ? 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  - Quitar (Débito)
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto (MXN)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Concepto / Motivo</label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none"
                  placeholder="Ej: Regalo de bienvenida, Ajuste por error..."
                />
              </div>

              <button
                onClick={executeAction}
                disabled={processing || !actionAmount || !actionReason}
                className={`w-full py-2.5 rounded-lg text-sm font-bold text-white shadow-sm transition ${actionType === 'credit' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {processing ? 'Procesando...' : actionType === 'credit' ? 'Confirmar Crédito' : 'Confirmar Débito'}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
            Selecciona un usuario para gestionar su saldo
          </div>
        )}
      </div>
    </div>
  );
}

function OperationsView() {
  const searchParams = useSearchParams();
  const initialSearch =
    searchParams.get('q') ||
    searchParams.get('userId') ||
    searchParams.get('user') ||
    '';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const term = searchQuery.trim();
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (term) {
        params.set('q', term);
      }

      const res = await fetch(`/api/admin/wallet/transactions/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar transacciones');

      setTransactions(data.transactions || []);

      // Use profiles returned from the API (enriched server-side)
      if (data.profiles) {
        setProfiles(data.profiles);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    const raw = searchQuery.trim();
    const term = raw.toLowerCase();
    const isUuid = /^[0-9a-fA-F-]{32,36}$/.test(raw);
    const isCard = /^\d{12,20}$/.test(raw.replace(/\s+/g, ''));

    if (!term) return true;

    if (isUuid || isCard) {
      return true;
    }

    const concept = String(t.concept || '').toLowerCase();
    const refId = String(t.reference_id || '').toLowerCase();
    const userId = String(t.wallet_id || '').toLowerCase();
    const userName = String(profiles[t.wallet_id]?.full_name || '').toLowerCase();
    const userEmail = String(profiles[t.wallet_id]?.email || '').toLowerCase();

    return (
      concept.includes(term) ||
      refId.includes(term) ||
      userId.includes(term) ||
      userName.includes(term) ||
      userEmail.includes(term)
    );
  });

  const { paginatedItems: paginatedTransactions, paginationProps: txPagination, setCurrentPage: setTxPage } = usePagination(filteredTransactions, 50);
  useEffect(() => { setTxPage(1); }, [searchQuery, setTxPage]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'credit': return { label: 'Crédito', color: 'bg-green-100 text-green-700' };
      case 'debit': return { label: 'Débito', color: 'bg-red-100 text-red-700' };
      default: return { label: type, color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Buscar por concepto, usuario, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button
          onClick={fetchTransactions}
          className="ml-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-semibold"
        >
          🔄 Actualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando operaciones...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No se encontraron operaciones.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-gray-900">Usuario</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Tipo</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Monto</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Producto / Detalles</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Concepto</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Referencia</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Fecha</th>
                    <th className="px-6 py-3 font-semibold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTransactions.map((t) => {
                    const typeInfo = getTypeLabel(t.type);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {profiles[t.wallet_id]?.full_name || `Usuario ${t.wallet_id?.slice(0, 8)}...`}
                          </div>
                          <div className="text-xs text-gray-500">{profiles[t.wallet_id]?.email || 'Sin email'}</div>
                          {t.wallet_id && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mt-0.5">
                              ID: <span className="break-all">{t.wallet_id}</span>
                              <CopyButton text={t.wallet_id} size="sm" className="text-gray-400 hover:text-brand-emerald" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-gray-900">
                          ${Number(t.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          {t.product_title ? (
                            <div className="flex flex-col gap-1 max-w-[200px]">
                              <Link
                                href={`/listings/${t.product_slug || t.product_id}`}
                                target="_blank"
                                className="text-xs font-medium text-brand-emerald hover:underline truncate"
                                title={t.product_title}
                              >
                                {t.product_title}
                              </Link>
                              <div className="flex flex-wrap gap-1">
                                {t.is_auction && (
                                  <span className="inline-flex items-center rounded-sm bg-pink-50 px-1 py-0.5 text-[10px] font-medium text-pink-700 ring-1 ring-inset ring-pink-600/20">
                                    Subasta
                                  </span>
                                )}
                                {Number(t.shipping_fee) > 0 && (
                                  <span className="inline-flex items-center rounded-sm bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                                    Envío: ${Number(t.shipping_fee)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                          {t.concept || '—'}
                        </td>
                        <td className="px-6 py-4">
                          {t.reference_id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 font-mono break-all">{t.reference_id}</span>
                              <CopyButton text={t.reference_id} size="sm" className="text-gray-400 hover:text-brand-emerald" />
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(t.created_at).toLocaleDateString('es-MX')} <span className="text-xs">{new Date(t.created_at).toLocaleTimeString('es-MX')}</span>
                        </td>
                        <td className="px-6 py-4">
                          <RevertButton tx={t} onDone={fetchTransactions} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...txPagination} />
          </>
        )}
      </div>
    </div>
  );
}

function RevertButton({ tx, onDone }: { tx: any; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const isReversal = tx.reference_type === 'manual_adjustment' && String(tx.reference_id || '').startsWith('reversal:');

  const onClick = async () => {
    if (isReversal) return;
    const reason = prompt('Motivo del reverso (opcional, máx. 140 caracteres):') || '';
    if (!confirm(`¿Revertir esta transacción ${tx.type} por $${Number(tx.amount).toFixed(2)}?`)) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/wallet/transactions/revert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ transactionId: tx.id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al revertir');
      alert('Transacción revertida correctamente');
      onDone();
    } catch (e: any) {
      alert(e.message || 'Error al revertir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || isReversal}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${isReversal
        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
        : 'bg-red-600 text-white hover:bg-red-500'
        }`}
      title={isReversal ? 'Esta transacción ya es un reverso' : 'Crear un asiento inverso'}
    >
      {loading ? 'Revirtiendo...' : isReversal ? 'Reverso' : 'Revertir'}
    </button>
  );
}
