'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ProExpirationBanner } from '@/components/dashboard/ProExpirationBanner';
import { PLAN_LIMITS } from '@/lib/plans/limits';

type ListingRow = {
  id: string;
  public_id?: string | null;
  title: string;
  price: number | string;
  currency: string;
  status: 'draft' | 'active' | 'sold' | 'paused' | 'blocked';
  is_featured?: boolean | null;
  sale_type?: 'direct' | 'auction' | null;
  created_at: string;
  expires_at?: string | null;
  view_count?: number | null;
  images?: string[] | null;
  auction_end_at?: string | null;
  auction_highest_bid?: number | null;
  auction_highest_bidder_id?: string | null;
  auction_starting_bid?: number | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  attributes?: Record<string, any> | null;
  shipping_by_seller?: boolean | null;
  free_shipping?: boolean | null;
  shipping_price?: number | null;
  shipping_subsidy?: number | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  product_type?: 'physical' | 'digital' | null;
};

type FilterKey =
  | 'all'
  | 'digital'
  | 'free_shipping'
  | 'gopocket'
  | 'gopocket_free'
  | 'seller_shipping'
  | 'seller_shipping_free'
  | 'most_views'
  | 'active'
  | 'paused'
  | 'ended'
  | 'auctions_active'
  | 'auctions_ending';

const FILTER_OPTIONS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'Todas', icon: '📋' },
  { key: 'digital', label: 'Productos Digitales', icon: '💻' },
  { key: 'free_shipping', label: 'Envío Gratis', icon: '🆓' },
  { key: 'gopocket', label: 'Envío GoVendy', icon: '⚡' },
  { key: 'gopocket_free', label: 'GoVendy Gratis', icon: '🎁' },
  { key: 'seller_shipping', label: 'Envío por Vendedor', icon: '📦' },
  { key: 'seller_shipping_free', label: 'Vendedor Gratis', icon: '🏷️' },
  { key: 'most_views', label: 'Más Vistas', icon: '👁️' },
  { key: 'active', label: 'Activas', icon: '🟢' },
  { key: 'paused', label: 'Pausadas', icon: '⏸️' },
  { key: 'ended', label: 'Finalizadas', icon: '🏁' },
  { key: 'auctions_active', label: 'Subastas Activas', icon: '🔨' },
  { key: 'auctions_ending', label: 'Subastas Por Finalizar', icon: '⏳' },
];

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
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

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function toNumber(v: number | string | null | undefined) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function statusLabel(s: ListingRow['status']) {
  if (s === 'active') return 'Activa';
  if (s === 'paused') return 'Pausada';
  if (s === 'sold') return 'Vendida';
  if (s === 'draft') return 'Borrador';
  if (s === 'blocked') return 'Bloqueada';
  return s;
}

function useSuspensionCountdown(adminState: { status: string; suspended_until: string | null } | null, currentTime: number) {
  return useMemo(() => {
    const s = adminState;
    if (!s || s.status !== 'suspended' || !s.suspended_until) return null;
    const end = new Date(s.suspended_until).getTime();
    const diff = Math.max(0, end - currentTime);
    if (diff <= 0) return { days: 0, hours: 0, ended: true };
    const totalHours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return { days, hours, ended: false };
  }, [adminState, currentTime]);
}

