'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { DynamicFeaturedCarousel } from '@/components/listings/DynamicFeaturedCarousel';
import { ListingCard, type ListingPreview } from '@/components/listings/ListingCard';

type Row = {
  id: string;
  title: string;
  description?: string | null;
  price: number | string;
  images: string[] | null;
  public_id?: string | null;
  seller_id: string;
  auction_end_at?: string | null;
  auction_highest_bid?: number | string | null;
  auction_starting_bid?: number | string | null;
};

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function money(v: any) {
  return toNumber(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
function formatTimeLeft(endAt: string | null | undefined) {
  if (!endAt) return '—';
  const end = Date.parse(endAt);
  if (!Number.isFinite(end)) return '—';
  const diff = end - Date.now();
  if (diff <= 0) return 'Subasta finalizada';
  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / (60 * 24));
  const hours = Math.floor((totalMins - days * 60 * 24) / 60);
  const mins = totalMins - days * 60 * 24 - hours * 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}

export default function SubastasPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsBooting(true);
        setError(null);
        const nowIso = new Date().toISOString();

        // console.log('[SUBASTAS] Cargando subastas activas...', { nowIso });

        // Consulta para obtener todas las subastas activas de todos los usuarios
        let res: any = await supabase
          .from('listings')
          .select('id,title,description,price,images,public_id,sale_type,seller_id,auction_end_at,auction_highest_bid,auction_starting_bid,stock')
          .eq('status', 'active')
          .eq('sale_type', 'auction')
          .gt('auction_end_at', nowIso)
          .order('auction_end_at', { ascending: true })
          .limit(200); // Aumentar límite para mostrar más subastas

        // console.log('[SUBASTAS] Resultado de la consulta:', {
        //   hasError: !!res?.error,
        //   errorCode: res?.error ? String((res.error as any)?.code || '') : null,
        //   errorMessage: res?.error ? String((res.error as any)?.message || '') : null,
        //   dataCount: Array.isArray(res?.data) ? res.data.length : 0,
        // });

        if (res?.error) {
          const code = String(res.error?.code || '');
          const msg = String(res.error?.message || '').toLowerCase();
          // console.error('[SUBASTAS] Error al cargar subastas:', { code, msg, error: res.error });

          if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
            throw new Error('Tu BD aún no tiene columnas de subasta. Ejecuta las migraciones de subastas y recarga.');
          }
          if (code === '42501' || msg.includes('permission') || msg.includes('policy')) {
            throw new Error('Error de permisos. Verifica las políticas RLS en Supabase para permitir lectura pública de listings activos.');
          }
          throw new Error(`Error al cargar subastas: ${res.error.message || msg || code}`);
        }

        const data = (res.data as Row[]) ?? [];
        // console.log('[SUBASTAS] Subastas cargadas:', data.length);

        if (!cancelled) {
          setRows(data);
          if (data.length === 0) {
            // console.log('[SUBASTAS] No se encontraron subastas activas. Verificando posibles causas...');
          }
        }
      } catch (e: unknown) {
        // console.error('[SUBASTAS] Error:', e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar las subastas.');
        }
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void load();

    // Recargar cada 30 segundos para mostrar subastas nuevas
    const interval = setInterval(() => {
      if (!cancelled) {
        void load();
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Redundant settle trigger: if any expired auctions somehow appear, trigger settle
  const settledIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isBooting || rows.length === 0) return;
    const now = Date.now();
    for (const r of rows) {
      if (!r.auction_end_at) continue;
      const endMs = Date.parse(r.auction_end_at);
      if (Number.isFinite(endMs) && now >= endMs && !settledIdsRef.current.has(r.id)) {
        settledIdsRef.current.add(r.id);
        fetch('/api/auctions/settle-one', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: r.id }),
          keepalive: true,
        }).catch(() => { });
      }
    }
  }, [rows, isBooting]);

  const items = useMemo(() => rows ?? [], [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </Link>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Subastas</div>
              <div className="text-xs text-gray-500">Ordenadas por la hora en que terminan</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      {/* Carrusel de subastas destacadas */}
      <section className="mx-auto max-w-6xl px-4 pt-8">
        <DynamicFeaturedCarousel type="auction" title="Subastas Destacadas" rotateInterval={4500} />
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">Selección: Subastas</div>
              <div className="mt-1 text-sm text-gray-600">Ve primero las que acaban antes.</div>
            </div>
            <Link href="/listings" className="text-sm font-semibold text-brand-emerald hover:opacity-90">
              Explorar todo
            </Link>
          </div>

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no hay subastas activas.</div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <ListingCard
                  key={p.id}
                  p={p as any}
                  size="fluid"
                  showDescription={true}
                  badge={
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-extrabold text-white shadow">
                      Subasta
                    </span>
                  }
                  mediaOverlay={
                    p.auction_end_at ? (
                      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full bg-brand-emerald/95 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTimeLeft(p.auction_end_at)}</span>
                      </div>
                    ) : null
                  }
                  meta={
                    p.public_id ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        ID: {p.public_id}
                      </span>
                    ) : null
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

