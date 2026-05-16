'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { SellerDisplay } from '@/components/SellerDisplay';

function formatMoney(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function formatMoneyDisplay(v: any) {
  return formatMoney(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'open') return { label: 'Abierta', color: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
  if (s === 'resolved') return { label: 'Resuelta', color: 'bg-green-50 text-green-700 ring-1 ring-green-200' };
  if (s === 'closed') return { label: 'Cerrada', color: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200' };
  return { label: status || '—', color: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200' };
}

export default function DashboardDevolucionesPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [ordersByOrderId, setOrdersByOrderId] = useState<Record<string, any>>({});
  const [itemsByOrderId, setItemsByOrderId] = useState<Record<string, any[]>>({});
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [sellerStateById, setSellerStateById] = useState<Record<string, string | null>>({});
  const [sellerCityById, setSellerCityById] = useState<Record<string, string | null>>({});
  const [sellerOperationsById, setSellerOperationsById] = useState<Record<string, number>>({});
  const [buyerNames, setBuyerNames] = useState<Record<string, string>>({});
  const [thumbByListingId, setThumbByListingId] = useState<Record<string, string>>({});

  const load = async () => {
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/dashboard/devoluciones')}`;
        return;
      }

      // Cargar disputas
      console.log('[DEVOLUCIONES] Cargando disputas...');
      const res = await fetch(`/api/disputes/list?limit=200&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      console.log('[DEVOLUCIONES] Respuesta de la API:', {
        ok: res.ok,
        status: res.status,
        error: json?.error,
        disputesCount: Array.isArray(json?.disputes) ? json.disputes.length : 0,
        disputes: json?.disputes,
      });
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar las disputas.');
      const list = (json?.disputes ?? []) as any[];
      console.log('[DEVOLUCIONES] Disputas recibidas:', list.length, list);
      setDisputes(list);

      // Obtener IDs de órdenes
      const orderIds = Array.from(new Set(list.map((d) => String(d?.order_id || '').trim()).filter(Boolean)));
      if (orderIds.length === 0) {
        setOrdersByOrderId({});
        setItemsByOrderId({});
        return;
      }

      // Cargar órdenes
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds);
      if (ordersErr) throw ordersErr;
      const ordersMap: Record<string, any> = {};
      for (const o of (ordersData as any[]) ?? []) {
        const oid = String(o?.id || '').trim();
        if (oid) ordersMap[oid] = o;
      }
      setOrdersByOrderId(ordersMap);

      // Cargar items de órdenes
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('order_id,listing_id,title,quantity,unit_price,line_total')
        .in('order_id', orderIds);
      if (!itemsErr && Array.isArray(itemsData)) {
        const itemsMap: Record<string, any[]> = {};
        for (const it of itemsData) {
          const oid = String(it?.order_id || '').trim();
          if (!oid) continue;
          if (!itemsMap[oid]) itemsMap[oid] = [];
          itemsMap[oid].push(it);
        }
        setItemsByOrderId(itemsMap);

        // Cargar miniaturas
        const listingIds = Array.from(new Set(itemsData.map((it) => String(it?.listing_id || '')).filter(Boolean)));
        if (listingIds.length > 0) {
          const { data: listingsData } = await supabase
            .from('listings')
            .select('id,images')
            .in('id', listingIds)
            .limit(300);
          if (Array.isArray(listingsData)) {
            const thumbMap: Record<string, string> = {};
            for (const l of listingsData) {
              const lid = String(l?.id || '').trim();
              const images = (l as any)?.images;
              if (lid && Array.isArray(images) && images.length > 0) {
                thumbMap[lid] = String(images[0] || '');
              }
            }
            setThumbByListingId(thumbMap);
          }
        }
      }

      // Cargar nombres de vendedores y compradores (y state/city para SellerDisplay)
      const userIds = Array.from(
        new Set(
          list.flatMap((d) => [String(d?.buyer_id || ''), String(d?.seller_id || '')]).map((x) => x.trim()).filter(Boolean),
        ),
      );
      if (userIds.length > 0) {
        let sel = 'id,full_name,state,city';
        const { data: profilesData, error: pe } = await supabase.from('profiles').select(sel).in('id', userIds);
        const fallback = pe && (String((pe as any)?.code || '') === '42703' || String((pe as any)?.message || '').toLowerCase().includes('column'));
        const { data: profilesData2 } = fallback
          ? await supabase.from('profiles').select('id,full_name').in('id', userIds)
          : { data: profilesData };
        const data = (fallback ? profilesData2 : profilesData) as any[] | null;
        if (Array.isArray(data)) {
          const sellerMap: Record<string, string> = {};
          const sellerStateMap: Record<string, string | null> = {};
          const sellerCityMap: Record<string, string | null> = {};
          const buyerMap: Record<string, string> = {};
          for (const p of data) {
            const pid = String(p?.id || '').trim();
            const name = String(p?.full_name || '').trim() || `${pid.slice(0, 6)}…`;
            const st = typeof (p as any).state === 'string' ? String((p as any).state).trim() || null : null;
            const ct = typeof (p as any).city === 'string' ? String((p as any).city).trim() || null : null;
            for (const d of list) {
              if (String(d?.seller_id || '') === pid) {
                sellerMap[pid] = name;
                sellerStateMap[pid] = st || null;
                sellerCityMap[pid] = ct || null;
              }
              if (String(d?.buyer_id || '') === pid) buyerMap[pid] = name;
            }
          }
          setSellerNames(sellerMap);
          setSellerStateById(sellerStateMap);
          setSellerCityById(sellerCityMap);
          setBuyerNames(buyerMap);
        }
        const sellerIdsOnly = Array.from(new Set(list.map((d) => String(d?.seller_id || '').trim()).filter(Boolean)));
        const opsMap: Record<string, number> = {};
        await Promise.all(
          sellerIdsOnly.map(async (id) => {
            try {
              const r = await fetch(`/api/sellers/${encodeURIComponent(id)}`, { cache: 'no-store' });
              const j = await r.json().catch(() => ({}));
              if (r.ok && typeof (j as any)?.operations_count === 'number') opsMap[id] = (j as any).operations_count;
            } catch {
              /* ignore */
            }
          }),
        );
        setSellerOperationsById(opsMap);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las devoluciones.');
      setDisputes([]);
    } finally {
      setIsBooting(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const openCount = useMemo(() => disputes.filter((d) => String(d?.status || '') === 'open').length, [disputes]);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Devoluciones</div>
              <div className="text-xs text-gray-500">
                {openCount > 0 ? `${openCount} ${openCount === 1 ? 'disputa abierta' : 'disputas abiertas'}` : 'Disputas y evidencias'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {isBooting ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-center text-sm text-gray-600">Cargando devoluciones…</div>
          </div>
        ) : disputes.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-center text-sm text-gray-600">No tienes disputas.</div>
            <div className="mt-2 text-center text-xs text-gray-500">
              Si crees que deberías ver disputas aquí, verifica la consola del navegador (F12) para ver los logs de depuración.
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {disputes.map((d) => {
              const disputeId = String(d?.id || '').trim();
              const orderId = String(d?.order_id || '').trim();
              const order = orderId ? ordersByOrderId[orderId] : null;
              const items = orderId ? itemsByOrderId[orderId] ?? [] : [];
              const status = String(d?.status || 'open').trim();
              const statusInfo = statusLabel(status);
              const reasonCode = String(d?.reason_code || '').trim();
              const reasonText = String(d?.reason_text || '').trim();
              const created_at = String(d?.created_at || '').trim();
              const buyerId = String(d?.buyer_id || '').trim();
              const sellerId = String(d?.seller_id || '').trim();
              const buyerName = buyerId ? buyerNames[buyerId] || `${buyerId.slice(0, 6)}…` : '—';
              const sellerName = sellerId ? sellerNames[sellerId] || `${sellerId.slice(0, 6)}…` : '—';

              const isOpen = status === 'open';
              const start = created_at ? new Date(created_at).getTime() : 0;
              const hasValidStart = Number.isFinite(start) && start > 0;
              const deadline = hasValidStart ? start + 72 * 60 * 60 * 1000 : 0;
              const diff = hasValidStart ? deadline - currentTime.getTime() : -1;
              const expired = diff <= 0;
              const hoursRemaining = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
              const minutesRemaining = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
              const secondsRemaining = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

              return (
                <div key={disputeId} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                  <div className="border-b border-black/5 bg-gray-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-gray-500">Orden: {orderId.slice(0, 8)}…</span>
                        <span className="text-xs text-gray-500">Creada: {formatDateTime(created_at)}</span>
                        {isOpen && hasValidStart && !expired ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-400 bg-red-50 px-2.5 py-0.5 text-xs font-extrabold text-red-900">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {hoursRemaining}h {minutesRemaining}m {secondsRemaining}s
                          </span>
                        ) : isOpen && (expired || !hasValidStart) ? (
                          <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                            Admin revisará
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={`/dashboard/disputas/${disputeId}`}
                        className="rounded-xl bg-brand-emerald px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                      >
                        Ver chat
                      </Link>
                    </div>
                  </div>

                  {isOpen && hasValidStart ? (
                    <div className={`border-x-0 border-b border-black/5 px-4 py-3 ${expired ? 'bg-gray-50' : 'border-2 border-red-200 bg-red-50'}`}>
                      <div className="flex items-start gap-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={expired ? '#6b7280' : '#dc2626'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <div className="flex-1">
                          {expired ? (
                            <>
                              <div className="text-sm font-extrabold text-gray-900">El administrador revisará tu caso</div>
                              <div className="mt-0.5 text-xs text-gray-700">El tiempo para resolver ha expirado. El administrador tomará una decisión definitiva.</div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm font-extrabold text-red-900">
                                Tiempo para resolver: {hoursRemaining}h {minutesRemaining}m {secondsRemaining}s
                              </div>
                              <div className="mt-0.5 text-xs text-red-800">
                                Tienes 72 horas para resolver con el comprador o el vendedor antes de que un mediador vea tu caso y dé una resolución.
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Información de la orden */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-500">Información de la orden</div>
                          {order ? (
                            <div className="mt-2 space-y-1 text-sm">
                              <div>
                                <span className="text-gray-600">Estado:</span>{' '}
                                <span className="font-semibold text-gray-900">{String(order?.status || '—')}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Total:</span>{' '}
                                <span className="font-semibold text-gray-900">{formatMoneyDisplay(order?.total)}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Envío:</span>{' '}
                                <span className="font-semibold text-gray-900">{formatMoneyDisplay(order?.shipping_fee)}</span>
                              </div>
                              {order?.tracking_number ? (
                                <div>
                                  <span className="text-gray-600">Rastreo:</span>{' '}
                                  <span className="font-semibold text-gray-900">{String(order.tracking_number)}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-gray-500">No se pudo cargar la información de la orden.</div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-gray-500">Participantes</div>
                          <div className="mt-2 space-y-1 text-sm">
                            <div>
                              <span className="text-gray-600">Comprador:</span>{' '}
                              {buyerId ? (
                                <Link href={`/perfil/${buyerId}`} className="font-semibold text-brand-emerald hover:underline">
                                  {buyerName}
                                </Link>
                              ) : (
                                <span className="font-semibold text-gray-900">{buyerName}</span>
                              )}
                            </div>
                            <div>
                              {sellerId ? (
                                <SellerDisplay
                                  sellerId={sellerId}
                                  sellerName={sellerName}
                                  state={sellerStateById[sellerId] ?? null}
                                  city={sellerCityById[sellerId] ?? null}
                                  operationsCount={sellerOperationsById[sellerId] ?? null}
                                  size="sm"
                                />
                              ) : (
                                <>
                                  <span className="text-gray-600">Vendedor:</span>{' '}
                                  <span className="font-semibold text-gray-900">{sellerName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Productos y motivo */}
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-500">Productos</div>
                          <div className="mt-2 space-y-2">
                            {items.length > 0 ? (
                              items.slice(0, 3).map((it: any, idx: number) => {
                                const lid = String(it?.listing_id || '').trim();
                                const title = String(it?.title || 'Artículo').trim();
                                const quantity = Number(it?.quantity ?? 1) || 1;
                                const img = lid ? thumbByListingId[lid] : '';
                                return (
                                  <div key={idx} className="flex gap-2">
                                    {img ? (
                                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt={title} className="h-full w-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="h-16 w-16 shrink-0 rounded-xl bg-gray-100 ring-1 ring-black/5" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold text-gray-900">{title}</div>
                                      <div className="mt-0.5 text-xs text-gray-600">Cantidad: x{quantity}</div>
                                      <div className="mt-0.5 text-xs font-semibold text-gray-900">
                                        {formatMoneyDisplay(it?.line_total)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-sm text-gray-500">No se pudieron cargar los productos.</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-gray-500">Motivo de la disputa</div>
                          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                            <div className="text-xs font-semibold text-amber-900">{reasonCode}</div>
                            {reasonText ? (
                              <div className="mt-1 text-xs text-amber-800/80">{reasonText}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

