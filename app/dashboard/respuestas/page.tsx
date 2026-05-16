'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageTour } from '@/components/PageTour';
import { pageTours } from '@/lib/tours/config';

type ResponseItem = {
  id: string;
  type: 'answer_received';
  question_id: string;
  listing_id: string;
  seller_id: string;
  asker_id: string;
  question_text: string;
  answer_text: string | null;
  created_at: string;
  answered_at: string | null;
  is_answered: boolean;
  listing?: {
    id: string;
    title: string;
    public_id?: string | null;
    images?: string[];
    price?: number | null;
  } | null;
};

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = d.toLocaleString('es-MX', { month: 'short' });
  const year = d.getFullYear();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
  const hour12 = hour % 12 || 12;
  const minStr = minute.toString().padStart(2, '0');
  return `${day} ${month} ${year}, ${hour12}:${minStr} ${ampm}`;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
}

function listingThumbnail(listing: ResponseItem['listing']): string | null {
  const imgs = listing?.images;
  if (Array.isArray(imgs) && imgs.length > 0 && typeof imgs[0] === 'string') return imgs[0];
  if (typeof imgs === 'string') return imgs;
  return null;
}

export default function DashboardRespuestasPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!userData.user) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/dashboard/respuestas')}`;
        return;
      }

      setUserId(userData.user.id);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/dashboard/respuestas')}`;
        return;
      }

      const res = await fetch(`/api/responses/list?t=${Date.now()}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar las respuestas.');

      const responsesList = (json?.responses || []) as ResponseItem[];
      setResponses(responsesList);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Error al cargar respuestas.');
    } finally {
      setIsBooting(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const deleteResponse = async (questionId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!userId) return;

    const idsToRemove = new Set<string>([questionId]);

    try {
      setIsDeleting(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        alert('Sesión expirada. Recarga la página.');
        return;
      }

      const res = await fetch(`/api/responses/delete?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ questionId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || 'Error al eliminar respuesta.');
      }
      const ok = json?.ok === true && (json?.deleted === true || json?.alreadyDeleted === true);
      if (!ok) {
        throw new Error(json?.error || 'La respuesta no se eliminó correctamente.');
      }

      setResponses((prev) => prev.filter((r) => !idsToRemove.has(r.question_id)));
      await load();
    } catch (err: unknown) {
      console.error('Error al eliminar respuesta:', err);
      alert(err instanceof Error ? err.message : 'Error al eliminar respuesta.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
        <PageTour steps={pageTours.respuestas || []} pageId="respuestas" />
          <div className="text-center text-gray-600">Cargando respuestas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-purple-50/30 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Respuestas</div>
              <div className="text-xs text-gray-500">
                {responses.length > 0 ? `${responses.length} respuesta(s)` : 'Sin respuestas'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {responses.length === 0 ? (
          <div className="rounded-2xl border border-black/5 bg-white p-8 text-center">
            <div className="text-gray-600">Aún no tienes respuestas.</div>
            <div className="mt-2 text-sm text-gray-500">
              Cuando hagas preguntas en publicaciones de otros y te respondan, aparecerán aquí.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-xl font-extrabold text-gray-900">Respuestas recibidas ({responses.length})</h2>
            </div>
            
            {/* Agrupar respuestas por publicación */}
            <div data-tour="responses-list">
            {(() => {
              // Agrupar por listing_id
              const groupedByListing: Record<string, ResponseItem[]> = {};
              responses.forEach((r) => {
                const listingId = r.listing_id || 'sin-publicacion';
                if (!groupedByListing[listingId]) {
                  groupedByListing[listingId] = [];
                }
                groupedByListing[listingId].push(r);
              });

              // Ordenar grupos por la fecha más reciente de respuesta
              const sortedGroups = Object.entries(groupedByListing).sort((a, b) => {
                const latestA = Math.max(...a[1].map(r => new Date(r.answered_at || r.created_at || 0).getTime()));
                const latestB = Math.max(...b[1].map(r => new Date(r.answered_at || r.created_at || 0).getTime()));
                return latestB - latestA;
              });

              return sortedGroups.map(([listingId, groupResponses]) => {
                const firstResponse = groupResponses[0];
                const listingTitle = firstResponse.listing?.title || 'Publicación';
                const thumb = listingThumbnail(firstResponse.listing);
                const price = firstResponse.listing?.price;
                const listingUrl = listingId !== 'sin-publicacion' ? `/listings/${listingId}` : '#';
                const questionCount = groupResponses.length;

                return (
                  <div key={listingId} className="rounded-3xl border-2 border-brand-emerald/20 bg-white shadow-sm ring-1 ring-black/5">
                    {/* Encabezado del grupo: Información de la publicación */}
                    <div className="border-b border-gray-100 bg-gradient-to-r from-brand-emerald/5 to-purple-50/30 px-6 py-4">
                      <div className="flex items-center gap-4">
                        {/* Imagen del producto */}
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                          {thumb ? (
                            <img src={thumb} alt={listingTitle} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-400">
                              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Información de la publicación */}
                        <div className="min-w-0 flex-1">
                          <Link 
                            href={listingUrl} 
                            className="text-lg font-extrabold uppercase text-gray-900 hover:text-brand-emerald hover:underline"
                          >
                            {listingTitle}
                          </Link>
                          {price != null && (
                            <p className="mt-1 text-lg font-extrabold text-brand-emerald">{formatPrice(price)}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-emerald/10 px-3 py-1 text-xs font-semibold text-brand-emerald">
                              <span className="inline-flex h-2 w-2 rounded-full bg-white0" />
                              {questionCount} {questionCount === 1 ? 'pregunta respondida' : 'preguntas respondidas'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lista de preguntas y respuestas de esta publicación */}
                    <div className="divide-y divide-gray-100">
                      {groupResponses
                        .sort((a, b) => {
                          // Ordenar por fecha de respuesta (más reciente primero)
                          const dateA = new Date(a.answered_at || a.created_at || 0).getTime();
                          const dateB = new Date(b.answered_at || b.created_at || 0).getTime();
                          return dateB - dateA;
                        })
                        .map((r) => (
                          <div key={r.id} className="group relative bg-white transition hover:bg-gray-50/50">
                            <div className="flex gap-4 p-5">
                              {/* Sección izquierda: Indicador */}
                              <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                                <span className="inline-flex h-2 w-2 rounded-full bg-white0" />
                                <div className="h-full w-px bg-gray-200" />
                              </div>

                              {/* Sección derecha: Conversación */}
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="text-sm font-medium text-gray-900">
                                  <span className="text-xs text-gray-500">Pregunta:</span> &ldquo;{r.question_text}&rdquo;
                                </div>
                                {r.answer_text ? (
                                  <div className="rounded-xl bg-green-100 px-4 py-3 text-sm font-medium text-gray-900">
                                    <span className="font-semibold">Respuesta:</span> {r.answer_text}
                                  </div>
                                ) : null}
                                <div className="text-xs text-gray-500">
                                  Pregunta: {formatDateTime(r.created_at)}
                                  {r.answered_at ? ` • Respuesta: ${formatDateTime(r.answered_at)}` : null}
                                </div>
                              </div>

                              {/* Botón eliminar */}
                              <button
                                type="button"
                                onClick={(ev) => deleteResponse(r.question_id, ev)}
                                disabled={isDeleting}
                                className="absolute right-4 top-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-black/10 transition hover:bg-red-50 hover:text-red-600 hover:ring-red-200 disabled:opacity-50"
                                aria-label="Eliminar"
                                title="Eliminar"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              });
            })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

