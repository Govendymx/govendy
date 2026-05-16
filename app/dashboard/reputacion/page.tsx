'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ReputationThermometer } from '@/components/reputation/ReputationThermometer';
import { ReviewsList, type PublicReview } from '@/components/reputation/ReviewsList';
import { useImpersonation } from '@/components/ImpersonationProvider';

type RepBlock = {
  avg_stars: number | null;
  count: number;
  percent: number;
  badge: string | null;
};

type RepResponse = {
  ok: boolean;
  id: string;
  name: string;
  seller: RepBlock;
  buyer: RepBlock;
  overall: RepBlock;
  reviews?: {
    seller?: PublicReview[];
    buyer?: PublicReview[];
  };
  note?: string;
};

function badgeLabel(badge: string | null | undefined) {
  if (badge === 'platinum') return 'Platinum';
  if (badge === 'gold') return 'Gold';
  if (badge === 'plata') return 'Plata';
  return '—';
}

function clampPct(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function DashboardReputacionPage() {
  const { isImpersonating, targetUserId } = useImpersonation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rep, setRep] = useState<RepResponse | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRep(null);
    setIsLoading(true);
    let hasRep = false;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const headers: HeadersInit = { authorization: `Bearer ${token}` };
      const opts: RequestInit = { cache: 'no-store', headers };

      // ── IMPERSONATION: skip /api/me/profile, use targetUserId directly ──
      let resolvedId: string | null = null;
      if (isImpersonating && targetUserId) {
        resolvedId = targetUserId;
      } else {
        const meRes = await fetch('/api/me/profile', opts);
        const meJson = (await meRes.json().catch(() => ({}))) as { ok?: boolean; userId?: string; error?: string };
        resolvedId = meRes.ok && meJson?.ok && meJson?.userId ? meJson.userId : null;
      }

      if (!resolvedId) {
        setError('No se pudo cargar la reputación.');
        setIsLoading(false);
        return;
      }

      const base = `/api/reputation/${encodeURIComponent(resolvedId)}`;

      // 1) Primero minimal=1 para mostrar algo ya
      try {
        const minimalRes = await fetch(`${base}?minimal=1`, opts);
        const minimalJson = (await minimalRes.json().catch(() => ({}))) as Partial<RepResponse> & { error?: string };
        if (minimalRes.ok && minimalJson?.ok === true && minimalJson?.id) {
          setRep(minimalJson as RepResponse);
          hasRep = true;
        }
      } catch (_) {
        /* seguir a full */
      }
      setIsLoading(false);

      // 2) Datos completos y actualizar si hay
      try {
        const fullRes = await fetch(base, opts);
        const fullJson = (await fullRes.json().catch(() => ({}))) as Partial<RepResponse> & { error?: string };
        if (fullRes.ok && fullJson?.ok === true && fullJson?.id) {
          setRep(fullJson as RepResponse);
          hasRep = true;
        }
      } catch (_) {
        /* ya mostramos minimal si hubo */
      }

      if (!hasRep) setError('No se pudo cargar tu reputación.');
    } catch (e: unknown) {
      console.error(e);
      if (!hasRep) setError(e instanceof Error ? e.message : 'No se pudo cargar tu reputación.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    if (!rep) return [];
    return [
      { key: 'overall', title: 'General', block: rep.overall },
      { key: 'seller', title: 'Como vendedor', block: rep.seller },
      { key: 'buyer', title: 'Como comprador', block: rep.buyer },
    ] as const;
  }, [rep]);

  const sellerReviews = useMemo(() => ((rep as any)?.reviews?.seller ?? []) as PublicReview[], [rep]);
  const buyerReviews = useMemo(() => ((rep as any)?.reviews?.buyer ?? []) as PublicReview[], [rep]);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Reputación</div>
              <div className="text-xs text-gray-500">Tu termómetro y estadísticas</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={isLoading}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
            >
              {isLoading ? 'Cargando…' : 'Actualizar'}
            </button>
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-3 rounded-lg bg-brand-emerald px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Tu reputación</div>
              <div className="mt-1 text-sm text-gray-600">Diseño más claro: verás tu posición exacta en la escala.</div>
            </div>
            {rep?.name ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {rep.name} <span className="text-xs font-normal text-gray-500">({rep.id?.slice(0, 8)}…)</span>
                </span>
                {typeof (rep as any)?.operations_count === 'number' && (rep as any).operations_count >= 0 && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {(rep as any).operations_count} {(rep as any).operations_count === 1 ? 'operación' : 'operaciones'} en el sitio
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : rep ? (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {cards.map(({ key, title, block }) => {
                  const pct = clampPct(block?.percent);
                  const badge = badgeLabel(block?.badge);
                  const count = Number(block?.count ?? 0) || 0;
                  const avg = block?.avg_stars === null || block?.avg_stars === undefined ? null : Number(block.avg_stars);
                  const subtitle = `Insignia: ${badge} · Promedio: ${avg === null || Number.isNaN(avg) ? '—' : `${avg.toFixed(2)}/10`} · Calificaciones: ${count}`;
                  return <ReputationThermometer key={key} percent={pct} label={title} subtitle={subtitle} />;
                })}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ReviewsList
                  title="Comentarios como vendedor"
                  subtitle="Lo que opinan los compradores sobre ti."
                  reviews={sellerReviews}
                  tone="pink"
                />
                <ReviewsList
                  title="Comentarios como comprador"
                  subtitle="Lo que opinan los vendedores sobre ti."
                  reviews={buyerReviews}
                  tone="neutral"
                />
              </div>
            </>
          ) : (
            <div className="mt-6 text-sm text-gray-600">No se pudo cargar la reputación.</div>
          )}

          <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-emerald-100">
            - Como comprador: confirma “Ya recibí el artículo” en <span className="font-semibold">Dashboard → Compras</span> para liberar pago y calificar.<br />
            - Como vendedor: cuando el comprador confirme, podrás calificar en <span className="font-semibold">Dashboard → Ventas</span>.
          </div>

          {rep?.note ? <div className="mt-3 text-[11px] text-gray-500">Nota: {rep.note}</div> : null}
        </div>
      </main>
    </div>
  );
}

