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
  free_shipping?: boolean | null;
  seller_id: string;
};

export default function EnvioGratisPage() {
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
          .select('id,title,description,price,images,public_id,free_shipping,seller_id')
          .eq('status', 'active')
          .eq('free_shipping', true)
          .order('created_at', { ascending: false })
          .limit(60);

        if (res?.error) {
          const code = String(res.error?.code || '');
          const msg = String(res.error?.message || '');
          if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
            throw new Error('Tu BD aún no tiene `free_shipping`. Ejecuta `supabase_shipping_features.sql` en Supabase y recarga.');
          }
          throw res.error;
        }

        if (!cancelled) setRows((res.data as Row[]) ?? []);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar Envío gratis.');
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
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </Link>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Envío gratis</div>
              <div className="text-xs text-gray-500">Publicaciones con envío gratis</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Carrusel de destacados */}
        <section className="mb-8">
          <DynamicFeaturedCarousel type="free_shipping" title="Destacados con Envío Gratis" />
        </section>

        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">Selección: Envío gratis</div>
              <div className="mt-1 text-sm text-gray-600">El vendedor absorbe el costo del envío.</div>
            </div>
            <Link href="/listings" className="text-sm font-semibold text-brand-emerald hover:opacity-90">
              Explorar todo
            </Link>
          </div>

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no hay publicaciones con envío gratis.</div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <ListingCard
                  key={p.id}
                  p={p as any}
                  size="fluid"
                  showDescription={true}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