export default function DashboardListingsPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userPlan, setUserPlan] = useState<'basic' | 'pro' | 'platinum'>('basic');
  const [bidderNames, setBidderNames] = useState<Record<string, string>>({});
  const [adminState, setAdminState] = useState<{ status: string; suspended_until: string | null } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [settleTriggered, setSettleTriggered] = useState<Record<string, boolean>>({});

  const suspensionCountdown = useSuspensionCountdown(adminState, currentTime);
  const isSuspended = adminState?.status === 'suspended';
  const isBanned = adminState?.status === 'banned';

  useEffect(() => {
    if (!isSuspended) return;
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isSuspended]);

  useEffect(() => {
    if (isBooting) return;
    let stopped = false;
    const tick = async () => {
      const now = Date.now();
      const candidates = rows.filter((r) => r.sale_type === 'auction' && r.auction_end_at && Date.parse(r.auction_end_at) <= now);
      for (const r of candidates) {
        if (stopped) break;
        if (settleTriggered[r.id]) continue;
        try {
          setSettleTriggered((prev) => ({ ...prev, [r.id]: true }));
          await fetch('/api/auctions/settle-one', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ listing_id: r.id }),
          }).catch(() => null);
        } catch {
          // ignore
        }
      }
    };
    const iv = setInterval(tick, 10000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [rows, isBooting, settleTriggered]);

  const archiveListing = async (row: ListingRow) => {
    setError(null);
    setSuccess(null);
    if (!confirm('¿Seguro que deseas eliminar esta publicación? Se archivará (no se borra del historial).')) return;
    setIsUpdating(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/listings/archive', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: row.id, reason: 'seller_archived' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo eliminar.');

      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSuccess('Publicación eliminada (archivada).');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        setSuccess(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/login';
          return;
        }

        // Fetch User Plan
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type')
          .eq('id', userData.user.id)
          .single();
        if (!cancelled && (profile?.plan_type === 'pro' || profile?.plan_type === 'platinum')) {
          setUserPlan(profile.plan_type as 'pro' | 'platinum');
        }

        const { data: stateRow } = await supabase
          .from('user_admin_states')
          .select('status,suspended_until')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (!cancelled && stateRow) {
          setAdminState({
            status: String((stateRow as any)?.status ?? 'active'),
            suspended_until: (stateRow as any)?.suspended_until ?? null,
          });
        }

        // Auto-pausa (30 días) si el esquema ya tiene expires_at
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch('/api/listings/autopause', {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
          }).catch(() => null);
        }

        // Intentar cargar con columnas nuevas; si no existen, fallback
        let listRes: any = await supabase
          .from('listings')
          .select(
            'id,public_id,title,price,currency,status,is_featured,sale_type,created_at,expires_at,view_count,images,auction_end_at,auction_highest_bid,auction_highest_bidder_id,auction_starting_bid,is_deleted,deleted_at,attributes,shipping_by_seller,free_shipping,shipping_price,shipping_subsidy,weight_kg,length_cm,width_cm,height_cm,product_type',
          )
          .eq('seller_id', userData.user.id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (listRes.error) {
          const code = String((listRes.error as any)?.code || '');
          const msg = String((listRes.error as any)?.message || '');
          if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
            listRes = await supabase
              .from('listings')
              .select('id,title,price,currency,status,is_featured,sale_type,created_at,images,attributes')
              .eq('seller_id', userData.user.id)
              .order('created_at', { ascending: false })
              .limit(200);
          }
        }
        if (listRes.error) throw listRes.error;

        let nextRows = (((listRes.data as ListingRow[]) ?? []) as ListingRow[]) ?? [];
        // Ocultar archivadas (borrado lógico) si la columna existe
        nextRows = nextRows.filter((r: any) => !r?.is_deleted);
        if (!cancelled) setRows(nextRows);

        // Best effort: resolver nombre del usuario que va ganando en subastas
        const bidderIds = Array.from(
          new Set(
            nextRows
              .filter((r) => r.sale_type === 'auction')
              .map((r) => String(r.auction_highest_bidder_id || '').trim())
              .filter(Boolean),
          ),
        );
        if (bidderIds.length > 0) {
          let profRes: any = await supabase.from('profiles').select('id,full_name,nickname,username').in('id', bidderIds);
          if (profRes.error) {
            const code = String((profRes.error as any)?.code || '');
            const msg = String((profRes.error as any)?.message || '');
            if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
              profRes = await supabase.from('profiles').select('id,full_name').in('id', bidderIds);
            }
          }
          if (!profRes.error && Array.isArray(profRes.data)) {
            const map: Record<string, string> = {};
            for (const p of profRes.data as any[]) {
              const id = String(p?.id || '').trim();
              if (!id) continue;
              const name =
                String(p?.full_name || '').trim() ||
                String(p?.nickname || '').trim() ||
                String(p?.username || '').trim() ||
                `${id.slice(0, 6)}…`;
              map[id] = name;
            }
            if (!cancelled) setBidderNames(map);
          }
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus publicaciones.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const now = Date.now();
    const base = rows.filter((r) => {
      // Apply active filter
      switch (activeFilter) {
        case 'digital':
          if (r.product_type !== 'digital') return false;
          break;
        case 'free_shipping':
          if (!r.free_shipping) return false;
          break;
        case 'gopocket':
          if (r.shipping_by_seller || r.free_shipping) return false;
          break;
        case 'gopocket_free':
          if (r.shipping_by_seller) return false;
          if (!r.free_shipping) return false;
          break;
        case 'seller_shipping':
          if (!r.shipping_by_seller) return false;
          break;
        case 'seller_shipping_free':
          if (!r.shipping_by_seller || !r.free_shipping) return false;
          break;
        case 'active':
          if (r.status !== 'active') return false;
          break;
        case 'paused':
          if (r.status !== 'paused') return false;
          break;
        case 'ended':
          if (r.status !== 'sold' && r.status !== 'blocked') return false;
          break;
        case 'auctions_active': {
          if (r.sale_type !== 'auction') return false;
          const endMs = r.auction_end_at ? Date.parse(r.auction_end_at) : NaN;
          if (Number.isFinite(endMs) && now >= endMs) return false;
          break;
        }
        case 'auctions_ending': {
          if (r.sale_type !== 'auction') return false;
          const endMs = r.auction_end_at ? Date.parse(r.auction_end_at) : NaN;
          if (!Number.isFinite(endMs)) return false;
          const hoursLeft = (endMs - now) / 3600000;
          if (hoursLeft <= 0 || hoursLeft > 24) return false; // next 24h
          break;
        }
        case 'most_views':
          // no filter, just sort
          break;
        case 'all':
        default:
          break;
      }
      return true;
    });
    // Text search
    const textFiltered = needle
      ? base.filter((r) => {
        const title = (r.title || '').toLowerCase();
        const pid = String((r as any).public_id || '').toLowerCase();
        return title.includes(needle) || (pid && pid.includes(needle));
      })
      : base;
    return textFiltered;
  }, [rows, q, activeFilter]);

  const sorted = useMemo(() => {
    const now = Date.now();
    // If "most views" sort by view_count desc
    if (activeFilter === 'most_views') {
      return filtered.slice().sort((a, b) => (Number(b.view_count ?? 0)) - (Number(a.view_count ?? 0)));
    }
    const cmp = (a: ListingRow, b: ListingRow) => {
      const aIsAuction = a.sale_type === 'auction';
      const bIsAuction = b.sale_type === 'auction';
      const aEnd = a.auction_end_at ? Date.parse(a.auction_end_at) : NaN;
      const bEnd = b.auction_end_at ? Date.parse(b.auction_end_at) : NaN;
      const aEnded = aIsAuction && Number.isFinite(aEnd) ? now >= aEnd : false;
      const bEnded = bIsAuction && Number.isFinite(bEnd) ? now >= bEnd : false;
      if (aIsAuction && !bIsAuction) return -1;
      if (!aIsAuction && bIsAuction) return 1;
      if (aIsAuction && bIsAuction) {
        if (!aEnded && bEnded) return -1;
        if (aEnded && !bEnded) return 1;
        if (Number.isFinite(aEnd) && Number.isFinite(bEnd)) return aEnd - bEnd;
      }
      const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
      const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
      return bCreated - aCreated;
    };
    return filtered.slice().sort(cmp);
  }, [filtered, activeFilter]);

  const cloneListing = async (listingId: string) => {
    setError(null);
    setSuccess(null);
    setIsUpdating(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/listings/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo clonar.');

      // Redirigir al panel unificado en modo edición (que ahora sirve para "terminar" el clon)
      // La API de clone devuelve { listing: { id: ... } }
      if (json.listing?.id) {
        window.location.href = `/dashboard/listings/${json.listing.id}/edit?mode=clone_success`;
      } else {
        setSuccess('Publicación clonada. Recarga la página.');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo clonar.');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (listingId: string, status: 'active' | 'paused' | 'sold') => {
    setError(null);
    setSuccess(null);
    setIsUpdating(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/listings/update-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar el estado.');

      setRows((prev) => prev.map((r) => (r.id === listingId ? { ...r, status } : r)));
      setSuccess('Cambios guardados.');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      setIsUpdating(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Mis publicaciones</div>
              <div className="text-xs text-gray-500">Gestiona tus artículos</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <ProExpirationBanner />
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">{success}</div>
        )}

        {isBanned && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-center text-sm text-red-900">
            <span className="font-extrabold">Cuenta bloqueada.</span> No puedes activar ni publicar.
          </div>
        )}
        {isSuspended && (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 sm:gap-6">
            <span className="text-sm font-extrabold text-amber-900">Cuenta suspendida.</span>
            <span className="text-xs text-amber-800">No puedes activar publicaciones hasta que termine la suspensión.</span>
            {suspensionCountdown && !suspensionCountdown.ended ? (
              <span className="rounded-xl bg-amber-100 px-4 py-2 font-mono text-lg font-bold tabular-nums text-amber-900 ring-1 ring-amber-300">
                {suspensionCountdown.days}d {suspensionCountdown.hours}h
              </span>
            ) : null}
          </div>
        )}

        {/* ── Filter bar ────────────────────────────────────────── */}
        <div className="mb-4">
          {/* Top row: count + search + filter toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-900 mr-auto">
              {filtered.length} publicaciones
            </span>
            {activeFilter !== 'all' && (
              <span className="flex items-center gap-1 rounded-full bg-brand-emerald px-3 py-1 text-xs font-bold text-white shadow">
                {FILTER_OPTIONS.find((f) => f.key === activeFilter)?.icon}{' '}
                {FILTER_OPTIONS.find((f) => f.key === activeFilter)?.label}
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="ml-1 rounded-full bg-white/25 px-1 text-white hover:bg-white/40"
                  aria-label="Quitar filtro"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={[
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm ring-1 transition-all',
                filtersOpen
                  ? 'bg-brand-emerald text-white ring-brand-emerald shadow-emerald-200'
                  : 'bg-white text-gray-700 ring-black/10 hover:bg-gray-50',
              ].join(' ')}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="4" x2="14" y2="4" />
                <line x1="4" y1="8" x2="12" y2="8" />
                <line x1="6" y1="12" x2="10" y2="12" />
              </svg>
              Filtros
            </button>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald sm:w-60"
              placeholder="Buscar por título..."
            />
          </div>

          {/* Collapsible filter panel */}
          {filtersOpen && (
            <div className="mt-3 rounded-2xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-100 sm:grid-cols-5">
                {/* Group 1: Tipo */}
                <div className="p-4 sm:col-span-1">
                  <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Tipo</div>
                  <div className="space-y-1">
                    {(['all', 'digital'] as FilterKey[]).map((key) => {
                      const f = FILTER_OPTIONS.find((o) => o.key === key)!;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveFilter(key); setFiltersOpen(false); }}
                          className={[
                            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all',
                            activeFilter === key
                              ? 'bg-brand-emerald text-white'
                              : 'text-gray-700 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span>{f.icon}</span>
                          <span className="flex-1">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group 2: Envío */}
                <div className="p-4 sm:col-span-1">
                  <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Envío</div>
                  <div className="space-y-1">
                    {(['free_shipping', 'gopocket', 'gopocket_free', 'seller_shipping', 'seller_shipping_free'] as FilterKey[]).map((key) => {
                      const f = FILTER_OPTIONS.find((o) => o.key === key)!;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveFilter(key); setFiltersOpen(false); }}
                          className={[
                            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all',
                            activeFilter === key
                              ? 'bg-brand-emerald text-white'
                              : 'text-gray-700 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span>{f.icon}</span>
                          <span className="flex-1">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group 3: Actividad */}
                <div className="p-4 sm:col-span-1">
                  <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Actividad</div>
                  <div className="space-y-1">
                    {(['most_views'] as FilterKey[]).map((key) => {
                      const f = FILTER_OPTIONS.find((o) => o.key === key)!;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveFilter(key); setFiltersOpen(false); }}
                          className={[
                            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all',
                            activeFilter === key
                              ? 'bg-brand-emerald text-white'
                              : 'text-gray-700 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span>{f.icon}</span>
                          <span className="flex-1">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group 4: Estado */}
                <div className="p-4 sm:col-span-1">
                  <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Estado</div>
                  <div className="space-y-1">
                    {(['active', 'paused', 'ended'] as FilterKey[]).map((key) => {
                      const f = FILTER_OPTIONS.find((o) => o.key === key)!;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveFilter(key); setFiltersOpen(false); }}
                          className={[
                            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all',
                            activeFilter === key
                              ? 'bg-brand-emerald text-white'
                              : 'text-gray-700 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span>{f.icon}</span>
                          <span className="flex-1">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group 5: Subastas */}
                <div className="p-4 sm:col-span-1">
                  <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Subastas</div>
                  <div className="space-y-1">
                    {(['auctions_active', 'auctions_ending'] as FilterKey[]).map((key) => {
                      const f = FILTER_OPTIONS.find((o) => o.key === key)!;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setActiveFilter(key); setFiltersOpen(false); }}
                          className={[
                            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all',
                            activeFilter === key
                              ? 'bg-brand-emerald text-white'
                              : 'text-gray-700 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          <span>{f.icon}</span>
                          <span className="flex-1">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer: limpiar filtros */}
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 bg-gray-50">
                <span className="text-xs text-gray-500">{filtered.length} resultados con filtro actual</span>
                <button
                  type="button"
                  onClick={() => { setActiveFilter('all'); setFiltersOpen(false); }}
                  className="text-xs font-bold text-brand-emerald hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>
        {/* ── End filter bar ──────────────────────────────────────── */}


        {filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
            Aún no tienes publicaciones. Usa <span className="font-semibold">“Publicar”</span> para crear tu primer artículo.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((r) => {
              const created = r.created_at;
              const expiresAt = r.expires_at || null;
              const price = toNumber(r.price);
              const views = Number(r.view_count ?? 0) || 0;
              const thumb = Array.isArray(r.images) && r.images.length > 0 ? r.images[0] : null;

              const isAuction = r.sale_type === 'auction';
              const planLimits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.basic;
              const rate = planLimits.commission_percent / 100;
              const highestBid = Number(r.auction_highest_bid ?? 0) || 0;
              const startingBid = Number(r.auction_starting_bid ?? 0) || 0;
              const currentBid = highestBid > 0 ? highestBid : startingBid > 0 ? startingBid : price;
              const commission = isAuction
                ? (userPlan === 'basic' ? 23 : 18)
                : Math.max(0, price * rate);
              const net = isAuction
                ? Math.max(0, currentBid - commission)
                : Math.max(0, price - commission);
              const leaderId = String(r.auction_highest_bidder_id || '').trim();
              const leaderName = leaderId ? bidderNames[leaderId] || `${leaderId.slice(0, 6)}…` : '—';
              const auctionEndMs = r.auction_end_at ? Date.parse(r.auction_end_at) : NaN;
              const auctionEnded = isAuction ? (Number.isFinite(auctionEndMs) ? Date.now() >= auctionEndMs : false) : false;

              return (
                <div
                  key={r.id}
                  className={[
                    'rounded-3xl bg-white p-4 shadow-sm ring-1 sm:p-5',
                    isAuction && !auctionEnded ? 'ring-amber-200 animate-pulse' : '',
                    isAuction && auctionEnded ? 'ring-gray-200' : 'ring-black/5',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <div className="h-24 w-24 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-black/5 sm:h-28 sm:w-28">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-contain p-2" />
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/listings/${r.id}`} className="truncate text-sm font-semibold text-gray-900 hover:underline">
                          {r.title}
                        </Link>
                        {r.public_id ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                            ID: {r.public_id}
                          </span>
                        ) : null}
                        {r.is_featured ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                            Destacado
                          </span>
                        ) : null}
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-extrabold ring-1',
                            r.sale_type === 'auction'
                              ? (auctionEnded ? 'bg-gray-100 text-gray-700 ring-gray-200' : 'bg-white text-brand-emerald ring-emerald-100 animate-pulse')
                              : 'bg-gray-100 text-gray-700 ring-black/5',
                          ].join(' ')}
                        >
                          {r.sale_type === 'auction' ? (auctionEnded ? 'Subasta finalizada' : 'Subasta activa') : 'Venta directa'}
                        </span>
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                            r.status === 'active'
                              ? 'bg-white text-green-800 ring-green-100'
                              : r.status === 'paused'
                                ? 'bg-amber-50 text-amber-800 ring-amber-100'
                                : r.status === 'sold'
                                  ? 'bg-gray-100 text-gray-700 ring-black/5'
                                  : 'bg-gray-100 text-gray-700 ring-black/5',
                          ].join(' ')}
                        >
                          {statusLabel(r.status)}
                        </span>
                        {r.attributes?.moderation_status === 'review_needed' && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                            ⚠️ Revisión
                          </span>
                        )}
                      </div>

                      {r.attributes?.moderation_status === 'review_needed' && (
                        <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                          <strong>Atención:</strong> Hemos detectado contenido que requiere revisión. Tu publicación es visible, pero podría ser suspendida si infringe las normas. <Link href={`/dashboard/listings/${r.id}/edit`} className="underline font-bold">Editar ahora</Link>
                        </div>
                      )}

                      <div className="mt-2 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                          <div className="font-semibold text-gray-900">Inicio</div>
                          <div>{formatDateTime(created)}</div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                          <div className="font-semibold text-gray-900">Finaliza</div>
                          <div>
                            {isAuction && r.auction_end_at
                              ? formatDateTime(r.auction_end_at)
                              : 'Sin límite de tiempo'}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                          <div className="font-semibold text-gray-900">Vistas</div>
                          <div>{views}</div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                          <div className="font-semibold text-gray-900">{isAuction ? 'Costo (puja actual)' : 'Costo (precio)'}</div>
                          <div className="text-gray-900 font-semibold">{formatMoney(isAuction ? currentBid : price)}</div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                          <div className="font-semibold text-gray-900">
                            {isAuction ? `Comisión (${formatMoney(commission)})` : `Comisión (${Math.round(rate * 100)}%)`}
                          </div>
                          <div>- {formatMoney(commission)}</div>
                        </div>
                        <div className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                          <div className="font-semibold text-gray-900">Te queda</div>
                          <div className="text-gray-900 font-semibold">{formatMoney(net)}</div>
                        </div>
                      </div>

                      {/* Shipping config info */}
                      <div className="mt-2 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                        <div className="rounded-2xl bg-blue-50 px-3 py-2 ring-1 ring-blue-100">
                          <div className="font-semibold text-gray-900">Forma de envío</div>
                          <div className="text-gray-900 font-medium">
                            {r.free_shipping
                              ? '🆓 Envío gratis'
                              : r.shipping_by_seller
                                ? '📦 Envío por vendedor'
                                : '⚡ GoVendy'}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-blue-50 px-3 py-2 ring-1 ring-blue-100">
                          <div className="font-semibold text-gray-900">Envío configurado</div>
                          <div className="text-gray-900 font-medium">
                            {(() => {
                              if (r.free_shipping) return '$0.00 (gratis)';
                              if (r.shipping_by_seller && Number(r.shipping_price || 0) > 0) return formatMoney(Number(r.shipping_price));
                              if (!r.shipping_by_seller) {
                                const DEFAULT_WEIGHT_RANGES = [
                                  { max_weight_kg: 1, price: 175 },
                                  { max_weight_kg: 5, price: 195 },
                                  { max_weight_kg: 10, price: 235 },
                                  { max_weight_kg: 15, price: 255 },
                                  { max_weight_kg: 20, price: 275 },
                                  { max_weight_kg: 25, price: 300 },
                                  { max_weight_kg: 30, price: 325 },
                                  { max_weight_kg: 35, price: 340 },
                                  { max_weight_kg: 40, price: 355 },
                                  { max_weight_kg: 45, price: 385 },
                                  { max_weight_kg: 50, price: 415 },
                                  { max_weight_kg: 55, price: 435 },
                                  { max_weight_kg: 60, price: 455 },
                                ];
                                const w = Number(r.weight_kg || 0) || 0;
                                const len = Number(r.length_cm || 0) || 0;
                                const wid = Number(r.width_cm || 0) || 0;
                                const h = Number(r.height_cm || 0) || 0;
                                const volW = (len * wid * h) / 5000;
                                const finalW = Math.max(w, volW, 0.1);
                                const ranges = [...DEFAULT_WEIGHT_RANGES].sort((a, b) => a.max_weight_kg - b.max_weight_kg);
                                const match = ranges.find(rng => finalW <= rng.max_weight_kg) || ranges[ranges.length - 1];
                                const base = match ? Number(match.price) : 175;
                                const subsidy = Math.max(0, Number(r.shipping_subsidy || 0));
                                const estimate = Math.max(0, base - subsidy);
                                return `${formatMoney(estimate)} · Calculado por peso`;
                              }
                              return '$0.00';
                            })()}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-blue-50 px-3 py-2 ring-1 ring-blue-100">
                          <div className="font-semibold text-gray-900">Subsidio envío</div>
                          <div className="text-gray-900 font-medium">
                            {Number(r.shipping_subsidy || 0) > 0
                              ? formatMoney(Number(r.shipping_subsidy))
                              : 'Sin subsidio'}
                          </div>
                        </div>
                      </div>

                      {isAuction ? (
                        <div className="mt-2 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-emerald-100">
                            <div className="font-semibold text-gray-900">Tiempo restante</div>
                            <div className="text-gray-900 font-semibold">{formatTimeLeft(r.auction_end_at)}</div>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-emerald-100">
                            <div className="font-semibold text-gray-900">Puja actual</div>
                            <div className="text-gray-900 font-semibold">{formatMoney(currentBid)}</div>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-emerald-100">
                            <div className="font-semibold text-gray-900">Va ganando</div>
                            <div className="text-gray-900 font-semibold">
                              {leaderId ? (
                                <Link href={`/perfil/${leaderId}`} className="text-brand-emerald hover:underline">
                                  {leaderName}
                                </Link>
                              ) : (
                                'Sin pujas'
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {!(isAuction && auctionEnded) ? (
                          <>
                            <Link
                              href={`/dashboard/listings/${r.id}/edit`}
                              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                            >
                              Editar
                            </Link>
                            <Link
                              href={`/listings/${r.id}`}
                              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                            >
                              Ver
                            </Link>
                            {r.status !== 'sold' && (
                              <button
                                type="button"
                                disabled={isUpdating || (isSuspended && r.status !== 'active') || r.sale_type === 'auction'}
                                onClick={() => updateStatus(r.id, r.status === 'active' ? 'paused' : 'active')}
                                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                title={
                                  r.sale_type === 'auction'
                                    ? 'No puedes pausar una subasta.'
                                    : isSuspended && r.status !== 'active'
                                      ? 'No puedes activar durante la suspensión.'
                                      : undefined
                                }
                              >
                                {r.status === 'active' ? 'Pausar' : 'Activar'}
                              </button>
                            )}
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={isUpdating || (r.sale_type === 'auction' && r.status === 'active')}
                          onClick={() => archiveListing(r)}
                          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-black/5 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                          title={r.sale_type === 'auction' && r.status === 'active' ? 'No puedes eliminar una subasta activa.' : 'Eliminar'}
                        >
                          Eliminar
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => cloneListing(r.id)}
                          className="rounded-xl bg-brand-emerald px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                        >
                          Publicar similar
                        </button>
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


