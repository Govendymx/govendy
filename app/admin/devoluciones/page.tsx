'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

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

function formatMoney(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

const ITEMS_PER_PAGE = 12;

function AdminDevolucionesContent() {
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const urlStatus = (searchParams.get('status') || 'open') as 'all' | 'open' | 'resolved' | 'closed';
  const urlQuery = searchParams.get('q') || '';
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<'all' | 'open' | 'resolved' | 'closed'>(urlStatus);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>(urlQuery);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const boot = async () => {
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/admin/devoluciones')}`;
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
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/admin/devoluciones')}`;
        return;
      }
      const qs = status === 'all' ? '' : `status=${encodeURIComponent(status)}`;
      const res = await fetch(`/api/admin/disputes/list?limit=200${qs ? `&${qs}` : ''}&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar devoluciones.');
      setRows((json?.disputes ?? []) as any[]);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar devoluciones.');
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

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((d) => {
      const orderId = String(d?.order_id || '').trim().toLowerCase();
      const disputeId = String(d?.id || '').trim().toLowerCase();
      const reasonText = String(d?.reason_text || '').trim().toLowerCase();
      return orderId.includes(query) || disputeId.includes(query) || reasonText.includes(query);
    });
  }, [rows, searchQuery]);

  // Calcular items de la página actual
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage]);

  // Calcular total de páginas
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  }, [filteredRows.length]);

  const reasonLabels: Record<string, string> = {
    not_received: 'No recibido',
    damaged: 'Dañado',
    not_as_described: 'No coincide',
    missing_items: 'Faltan artículos',
    other: 'Otro',
  };

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-gray-900">Admin · Gestión de Devoluciones</div>
          <div className="mt-1 text-sm text-gray-600">Gestiona todas las devoluciones y disputas de compradores.</div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
          disabled={!isAdmin || loading}
        >
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {!isAdmin ? (
        <div className="mt-5 rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          No autorizado (admin requerido).
        </div>
      ) : (
        <>
          {/* Buscador */}
          <div className="mt-5">
            <div className="relative">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por ID de orden, ID de disputa o motivo..."
                className="w-full rounded-xl border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Limpiar búsqueda"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
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
                    'rounded-full px-4 py-2 text-sm font-semibold ring-1',
                    active ? 'bg-brand-emerald text-white ring-brand-emerald' : 'bg-white text-gray-900 ring-black/10 hover:bg-gray-50',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white">
            {loading ? (
              <div className="p-4 text-sm text-gray-600">Cargando…</div>
            ) : paginatedRows.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">
                {searchQuery ? 'No se encontraron devoluciones con ese criterio.' : 'No hay devoluciones en este filtro.'}
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedRows.map((d) => {
                  const id = String(d?.id || '').trim();
                  const orderId = String(d?.order_id || '').trim();
                  const st = String(d?.status || 'open').trim();
                  const reasonCode = String(d?.reason_code || 'other').trim();
                  const last = d?.last_message;
                  const snippet = String(last?.body || '').trim().slice(0, 120) || '—';
                  const decision = String(d?.admin_decision || '').trim() || null;
                  return (
                    <Link
                      key={id}
                      href={`/admin/disputas/${id}`}
                      className="block overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                            Orden: {orderId.slice(0, 8)}…
                          </span>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {reasonLabels[reasonCode] || reasonCode}
                          </span>
                          <span
                            className={classNames(
                              'rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                              st === 'open'
                                ? 'bg-amber-50 text-amber-900 ring-amber-200'
                                : st === 'resolved'
                                  ? 'bg-green-50 text-green-900 ring-green-200'
                                  : 'bg-gray-50 text-gray-700 ring-gray-200',
                            )}
                          >
                            {st === 'open' ? 'Abierta' : st === 'resolved' ? 'Resuelta' : 'Cerrada'}
                          </span>
                          {decision && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                              {decision === 'release' ? 'Pago liberado' : decision === 'refund' ? 'Reembolso' : decision}
                            </span>
                          )}
                        </div>
                        <div className="line-clamp-2 text-sm text-gray-700">{snippet}</div>
                        {d?.reason_text && (
                          <div className="text-xs text-gray-500 line-clamp-1">
                            Motivo: {String(d.reason_text).slice(0, 100)}
                            {String(d.reason_text).length > 100 ? '…' : ''}
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                          <div className="text-xs font-semibold text-gray-500">{formatListTime(String(d?.last_message_at || d?.created_at || ''))}</div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            ID: {id.slice(0, 8)}…
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(id, id);
                              }}
                              className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                              title="Copiar ID de disputa"
                            >
                              {copiedId === id ? '✅' : '📋'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {/* Botón Anterior */}
              {currentPage > 1 && (
                <Link
                  href={`/admin/devoluciones?page=${currentPage - 1}${status !== 'all' ? `&status=${status}` : ''}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                >
                  Anterior
                </Link>
              )}

              {/* Números de página */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <Link
                      key={page}
                      href={`/admin/devoluciones?page=${page}${status !== 'all' ? `&status=${status}` : ''}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`}
                      className={classNames(
                        'rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ring-1',
                        page === currentPage
                          ? 'bg-brand-emerald text-white ring-brand-emerald'
                          : 'bg-white text-gray-900 ring-black/5 hover:bg-gray-50',
                      )}
                    >
                      {page}
                    </Link>
                  );
                }
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2 text-sm text-gray-400">
                      …
                    </span>
                  );
                }
                return null;
              })}

              {/* Botón Siguiente */}
              {currentPage < totalPages && (
                <Link
                  href={`/admin/devoluciones?page=${currentPage + 1}${status !== 'all' ? `&status=${status}` : ''}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                >
                  Siguiente
                </Link>
              )}
            </div>
          )}

          {filteredRows.length > 0 && (
            <div className="mt-4 text-center text-xs text-gray-500">
              Mostrando {paginatedRows.length} de {filteredRows.length} devoluciones (página {currentPage} de {totalPages})
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminDevolucionesPage() {
  return (
    <Suspense fallback={<div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">Cargando…</div>}>
      <AdminDevolucionesContent />
    </Suspense>
  );
}
