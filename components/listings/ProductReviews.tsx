'use client';

import { useEffect, useState } from 'react';

interface ProductReviewsProps {
  listingId: string;
  sellerId: string;
}

export function ProductReviews({ listingId, sellerId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadReviews = async (reset = false) => {
    try {
      setIsLoading(true);
      const currentPage = reset ? 1 : page;
      const res = await fetch(`/api/listings/${listingId}/reviews?page=${currentPage}&sort=${sort}&limit=5`);
      const data = await res.json();

      if (!res.ok) {
        // Tabla no existe aún → mostrar sección vacía sin error
        setReviews([]);
        setStats({ average: 0, total: 0, breakdown: {}, features: [] });
        return;
      }

      if (data.reviews !== undefined) {
        if (reset) {
          setReviews(data.reviews);
        } else {
          setReviews(prev => [...prev, ...data.reviews]);
        }
        setHasMore(data.pagination?.page < data.pagination?.pages);
        setStats(data.stats ?? { average: 0, total: 0, breakdown: {}, features: [] });
        if (reset) setPage(1);
      }
    } catch (err) {
      console.error('Error loading reviews:', err);
      setStats({ average: 0, total: 0, breakdown: {}, features: [] });
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    loadReviews(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, sort]);

  useEffect(() => {
    if (page > 1) loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const avg = stats?.average ?? 0;
  const total = stats?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Opiniones del producto</h2>
      </div>

      {isLoading && reviews.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-sm text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
          Cargando opiniones...
        </div>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
          <div className="text-4xl mb-3">⭐</div>
          <p className="font-semibold text-gray-700">Aún no hay opiniones</p>
          <p className="mt-1 text-sm text-gray-500">¡Sé el primero en opinar desde tu panel de compras!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="flex items-center gap-3 mb-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-4xl font-bold text-gray-900">{avg.toFixed(1)}</span>
            <div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <svg key={s} className={`h-5 w-5 ${s <= Math.round(avg) ? 'text-amber-400' : 'text-gray-200'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{total} {total === 1 ? 'opinión' : 'opiniones'}</p>
            </div>
            <div className="ml-auto">
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 py-1.5 pl-3 pr-8 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="recent">Más recientes</option>
                <option value="helpful">Más útiles</option>
                <option value="highest">Mayor calificación</option>
                <option value="lowest">Menor calificación</option>
              </select>
            </div>
          </div>

          {/* Lista de reseñas */}
          {reviews.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <svg key={s} className={`h-4 w-4 ${s <= Math.round(r.rating) ? 'text-amber-400' : 'text-gray-200'}`} viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {r.title && <p className="font-semibold text-gray-900 text-sm">{r.title}</p>}
                  {r.content && <p className="mt-1 text-sm text-gray-700">{r.content}</p>}
                </div>
                {r.is_verified_purchase && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-green-200">
                    ✓ Compra verificada
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <span>{r.user?.full_name || 'Usuario'}</span>
                <span>·</span>
                <span>{new Date(r.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              {Array.isArray(r.images) && r.images.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {r.images.map((img: string, i: number) => (
                    <img key={i} src={img} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10" />
                  ))}
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => setPage(prev => prev + 1)}
                disabled={isLoading}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Cargando...' : 'Mostrar más opiniones'}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
