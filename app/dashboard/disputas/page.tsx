'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useImpersonation } from '@/components/ImpersonationProvider';

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function DashboardDisputasPage() {
  const { isImpersonating, targetUserId, queryAsUser } = useImpersonation();
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  const openCount = useMemo(() => rows.filter((r) => String(r?.status || '') === 'open').length, [rows]);

  const load = async () => {
    setError(null);
    try {
      // ── IMPERSONATION MODE ──
      if (isImpersonating && targetUserId) {
        const resBuyer = await queryAsUser({
          table: 'disputes',
          select: 'id,order_id,status,last_message_at,created_at,last_message',
          filters: { userColumn: 'buyer_id' },
          order: { column: 'last_message_at', ascending: false },
          limit: 120,
        });
        const resSeller = await queryAsUser({
          table: 'disputes',
          select: 'id,order_id,status,last_message_at,created_at,last_message',
          filters: { userColumn: 'seller_id' },
          order: { column: 'last_message_at', ascending: false },
          limit: 120,
        });
        const all = new Map<string, any>();
        for (const r of [...(resBuyer.data ?? []), ...(resSeller.data ?? [])]) {
          if (r?.id) all.set(r.id, r);
        }
        setRows(Array.from(all.values()).sort((a, b) =>
          new Date(b.last_message_at || b.created_at || 0).getTime() -
          new Date(a.last_message_at || a.created_at || 0).getTime()
        ));
        setIsBooting(false);
        return;
      }

      // ── NORMAL MODE ──
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/dashboard/disputas')}`;
        return;
      }
      const res = await fetch(`/api/disputes/list?limit=120&t=${Date.now()}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar las disputas.');
      setRows((json?.disputes ?? []) as any[]);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las disputas.');
    } finally {
      setIsBooting(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating, targetUserId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Disputas</div>
              <div className="text-xs text-gray-500">{openCount > 0 ? `${openCount} abiertas` : 'Al día'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Actualizar
            </button>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">Tus disputas</div>
              <div className="mt-1 text-sm text-gray-600">Chats donde participan comprador, vendedor y soporte.</div>
            </div>
          </div>

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no tienes disputas.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {rows.map((d) => {
                const id = String(d?.id || '').trim();
                const orderId = String(d?.order_id || '').trim();
                const st = String(d?.status || '').trim() || 'open';
                const last = d?.last_message;
                const snippet = String(last?.body || '').trim().slice(0, 110) || '—';
                return (
                  <Link
                    key={id}
                    href={`/dashboard/disputas/${id}`}
                    className="block overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm hover:bg-pink-50/30"
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Orden: {orderId.slice(0, 8)}…</span>
                          <span
                            className={classNames(
                              'rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                              st === 'open' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-green-50 text-green-900 ring-green-200',
                            )}
                          >
                            {st}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">{formatDateTime(String(d?.last_message_at || d?.created_at || ''))}</div>
                      </div>
                      <div className="mt-2 text-sm text-gray-700">{snippet}</div>
                      <div className="mt-3 text-sm font-semibold text-brand-orange">Abrir chat →</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

