'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Pagination, usePagination } from '@/components/ui/Pagination';

type Row = {
  id: string;
  public_id?: string | null;
  title: string;
  status: string;
  sale_type?: string | null;
  price?: number | string | null;
  currency?: string | null;
  seller_id?: string | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  attributes?: Record<string, any> | null;
};

function formatMoney(v: number) {
  return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function toNumber(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

type Report = {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  comment?: string;
  status: string;
  created_at: string;
  listing?: {
    id: string;
    public_id: string;
    title: string;
    status: string;
  };
  reporter?: {
    full_name: string;
  };
};

export default function AdminListingsPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'review' | 'reports'>('all');

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  const handleAction = async (listingId: string, action: 'delete' | 'suspend' | 'reactivate' | 'approve') => {
    const actionLabel =
      action === 'delete' ? 'eliminar' :
        action === 'suspend' ? 'suspender' :
          action === 'reactivate' ? 'reactivar' :
            'aprobar';

    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} esta publicación?`)) {
      return;
    }

    setUpdatingId(listingId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/admin/listings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId, action }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al actualizar');

      // Actualizar estado local
      setRows((prev) => {
        // Si estamos en la vista de revisión y la acción es aprobar, quitamos la fila de la vista actual
        if (filter === 'review' && action === 'approve') {
          return prev.filter(r => r.id !== listingId);
        }

        return prev.map((row) => {
          if (row.id !== listingId) return row;

          if (action === 'delete') {
            return { ...row, is_deleted: true, deleted_at: new Date().toISOString(), status: 'blocked' };
          } else if (action === 'suspend') {
            return { ...row, status: 'paused' };
          } else if (action === 'reactivate') {
            return { ...row, status: 'active', is_deleted: false, deleted_at: null };
          } else if (action === 'approve') {
            const newAttrs = { ...(row.attributes || {}) };
            delete newAttrs.moderation_status;
            delete newAttrs.moderation_violations;
            return { ...row, attributes: newAttrs, status: 'active' };
          }
          return row;
        });
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al realizar la acción');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReportAction = async (reportId: string, action: 'delete' | 'suspend' | 'ignore', adminNotes?: string) => {
    if (!confirm(`¿Estás seguro de que deseas realizar esta acción sobre el reporte?`)) return;

    setUpdatingId(reportId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No hay sesión activa');

      const res = await fetch('/api/admin/listings/reports/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportId, action, adminNotes }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al procesar el reporte');

      // Actualizar estado local
      setReports(prev => prev.filter(r => r.id !== reportId));
      alert('Acción realizada con éxito');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al realizar la acción');
    } finally {
      setUpdatingId(null);
    }
  };

  const load = async (needle: string, currentFilter?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      if (currentFilter === 'reports') {
        const res = await fetch('/api/admin/listings/reports', {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar los reportes.');
        setReports((json?.reports ?? []) as Report[]);
      } else {
        const res = await fetch(`/api/admin/listings/search?q=${encodeURIComponent(needle)}&limit=100`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar publicaciones.');
        setRows((json?.rows ?? []) as Row[]);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al cargar datos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          window.location.href = '/';
          return;
        }

        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
        if (!adminRow) {
          if (!cancelled) {
            setIsAdmin(false);
            setError('No tienes permisos de administrador para ver esta página.');
          }
          return;
        }
        if (!cancelled) setIsAdmin(true);
        await load('');
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo iniciar la página.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const { paginatedItems: paginatedRows, paginationProps, setCurrentPage: setListingsPage } = usePagination(rows, 50);
  useEffect(() => { setListingsPage(1); }, [q, filter, setListingsPage]);

  const countLabel = useMemo(() => {
    if (isLoading) return 'Cargando…';
    const from = (paginationProps.currentPage - 1) * 50 + 1;
    const to = Math.min(paginationProps.currentPage * 50, rows.length);
    return `${from}–${to} de ${rows.length} resultados`;
  }, [isLoading, rows.length, paginationProps.currentPage]);

  if (isBooting) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-72 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-bold text-gray-900">Acceso denegado</div>
            {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
            <div className="mt-6">
              <Link href="/dashboard" className="inline-flex rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
                Volver
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Admin · Publicaciones</div>
              <div className="text-xs text-gray-500">Busca por título o por ID (PCK-…)</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Configuración
            </Link>
            <Link href="/admin/banners" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Banners
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="mb-6 flex flex-col gap-4">
          {/* Tabs de Filtro */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
            <button
              onClick={() => {
                setFilter('all');
                load(q, 'all');
              }}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${filter === 'all' ? 'border-b-2 border-brand-emerald text-brand-emerald' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Todas
            </button>
            <button
              onClick={() => {
                setFilter('reports');
                load(q, 'reports');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${filter === 'reports' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <span>🚩 Reportes</span>
              {reports.length > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                  {reports.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-900">
              {filter === 'reports' ? `${reports.length} denuncias pendientes` : countLabel}
            </div>
            <div className={`flex w-full gap-2 sm:max-w-lg ${filter === 'reports' ? 'invisible' : ''}`}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                placeholder="Buscar por título, UUID o PCK-…"
              />
              <button
                type="button"
                onClick={() => load(q.trim(), filter)}
                className="shrink-0 rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            {filter === 'reports' ? (
              <table className="min-w-full divide-y divide-black/5">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Fecha / Denunciante</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Publicación</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Motivo / Comentario</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white">
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-600">
                        No hay denuncias pendientes.
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 text-xs">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-gray-900">{formatDateTime(r.created_at)}</div>
                          <div className="text-gray-500">{r.reporter?.full_name || 'Desconocido'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-blue-600">
                            <Link href={`/listings/${r.listing_id}`} target="_blank" className="hover:underline">
                              {r.listing?.title || 'Publicación eliminada'}
                            </Link>
                          </div>
                          <div className="text-gray-400">{r.listing?.public_id || r.listing_id.slice(0, 8)}</div>
                          <div className="mt-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${r.listing?.status === 'active' ? 'bg-green-50 text-green-700 ring-green-100' :
                              'bg-amber-50 text-amber-700 ring-amber-100'
                              }`}>
                              {r.listing?.status || 'desconocido'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-red-600">{r.reason}</div>
                          {r.comment && <div className="mt-1 italic text-gray-600 max-w-xs break-words">{r.comment}</div>}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleReportAction(r.id, 'ignore')}
                              disabled={updatingId === r.id}
                              className="rounded-lg bg-gray-100 px-2 py-1.5 font-bold text-gray-600 hover:bg-gray-200"
                            >
                              Ignorar
                            </button>
                            <button
                              onClick={() => handleReportAction(r.id, 'suspend')}
                              disabled={updatingId === r.id}
                              className="rounded-lg bg-amber-500 px-2 py-1.5 font-bold text-white hover:bg-amber-600 shadow-sm"
                            >
                              Suspender
                            </button>
                            <button
                              onClick={() => handleReportAction(r.id, 'delete')}
                              disabled={updatingId === r.id}
                              className="rounded-lg bg-red-600 px-2 py-1.5 font-bold text-white hover:bg-red-700 shadow-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-black/5">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Título</th>
                    {filter === 'review' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-600">Razón de Revisión</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Precio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-600">
                        No hay resultados.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-xs font-semibold text-gray-700 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {r.public_id || '—'}
                            {r.public_id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(r.public_id!);
                                  const el = e.currentTarget;
                                  const original = el.innerHTML;
                                  el.innerHTML = '✅';
                                  setTimeout(() => {
                                    el.innerHTML = original;
                                  }, 1000);
                                }}
                                className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                                title="Copiar Public ID"
                              >
                                📋
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            {r.id.slice(0, 8)}…
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(r.id, r.id);
                              }}
                              className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                              title="Copiar UUID"
                            >
                              {copiedId === r.id ? '✅' : '📋'}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={['text-sm font-semibold', r.is_deleted ? 'text-gray-500 line-through' : 'text-gray-900'].join(' ')}>
                              {r.title}
                            </div>
                            {r.is_deleted ? (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-100">
                                Archivada
                              </span>
                            ) : null}
                            {r.attributes?.moderation_status === 'review_needed' && filter !== 'review' && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200" title="Detectado contenido sospechoso">
                                ⚠️ Revisión
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">Seller: {String(r.seller_id || '').slice(0, 8)}…</div>
                        </td>
                        {filter === 'review' && (
                          <td className="px-4 py-4 text-xs text-gray-600 max-w-xs break-words">
                            <div className="rounded-lg bg-red-50 p-2 border border-red-100">
                              {Array.isArray(r.attributes?.moderation_violations) && r.attributes?.moderation_violations.length > 0 ? (
                                <ul className="list-disc list-inside space-y-1">
                                  {r.attributes.moderation_violations.map((v: any, idx: number) => {
                                    const label = typeof v === 'string' ? v : (v?.kind ? `${v.kind}: ${v.match || ''}` : JSON.stringify(v));
                                    return <li key={idx} className="text-red-700 font-medium">{label}</li>;
                                  })}
                                </ul>
                              ) : (
                                <span className="text-gray-500 italic">Posible contacto o contenido sospechoso</span>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-4 text-sm text-gray-700">{r.sale_type === 'auction' ? 'Subasta' : 'Directa'}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900">{formatMoney(toNumber(r.price))}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div>{r.status}</div>
                          {r.is_deleted ? <div className="mt-1 text-xs text-gray-500">Archivada: {formatDateTime(r.deleted_at || null)}</div> : null}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/listings/${r.id}`}
                              target="_blank"
                              className="inline-flex rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                            >
                              Ver
                            </Link>
                            {(r.attributes?.moderation_status === 'review_needed' || r.status === 'blocked' || r.status === 'paused') && (
                              <button
                                onClick={() => handleAction(r.id, 'approve' as any)}
                                disabled={updatingId === r.id}
                                className="inline-flex rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
                                title="Aprobar publicación"
                              >
                                Aprobar
                              </button>
                            )}
                            {updatingId === r.id ? (
                              <span className="inline-flex items-center px-3 py-2 text-sm text-gray-500">...</span>
                            ) : (
                              <>
                                {r.is_deleted ? (
                                  <button
                                    onClick={() => handleAction(r.id, 'reactivate')}
                                    className="inline-flex rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 shadow-sm ring-1 ring-green-200 hover:bg-green-100"
                                    title="Restaurar publicación"
                                  >
                                    Reactivar
                                  </button>
                                ) : (
                                  <>
                                    {r.status === 'active' ? (
                                      <button
                                        onClick={() => handleAction(r.id, 'suspend')}
                                        className="inline-flex rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100"
                                        title="Pausar publicación"
                                      >
                                        Suspender
                                      </button>
                                    ) : r.status === 'paused' ? (
                                      <button
                                        onClick={() => handleAction(r.id, 'reactivate')}
                                        className="inline-flex rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 shadow-sm ring-1 ring-green-200 hover:bg-green-100"
                                        title="Reactivar publicación"
                                      >
                                        Reactivar
                                      </button>
                                    ) : null}

                                    <button
                                      onClick={() => handleAction(r.id, 'delete')}
                                      className="inline-flex rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
                                      title="Archivar publicación"
                                    >
                                      Eliminar
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <Pagination {...paginationProps} />
        </div>
      </main>
    </div>
  );
}


