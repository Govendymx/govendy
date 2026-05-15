'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAdminContext } from '@/lib/admin/AdminContext';
import { CopyButton } from '@/components/ui/CopyButton';

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatListTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString('es-MX', sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: '2-digit' });
}

function AdminDisputasContent() {
  const { orders, payments, refreshDisputes, refreshOrders, refreshPayments } = useAdminContext();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<'all' | 'open' | 'resolved' | 'closed'>((searchParams.get('status') as any) || 'open');
  
  useEffect(() => {
    const s = searchParams.get('status');
    if (s && ['all', 'open', 'resolved', 'closed'].includes(s)) {
      setStatus(s as any);
    }
  }, [searchParams]);

  const [searchTerm, setSearchTerm] = useState(''); // Estado para búsqueda
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  // Filtrado cliente-side por término de búsqueda
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase().trim();
    return rows.filter((r) => {
      const id = String(r?.id || '').toLowerCase();
      const orderId = String(r?.order_id || '').toLowerCase();
      const snippet = String(r?.last_message?.body || '').toLowerCase();
      
      // Buscar en ID, Order ID, Snippet de mensaje
      return (
        id.includes(term) ||
        orderId.includes(term) ||
        snippet.includes(term)
      );
    });
  }, [rows, searchTerm]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const boot = async () => {
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/admin/disputas')}`;
          return;
        }
        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
        if (!cancelled) setIsAdmin(Boolean(adminRow));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo validar admin.');
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/admin/disputas')}`;
        return;
      }
      const qs = status === 'all' ? '' : `status=${encodeURIComponent(status)}`;
      const res = await fetch(`/api/admin/disputes/list?limit=200${qs ? `&${qs}` : ''}&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar disputas.');
      setRows((json?.disputes ?? []) as any[]);
      
      // Actualizar contexto compartido
      await refreshDisputes();
      await refreshOrders();
      await refreshPayments();
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar disputas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (!isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAdmin, status]);

  const counts = useMemo(() => {
    const c = { open: 0, resolved: 0, closed: 0 };
    for (const d of rows) {
      const st = String(d?.status || '');
      if (st === 'open') c.open += 1;
      else if (st === 'resolved') c.resolved += 1;
      else if (st === 'closed') c.closed += 1;
    }
    return c;
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header moderno */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-emerald-600 p-8 shadow-xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-white/20 backdrop-blur-sm p-3">
              <span className="text-3xl">⚖️</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Disputas</h1>
              <p className="mt-1 text-sm text-white/90">Chats con evidencia: comprador, vendedor y soporte.</p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent"></div>
      </div>

      {/* Contenido principal */}
      <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6">
        {error ? (
          <div className="mb-6 rounded-xl border-l-4 border-red-500 bg-red-50/80 backdrop-blur-sm px-5 py-4 shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="text-sm font-semibold text-red-900">{error}</div>
            </div>
          </div>
        ) : null}

        {!isAdmin ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 px-8 py-12 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <div className="text-lg font-bold text-gray-900">No autorizado</div>
            <div className="text-sm text-gray-600 mt-1">Se requiere permisos de administrador</div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {([
                  { k: 'open', label: `Abiertas (${counts.open})` },
                  { k: 'resolved', label: `Resueltas (${counts.resolved})` },
                  { k: 'closed', label: `Cerradas (${counts.closed})` },
                  { k: 'all', label: 'Todas' },
                ] as const).map((t) => {
                  const active = status === t.k;
                  return (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => setStatus(t.k)}
                      className={classNames(
                        'rounded-lg px-4 py-2 text-sm font-bold transition-all',
                        active 
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg scale-105' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar ID, orden, mensaje..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 rounded-xl border border-gray-300 px-4 py-2.5 pl-10 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent"></div>
                    <p className="mt-4 text-sm font-semibold text-gray-600">Cargando...</p>
                  </div>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 px-8 py-12 text-center">
                  {searchTerm ? (
                    <>
                      <div className="text-5xl mb-4">🔍</div>
                      <div className="text-lg font-bold text-gray-900 mb-2">No se encontraron resultados</div>
                      <div className="text-sm text-gray-600">
                        No hay disputas que coincidan con "{searchTerm}"
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl mb-4">⚖️</div>
                      <div className="text-lg font-bold text-gray-900">No hay disputas en este filtro</div>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                {filteredRows.map((d) => {
                  const id = String(d?.id || '').trim();
                  const orderId = String(d?.order_id || '').trim();
                  const st = String(d?.status || 'open').trim();
                  const last = d?.last_message;
                  const snippet = String(last?.body || '').trim().slice(0, 120) || '—';
                  return (
                    <div key={id} className="block hover:bg-emerald-50/30">
                      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                              <Link
                                href={`/admin/operations?orderId=${orderId}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Orden: {orderId.slice(0, 8)}…
                              </Link>
                              <CopyButton text={orderId} size="sm" iconSize={12} className="text-gray-400 hover:text-brand-emerald" />
                            </div>
                            {(() => {
                              const relatedOrder = orders.find(o => o.id === orderId);
                              const relatedPayment = payments.find(p => p.order_ids?.includes(orderId));
                              return (
                                <>
                                  {relatedPayment && (
                                    <Link
                                      href={`/admin/operations?paymentId=${relatedPayment.id}`}
                                      className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-200"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      💰 Pago
                                    </Link>
                                  )}
                                  {relatedOrder && (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                      📦 {relatedOrder.status}
                                    </span>
                                  )}
                                  {(d?.seller_id || relatedOrder?.seller_id) && (
                                     <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                        Seller: {(d?.seller_id || relatedOrder?.seller_id).slice(0, 6)}...
                                        <CopyButton text={d?.seller_id || relatedOrder?.seller_id} size="sm" iconSize={10} />
                                     </span>
                                  )}
                                </>
                              );
                            })()}
                            <span
                              className={classNames(
                                'rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                                st === 'open' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-green-50 text-green-900 ring-green-200',
                              )}
                            >
                              {st}
                            </span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm text-gray-700">{snippet}</div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <Link
                            href={`/admin/operations?disputeId=${id}`}
                            className="rounded-md bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-800 shadow-sm ring-1 ring-purple-200 hover:bg-purple-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver completo
                          </Link>
                            <Link
                              href={`/admin/disputas/${id}`}
                              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:from-red-600 hover:to-rose-700 transition-all"
                            >
                              <span>👁️</span>
                              Ver detalles
                            </Link>
                            <span className="shrink-0 text-xs font-semibold text-gray-500">
                              {formatListTime(String(d?.last_message_at || d?.created_at || ''))}
                            </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminDisputasPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando disputas...</div>}>
      <AdminDisputasContent />
    </Suspense>
  );
}
