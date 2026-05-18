'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAdminContext } from '@/lib/admin/AdminContext';
import { CopyButton } from '@/components/ui/CopyButton';
import { Pagination, usePagination } from '@/components/ui/Pagination';

export default function AdminRetirosPage() {
  const { orders } = useAdminContext(); // Para contexto si hiciera falta, aunque cargamos retiros aparte
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredWithdrawals = useMemo(() => {
    if (!searchTerm.trim()) return withdrawals;
    const term = searchTerm.toLowerCase();
    return withdrawals.filter((w) => {
      const sellerName = (w.seller?.full_name || '').toLowerCase();
      const sellerEmail = (w.seller?.email || '').toLowerCase();
      const id = w.id.toLowerCase();
      return sellerName.includes(term) || sellerEmail.includes(term) || id.includes(term);
    });
  }, [withdrawals, searchTerm]);

  const { paginatedItems: paginatedWithdrawals, paginationProps, setCurrentPage } = usePagination(filteredWithdrawals, 50);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, setCurrentPage]);

  const loadWithdrawals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/withdrawals/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar retiros');

      setWithdrawals(json.withdrawals || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const handleApprove = async (withdrawalId: string) => {
    if (!confirm('¿Confirmas que ya realizaste la transferencia manual? Esta acción marcará el retiro como completado.')) return;

    setProcessingId(withdrawalId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión');

      const res = await fetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ withdrawalId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al aprobar retiro');

      // Recargar lista
      await loadWithdrawals();
      alert('Retiro marcado como pagado exitosamente.');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-MX');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="mb-4 px-4 sm:px-6 lg:px-8 pt-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900">
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Retiros Manuales</h1>
            <p className="mt-1 text-sm text-gray-500">Administra las solicitudes de transferencia de los vendedores.</p>
          </div>
          <button
            onClick={loadWithdrawals}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                {error.toLowerCase().includes('seller_withdrawals') || error.toLowerCase().includes('schema cache') ? (
                  <>
                    <div className="font-bold text-amber-900 text-sm">Tabla de retiros pendiente de crear</div>
                    <p className="mt-1 text-sm text-amber-800">
                      La tabla <code className="bg-amber-100 px-1 rounded font-mono text-xs">seller_withdrawals</code> aún no existe en la base de datos.
                    </p>
                    <p className="mt-2 text-sm text-amber-700">
                      👉 Ejecuta el script <code className="bg-amber-100 px-1 rounded font-mono text-xs">scripts/create_missing_admin_tables.sql</code> en el SQL Editor de Supabase para activar esta sección.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="font-bold text-red-900 text-sm">Error al cargar retiros</div>
                    <div className="mt-1 text-sm text-red-800">{error}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-emerald"></div>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl bg-white text-center shadow-sm ring-1 ring-black/5">
            {searchTerm ? (
              <>
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-gray-900 font-medium">No se encontraron resultados</p>
                <p className="text-sm text-gray-500 mt-1">Intenta con otro término de búsqueda</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-sm text-brand-emerald hover:underline"
                >
                  Limpiar búsqueda
                </button>
              </>
            ) : (
              <p className="text-gray-500">No hay solicitudes de retiro.</p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Vendedor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Monto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Detalles de Cuenta</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(w.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{w.seller?.full_name || 'Desconocido'}</div>
                        <div className="flex items-center gap-1 text-gray-500">
                          {w.seller?.email}
                          <CopyButton text={w.seller?.email || ''} size="sm" className="text-gray-400 hover:text-brand-emerald" />
                        </div>
                        {w.seller_id && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            Seller ID: {w.seller_id.slice(0, 8)}...
                            <CopyButton text={w.seller_id} size="sm" iconSize={12} className="text-gray-400 hover:text-brand-emerald" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          Retiro ID: {w.id.slice(0, 8)}...
                          <CopyButton text={w.id} size="sm" iconSize={12} className="text-gray-400 hover:text-brand-emerald" />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                        {formatMoney(w.amount_cents)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${w.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : w.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {w.status === 'completed' ? 'Pagado' : w.status === 'pending' ? 'Pendiente' : 'Fallido'}
                        </span>
                      </td>
                      <td className="max-w-xs px-6 py-4 text-sm text-gray-500">
                        <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs font-mono text-gray-700 ring-1 ring-gray-200">
                          {w.account_details || 'Sin detalles (Usar MP default)'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        {w.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(w.id)}
                            disabled={processingId === w.id}
                            className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            {processingId === w.id ? 'Procesando...' : 'Marcar Pagado'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...paginationProps} />
          </div>
        )}
      </div>
    </div>
  );
}
