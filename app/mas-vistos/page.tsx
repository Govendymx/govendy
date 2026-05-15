'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { DynamicFeaturedCarousel } from '@/components/listings/DynamicFeaturedCarousel';
import { ListingCard } from '@/components/listings/ListingCard';

type Row = {
  id: string;
  title: string;
  description?: string | null;
  price: number | string;
  images: string[] | null;
  public_id?: string | null;
  view_count?: number | null;
  share_count?: number | null;
  seller_id: string;
};

export default function MasVistosPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsBooting(true);
        setError(null);

        let res: any = await supabase
          .from('listings')
          .select('id,title,description,price,images,public_id,view_count,share_count,seller_id')
          .eq('status', 'active')
          .order('view_count', { ascending: false })
          .order('share_count', { ascending: false })
          .limit(80);

        if (res?.error) {
          const code = String(res.error?.code || '');
          const msg = String(res.error?.message || '');
          if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
            // fallback si falta el esquema nuevo
            res = await supabase
              .from('listings')
              .select('id,title,description,price,images,public_id,seller_id')
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(80);
          } else {
            throw res.error;
          }
        }

        if (!cancelled) setRows((res.data as Row[]) ?? []);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar los más vistos.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => rows ?? [], [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </Link>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Más vistos</div>
              <div className="text-xs text-gray-500">Ordenados por vistas y compartidos</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Carrusel de más vistos destacados */}
        <section className="mb-8">
          <DynamicFeaturedCarousel type="most_viewed" title="Destacados Más Vistos" rotateInterval={5000} />
        </section>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">Selección: Más vistos</div>
              <div className="mt-1 text-sm text-gray-600">Los artículos con mayor interacción de la comunidad.</div>
            </div>
            <Link href="/listings" className="text-sm font-semibold text-brand-emerald hover:opacity-90">
              Explorar todo
            </Link>
          </div>

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no hay publicaciones.</div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p, idx) => (
                <ListingCard
                  key={p.id}
                  p={p as any}
                  size="fluid"
                  showDescription={true}
                  badge={
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-extrabold text-white shadow">
                      #{idx + 1}
                    </span>
                  }
                  meta={
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {typeof p.view_count === 'number' ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold">Vistas: {p.view_count}</span>
                      ) : null}
                      {typeof p.share_count === 'number' ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold">Compartidos: {p.share_count}</span>
                      ) : null}
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

