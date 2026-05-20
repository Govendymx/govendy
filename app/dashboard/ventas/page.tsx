'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { OrderChatFloating } from '@/components/OrderChatFloating';
import { payoutNet } from '@/lib/payouts/calc';
import { PageTour } from '@/components/PageTour';
import { pageTours } from '@/lib/tours/config';
import { SectionMessage } from '@/components/SectionMessage';
import { DigitalDeliverySeller } from '@/components/orders/DigitalDeliverySection';
import { Countdown48Hours } from '@/components/orders/Countdown48Hours';
import { AuctionDeadline } from '@/components/orders/AuctionDeadline';
import { OrderSourceChip } from '@/components/ui/ShippingBadge';
import { useImpersonation } from '@/components/ImpersonationProvider';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { isOrderDelivered, normalizeOrderStatus } from '@/lib/orders/orderStatus';
import { resolveBuyerAddress } from '@/lib/orders/buyerAddress';
import { useOrderUpdatesRealtime } from '@/lib/hooks/useOrderUpdatesRealtime';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function formatMoney(v: any) {
  return toNumber(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function sanitizeTitle(v: string | undefined | null) {
  const t = String(v || '').trim();
  if (!t) return '';
  const normalized = t.toLowerCase();
  if (normalized === 'producto vendido' || normalized === 'producto' || normalized === 'vendido') return '';
  return t;
}

// Componente de Cuenta Regresiva Personalizado (Verde, sin Domingos)
function CountdownShipment({ createdAt, handlingDays = 3, onExpire }: { createdAt: string; handlingDays?: number; onExpire?: () => void }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  const expiredRef = useRef(false);

  const deadline = useMemo(() => {
    if (!createdAt) return 0;
    const start = new Date(createdAt);
    let current = new Date(start);
    let daysAdded = 0;

    // Si es 0 (Mismo día), damos 24h como margen base, o hasta el final del día.
    // Asumiremos 1 día natural pero respetando la regla de domingos si cae en domingo.
    const targetDays = handlingDays === 0 ? 1 : handlingDays;

    while (daysAdded < targetDays) {
      current.setDate(current.getDate() + 1);
      // 0 = Domingo. Si es domingo, no cuenta como día hábil de preparación.
      if (current.getDay() !== 0) {
        daysAdded++;
      }
    }
    return current.getTime();
  }, [createdAt, handlingDays]);

  useEffect(() => {
    if (!deadline) return;

    const update = () => {
      const now = Date.now();
      const remaining = deadline - now;

      if (remaining <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        if (onExpire && !expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, totalMs: remaining });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  if (!timeLeft) return null;

  if (timeLeft.totalMs === 0) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-100 px-2 py-1.5 text-[10px] font-bold text-red-700">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        ¡Tiempo Agotado! Se abrirá disputa.
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold text-green-700 ring-1 ring-green-200">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
      Envía antes de: {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}{timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s para evitar disputa automática
    </div>
  );
}

export default function DashboardVentasPage() {
  const { isImpersonating, targetUserId, queryAsUser } = useImpersonation();
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, any[]>>({});
  const [buyerNames, setBuyerNames] = useState<Record<string, string>>({});
  const [buyerAddressById, setBuyerAddressById] = useState<Record<string, { street?: string; city?: string; state?: string; zip?: string; colonia?: string; phone?: string; reference?: string; full?: string }>>({});
  const [showAddressByOrderId, setShowAddressByOrderId] = useState<Record<string, boolean>>({});
  const [thumbByListingId, setThumbByListingId] = useState<Record<string, string>>({});
  const [titleByListingId, setTitleByListingId] = useState<Record<string, string>>({});
  const [handlingDaysByListingId, setHandlingDaysByListingId] = useState<Record<string, number>>({});
  const [shippingBySellerByListingId, setShippingBySellerByListingId] = useState<Record<string, boolean>>({});
  const [allowPersonalDeliveryByListingId, setAllowPersonalDeliveryByListingId] = useState<Record<string, boolean>>({});
  const [weightByListingId, setWeightByListingId] = useState<Record<string, number>>({});
  const [dimsByListingId, setDimsByListingId] = useState<Record<string, { length_cm: number; width_cm: number; height_cm: number }>>({});
  const [weightByOrderId, setWeightByOrderId] = useState<Record<string, number>>({});
  const [dimsByOrderId, setDimsByOrderId] = useState<Record<string, { length_cm: number; width_cm: number; height_cm: number }>>({});

  // Producto digital
  const [productTypeByListingId, setProductTypeByListingId] = useState<Record<string, string>>({});
  const [digitalFieldsByListingId, setDigitalFieldsByListingId] = useState<Record<string, { label: string }[]>>({});

  const [carrierDraft, setCarrierDraft] = useState<Record<string, string>>({});
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [isMarking, setIsMarking] = useState<Record<string, boolean>>({});

  const [chatOpen, setChatOpen] = useState(false);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [hasUnreadByOrderId, setHasUnreadByOrderId] = useState<Record<string, boolean>>({});

  const [rateOpen, setRateOpen] = useState(false);
  const [rateOrderId, setRateOrderId] = useState<string | null>(null);
  const [rateBuyerId, setRateBuyerId] = useState<string | null>(null);
  const [rateStars, setRateStars] = useState<number>(10);
  const [rateComment, setRateComment] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratedByOrderId, setRatedByOrderId] = useState<Record<string, boolean>>({});
  const [bothRatedByOrderId, setBothRatedByOrderId] = useState<Record<string, boolean>>({});

  // Inline confirmation states for P2P Voucher approval
  const [confirmingApproveOrderId, setConfirmingApproveOrderId] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Scroll automático cuando se abre el modal de calificación
  useEffect(() => {
    if (rateOpen) {
      // Pequeño delay para asegurar que el modal esté renderizado
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [rateOpen]);

  // Disputas
  const [disputeByOrderId, setDisputeByOrderId] = useState<Record<string, string>>({});
  const [disputeInfoByOrderId, setDisputeInfoByOrderId] = useState<Record<string, { id: string; status: string; created_at: string; admin_decision?: string | null; admin_note?: string | null }>>({});

  // Estado local para rastrear descargas de guías (optimistic update)
  const [labelDownloadedAtByOrderId, setLabelDownloadedAtByOrderId] = useState<Record<string, string>>({});
  const [proofDownloadedAtByOrderId, setProofDownloadedAtByOrderId] = useState<Record<string, string>>({});

  // Estado para rastrear subidas individuales de constancia e INE
  const [constanciaUrlByOrderId, setConstanciaUrlByOrderId] = useState<Record<string, string>>({});
  const [ineUrlByOrderId, setIneUrlByOrderId] = useState<Record<string, string>>({});

  // Contador de tiempo para actualizar cada segundo
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtros y búsqueda
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ventasPage, setVentasPage] = useState(1);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);
  const [sellerPlan, setSellerPlan] = useState<string>('basic');

  const bumpOrdersRefresh = useCallback(() => {
    setOrdersRefreshToken((t) => t + 1);
  }, []);

  useOrderUpdatesRealtime(bumpOrdersRefresh);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (orders.length === 0) setIsBooting(true);
        setError(null);
        setSuccess(null);

        // ── IMPERSONATION MODE ──
        if (isImpersonating && targetUserId) {
          // Obtener plan del vendedor impersonado
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('plan_type')
            .eq('id', targetUserId)
            .single();
          if (!profErr && prof && !cancelled) {
            setSellerPlan(prof.plan_type || 'basic');
          }

          // Órdenes como vendedor del usuario impersonado
          const ordersResult = await queryAsUser({
            table: 'orders',
            select: 'id,status,total,subtotal,shipping_fee,commission_fee,coupon_discount,shipping_subsidy,shipping_option_id,shipping_carrier,shipping_by_seller,paid_to_seller_at,created_at,buyer_id,tracking_number,shipping_label_url,shipping_method,order_source,isr_withheld,iva_withheld,payment_method_type,buyer_payment_voucher_url,seller_payment_details',
            filters: { userColumn: 'seller_id' },
            order: { column: 'created_at', ascending: false },
            limit: 500,
          });
          const next = (ordersResult.data as any[]) ?? [];
          if (cancelled) return;
          setOrders(next);

          const ids = next.map((o: any) => String(o?.id || '')).filter(Boolean);

          // Order items via admin proxy
          if (ids.length > 0) {
            const itemsResult = await queryAsUser({
              table: 'order_items',
              select: 'order_id,listing_id,title,quantity,line_total,selected_size,selected_color',
              filters: { in: { order_id: ids } },
            });
            if (Array.isArray(itemsResult.data)) {
              const map: Record<string, any[]> = {};
              for (const it of itemsResult.data) {
                const oid = String(it?.order_id || '').trim();
                if (!oid) continue;
                if (!map[oid]) map[oid] = [];
                map[oid].push(it);
              }
              if (!cancelled) setItemsByOrder(map);
            }
          }

          // Buyer names (public profiles — sin datos sensibles)
          const buyerIds = Array.from(new Set(next.map((o: any) => String(o?.buyer_id || '')).filter(Boolean)));
          if (buyerIds.length > 0) {
            const profRes: any = await supabase
              .from('profiles')
              .select('id,full_name,nickname,username')
              .in('id', buyerIds);
            if (!profRes.error && Array.isArray(profRes.data)) {
              const map: Record<string, string> = {};
              for (const p of profRes.data as any[]) {
                const id = String(p?.id || '').trim();
                if (!id) continue;
                map[id] = String(p?.full_name || p?.nickname || p?.username || `${id.slice(0, 6)}…`).trim();
              }
              if (!cancelled) setBuyerNames(map);
            }
          }

          // Listing thumbnails + titles: query directo a listings usando los listing_ids de order_items
          if (ids.length > 0) {
            try {
              // Obtener listing_ids directamente desde order_items via admin proxy
              const itemsResult2 = await queryAsUser({
                table: 'order_items',
                select: 'listing_id',
                filters: { in: { order_id: ids } },
              });
              const listingIds = Array.from(
                new Set(
                  ((itemsResult2.data ?? []) as any[])
                    .map((it: any) => String(it?.listing_id || '').trim())
                    .filter(Boolean)
                )
              );

              if (listingIds.length > 0) {
                const listingsResult = await queryAsUser({
                  table: 'listings',
                  select: 'id,public_id,title,images,handling_days,shipping_by_seller',
                  filters: { in: { id: listingIds } },
                  limit: 500,
                });
                if (Array.isArray(listingsResult.data) && !cancelled) {
                  const thumbs: Record<string, string> = {};
                  const titles: Record<string, string> = {};
                  const handling: Record<string, number> = {};
                  const sbs: Record<string, boolean> = {};
                  for (const r of listingsResult.data as any[]) {
                    const k1 = String(r?.id || '').trim();
                    const k2 = String(r?.public_id || '').trim();
                    const tt = String(r?.title || '').trim();
                    let imgs: string[] = [];
                    if (Array.isArray(r?.images)) imgs = r.images.map((x: any) => String(x || '')).filter(Boolean);
                    else if (typeof r?.images === 'string') {
                      try { imgs = JSON.parse(r.images); } catch { if (r.images.startsWith('http')) imgs = [r.images]; }
                    }
                    const first = imgs[0] || '';
                    if (first) { if (k1) thumbs[k1] = first; if (k2) thumbs[k2] = first; }
                    if (tt) { if (k1) titles[k1] = tt; if (k2) titles[k2] = tt; }
                    if (typeof r?.handling_days === 'number') { if (k1) handling[k1] = r.handling_days; if (k2) handling[k2] = r.handling_days; }
                    if (typeof r?.shipping_by_seller !== 'undefined') { if (k1) sbs[k1] = Boolean(r.shipping_by_seller); if (k2) sbs[k2] = Boolean(r.shipping_by_seller); }
                  }
                  setThumbByListingId((prev) => ({ ...prev, ...thumbs }));
                  setTitleByListingId((prev) => ({ ...prev, ...titles }));
                  setHandlingDaysByListingId((prev) => ({ ...prev, ...handling }));
                  setShippingBySellerByListingId((prev) => ({ ...prev, ...sbs }));
                }
              }
            } catch { /* best-effort */ }
          }


          // Carrier + tracking drafts
          const cd: Record<string, string> = {};
          const td: Record<string, string> = {};
          for (const o of next) {
            const oid = String(o?.id || '').trim();
            if (!oid) continue;
            cd[oid] = String(o?.shipping_carrier || '');
            td[oid] = String(o?.tracking_number || '');
          }
          if (!cancelled) {
            setCarrierDraft(cd);
            setTrackingDraft(td);
            setIsBooting(false);
          }
          return;
        }

        // ── NORMAL MODE ──
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          window.location.href = '/login';
          return;
        }

        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error('Auth session missing');

        // ── FASE 1: Cargar órdenes (debe ser secuencial) ──
        const res = await fetch(`/api/orders/seller-dashboard?limit=500&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !(json as any)?.ok) {
          throw new Error((json as any)?.error || 'No se pudieron cargar tus ventas.');
        }

        const next = ((json as any)?.orders as any[]) ?? [];
        if (cancelled) return;
        setOrders(next);

        // Prefill drafts para rastreo/paquetería (síncrono, no depende de API)
        const cd: Record<string, string> = {};
        const td: Record<string, string> = {};
        for (const o of next) {
          const oid = String(o?.id || '').trim();
          if (!oid) continue;
          cd[oid] = String(o?.shipping_carrier || '');
          td[oid] = String(o?.tracking_number || '');
        }
        setCarrierDraft(cd);
        setTrackingDraft(td);

        const ids = next.map((o) => String(o?.id || '')).filter(Boolean);

        // ── FASE 2: Todo lo demás EN PARALELO ──
        const chunk = <T,>(arr: T[], size: number) => {
          const out: T[][] = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };

        // Función para cargar items + listings + enrich
        const loadItemsAndListings = async () => {
          if (ids.length === 0) return;
          const idChunks = chunk(ids, 25);
          const allItems: any[] = [];
          // Cargar todos los batches de order_items en paralelo
          const batchResults = await Promise.allSettled(
            idChunks.map(async (batch) => {
              let part: any = await supabase
                .from('order_items')
                .select('order_id,listing_id,title,quantity,line_total,selected_size,selected_color,listings(title,images,sale_type)')
                .in('order_id', batch);
              if (part.error) {
                part = await supabase
                  .from('order_items')
                  .select('order_id,listing_id,title,quantity,line_total,selected_size,selected_color')
                  .in('order_id', batch);
              }
              return (!part.error && Array.isArray(part.data)) ? part.data : [];
            })
          );
          for (const r of batchResults) {
            if (r.status === 'fulfilled') allItems.push(...r.value);
          }
          if (allItems.length > 0) {
            const map: Record<string, any[]> = {};
            const mFromJoin: Record<string, string> = {};
            const tFromJoin: Record<string, string> = {};
            for (const it of allItems as any[]) {
              const oid = String(it?.order_id || '');
              if (!oid) continue;
              if (!map[oid]) map[oid] = [];
              map[oid].push(it);

              const lid = String(it?.listing_id || '').trim();
              const lj = (it as any)?.listings || null;
              if (lid && lj) {
                const tt = typeof lj.title === 'string' ? lj.title.trim() : '';
                if (tt) tFromJoin[lid] = tt;
                let imgs: string[] = [];
                const rawImgs = lj.images;
                if (Array.isArray(rawImgs)) {
                  imgs = rawImgs.map((x: any) => String(x || '').trim()).filter(Boolean);
                } else if (typeof rawImgs === 'string') {
                  const sraw = rawImgs.trim();
                  try {
                    const parsed = JSON.parse(sraw);
                    if (Array.isArray(parsed)) imgs = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
                  } catch {
                    if (sraw.startsWith('http') || sraw.startsWith('/')) imgs = [sraw];
                  }
                }
                const first = imgs[0] || '';
                if (first) mFromJoin[lid] = first;
              }
            }
            if (!cancelled) setItemsByOrder(map);
            if (!cancelled && Object.keys(mFromJoin).length > 0) setThumbByListingId((prev) => ({ ...prev, ...mFromJoin }));
            if (!cancelled && Object.keys(tFromJoin).length > 0) setTitleByListingId((prev) => ({ ...prev, ...tFromJoin }));

            const listingIds = Array.from(new Set((allItems as any[]).map((it) => String(it?.listing_id || '')).filter(Boolean)));
            if (listingIds.length > 0) {
              const uuids = listingIds.filter((x) => isUuid(x));
              const publics = listingIds.filter((x) => !isUuid(x));

              const selectCols = 'id,public_id,images,title,handling_days,shipping_by_seller,allow_personal_delivery,weight_kg,length_cm,width_cm,height_cm,product_type,digital_delivery_fields';
              const results: any[] = [];

              // Cargar UUIDs y publics en paralelo
              const [q1Res, q2Res] = await Promise.allSettled([
                uuids.length > 0 ? supabase.from('listings').select(selectCols).in('id', uuids).limit(300) : Promise.resolve({ data: [], error: null }),
                publics.length > 0 ? supabase.from('listings').select(selectCols).in('public_id', publics).limit(300) : Promise.resolve({ data: [], error: null }),
              ]);
              if (q1Res.status === 'fulfilled' && !(q1Res.value as any).error && Array.isArray((q1Res.value as any).data)) results.push(...(q1Res.value as any).data);
              if (q2Res.status === 'fulfilled' && !(q2Res.value as any).error && Array.isArray((q2Res.value as any).data)) results.push(...(q2Res.value as any).data);

              if (results.length > 0 && !cancelled) {
                const m: Record<string, string> = {};
                const t: Record<string, string> = {};
                const h: Record<string, number> = {};
                const s: Record<string, boolean> = {};
                const apd: Record<string, boolean> = {};
                const w: Record<string, number> = {};
                const d: Record<string, { length_cm: number; width_cm: number; height_cm: number }> = {};
                for (const r of results as any[]) {
                  const idKey1 = String(r?.id || '').trim();
                  const idKey2 = String(r?.public_id || '').trim();

                  let imgs: string[] = [];
                  const rawImgs = (r as any)?.images;
                  if (Array.isArray(rawImgs)) {
                    imgs = rawImgs.map((x: any) => String(x || '').trim()).filter(Boolean);
                  } else if (typeof rawImgs === 'string') {
                    const sraw = rawImgs.trim();
                    try {
                      const parsed = JSON.parse(sraw);
                      if (Array.isArray(parsed)) imgs = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
                    } catch {
                      if (sraw.startsWith('http') || sraw.startsWith('/')) imgs = [sraw];
                    }
                  }
                  const first = imgs[0] || '';
                  if (first) { if (idKey1) m[idKey1] = first; if (idKey2) m[idKey2] = first; }
                  const tt = String((r as any)?.title || '').trim();
                  if (tt) { if (idKey1) t[idKey1] = tt; if (idKey2) t[idKey2] = tt; }
                  if (typeof (r as any)?.handling_days === 'number') { if (idKey1) h[idKey1] = (r as any).handling_days; if (idKey2) h[idKey2] = (r as any).handling_days; }
                  if (typeof (r as any)?.shipping_by_seller !== 'undefined') { if (idKey1) s[idKey1] = Boolean((r as any).shipping_by_seller); if (idKey2) s[idKey2] = Boolean((r as any).shipping_by_seller); }
                  if (typeof (r as any)?.allow_personal_delivery !== 'undefined') { if (idKey1) apd[idKey1] = Boolean((r as any).allow_personal_delivery); if (idKey2) apd[idKey2] = Boolean((r as any).allow_personal_delivery); }
                  const wv = Number((r as any)?.weight_kg || 0);
                  const lv = Number((r as any)?.length_cm || 0);
                  const wcm = Number((r as any)?.width_cm || 0);
                  const hv = Number((r as any)?.height_cm || 0);
                  if (idKey1) { w[idKey1] = wv; d[idKey1] = { length_cm: lv, width_cm: wcm, height_cm: hv }; }
                  if (idKey2) { w[idKey2] = wv; d[idKey2] = { length_cm: lv, width_cm: wcm, height_cm: hv }; }
                }
                setThumbByListingId((prev) => ({ ...prev, ...m }));
                setTitleByListingId((prev) => ({ ...prev, ...t }));
                if (Object.keys(h).length > 0) setHandlingDaysByListingId((prev) => ({ ...prev, ...h }));
                if (Object.keys(s).length > 0) setShippingBySellerByListingId((prev) => ({ ...prev, ...s }));
                if (Object.keys(apd).length > 0) setAllowPersonalDeliveryByListingId((prev) => ({ ...prev, ...apd }));
                if (Object.keys(w).length > 0) setWeightByListingId((prev) => ({ ...prev, ...w }));
                if (Object.keys(d).length > 0) setDimsByListingId((prev) => ({ ...prev, ...d }));

                // Datos digitales
                const pt: Record<string, string> = {};
                const df: Record<string, { label: string }[]> = {};
                for (const r of results as any[]) {
                  const idKey1 = String(r?.id || '').trim();
                  const idKey2 = String(r?.public_id || '').trim();
                  const ptype = String(r?.product_type || 'physical');
                  const dfields = Array.isArray(r?.digital_delivery_fields) ? r.digital_delivery_fields : [];
                  if (idKey1) { pt[idKey1] = ptype; df[idKey1] = dfields; }
                  if (idKey2) { pt[idKey2] = ptype; df[idKey2] = dfields; }
                }
                if (Object.keys(pt).length > 0) setProductTypeByListingId((prev) => ({ ...prev, ...pt }));
                if (Object.keys(df).length > 0) setDigitalFieldsByListingId((prev) => ({ ...prev, ...df }));

                // Calcular peso/dims por orden con datos YA cargados
                const wByOrder: Record<string, number> = {};
                const realWByOrder: Record<string, number> = {};
                const orderDims: Record<string, { length_cm: number; width_cm: number; height_cm: number }> = {};
                for (const it of allItems as any[]) {
                  const oid = String(it?.order_id || '').trim();
                  const lid = String(it?.listing_id || '').trim();
                  if (!oid || !lid) continue;
                  const wv = w[lid] ?? 0;
                  const dims = d[lid] ?? { length_cm: 0, width_cm: 0, height_cm: 0 };
                  const qty = Number(it?.quantity || 1);
                  realWByOrder[oid] = (realWByOrder[oid] || 0) + wv * qty;
                  const prev = orderDims[oid] || { length_cm: 0, width_cm: 0, height_cm: 0 };
                  orderDims[oid] = {
                    length_cm: Math.max(prev.length_cm, dims.length_cm || 0),
                    width_cm: Math.max(prev.width_cm, dims.width_cm || 0),
                    height_cm: prev.height_cm + (dims.height_cm || 0) * qty,
                  };
                }
                for (const oid of Object.keys(orderDims)) {
                  const od = orderDims[oid];
                  const volW = (od.length_cm * od.width_cm * od.height_cm) / 5000;
                  wByOrder[oid] = Math.max(realWByOrder[oid] || 0, volW);
                }
                setWeightByOrderId(wByOrder);
                setDimsByOrderId(orderDims);
              }

              // Enriquecimiento server-side (best-effort, no bloquear)
              try {
                const resp = await fetch('/api/orders/enrich-items', {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                  },
                  credentials: 'include',
                  cache: 'no-store',
                  body: JSON.stringify({ orderIds: ids, listingIds }),
                });
                if (resp.ok) {
                  const ejson = await resp.json().catch(() => ({}));
                  const titles = (ejson?.titles || {}) as Record<string, string>;
                  const thumbs = (ejson?.thumbs || {}) as Record<string, string>;
                  const handling = (ejson?.handlingDays || {}) as Record<string, number>;
                  const sbs = (ejson?.shippingBySeller || {}) as Record<string, boolean>;
                  if (!cancelled && Object.keys(thumbs).length > 0) setThumbByListingId((prev) => ({ ...prev, ...thumbs }));
                  if (!cancelled && Object.keys(titles).length > 0) setTitleByListingId((prev) => ({ ...prev, ...titles }));
                  if (!cancelled && Object.keys(handling).length > 0) setHandlingDaysByListingId((prev) => ({ ...prev, ...handling }));
                  if (!cancelled && Object.keys(sbs).length > 0) setShippingBySellerByListingId((prev) => ({ ...prev, ...sbs }));
                }
              } catch { }
            }
          }
        };

        // Función para cargar perfiles de compradores
        const loadBuyerProfiles = async () => {
          const buyerIds = Array.from(new Set(next.map((o) => String(o?.buyer_id || '')).filter(Boolean)));
          if (buyerIds.length === 0) return;
          let profRes: any = await supabase.from('profiles').select('id,full_name,nickname,username,address_street,ext_number,int_number,neighborhood,zip_code,state,city,references,cross_streets,phone').in('id', buyerIds);
          if (profRes.error) {
            const code = String((profRes.error as any)?.code || '');
            const msg = String((profRes.error as any)?.message || '').toLowerCase();
            if (code === '42703' || msg.includes('does not exist') || msg.includes('column') || code === '400') {
              profRes = await supabase.from('profiles').select('id,full_name').in('id', buyerIds);
            }
          }
          if (!profRes.error && Array.isArray(profRes.data) && !cancelled) {
            const map: Record<string, string> = {};
            const addrMap: Record<string, { street?: string; city?: string; state?: string; zip?: string; colonia?: string; phone?: string; reference?: string; full?: string }> = {};
            for (const p of profRes.data as any[]) {
              const id = String(p?.id || '').trim();
              if (!id) continue;
              const name =
                String(p?.full_name || '').trim() ||
                String(p?.nickname || '').trim() ||
                String(p?.username || '').trim() ||
                `${id.slice(0, 6)}…`;
              map[id] = name;
              const streetBase = String(p?.address_street || '').trim();
              const extNum = String(p?.ext_number || '').trim();
              const intNum = String(p?.int_number || '').trim();
              const street = [streetBase, extNum ? `#${extNum}` : '', intNum ? `Int. ${intNum}` : ''].filter(Boolean).join(' ');
              const cityVal = String(p?.city || '').trim();
              const stateVal = String(p?.state || '').trim();
              const zip = String(p?.zip_code || '').trim();
              const colonia = String(p?.neighborhood || '').trim();
              const reference = [String(p?.cross_streets || '').trim(), String(p?.references || '').trim()].filter(Boolean).join(' / ');
              const phone = String(p?.phone || '').trim();
              const parts = [street, colonia, cityVal, stateVal, zip].filter(Boolean);
              if (parts.length > 0 || phone) {
                addrMap[id] = { street, city: cityVal, state: stateVal, zip, colonia, phone, reference, full: parts.join(', ') };
              }
            }
            setBuyerNames(map);
            setBuyerAddressById(addrMap);
          }
        };

        // Función para cargar chat unread
        const loadChatUnread = async () => {
          if (ids.length === 0) return;
          try {
            const resUnread = await fetch('/api/chat/unread-batch', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
              cache: 'no-store',
              body: JSON.stringify({ orderIds: ids }),
            });
            const jsonUnread = await resUnread.json().catch(() => ({}));
            if (resUnread.ok && (jsonUnread as any)?.ok && jsonUnread.hasUnreadByOrderId && !cancelled) {
              setHasUnreadByOrderId(jsonUnread.hasUnreadByOrderId as Record<string, boolean>);
            }
          } catch (err) {
            console.error('[VENTAS] Error cargando estado de chat (unread):', err);
          }
        };

        // Función para cargar ratings
        const loadRatings = async () => {
          if (ids.length === 0) return;
          try {
            const resRatings = await fetch('/api/ratings/status-batch', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
              cache: 'no-store',
              body: JSON.stringify({ orderIds: ids, mode: 'seller' }),
            });
            const jsonRatings = await resRatings.json().catch(() => ({}));
            if (resRatings.ok && (jsonRatings as any)?.ok && !cancelled) {
              const rated = (jsonRatings as any)?.rated as Record<string, boolean>;
              const bothRated = (jsonRatings as any)?.bothRated as Record<string, boolean>;
              if (rated && typeof rated === 'object') setRatedByOrderId(rated);
              if (bothRated && typeof bothRated === 'object') setBothRatedByOrderId(bothRated);
            }
          } catch (err) {
            console.error('[VENTAS] Error cargando estado de calificaciones:', err);
          }
        };

        // Función para cargar disputas
        const loadDisputes = async () => {
          if (ids.length === 0) return;
          try {
            const res = await fetch(`/api/disputes/list?limit=200&t=${Date.now()}`, {
              headers: { authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const list = (json?.disputes ?? []) as any[];
            const wanted = new Set(ids.map(String));
            const map: Record<string, string> = {};
            const infoMap: Record<string, { id: string; status: string; created_at: string; admin_decision?: string | null; admin_note?: string | null }> = {};
            for (const d of list) {
              const oid = String(d?.order_id || '').trim();
              const did = String(d?.id || '').trim();
              const status = String(d?.status || 'open').trim();
              const created_at = String(d?.created_at || '').trim();
              const admin_decision = d?.admin_decision ? String(d.admin_decision).trim() : null;
              const admin_note = d?.admin_note ? String(d.admin_note).trim() : null;
              if (oid && did && wanted.has(oid)) {
                map[oid] = did;
                infoMap[oid] = { id: did, status, created_at, admin_decision, admin_note };
              }
            }
            if (!cancelled) {
              setDisputeByOrderId(map);
              setDisputeInfoByOrderId(infoMap);
            }
          } catch (err) {
            console.error('[VENTAS] Error al cargar disputas:', err);
          }
        };

        // Función para cargar plan del vendedor
        const loadSellerProfile = async () => {
          try {
            const { data: prof, error: profErr } = await supabase
              .from('profiles')
              .select('plan_type')
              .eq('id', user.id)
              .single();
            if (!profErr && prof && !cancelled) {
              setSellerPlan(prof.plan_type || 'basic');
            }
          } catch (err) {
            console.error('[VENTAS] Error al cargar plan del vendedor:', err);
          }
        };

        // ── EJECUTAR TODO EN PARALELO ──
        await Promise.allSettled([
          loadItemsAndListings(),
          loadBuyerProfiles(),
          loadChatUnread(),
          loadRatings(),
          loadDisputes(),
          loadSellerProfile(),
        ]);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus ventas.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating, targetUserId, ordersRefreshToken]);

  const submitRateBuyer = async () => {
    setError(null);
    setSuccess(null);
    const orderId = String(rateOrderId || '').trim();
    const buyerId = String(rateBuyerId || '').trim();
    if (!orderId || !buyerId || !isUuid(orderId)) return;

    try {
      setIsSubmittingRating(true);
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/orders/rate-buyer', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, stars: rateStars, comment: rateComment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo calificar al comprador.');

      setRatedByOrderId((p) => ({ ...p, [orderId]: true }));

      // Verificar si ambas calificaciones existen después de calificar
      if (json.both_rated) {
        setBothRatedByOrderId((p) => ({ ...p, [orderId]: true }));
      }

      setSuccess('Listo: calificaste al comprador.');
      setRateOpen(false);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo calificar al comprador.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Filtrar órdenes según el filtro activo y búsqueda (optimizado con useMemo)
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((o) => {
      const status = normalizeOrderStatus(o?.status);
      const labelUrl = String(o?.shipping_label_url || '').trim();
      const tracking = String(o?.tracking_number || '').trim();
      const orderId = String(o?.id || '').trim();
      const hasRating = Boolean(ratedByOrderId[orderId]);
      const isCompleted = isOrderDelivered(o?.status);

      // Ocultar al vendedor las órdenes que no han sido pagadas / sin voucher
      // Ocultar al vendedor las órdenes que no han sido pagadas / sin voucher
      // Mostrar 'awaiting_voucher' siempre, incluso si no hay URL (ej: si fue rechazado y espera que se suba de nuevo)
      if (o?.status === 'pending_payment') {
        return false;
      }

      // Aplicar filtro de estado
      let matchesFilter = true;
      switch (activeFilter) {
        case 'pending_payment':
          matchesFilter = status === 'pending_payment' || status === 'verifying_payment';
          break;
        case 'pending_shipping':
          matchesFilter = (status === 'paid' || Boolean(labelUrl)) && !tracking;
          break;
        case 'shipped':
          matchesFilter = status === 'shipped' || tracking.length > 0;
          break;
        case 'rated':
          matchesFilter = isCompleted && hasRating;
          break;
        case 'not_rated':
          matchesFilter = isCompleted && !hasRating;
          break;
        case 'paid':
          matchesFilter = status === 'paid';
          break;
        case 'no_label':
          matchesFilter = !labelUrl;
          break;
        case 'with_label':
          matchesFilter = Boolean(labelUrl);
          break;
        default:
          matchesFilter = true; // 'all'
      }

      if (!matchesFilter) return false;

      // Aplicar búsqueda si hay query
      if (query) {
        const buyerId = String(o?.buyer_id || '');
        const buyerName = buyerId ? (buyerNames[buyerId] || '').toLowerCase() : '';
        const orderIdLower = orderId.toLowerCase();
        const trackingLower = tracking.toLowerCase();

        // Buscar en: ID de orden, nombre del comprador, tracking
        const matchesSearch =
          orderIdLower.includes(query) ||
          buyerName.includes(query) ||
          trackingLower.includes(query);

        return matchesSearch;
      }

      return true;
    });
  }, [orders, activeFilter, ratedByOrderId, searchQuery, buyerNames]);

  // Contadores por filtro
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      pending_payment: 0,
      pending_shipping: 0,
      shipped: 0,
      rated: 0,
      not_rated: 0,
      paid: 0,
      no_label: 0,
      with_label: 0,
    };

    for (const o of orders) {
      const status = normalizeOrderStatus(o?.status);
      const labelUrl = String(o?.shipping_label_url || '').trim();
      const tracking = String(o?.tracking_number || '').trim();
      const orderId = String(o?.id || '').trim();
      const hasRating = Boolean(ratedByOrderId[orderId]);
      const isCompleted = isOrderDelivered(o?.status);

      if (status === 'pending_payment') counts.pending_payment++;
      if ((status === 'paid' || labelUrl) && !tracking) counts.pending_shipping++;
      if (status === 'shipped' || tracking.length > 0) counts.shipped++;
      if (isCompleted && hasRating) counts.rated++;
      if (isCompleted && !hasRating) counts.not_rated++;
      if (status === 'paid') counts.paid++;
      if (!labelUrl) counts.no_label++;
      if (labelUrl) counts.with_label++;
    }

    return counts;
  }, [orders, ratedByOrderId]);

  const VENTAS_PAGE_SIZE = 10;
  const ventasTotalPages = Math.max(1, Math.ceil(filteredOrders.length / VENTAS_PAGE_SIZE));
  const ventasPaginated = useMemo(() => {
    const page = Math.min(Math.max(1, ventasPage), ventasTotalPages);
    const start = (page - 1) * VENTAS_PAGE_SIZE;
    return filteredOrders.slice(start, start + VENTAS_PAGE_SIZE);
  }, [filteredOrders, ventasPage, ventasTotalPages]);

  useEffect(() => {
    setVentasPage(1);
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    if (ventasPage > ventasTotalPages && ventasTotalPages >= 1) setVentasPage(1);
  }, [ventasTotalPages, ventasPage]);

  const handleUploadProof = async (orderId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Validate: EXACTLY 1 file (PDF o imagen)
    if (files.length !== 1) {
      setError('Sube 1 archivo: PDF o imagen.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMarking((p) => ({ ...p, [orderId]: true }));
    try {
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const fd = new FormData();
      fd.append('orderId', orderId);

      // Un solo archivo
      fd.append('file', files[0]);

      const res = await fetch('/api/orders/upload-proof', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo subir la evidencia.');

      const proofUrl = json.url;

      setOrders((prev) =>
        prev.map((o) => {
          if (String(o?.id || '') !== orderId) return o;

          const isPickup = o.shipping_option_id === 'pickup' || o.shipping_carrier === 'pickup';
          const update: any = {
            status: 'shipped',
            delivery_proof_url: proofUrl,
            shipped_at: new Date().toISOString()
          };

          if (isPickup) {
            update.shipping_carrier = 'pickup';
            update.tracking_number = 'ENTREGA_PERSONAL';
          }

          return { ...o, ...update };
        }),
      );
      setSuccess('Evidencia subida correctamente. La orden se marcó como entregada/enviada.');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir la evidencia.');
    } finally {
      setIsMarking((p) => ({ ...p, [orderId]: false }));
    }
  };

  // Subida individual para Constancia de Entrega o Foto de INE
  const handleUploadSingleProof = async (orderId: string, file: File | null, type: 'constancia' | 'ine') => {
    if (!file) return;

    setError(null);
    setSuccess(null);
    setIsMarking((p) => ({ ...p, [`${orderId}_${type}`]: true }));
    try {
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      let proofUrl: string | null = null;

      // Paso 1: Obtener signed URL del servidor (pequeño payload, sin archivo)
      const signedRes = await fetch('/api/orders/signed-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      });
      const signedJson = await signedRes.json().catch(() => ({}));
      if (!signedRes.ok) throw new Error(signedJson?.error || 'No se pudo preparar la subida.');

      // Paso 2: Subir archivo directo a Supabase Storage (sin límite de Vercel)
      const uploadRes = await fetch(signedJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Error al subir el archivo a storage.');

      proofUrl = signedJson.publicUrl;

      // Paso 3: Registrar la URL en la orden (solo URL, sin archivo)
      const fd = new FormData();
      fd.append('orderId', orderId);
      fd.append('type', type);
      fd.append('url', proofUrl);
      const regRes = await fetch('/api/orders/upload-proof', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
      });
      const regJson = await regRes.json().catch(() => ({}));
      if (!regRes.ok) throw new Error(regJson?.error || 'No se pudo registrar la evidencia.');

      // Guardar la URL del tipo correspondiente y verificar si el otro ya existe
      let otherUploaded = false;

      if (type === 'constancia') {
        setConstanciaUrlByOrderId((p) => {
          const updated = { ...p, [orderId]: proofUrl };
          return updated;
        });
        // Verificar el otro usando el estado actual (inmediato, no batched)
        setIneUrlByOrderId((p) => {
          otherUploaded = Boolean(p[orderId]);
          return p; // no modificar
        });
      } else {
        setIneUrlByOrderId((p) => {
          const updated = { ...p, [orderId]: proofUrl };
          return updated;
        });
        setConstanciaUrlByOrderId((p) => {
          otherUploaded = Boolean(p[orderId]);
          return p;
        });
      }

      // Pequeño delay para que React procese los setState
      await new Promise(r => setTimeout(r, 50));

      if (otherUploaded) {
        // Ambos archivos subidos — actualizar estado local de la orden
        setOrders((prev) =>
          prev.map((o) => {
            if (String(o?.id || '') !== orderId) return o;
            return {
              ...o,
              status: 'delivered',
              delivery_proof_url: proofUrl,
              shipped_at: new Date().toISOString(),
              delivered_at: new Date().toISOString(),
              shipping_carrier: 'pickup',
              tracking_number: 'ENTREGA_PERSONAL',
            };
          }),
        );
        setSuccess('¡Ambos archivos subidos! La orden se marcó como entregada.');
      } else {
        setSuccess(`${type === 'constancia' ? 'Constancia de Entrega' : 'Foto de INE'} subida correctamente. Falta subir ${type === 'constancia' ? 'la Foto de INE' : 'la Constancia de Entrega'}.`);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir la evidencia.');
    } finally {
      setIsMarking((p) => ({ ...p, [`${orderId}_${type}`]: false }));
    }
  };

  const handleUploadOwnLabelPDF = async (orderId: string, file: File | null) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecciona un archivo PDF válido.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsMarking((p) => ({ ...p, [`${orderId}_own_pdf`]: true }));
    try {
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      // 1. Get signed upload URL
      const signedRes = await fetch('/api/orders/signed-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          fileName: file.name,
          contentType: 'application/pdf',
        }),
      });
      const signedJson = await signedRes.json().catch(() => ({}));
      if (!signedRes.ok) throw new Error(signedJson?.error || 'No se pudo preparar la subida.');

      // 2. Upload file to Supabase storage
      const uploadRes = await fetch(signedJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Error al subir el PDF de la guía.');

      const publicUrl = signedJson.publicUrl;

      // 3. Automatically submit to mark-shipped
      const trackingNum = String(trackingDraft[orderId] || 'VER_GUIA_PDF').trim();
      const carrierName = String(carrierDraft[orderId] || 'Propio').trim();

      const markRes = await fetch('/api/orders/mark-shipped', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId,
          tracking_number: trackingNum,
          shipping_carrier: carrierName,
          shipping_label_url: publicUrl,
          shipping_method: 'seller_managed',
        }),
      });
      const markJson = await markRes.json().catch(() => ({}));
      if (!markRes.ok) throw new Error(markJson?.error || 'No se pudo marcar como enviado.');

      // 4. Update local React state
      setOrders((prev) =>
        prev.map((o) => {
          if (String(o?.id || '') !== orderId) return o;
          return {
            ...o,
            status: 'shipped',
            tracking_number: trackingNum,
            shipping_carrier: carrierName,
            shipping_label_url: publicUrl,
            shipping_method: 'seller_managed',
            shipped_at: new Date().toISOString(),
          };
        })
      );
      setSuccess('¡Guía de envío subida con éxito! Se notificó al comprador.');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir la guía de envío.');
    } finally {
      setIsMarking((p) => ({ ...p, [`${orderId}_own_pdf`]: false }));
    }
  };

  const markShipped = async (orderId: string) => {
    setError(null);
    setSuccess(null);
    setIsMarking((p) => ({ ...p, [orderId]: true }));

    // Snapshot for rollback
    const previousOrders = [...orders];

    const tracking = String(trackingDraft[orderId] ?? '').trim();
    const carrier = String(carrierDraft[orderId] ?? '').trim();

    if (tracking.length < 2) {
      setError('Ingresa un código de rastreo/nombre válido.');
      setIsMarking((p) => ({ ...p, [orderId]: false }));
      return;
    }

    let determinedMethod = 'seller_managed';
    const carrierLower = carrier.toLowerCase().trim();
    if (carrierLower === 'pickup' || carrierLower === 'personal_delivery' || carrierLower === 'entrega personal') {
      determinedMethod = 'personal_delivery';
    }

    // Optimistic Update
    setOrders((prev) =>
      prev.map((o) =>
        String(o?.id || '') === orderId
          ? {
            ...o,
            status: 'shipped',
            tracking_number: tracking,
            shipping_carrier: carrier || null,
            shipping_method: determinedMethod,
            shipped_at: new Date().toISOString()
          }
          : o,
      ),
    );

    try {
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/orders/mark-shipped', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          orderId, 
          tracking_number: tracking, 
          shipping_carrier: carrier,
          shipping_method: determinedMethod,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo marcar como enviado.');

      setSuccess('Listo: marcado como enviado. Se notificó al comprador.');
    } catch (e: unknown) {
      console.error(e);
      // Revert optimistic update
      setOrders(previousOrders);
      setError(e instanceof Error ? e.message : 'No se pudo marcar como enviado.');
    } finally {
      setIsMarking((p) => ({ ...p, [orderId]: false }));
    }
  };

  const handleDownloadProof = async (orderId: string) => {
    // Optimistic update
    const now = new Date().toISOString();
    setProofDownloadedAtByOrderId((prev) => ({ ...prev, [orderId]: now }));

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (token) {
        // Call API (fire and forget)
        fetch('/api/orders/proof-downloaded', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderId }),
        }).catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- 1. Sistema de Advertencias Global (Warning System) ---
  const hasLateShipments = useMemo(() => {
    const now = Date.now();
    return orders.some(o => {
      // Si status='paid' y no shipped, y pasaron 72h
      if (o.status === 'paid' && !o.shipped_at) {
        const created = new Date(o.created_at).getTime();
        return (now - created) > 72 * 60 * 60 * 1000;
      }
      return false;
    });
  }, [orders]);

  const hasActiveDisputes = useMemo(() => {
    return Object.values(disputeInfoByOrderId).some(
      (d) => String(d?.status || '').toLowerCase() === 'open'
    );
  }, [disputeInfoByOrderId]);

  return (
    <div className="min-h-screen bg-white pb-10">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-auto items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="GoVendy" className="h-full w-auto object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Ventas</div>
              <div className="text-[10px] text-gray-500">Panel de control</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-3 py-4">
        <PageTour steps={pageTours.ventas || []} pageId="ventas" />
        <SectionMessage section="ventas" />

        {/* --- Sistema de Advertencias Global --- */}
        {hasLateShipments && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm animate-pulse">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold">¡Tienes envíos atrasados!</h3>
              <p className="text-xs opacity-90">Algunos pedidos han superado el límite de 72 horas. Envíalos urgente para evitar penalizaciones.</p>
            </div>
          </div>
        )}
        {hasActiveDisputes && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-900 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold">Disputas en curso</h3>
              <p className="text-xs opacity-90">Tienes disputas activas que requieren tu atención. Revisa los detalles en cada pedido.</p>
            </div>
          </div>
        )}

        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-4 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">{success}</div>}

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5 relative">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-base font-bold text-gray-900">Historial de ventas</div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-extrabold text-green-800 ring-1 ring-green-200">
                  TÚ VENDISTE
                </span>
              </div>
              <div className="mt-0.5 text-xs text-gray-600">Gestiona tus envíos y cobros.</div>
            </div>
          </div>

          {!isBooting && orders.length > 0 ? (
            <div className="mt-4">
              {/* Buscador y Filtros */}
              <div className="mb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <svg
                    width="14"
                    height="14"
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
                    placeholder="Buscar..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-9 py-2 text-xs outline-none placeholder:text-gray-400 focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20"
                  />
                </div>
              </div>

              <div className="relative flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
                {/* Filtro activo siempre visible */}
                {(() => {
                  const filterConfig: Record<string, { label: string; count: number; color: string }> = {
                    all: { label: 'Todas', count: filterCounts.all, color: 'bg-brand-emerald text-white shadow-sm' },
                    pending_shipping: { label: 'Pendiente envío', count: filterCounts.pending_shipping, color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
                    pending_payment: { label: 'Pendiente pago', count: filterCounts.pending_payment, color: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
                    shipped: { label: 'Enviadas', count: filterCounts.shipped, color: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
                    rated: { label: 'Calificadas', count: filterCounts.rated, color: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
                    not_rated: { label: 'Sin Calificar', count: filterCounts.not_rated, color: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' },
                    paid: { label: 'Pagadas', count: filterCounts.paid, color: 'bg-green-100 text-green-700 ring-1 ring-green-200' },
                    no_label: { label: 'Sin Guía', count: filterCounts.no_label, color: 'bg-gray-200 text-gray-700 ring-1 ring-gray-300' },
                    with_label: { label: 'Con Guía', count: filterCounts.with_label, color: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
                  };
                  const active = filterConfig[activeFilter] || filterConfig.all;
                  return (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${active.color}`}
                    >
                      {active.label} {active.count > 0 ? `(${active.count})` : ''}
                    </button>
                  );
                })()}

                {/* Botón para expandir/colapsar */}
                <button
                  type="button"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  {filtersExpanded ? 'Menos' : 'Más filtros'}
                </button>

                {/* Filtros adicionales (colapsables) */}
                {filtersExpanded && (
                  <div className="flex flex-wrap gap-2 w-full mt-2 animate-slide-in">
                    {activeFilter !== 'all' && (
                      <button type="button" onClick={() => { setActiveFilter('all'); setFiltersExpanded(false); }} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100">
                        Todas {filterCounts.all > 0 ? `(${filterCounts.all})` : ''}
                      </button>
                    )}
                    {activeFilter !== 'pending_shipping' && (
                      <button type="button" onClick={() => { setActiveFilter('pending_shipping'); setFiltersExpanded(false); }} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100">
                        Pendiente envío {filterCounts.pending_shipping > 0 ? `(${filterCounts.pending_shipping})` : ''}
                      </button>
                    )}
                    {activeFilter !== 'pending_payment' && (
                      <button type="button" onClick={() => { setActiveFilter('pending_payment'); setFiltersExpanded(false); }} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100">
                        Pendiente pago {filterCounts.pending_payment > 0 ? `(${filterCounts.pending_payment})` : ''}
                      </button>
                    )}
                    {activeFilter !== 'shipped' && (
                      <button type="button" onClick={() => { setActiveFilter('shipped'); setFiltersExpanded(false); }} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100">
                        Enviadas {filterCounts.shipped > 0 ? `(${filterCounts.shipped})` : ''}
                      </button>
                    )}
                    {activeFilter !== 'rated' && (
                      <button type="button" onClick={() => { setActiveFilter('rated'); setFiltersExpanded(false); }} className="whitespace-nowrap rounded-xl px-3 py-1.5 text-[11px] font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100">
                        Calificadas {filterCounts.rated > 0 ? `(${filterCounts.rated})` : ''}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando...</div>
          ) : orders.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no tienes ventas.</div>
          ) : filteredOrders.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">No hay ventas que coincidan con este filtro.</div>
          ) : (
            <>
              {/* Leyenda compacta */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase text-gray-500">Leyenda:</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 shrink-0 rounded border border-green-500 bg-white" />
                  <span className="text-[10px] text-gray-700">Concretada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 shrink-0 rounded border border-yellow-500 bg-yellow-50" />
                  <span className="text-[10px] text-gray-700">En proceso</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 shrink-0 rounded border border-red-500 bg-red-50" />
                  <span className="text-[10px] text-gray-700">Disputa</span>
                </div>
              </div>
              <div className="mt-4 space-y-2" data-tour="orders-list">
                {ventasPaginated.map((o) => {
                  const buyerId = String(o?.buyer_id || '');
                  const buyer = buyerId ? buyerNames[buyerId] || `${buyerId.slice(0, 6)}…` : '—';
                  const items = itemsByOrder[String(o?.id || '')] ?? [];
                  const labelUrl = String(o?.shipping_label_url || '').trim();
                  const orderId = String(o?.id || '').trim();
                  const labelDownloadedAtFromDb = String(o?.label_downloaded_at || '').trim();
                  const labelDownloadedAtLocal = labelDownloadedAtByOrderId[orderId] || '';
                  const labelDownloadedAt = labelDownloadedAtLocal || labelDownloadedAtFromDb;
                  const isLabelDownloaded = Boolean(labelDownloadedAt);

                  const proofDownloadedAtFromDb = String(o?.delivery_proof_downloaded_at || '').trim();
                  const proofDownloadedAtLocal = proofDownloadedAtByOrderId[orderId] || '';
                  const proofDownloadedAt = proofDownloadedAtLocal || proofDownloadedAtFromDb;
                  const isProofDownloaded = Boolean(proofDownloadedAt);

                  const tracking = String((o as any)?.tracking_number || '').trim();
                  const carrier = String((o as any)?.shipping_carrier || '').trim();
                  const isPickup = (o as any)?.shipping_option_id === 'pickup' || carrier === 'pickup';
                  const shippedAt = String(o?.shipped_at || '').trim();
                  const canMarkShipped = orderId && (String(o?.status || '') === 'paid' || String(o?.status || '') === 'pending_payment');
                  const hasUnread = Boolean(hasUnreadByOrderId[orderId]);
                  const status = normalizeOrderStatus(o?.status);
                  const alreadyRated = Boolean(ratedByOrderId[orderId]);
                  const bothRated = Boolean(bothRatedByOrderId[orderId]);
                  const isPickupOrder = (o?.shipping_option_id === 'pickup' || carrier === 'pickup');
                  const pickupBothUploaded = Boolean(constanciaUrlByOrderId[orderId] && ineUrlByOrderId[orderId]) || Boolean(o?.delivery_proof_url);
                  // Para pickup: requiere TODOS los pasos completos antes de calificar
                  const pickupAllComplete = isPickupOrder ? Boolean(
                    pickupBothUploaded &&
                    isProofDownloaded &&
                    tracking.length >= 2 &&
                    carrier.length >= 1
                  ) : false;
                  const disputeId = orderId ? disputeByOrderId[orderId] : '';

                  const getBorderColor = () => {
                    if (disputeId) {
                      const di = disputeInfoByOrderId[orderId];
                      if (di?.status === 'open') {
                        return { border: 'border-red-500 ring-red-200 hover:border-red-600', left: 'border-red-500', bg: 'bg-red-50/30' };
                      }
                    }
                    if (isOrderDelivered(o?.status)) {
                      return { border: 'border-green-500 ring-green-200 hover:border-green-600', left: 'border-green-500', bg: 'bg-white/30' };
                    }
                    return { border: 'border-yellow-500 ring-yellow-200 hover:border-yellow-600', left: 'border-yellow-500', bg: 'bg-yellow-50/30' };
                  };

                  const borderColors = getBorderColor();

                  const isOrderCompleted = isOrderDelivered(o?.status);
                  const daysSinceShipped = shippedAt ? (() => {
                    const shippedDate = new Date(shippedAt);
                    const daysDiff = (currentTime.getTime() - shippedDate.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff;
                  })() : null;
                  const chatDisabled = isOrderCompleted || (daysSinceShipped !== null && daysSinceShipped >= 15);

                  // ⚠️ CRITICAL: For GoVendy free shipping orders where shipping_subsidy was never saved,
                  // calculate the actual GoVendy cost from listing weight and inject it before payoutNet.
                  const _carrier = String((o as any)?.shipping_carrier || '').trim().toLowerCase();
                  const _sFee = Number((o as any)?.shipping_fee || 0);
                  const _sSub = Number((o as any)?.shipping_subsidy || 0);
                  const _orderItemsForNet = itemsByOrder[o?.id] || [];
                  const _firstItemForNet = _orderItemsForNet[0];
                  const _listingIdForNet = String(_firstItemForNet?.listing_id || '').trim();
                  let orderForPayout = o;
                  if (_carrier === 'gopocket' && _sFee === 0 && _sSub === 0 && _listingIdForNet) {
                    // GoVendy free shipping with no subsidy recorded — calculate from listing weight
                    const _w = Number(weightByListingId[_listingIdForNet] || 0) || 1;
                    const _dims = dimsByListingId[_listingIdForNet] || { length_cm: 10, width_cm: 10, height_cm: 10 };
                    const _volW = (_dims.length_cm * _dims.width_cm * _dims.height_cm) / 5000;
                    const _finalWeight = Math.max(_w, _volW);
                    const _WEIGHT_RANGES = [
                      { max_weight_kg: 1, price: 175 },
                      { max_weight_kg: 5, price: 195 },
                      { max_weight_kg: 10, price: 235 },
                      { max_weight_kg: 15, price: 255 },
                      { max_weight_kg: 20, price: 275 },
                      { max_weight_kg: 25, price: 300 },
                      { max_weight_kg: 30, price: 325 },
                    ];
                    const _match = _WEIGHT_RANGES.find(r => _finalWeight <= r.max_weight_kg);
                    const _calcCost = _match ? _match.price : _WEIGHT_RANGES[_WEIGHT_RANGES.length - 1].price;
                    orderForPayout = { ...o, shipping_subsidy: _calcCost };
                  }
                  const netEarnings = payoutNet(orderForPayout);

                  // Calcular días de preparación (handling) máximos para esta orden
                  const orderItemsList = itemsByOrder[o?.id] || [];
                  const maxHandling = orderItemsList.length > 0
                    ? Math.max(...orderItemsList.map((it: any) => handlingDaysByListingId[it.listing_id] ?? 3))
                    : 3;

                  // Logic for Green Button (Seller Managed Evidence)
                  const firstItem = orderItemsList[0];
                  const listingId = String(firstItem?.listing_id || '').trim();
                  // ✅ FUENTE DE VERDAD: usar shipping_method si está disponible y detectar si subió su propia guía
                  const sm = String((o as any)?.shipping_method || '').trim();
                  const isSellerManagedUploaded = sm === 'seller_managed' || tracking === 'VER_GUIA_PDF' || labelUrl.includes('/delivery-proofs/');

                  let isPersonalDelivery = false;
                  let isGoVendyOrder = false;
                  let isSellerManagedOrder = false;
                  const hasSubsidy = Number((o as any)?.shipping_subsidy || 0) > 0;
                  
                  if (isSellerManagedUploaded) {
                    isSellerManagedOrder = true;
                  } else if (sm) {
                    isPersonalDelivery = sm === 'personal_delivery';
                    isGoVendyOrder = sm === 'gopocket' || sm === 't1';
                    isSellerManagedOrder = sm === 'seller_managed';
                  } else {
                    // Fallback: inferencia para órdenes antiguas sin shipping_method
                    const optionId = String(o?.shipping_option_id || '').trim();
                    const carrierField = String(o?.shipping_carrier || '').trim();
                    const hasPlatformLabel = Boolean(String(o?.shipping_label_url || '').trim());
                    const orderItemsCfg = itemsByOrder[o?.id] || [];
                    const anySellerManagedCfg = orderItemsCfg.some((it: any) => shippingBySellerByListingId[it.listing_id] === true);
                    const anyGoVendyCfg = orderItemsCfg.some((it: any) => shippingBySellerByListingId[it.listing_id] === false);
                    const isPickupFallback = carrierField === 'pickup' || optionId === 'pickup';
                    const hasGoVendyShipping = Boolean(optionId) && optionId !== 'pickup' && !isPickupFallback;
                    const isGoVendyConfigured = orderItemsCfg.length > 0 ? (anyGoVendyCfg && !anySellerManagedCfg && !isPickupFallback) : false;
                    isPersonalDelivery = isPickupFallback;
                    isGoVendyOrder = !isPersonalDelivery && (hasGoVendyShipping || hasPlatformLabel || hasSubsidy || isGoVendyConfigured);
                    isSellerManagedOrder = !isPersonalDelivery && !isGoVendyOrder;
                  }
                  const showGreenButton = isSellerManagedOrder;
                  const isT1Order = sm === 't1';
                  const isDigitalOrder = sm === 'digital' || productTypeByListingId[listingId] === 'digital';
                  const digitalFields = digitalFieldsByListingId[listingId] || [];

                  // Para envío gestionado por vendedor: requiere rastreo + enviado + guía subida
                  const sellerManagedAllComplete = isSellerManagedOrder ? Boolean(
                    tracking.length >= 2 &&
                    carrier.length >= 1 &&
                    (status === 'shipped' || status === 'delivered') &&
                    (o?.delivery_proof_url || labelUrl)
                  ) : false;
                  const canRateBuyer = Boolean(orderId && buyerId && !alreadyRated && (
                    isPickupOrder
                      ? pickupAllComplete
                      : isSellerManagedOrder
                        ? sellerManagedAllComplete
                        : (labelUrl || status === 'delivered' || status === 'shipped' || tracking)
                  ));

                  return (
                    <div
                      key={String(o?.id || Math.random())}
                      className={`rounded-xl border-2 bg-white p-2.5 shadow-sm ring-1 hover:shadow-md transition-all ${borderColors.border} ${hasUnread ? borderColors.bg : ''} relative`}
                    >
                      <div className={`border-l-4 pl-2.5 -ml-2.5 ${borderColors.left}`}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                                Tu Venta
                              </span>
                              <OrderSourceChip isAuction={String((o as any)?.order_source || '').toLowerCase() === 'auction'} />
                              <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                <span className="font-mono">{String(o?.id || '')}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const txt = String(o?.id || '').trim();
                                    if (txt) navigator.clipboard?.writeText(txt).catch(() => { });
                                  }}
                                  className="ml-1 rounded bg-gray-200 px-1 py-[1px] text-[10px] font-extrabold text-gray-800 hover:bg-gray-300 active:scale-95"
                                  aria-label="Copiar ID"
                                  title="Copiar ID"
                                >
                                  Copiar
                                </button>
                              </div>
                              <OrderStatusBadge status={o?.status} />
                              {(o as any)?.payment_method === 'mercadopago' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 ring-1 ring-sky-300">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M12 5l7 7-7 7" /></svg>
                                  MercadoPago
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500">{formatDateTime(o?.created_at)}</span>
                              {(() => {
                                if (!disputeId) return null;
                                const di = disputeInfoByOrderId[orderId];
                                const st = String(di?.status || '').trim();
                                if (st === 'open') {
                                  return (
                                    <Link href={`/dashboard/disputas/${disputeId}`} className="inline-flex items-center gap-1.5 rounded-full border border-red-400 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-900 shadow-sm hover:bg-red-100 animate-pulse">
                                      <span>Disputa Activa</span>
                                    </Link>
                                  );
                                }
                                return (
                                  <Link href={`/dashboard/disputas/${disputeId}`} className="inline-flex items-center gap-1.5 rounded-full border border-green-400 bg-white px-2 py-0.5 text-[10px] font-extrabold text-green-900 shadow-sm hover:bg-green-100">
                                    <span>Disputa resuelta</span>
                                  </Link>
                                );
                              })()}
                            </div>

                            <div className="mt-3 mb-2 flex flex-col gap-1">
                              <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">{isDigitalOrder ? 'Tipo de Entrega:' : 'Método de Envío:'}</span>
                              {isDigitalOrder ? (
                                <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 shadow-sm w-fit">
                                  💎 PRODUCTO DIGITAL
                                </div>
                              ) : isPersonalDelivery ? (
                                <div className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-800 ring-1 ring-purple-600/20 shadow-sm w-fit">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                  ENTREGA PERSONAL
                                </div>
                              ) : isGoVendyOrder ? (
                                isT1Order ? (
                                  <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1.5 text-xs font-bold text-orange-800 ring-1 ring-orange-300 shadow-sm w-fit">
                                    🚀 {hasSubsidy ? 'ENVÍO GRATIS POR EL VENDEDOR' : `GOVENDY PREMIUM ${carrier ? `· ${carrier}` : ''}`}
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-700/20 shadow-sm w-fit">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                    {hasSubsidy ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍOS GOVENDY'}
                                  </div>
                                )
                              ) : (isSellerManagedOrder && (o?.delivery_proof_url || labelUrl || o?.self_ship_evidence_url)) ? (
                                <div className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800 ring-1 ring-green-600/20 shadow-sm w-fit">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                  {hasSubsidy ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍO GESTIONADO POR EL VENDEDOR'}
                                </div>
                              ) : isSellerManagedOrder ? (
                                <div className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 ring-1 ring-amber-600/30 shadow-sm w-fit">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19" /><line x1="15" y1="9" x2="15.01" y2="9" /><line x1="19" y1="9" x2="19.01" y2="9" /><line x1="23" y1="9" x2="23.01" y2="9" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
                                  {hasSubsidy ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍO GESTIONADO POR EL VENDEDOR'}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 ring-1 ring-amber-600/30 shadow-sm w-fit">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19" /><line x1="15" y1="9" x2="15.01" y2="9" /><line x1="19" y1="9" x2="19.01" y2="9" /><line x1="23" y1="9" x2="23.01" y2="9" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
                                  {hasSubsidy ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍO GESTIONADO POR EL VENDEDOR'}
                                </div>
                              )}
                            </div>

                            {!isOrderCompleted && !isDigitalOrder && !isPersonalDelivery && (
                              <div className="mt-2.5 flex flex-wrap gap-3 max-w-2xl w-full">
                                {/* Panel A: Paga y genera tu etiqueta de envío */}
                                <div className="flex-1 min-w-[280px] p-3 rounded-2xl bg-gray-50 border border-gray-150 shadow-xs">
                                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Paga y genera tu etiqueta de envío:
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Link 
                                      href="/estafeta/cotizar" 
                                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5"
                                    >
                                      <span>🏪 Tienda Estafeta</span>
                                    </Link>
                                    <Link 
                                      href="/dashboard/envios" 
                                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5"
                                    >
                                      <span>🚚 Envíos GoVendy</span>
                                    </Link>
                                  </div>
                                </div>

                                {/* Panel B: Deseo enviar por mi propia cuenta */}
                                <div className="flex-1 min-w-[280px] p-3 rounded-2xl bg-gray-50 border border-gray-150 shadow-xs">
                                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    Deseo enviar por mi propia cuenta:
                                  </div>
                                  <div>
                                    {o?.shipping_label_url ? (
                                      <div className="flex items-center gap-1.5 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs font-bold text-green-700">
                                        <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Guía propia subida ✓
                                      </div>
                                    ) : (
                                      <label className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5 cursor-pointer ${isMarking[`${orderId}_own_pdf`] ? 'opacity-50 cursor-wait' : ''}`}>
                                        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        <span>{isMarking[`${orderId}_own_pdf`] ? 'Subiendo...' : 'Subir Guía (PDF)'}</span>
                                        <input
                                          type="file"
                                          accept=".pdf,application/pdf"
                                          className="hidden"
                                          disabled={Boolean(isMarking[`${orderId}_own_pdf`])}
                                          onChange={(e) => {
                                            const f = e.target.files?.[0] || null;
                                            handleUploadOwnLabelPDF(orderId, f);
                                          }}
                                        />
                                      </label>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="w-full mt-2 mb-2 flex items-center gap-3">
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                                {thumbByListingId[listingId] ? (
                                  <img
                                    src={thumbByListingId[listingId]}
                                    alt={firstItem?.title || 'Producto'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {(() => {
                                  const t = sanitizeTitle(firstItem?.title) || titleByListingId[listingId] || 'Producto vendido';
                                  if (isUuid(listingId)) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <Link href={`/listings/${listingId}`} className="text-sm font-bold text-gray-900 hover:text-brand-emerald hover:underline line-clamp-2 leading-tight">
                                          {t}
                                        </Link>
                                        {(firstItem as any)?.listings?.sale_type === 'auction' ? (
                                          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-brand-emerald ring-1 ring-emerald-100 animate-pulse">
                                            Subasta
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">
                                        {t}
                                      </span>
                                      {(firstItem as any)?.listings?.sale_type === 'auction' ? (
                                        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-brand-emerald ring-1 ring-emerald-100 animate-pulse">
                                          Subasta
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                                <div className="mt-0.5 text-[10px] text-gray-500">
                                  Cantidad: {firstItem?.quantity || 1}
                                </div>
                              </div>
                            </div>

                            {!isPickup && (
                              <div className="mb-3 mt-1">
                                {(() => {
                                  if (alreadyRated) {
                                    return (
                                      <div className="rounded-lg bg-white p-2 text-center text-[11px] font-bold text-green-700 animate-pulse border border-green-200">
                                        Listo Venta completada Sigue Asi
                                      </div>
                                    );
                                  }
                                  if (isDigitalOrder) {
                                    if (status === 'pending_payment') {
                                      return (
                                        <div className="rounded-lg bg-gray-100 p-2 text-center text-[11px] font-bold text-gray-700 animate-pulse border border-gray-200">
                                          1- Felicidades recibiste una compra, espera se acredite el pago.
                                        </div>
                                      );
                                    }
                                    if (status === 'paid') {
                                      return (
                                        <div className="rounded-lg bg-indigo-50 p-2 text-center text-[11px] font-bold text-indigo-700 animate-pulse border border-indigo-200">
                                          2- Pago acreditado. Entrega el producto digital al comprador.
                                        </div>
                                      );
                                    }
                                    if (shippedAt) {
                                      return (
                                        <div className="rounded-lg bg-purple-50 p-2 text-center text-[11px] font-bold text-purple-700 animate-pulse border border-purple-200">
                                          3- Producto digital entregado. Califica al comprador.
                                        </div>
                                      );
                                    }
                                    return null;
                                  }
                                  if (shippedAt) {
                                    return (
                                      <div className="rounded-lg bg-purple-50 p-2 text-center text-[11px] font-bold text-purple-700 animate-pulse border border-purple-200">
                                        5- Muy bien ahora solo Califica al Comprador
                                      </div>
                                    );
                                  }
                                  if (status === 'paid') {
                                    if (labelUrl) {
                                      if (isLabelDownloaded) {
                                        return (
                                          <div className="rounded-lg bg-blue-50 p-2 text-center text-[11px] font-bold text-blue-700 animate-pulse border border-blue-200">
                                            4- Entrega el paquete en la paqueteria lo antes posible
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="rounded-lg bg-indigo-50 p-2 text-center text-[11px] font-bold text-indigo-700 animate-pulse border border-indigo-200">
                                            3- Guia Generada Descarga la Guia
                                          </div>
                                        );
                                      }
                                    } else {
                                      if (isSellerManagedOrder) {
                                        return (
                                          <div className="rounded-lg bg-white p-2 text-center text-[11px] font-bold text-green-700 animate-pulse border border-green-200">
                                            El Envío corre por tu cuenta: 1. Agrega el número de rastreo primero. 2. Sube la evidencia de que realizaste el envío.
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className="rounded-lg bg-amber-50 p-2 text-center text-[11px] font-bold text-amber-700 border border-amber-200">
                                          2- Pago Acreditado. Pendiente de generar etiqueta de envío arriba.
                                        </div>
                                      );
                                    }
                                  }
                                  if (status === 'pending_payment') {
                                    return (
                                      <div className="rounded-lg bg-gray-100 p-2 text-center text-[11px] font-bold text-gray-700 animate-pulse border border-gray-200">
                                        1- Felicidades recibiste una compra espera se acredite el pago.
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}

                            {/* Tutorial Adicional para Entrega Personal (Rosa) */}
                            {isPickup && (
                              <div className="mb-3 mt-1">
                                {(() => {
                                  if (alreadyRated) return null;

                                  if (status === 'pending_payment') {
                                    return (
                                      <div className="rounded-lg bg-white p-2 text-center text-[11px] font-bold text-emerald-700 animate-pulse border border-emerald-200">
                                        1- Felicidades Recibiste una compra Espera a que se acredite el pago
                                      </div>
                                    );
                                  }

                                  if (status === 'paid') {
                                    if (isProofDownloaded) {
                                      return (
                                        <div className="rounded-lg bg-white p-2 text-center text-[11px] font-bold text-emerald-700 animate-pulse border border-emerald-200">
                                          3- Verifica Sigue las Instrucciones de la Constancia de Entrega Personal y Sube La Evidencia para liberar tu pago.
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="rounded-lg bg-white p-2 text-center text-[11px] font-bold text-emerald-700 animate-pulse border border-emerald-200">
                                        2- El Pago a sido acreditado Contacta al comprador por chat y descarga la constancia de entrega
                                      </div>
                                    );
                                  }

                                  if (status === 'shipped' || status === 'delivered') {
                                    return (
                                      <div className="rounded-lg bg-white p-2 text-center text-[11px] font-bold text-emerald-700 animate-pulse border border-emerald-200">
                                        4- No olvides Solicitar a tu comprador te califique para liberar tu dinero.
                                      </div>
                                    );
                                  }

                                  return null;
                                })()}
                              </div>
                            )}

                            {/* --- 3. Contadores de tiempo (Countdown) --- */}
                            {!isDigitalOrder && !shippedAt && status === 'paid' && (
                              <CountdownShipment
                                createdAt={o?.created_at}
                                handlingDays={maxHandling}
                                onExpire={() => {
                                  fetch('/api/disputes/auto-expire', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ orderId: o.id })
                                  }).then(res => res.json()).then(d => {
                                    if (d.ok) {
                                      window.location.reload();
                                    }
                                  }).catch(console.error);
                                }}
                              />
                            )}

                            {/* Contador 7 días Subasta */}
                            {items.some((it: any) => (it.listings as any)?.sale_type === 'auction') &&
                              !shippedAt && (status === 'pending_payment' || status === 'paid') && (
                                <AuctionDeadline createdAt={o?.created_at} orderStatus={o?.status} />
                              )}

                            {/* Contador de 48h para auto-liberación si ya fue entregado */}
                            {status === 'delivered' && !alreadyRated && (
                              <div className="mt-2 max-w-xs">
                                <div className="mb-1 text-xs font-bold text-green-600 flex items-center gap-1">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  Envío Entregado
                                </div>
                                <Countdown48Hours deliveredAt={o?.delivered_at} />
                              </div>
                            )}

                            {(() => {
                              const salePrice = toNumber((o as any)?.subtotal ?? (Number(o?.total || 0) - Number(o?.shipping_fee || 0)));
                              const commission = toNumber((o as any)?.commission_fee ?? 0);
                              const commissionPct = salePrice > 0 ? (commission / salePrice) * 100 : 0;
                              return (
                                <div className={`mt-2 mb-2 flex flex-col gap-2 rounded-xl p-3 ring-1 ${netEarnings < 0 ? 'bg-red-50/50 ring-red-100' : 'bg-white/60 ring-green-200'}`}>
                                  <div className="flex items-center gap-2 text-xs text-gray-700">
                                    <span className="font-medium text-gray-500">Comprador:</span>
                                    <span className="font-bold">{buyer}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-black drop-shadow-sm ${netEarnings < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {netEarnings < 0 ? '' : '+'}{formatMoney(netEarnings)}
                                    </span>
                                    <span className={`text-[10px] font-semibold ${netEarnings < 0 ? 'text-red-700/70' : 'text-green-700/70'}`}>
                                      {netEarnings < 0 ? 'Saldo Negativo' : 'Tu ganancia'}
                                    </span>
                                  </div>
                                  {netEarnings > 0 && salePrice > 0 && (
                                    <div className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-green-200/60">
                                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]">
                                        <span className="text-gray-500">Vendiste en</span>
                                        <span className="font-extrabold text-gray-800">{formatMoney(salePrice)}</span>
                                        <span className="text-gray-400 mx-0.5">→</span>
                                        <span className="text-gray-500">Cobrarás</span>
                                        <span className="font-extrabold text-green-700">{formatMoney(netEarnings)}</span>
                                      </div>
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                          <div
                                            className="h-full rounded-full bg-white0"
                                            style={{ width: `${Math.min(100, (netEarnings / salePrice) * 100).toFixed(1)}%` }}
                                          />
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold text-green-700">
                                          {commissionPct > 23.5 ? 'Comisión Mínima' : commissionPct > 0 ? `Solo ${commissionPct.toFixed(1)}% comisión` : 'Sin comisión'}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Artículos: lista compacta */}
                            {items.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {items.slice(0, 3).map((it: any, idx: number) => {
                                  const lid = String(it?.listing_id || '').trim();
                                  const t = String(it?.title || 'Artículo');
                                  const img = lid ? thumbByListingId[lid] : '';
                                  return (
                                    <div key={idx} className="flex gap-2 rounded-lg border border-gray-100 bg-white p-1.5 ring-1 ring-black/5 hover:bg-gray-50 items-center">
                                      {img ? (
                                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-gray-100">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={img} alt={t} className="h-full w-full object-cover" />
                                        </div>
                                      ) : (
                                        <div className="h-8 w-8 shrink-0 rounded bg-gray-100" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <Link href={`/listings/${String(it.listing_id)}`} className="text-xs font-bold text-gray-900 hover:text-brand-emerald hover:underline line-clamp-1">
                                          {t}
                                        </Link>
                                      </div>
                                    </div>
                                  );
                                })}
                                {items.length > 3 && <div className="text-[10px] text-gray-500 pl-1">+{items.length - 3} más</div>}
                              </div>
                            ) : null}
                          </div>

                          {/* Columna Derecha: Acciones y Totales */}
                          <div className="shrink-0 w-full sm:w-[260px] rounded-xl bg-gray-50 px-3 py-2.5 text-xs ring-1 ring-black/5">
                            <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-2">
                              <span className="text-[10px] font-bold text-gray-800">Total Venta (Cliente)</span>
                              <span className="font-extrabold text-gray-900">
                                {formatMoney(o?.payment_method_type === 'direct' ? (o?.subtotal || (Number(o?.total || 0) - Number(o?.shipping_fee || 0))) : o?.total)}
                              </span>
                            </div>

                            {/* Desglose detallado de la venta */}
                            <div className="space-y-1.5 mb-3">
                              {/* Precio base del producto */}
                              <div className="flex justify-between text-[10px] text-gray-600">
                                <span>Precio Producto</span>
                                <span>{formatMoney(o?.subtotal || (Number(o?.total || 0) - Number(o?.shipping_fee || 0)))}</span>
                              </div>

                              {/* Envío — ocultar para productos digitales o de pago directo por transferencia */}
                              {!isDigitalOrder && !isPickupOrder && o?.payment_method_type !== 'direct' && (
                                <div className="flex justify-between text-[10px] text-gray-600">
                                  <span className="flex items-center gap-1">
                                    {isT1Order
                                      ? <><span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 ring-1 ring-orange-300">🚀 PREMIUM</span>{carrier ? ` · ${carrier}` : ''}</>
                                      : isSellerManagedOrder
                                        ? Number(o?.shipping_fee || 0) === 0 ? <span className="text-green-600 font-bold">Envío Gratis (Vendedor)</span> : 'Envío Vendedor'
                                        : 'Envío GoVendy'
                                    }
                                  </span>
                                  <span>
                                    {Number(o?.shipping_fee || 0) === 0 && !isT1Order && !isSellerManagedOrder
                                      ? <span className="text-green-600 font-bold">Gratis</span>
                                      : Number(o?.shipping_fee || 0) === 0 && isSellerManagedOrder
                                        ? null
                                        : formatMoney(o?.shipping_fee)
                                    }
                                  </span>
                                </div>
                              )}
                              {isDigitalOrder && (
                                <div className="flex justify-between text-[10px] text-gray-600">
                                  <span>Entrega</span>
                                  <span className="text-indigo-600 font-bold">Digital</span>
                                </div>
                              )}

                              {/* Peso y Dimensiones — ocultar para digital */}
                              {!isDigitalOrder && (() => {
                                const oid = String(o?.id || '').trim();
                                const w = Number(weightByOrderId[oid] || 0);
                                const dims = dimsByOrderId[oid];
                                const hasWeight = w > 0;
                                const hasDims = dims && (dims.length_cm > 0 || dims.width_cm > 0 || dims.height_cm > 0);
                                if (!hasWeight && !hasDims) return null;
                                return (
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
                                    <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    <span className="text-gray-400">Paquete:</span>
                                    {hasWeight && <span className="font-semibold text-gray-700">{w.toFixed(2)} kg</span>}
                                    {hasWeight && hasDims && <span className="text-gray-300">·</span>}
                                    {hasDims && <span className="font-semibold text-gray-700">{Number(dims!.length_cm || 0)}×{Number(dims!.width_cm || 0)}×{Number(dims!.height_cm || 0)} cm</span>}
                                  </div>
                                );
                              })()}

                              <div className="my-1.5 border-t border-dashed border-gray-200"></div>

                              {/* Deducciones / Costos Vendedor */}
                              {(() => {
                                const commVal = toNumber(o?.commission_fee);
                                const subVal = toNumber((o as any)?.subtotal ?? (Number(o?.total || 0) - Number(o?.shipping_fee || 0)));
                                const pct = subVal > 0 ? (commVal / subVal) * 100 : 0;
                                const isMin = pct > 23.5;
                                return (
                                  <div className="flex justify-between text-[10px] text-gray-600">
                                    <span className="text-gray-500">{isMin ? 'Comisión Mínima' : 'Comisión Venta'}</span>
                                    <span className="text-red-600">-{formatMoney(commVal)}</span>
                                  </div>
                                );
                              })()}

                              {/* Subsidio de envío (real or calculated for GoVendy free shipping) */}
                              {!isDigitalOrder && (() => {
                                const displaySub = Number((orderForPayout as any)?.shipping_subsidy || 0);
                                if (displaySub <= 0) return null;
                                const isCalculated = Number(o?.shipping_subsidy || 0) === 0 && displaySub > 0;
                                return (
                                  <div className="flex justify-between text-[10px] text-gray-600">
                                    <span className="text-gray-500">{isCalculated ? 'Envío GoVendy (Gratis)' : 'Subsidio Envío'}</span>
                                    <span className="text-red-600">-{formatMoney(displaySub)}</span>
                                  </div>
                                );
                              })()}

                              {/* Cupón */}
                              {(Number(o?.coupon_discount || 0) > 0) && (
                                <div className="flex justify-between text-[10px] text-gray-600">
                                  <span className="text-gray-500">Descuento Cupón</span>
                                  <span className="text-red-600">-{formatMoney(o?.coupon_discount)}</span>
                                </div>
                              )}

                              {/* Retenciones Fiscales (solo si el sistema está activo y hay retención) */}
                              {Number((o as any)?.isr_withheld || 0) > 0 && (
                                <div className="flex justify-between text-[10px] text-gray-600">
                                  <span className="text-gray-500">ISR retenido</span>
                                  <span className="text-red-600">-{formatMoney((o as any)?.isr_withheld)}</span>
                                </div>
                              )}
                              {Number((o as any)?.iva_withheld || 0) > 0 && (
                                <div className="flex justify-between text-[10px] text-gray-600">
                                  <span className="text-gray-500">IVA retenido</span>
                                  <span className="text-red-600">-{formatMoney((o as any)?.iva_withheld)}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                              <span className="text-[10px] font-bold text-gray-900">Tu Ganancia Neta</span>
                              <span className={`font-extrabold ${netEarnings < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatMoney(netEarnings)}
                              </span>
                            </div>

                            {/* Acciones de Pago Directo */}
                            {o?.payment_method_type === 'direct' && (
                              <div className="my-3 space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
                                <div className="text-[11px] font-bold text-blue-900">Pago Directo por Transferencia</div>
                                {o?.status === 'awaiting_voucher' && !o?.buyer_payment_voucher_url && (
                                  <div className="text-[10px] text-blue-800">
                                    Esperando que el comprador suba su comprobante de pago.
                                  </div>
                                )}
                                {(o?.status === 'verifying_payment' || o?.status === 'awaiting_voucher') && o?.buyer_payment_voucher_url && (
                                  <div className="space-y-2">
                                    <div className="text-[10px] text-blue-800">El comprador ha subido su comprobante.</div>
                                    <a href={o.buyer_payment_voucher_url} target="_blank" rel="noopener noreferrer" className="block text-center text-[10px] font-bold text-blue-700 underline">
                                      Ver Comprobante
                                    </a>
                                    <div className="flex gap-2">
                                      {confirmingApproveOrderId === o.id ? (
                                        <div className="flex-1 rounded border border-green-200 bg-green-50 p-2 text-center flex flex-col gap-2">
                                          <div className="text-[10px] font-bold text-green-900">¿Recibiste el dinero?</div>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const res = await fetch('/api/orders/voucher/approve', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ orderId: o.id })
                                                  });
                                                  const json = await res.json().catch(() => ({}));
                                                  if (res.ok) {
                                                    setConfirmingApproveOrderId(null);
                                                    bumpOrdersRefresh();
                                                  } else {
                                                    alert(`Error: ${json?.error || `HTTP ${res.status}`}`);
                                                  }
                                                } catch (e: any) { alert(`Error de conexión: ${e?.message || 'Sin detalles'}`); }
                                              }}
                                              className="flex-1 rounded bg-green-600 py-1 text-[10px] font-bold text-white hover:bg-green-700"
                                            >
                                              Sí, Aprobar
                                            </button>
                                            <button onClick={() => setConfirmingApproveOrderId(null)} className="flex-1 rounded bg-gray-200 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-300">
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : rejectingOrderId === o.id ? (
                                        <div className="flex-1 rounded border border-red-200 bg-red-50 p-2 flex flex-col gap-2">
                                          <div className="text-[10px] font-bold text-red-900">Motivo del rechazo</div>
                                          <input 
                                            type="text" 
                                            className="w-full rounded border border-red-300 px-2 py-1 text-[10px] outline-none focus:border-red-500" 
                                            placeholder="Escribe el motivo..." 
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              disabled={!rejectReason.trim()}
                                              onClick={async () => {
                                                if (!rejectReason.trim()) return;
                                                try {
                                                  const res = await fetch('/api/orders/voucher/reject', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ orderId: o.id, reason: rejectReason.trim() })
                                                  });
                                                  if (res.ok) {
                                                    setRejectingOrderId(null);
                                                    setRejectReason('');
                                                    bumpOrdersRefresh();
                                                  } else alert('Error al rechazar.');
                                                } catch (e) { alert('Error de conexión'); }
                                              }}
                                              className="flex-1 rounded bg-red-600 py-1 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                              Confirmar
                                            </button>
                                            <button onClick={() => { setRejectingOrderId(null); setRejectReason(''); }} className="flex-1 rounded bg-gray-200 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-300">
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => setConfirmingApproveOrderId(o.id)}
                                            className="flex-1 rounded bg-green-600 py-1.5 text-[10px] font-bold text-white hover:bg-green-700"
                                          >
                                            Aprobar Pago
                                          </button>
                                          <button
                                            onClick={() => { setRejectingOrderId(o.id); setRejectReason(''); }}
                                            className="flex-1 rounded bg-red-600 py-1.5 text-[10px] font-bold text-white hover:bg-red-700"
                                          >
                                            Rechazar
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              {!isDigitalOrder && !(o?.shipping_option_id === 'pickup' || o?.shipping_carrier === 'pickup') ? (
                                <div className="space-y-2 relative">
                                  {/* Estado: Pendiente de Generar Guía */}
                                  {!labelUrl && o?.shipping_option_id && !o?.shipping_label_url && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-center">
                                      <div className="text-[10px] font-bold text-amber-950">Pendiente de generar guía</div>
                                      <div className="text-[10px] text-amber-700">Selecciona una opción arriba para obtener tu etiqueta.</div>
                                    </div>
                                  )}

                                  {/* Estado: Guía Lista */}
                                  {labelUrl && (
                                    <>
                                      <div className={isLabelDownloaded ? 'flex items-center gap-1 text-[10px] font-bold text-green-700' : 'flex items-center gap-1 text-[10px] font-bold text-amber-800'}>
                                        {isLabelDownloaded ? '✓ Guía descargada' : '⏳ Guía lista'}
                                      </div>
                                    </>
                                  )}

                                  {/* Botón Descargar (Siempre visible, deshabilitado si no hay guía) */}
                                  <button
                                    type="button"
                                    disabled={!labelUrl}
                                    onClick={async () => {
                                      if (!labelUrl) return;
                                      const orderIdStr = String(o?.id || '');
                                      if (!isLabelDownloaded) {
                                        const now = new Date().toISOString();
                                        setLabelDownloadedAtByOrderId((prev) => ({ ...prev, [orderIdStr]: now }));
                                      }
                                      try {
                                        const { data: sess } = await supabase.auth.getSession();
                                        const token = sess.session?.access_token;
                                        if (token) {
                                          await fetch('/api/orders/label-downloaded', {
                                            method: 'POST',
                                            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                                            body: JSON.stringify({ orderId: orderIdStr }),
                                          }).catch(() => null);
                                        }
                                      } finally {
                                        window.open(labelUrl, '_blank', 'noopener,noreferrer');
                                      }
                                    }}
                                    className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition ${!labelUrl
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed ring-1 ring-gray-200'
                                      : isLabelDownloaded
                                        ? 'bg-green-600 text-white ring-1 ring-green-700 hover:bg-green-700'
                                        : 'bg-brand-emerald text-white ring-1 ring-brand-emerald hover:opacity-90 animate-subtle-pulse'
                                      }`}
                                  >
                                    {isLabelDownloaded ? 'Volver a descargar' : 'Descargar guía'}
                                  </button>

                                  {!labelUrl && o?.shipping_option_id && !o?.shipping_label_url && (
                                    <div className="text-[10px] text-gray-500 text-center">
                                      Si tarda demasiado, contacta a soporte.
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {/* Entrega Digital */}
                              {isDigitalOrder && status !== 'pending_payment' ? (
                                <DigitalDeliverySeller
                                  orderId={orderId}
                                  listingId={listingId}
                                  deliveryFields={digitalFields.length > 0 ? digitalFields : [{ label: 'Serial' }]}
                                />
                              ) : null}

                              {/* Envío / Tracking — Solo para productos físicos */}
                              {/* Para seller-managed: siempre mostrar la sección de envío hasta que se cumplan todos los pasos */}
                              {!isDigitalOrder && tracking && !isPickupOrder && !(isSellerManagedOrder && !sellerManagedAllComplete) ? (
                                <div className="space-y-2">
                                  <div className="rounded-lg border border-gray-100 bg-white px-2 py-1.5 text-[10px]">
                                    <div className="text-gray-500">Rastreo ({carrier || '—'}):</div>
                                    <div className="font-mono font-bold text-gray-900 truncate">{tracking}</div>
                                  </div>
                                </div>
                              ) : !isDigitalOrder && (canMarkShipped || isPickupOrder || (isSellerManagedOrder && !sellerManagedAllComplete)) ? (
                                <div className="space-y-2 relative">
                                  {isPickupOrder && (
                                    <div className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5">
                                      <div className="text-[10px] text-emerald-900 leading-tight">
                                        Sube la evidencia para procesar el pago.
                                      </div>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {isSellerManagedOrder ? (
                                      <select
                                        value={carrierDraft[orderId] ?? carrier ?? ''}
                                        onChange={(e) => setCarrierDraft((p) => ({ ...p, [orderId]: e.target.value }))}
                                        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-brand-emerald"
                                        disabled={(status === 'pending_payment' && !labelUrl) || (!!tracking && !isPickupOrder)}
                                      >
                                        <option value="" disabled>Paquetería</option>
                                        <option value="DHL">DHL</option>
                                        <option value="Estafeta">Estafeta</option>
                                        <option value="Fedex">Fedex</option>
                                        <option value="Paquetexpress">Paquetexpress</option>
                                        <option value="Ups">Ups</option>
                                        <option value="Sendex">Sendex</option>
                                        <option value="Castores">Castores</option>
                                        <option value="Tres guerras">Tres guerras</option>
                                        <option value="Otra paqueteria">Otra paqueteria</option>
                                      </select>
                                    ) : (
                                      <select
                                        value={carrierDraft[orderId] ?? carrier ?? (isPickupOrder ? 'Entrega Personal' : '')}
                                        onChange={(e) => setCarrierDraft((p) => ({ ...p, [orderId]: e.target.value }))}
                                        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-brand-emerald"
                                        disabled={isPickupOrder || (status === 'pending_payment' && !labelUrl) || (!!tracking && !isPickupOrder)}
                                      >
                                        {isPickupOrder ? (
                                          <option value="Entrega Personal">Entrega Personal</option>
                                        ) : (
                                          <>
                                            <option value="" disabled>Paquetería</option>
                                            {sellerPlan === 'platinum' && (
                                              <option value="Entrega Personal">Entrega Personal</option>
                                            )}
                                            <option value="Estafeta">Estafeta</option>
                                            <option value="Fedex">Fedex</option>
                                            <option value="DHL">DHL</option>
                                            <option value="Paquetexpress">Paquetexpress</option>
                                            <option value="Otro">Otro</option>
                                          </>
                                        )}
                                      </select>
                                    )}
                                    <input
                                      value={trackingDraft[orderId] ?? (isPickupOrder && tracking ? tracking : '') ?? ''}
                                      onChange={(e) => setTrackingDraft((p) => ({ ...p, [orderId]: e.target.value }))}
                                      placeholder={isPickupOrder ? "Nombre de quien recibió" : "Ingresa el Rastreo"}
                                      className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-brand-emerald"
                                      disabled={
                                        (status === 'pending_payment' && !labelUrl) ||
                                        (isSellerManagedOrder ? sellerManagedAllComplete : (!!tracking && !isPickupOrder))
                                      }
                                    />
                                  </div>
                                  {((!tracking || isPickupOrder) || (isSellerManagedOrder && !sellerManagedAllComplete)) && canMarkShipped && (
                                    <button
                                      type="button"
                                      onClick={() => markShipped(orderId)}
                                      disabled={Boolean(isMarking[orderId]) || String(trackingDraft[orderId] ?? '').trim().length < 2 || (status === 'pending_payment' && !labelUrl) || (isSellerManagedOrder && !String(carrierDraft[orderId] ?? carrier ?? '').trim())}
                                      className="w-full rounded-lg bg-brand-emerald px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                                    >
                                      {isMarking[orderId] ? '...' : isPickupOrder ? 'Confirmar Entrega' : 'Marcar enviado'}
                                    </button>
                                  )}
                                  {tracking && isPickupOrder && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold text-green-700 ring-1 ring-green-200">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                      Entrega confirmada — {carrier || 'Personal'} — {tracking}
                                    </div>
                                  )}
                                  {/* Indicador de pasos completados para envío gestionado por vendedor */}
                                  {isSellerManagedOrder && tracking && !sellerManagedAllComplete && (
                                    <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                      ✅ Enviado — {carrier} — {tracking} · Falta subir guía
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {(o?.shipping_option_id === 'pickup' || o?.shipping_carrier === 'pickup') && (
                                <div className="relative">
                                  <Link
                                    href={`/dashboard/ventas/${orderId}/delivery-format`}
                                    target="_blank"
                                    onClick={() => handleDownloadProof(orderId)}
                                    className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold mb-1 shadow-sm ring-1 ring-inset ${isProofDownloaded ? 'bg-white text-green-700 ring-green-600/20 hover:bg-green-100' : 'bg-gray-800 text-white ring-black/5 hover:bg-gray-700'}`}
                                  >
                                    {isProofDownloaded ? 'Constancia Descargada' : 'Descargar Constancia'}
                                  </Link>
                                  {!o.delivery_proof_url && status !== 'delivered' ? (
                                    <div className="flex flex-col gap-1.5">
                                      {/* Botón: Constancia de Entrega */}
                                      {constanciaUrlByOrderId[orderId] ? (
                                        <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-100 px-2 py-1.5 text-[10px] font-bold text-green-700 ring-1 ring-green-300">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                          Constancia Subida ✓
                                        </div>
                                      ) : (
                                        <label className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-2 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-purple-700 transition-all ${isMarking[`${orderId}_constancia`] ? 'opacity-50 cursor-wait' : ''}`}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                          {isMarking[`${orderId}_constancia`] ? 'Subiendo...' : 'Constancia de Entrega'}
                                          <input
                                            type="file"
                                            accept="image/*,.pdf,application/pdf"
                                            className="hidden"
                                            disabled={Boolean(isMarking[`${orderId}_constancia`])}
                                            onChange={(e) => {
                                              const f = e.target.files?.[0] || null;
                                              handleUploadSingleProof(orderId, f, 'constancia');
                                            }}
                                          />
                                        </label>
                                      )}

                                      {/* Botón: Foto de INE */}
                                      {ineUrlByOrderId[orderId] ? (
                                        <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-100 px-2 py-1.5 text-[10px] font-bold text-green-700 ring-1 ring-green-300">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                          INE Subida ✓
                                        </div>
                                      ) : (
                                        <label className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-2 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-purple-700 transition-all ${isMarking[`${orderId}_ine`] ? 'opacity-50 cursor-wait' : ''}`}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><circle cx="8" cy="10" r="2" /><path d="M22 17H2" /><line x1="14" y1="8" x2="18" y2="8" /><line x1="14" y1="12" x2="18" y2="12" /></svg>
                                          {isMarking[`${orderId}_ine`] ? 'Subiendo...' : 'Foto de INE'}
                                          <input
                                            type="file"
                                            accept="image/*,.pdf,application/pdf"
                                            className="hidden"
                                            disabled={Boolean(isMarking[`${orderId}_ine`])}
                                            onChange={(e) => {
                                              const f = e.target.files?.[0] || null;
                                              handleUploadSingleProof(orderId, f, 'ine');
                                            }}
                                          />
                                        </label>
                                      )}

                                      <span className="text-[9px] text-gray-500 text-center leading-tight">
                                        Completa todos los pasos para activar Calificar: nombre de quien recibió, descargar constancia, subir constancia y subir INE.
                                      </span>
                                    </div>
                                  ) : (
                                    <button disabled className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200 cursor-not-allowed">
                                      Evidencia enviada
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* --- Botón Subir Evidencia para Envío Gestionado por Vendedor (Nuevo) --- */}
                              {showGreenButton && (
                                <div className="relative mt-2">
                                  <div className="mb-1 rounded bg-yellow-50 p-1.5 text-center text-[9px] text-yellow-800 border border-yellow-200">
                                    <span className="font-bold">⚠️ Envío por tu cuenta:</span> Debes subir la guía de envío para liberar el pago.
                                  </div>

                                  {!o.delivery_proof_url ? (() => {
                                    // Para seller-managed: solo permitir subir guía DESPUÉS de marcar como enviado
                                    const needsShipFirst = isSellerManagedOrder && status !== 'shipped' && status !== 'delivered';
                                    return (
                                      <div className="flex flex-col gap-1">
                                        <label className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold shadow-sm ${needsShipFirst ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : `bg-green-600 text-white hover:bg-green-700 cursor-pointer ${isMarking[orderId] ? 'opacity-50 cursor-wait' : ''}`}`}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                          {isMarking[orderId] ? 'Subiendo...' : needsShipFirst ? '🔒 Primero marca como enviado' : 'Subir Guía de Envío'}
                                          {!needsShipFirst && (
                                            <input
                                              type="file"
                                              accept="image/png,image/jpeg,application/pdf"
                                              className="hidden"
                                              disabled={isMarking[orderId] || needsShipFirst}
                                              onChange={(e) => {
                                                handleUploadProof(orderId, e.target.files);
                                              }}
                                            />
                                          )}
                                        </label>
                                        <span className="text-[9px] text-gray-500 text-center leading-tight">
                                          {needsShipFirst
                                            ? 'Primero selecciona paquetería, ingresa el rastreo y haz clic en "Marcar enviado".'
                                            : 'Completa todos los pasos para calificar: paquetería, rastreo, marcar enviado y subir guía.'}
                                        </span>
                                      </div>
                                    );
                                  })() : (
                                    <button disabled className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200 cursor-not-allowed">
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                      Guía enviada
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* --- Botón Ver Dirección del Comprador (Envío Gestionado por Vendedor) --- */}
                              {isSellerManagedOrder && status !== 'pending_payment' && (() => {
                                const addr = resolveBuyerAddress(o, buyerAddressById[buyerId]);
                                const isLocked = alreadyRated || isOrderCompleted;
                                const isOpen = showAddressByOrderId[orderId];
                                const hasAddr = addr && (addr.full || addr.phone);
                                return (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => !isLocked && setShowAddressByOrderId((p) => ({ ...p, [orderId]: !p[orderId] }))}
                                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-semibold transition-all ${isLocked
                                        ? 'bg-gray-100 text-gray-400 ring-1 ring-gray-200 cursor-not-allowed'
                                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100'
                                        }`}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                      {isLocked
                                        ? '🔒 Dirección bloqueada (venta finalizada)'
                                        : isOpen ? 'Ocultar Dirección' : '📍 Ver Dirección del Destinatario'
                                      }
                                      {!isLocked && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
                                      )}
                                    </button>
                                    {isOpen && !isLocked && (
                                      <div className="mt-1.5 rounded-lg border border-blue-100 bg-white px-3 py-2.5 text-[10px] text-gray-800 space-y-1 shadow-sm">
                                        {hasAddr ? (
                                          <>
                                            {addr!.source === 'order' && (
                                              <div className="text-[9px] font-bold uppercase text-blue-600">Dirección del checkout</div>
                                            )}
                                            {addr!.source === 'profile' && (
                                              <div className="text-[9px] font-bold uppercase text-gray-500">Dirección del perfil</div>
                                            )}
                                            {addr!.full && <div className="font-semibold text-gray-900">📍 {addr!.full}</div>}
                                            {addr!.colonia && <div className="text-gray-600">Col. {addr!.colonia}</div>}
                                            {addr!.city && addr!.state && <div className="text-gray-600">{addr!.city}, {addr!.state}</div>}
                                            {addr!.zip && <div className="text-gray-600">C.P. {addr!.zip}</div>}
                                            {addr!.reference && <div className="text-gray-500 italic">Ref: {addr!.reference}</div>}
                                            {addr!.phone && <div className="text-blue-600 font-semibold">📞 {addr!.phone}</div>}
                                          </>
                                        ) : (
                                          <div className="text-amber-600 font-semibold">⚠️ Sin dirección en la orden ni en el perfil. Contacta al comprador por Chat.</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* --- 4. Calificaciones del comprador (Restaurado) --- */}
                              {canRateBuyer && (
                                <div className="relative w-full">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRateOrderId(orderId);
                                      setRateBuyerId(buyerId);
                                      setRateStars(0);
                                      setRateComment('');
                                      setRateOpen(true);
                                    }}
                                    className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-emerald px-2 py-1.5 text-[10px] font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 transition-all ${shippedAt && !alreadyRated ? 'animate-pulse ring-2 ring-yellow-300 ring-offset-1' : ''}`}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#FDE047" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 drop-shadow-sm">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                    Calificar Comprador
                                  </button>
                                </div>
                              )}
                              {alreadyRated && (
                                <div className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1.5 text-[10px] font-bold text-gray-600 ring-1 ring-black/5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                  Ya calificaste
                                </div>
                              )}

                              {!chatDisabled ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setChatOrderId(orderId);
                                    setChatOpen(true);
                                    setHasUnreadByOrderId((p) => ({ ...p, [orderId]: false }));
                                  }}
                                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[11px] font-bold shadow-sm ring-1 transition-all ${
                                    hasUnread 
                                      ? 'bg-brand-emerald text-white ring-brand-emerald hover:opacity-90 animate-pulse' 
                                      : 'bg-brand-emerald text-white ring-brand-emerald hover:opacity-90'
                                  }`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                  </svg>
                                  Contactar Comprador
                                  {hasUnread ? <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-extrabold text-brand-emerald">NUEVO</span> : null}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-600">
                  Página {Math.min(ventasPage, ventasTotalPages)} de {ventasTotalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVentasPage((p) => Math.max(1, p - 1))}
                    disabled={ventasPage <= 1}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setVentasPage((p) => Math.min(ventasTotalPages, p + 1))}
                    disabled={ventasPage >= ventasTotalPages}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <OrderChatFloating
        open={chatOpen}
        orderId={chatOrderId}
        onClose={() => {
          setChatOpen(false);
        }}
      />

      {rateOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10 animate-slide-in">
            <div className="border-b border-black/5 px-5 py-4">
              <div className="text-sm font-extrabold text-gray-900">Calificar comprador</div>
              <div className="mt-1 text-xs text-gray-600">Califica la experiencia de compra (1 a 10).</div>
            </div>

            <div className="px-5 py-4">
              <div className="text-xs font-semibold text-gray-900">Calificación (1 a 10)</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const v = i + 1;
                  const active = v <= rateStars;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRateStars(v)}
                      className={`h-8 w-8 rounded-lg text-xs font-extrabold ring-1 transition ${active ? 'bg-brand-emerald text-white ring-brand-emerald' : 'bg-white text-gray-700 ring-black/10 hover:bg-white'
                        }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 text-xs font-semibold text-gray-900">Comentario (opcional)</div>
              <textarea
                value={rateComment}
                onChange={(e) => setRateComment(e.target.value)}
                placeholder="Cuenta tu experiencia..."
                className="mt-2 h-20 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-emerald"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-3">
              <button
                type="button"
                onClick={() => setRateOpen(false)}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                disabled={isSubmittingRating}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitRateBuyer()}
                className="rounded-xl bg-brand-emerald px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                disabled={isSubmittingRating || !rateOrderId || rateStars < 1 || rateStars > 10}
              >
                {isSubmittingRating ? 'Enviando…' : 'Enviar calificación'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

