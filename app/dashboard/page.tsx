'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageTour } from '@/components/PageTour';
import { pageTours } from '@/lib/tours/config';
import { SectionMessage } from '@/components/SectionMessage';
import { PlanWidget } from '@/components/dashboard/PlanWidget';
import { ProExpirationBanner } from '@/components/dashboard/ProExpirationBanner';

type ContactRow = {
  // DEPRECATED: Contactos fueron removidos del dashboard
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type OrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  payment_method?: string | null;
  subtotal?: number | string | null;
  shipping_fee?: number | string | null;
  commission_fee?: number | string | null;
  total?: number | string | null;
  created_at?: string | null;
  shipping_carrier?: string | null;
  shipping_label_url?: string | null;
  is_topup?: boolean;
  proof_url?: string;
};

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: any) {
  return toNumber(value).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

type NavItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: 'pink' | 'neutral' | 'danger';
  badge?: number;
  shadowPink?: boolean;
};

function NavCard({ item }: { item: NavItem }) {
  const tone = item.tone ?? 'neutral';
  const base =
    'group flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition';
  const shadow = item.shadowPink
    ? 'shadow-[0_4px_12px_rgba(31,181,155,0.25)]'
    : 'shadow-sm';
  const styles =
    tone === 'pink'
      ? 'border-emerald-200 bg-emerald-50 text-brand-emerald hover:opacity-90'
      : tone === 'danger'
        ? 'border-black/10 bg-gray-900 text-white hover:bg-black'
        : 'border-black/5 bg-white text-gray-900 hover:bg-gray-50';

  const content = (
    <>
      <span className="truncate">{item.label}</span>
      <span className="inline-flex items-center gap-2">
        {typeof item.badge === 'number' && item.badge > 0 ? (
          <span className="text-[12px] font-extrabold text-brand-emerald">{item.badge > 99 ? '99+' : item.badge}</span>
        ) : null}
        <span className={classNames('text-xs font-bold', tone === 'danger' ? 'text-white/80' : 'text-gray-400')}>→</span>
      </span>
    </>
  );

  const cls = classNames(base, shadow, styles);
  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={cls}>
        {content}
      </button>
    );
  }

  if (!item.href) {
    // Si no hay href, no renderizar link (solo debería pasar si hay onClick)
    return null;
  }

  return (
    <Link href={item.href} className={cls}>
      {content}
    </Link>
  );
}

type AnalyticsData = {
  listings_views: { id: string; title: string; view_count: number; share_count: number }[];
  by_month: { label: string; sales_count: number; sales_total: number; purchases_count: number; purchases_total: number }[];
  performance: {
    total_views: number;
    total_listings: number;
    sales_last_30_days: number;
    purchases_last_30_days: number;
    sales_total_30: number;
    purchases_total_30: number;
  };
};

function DashboardCharts({ userId }: { userId: string | null }) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token || cancelled) return;
        const res = await fetch('/api/dashboard/analytics', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled || !res.ok || !(json as any)?.ok) return;
        setAnalytics({
          listings_views: (json as any).listings_views ?? [],
          by_month: (json as any).by_month ?? [],
          performance: (json as any).performance ?? { total_views: 0, total_listings: 0, sales_last_30_days: 0, purchases_last_30_days: 0, sales_total_30: 0, purchases_total_30: 0 },
        });
      } catch {
        if (!cancelled) setAnalytics(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  const perf = analytics?.performance;
  const maxViews = Math.max(1, ...(analytics?.listings_views?.map((x) => x.view_count) ?? []));
  const maxMonth = Math.max(
    1,
    ...(analytics?.by_month?.flatMap((m) => [m.sales_count, m.purchases_count]) ?? []),
  );

  return (
    <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6" data-tour="charts">
      <h2 className="text-base font-bold text-gray-900">Gráficas y desempeño</h2>
      <p className="mt-1 text-sm text-gray-600">
        Vistas de tus artículos, ventas y compras por mes. Control para llevar un buen seguimiento.
      </p>

      {loading && !analytics ? (
        <div className="mt-6 flex h-48 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-500">
          Cargando…
        </div>
      ) : !analytics ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          No se pudieron cargar las gráficas. Revisa tu conexión o intenta más tarde.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Vistas totales</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">{perf?.total_views ?? 0}</div>
              <div className="mt-0.5 text-xs text-gray-600">en {perf?.total_listings ?? 0} artículos</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Ventas (30 días)</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-900">{perf?.sales_last_30_days ?? 0}</div>
              <div className="mt-0.5 text-xs text-emerald-700">{formatMoney(perf?.sales_total_30 ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Compras (30 días)</div>
              <div className="mt-1 text-2xl font-extrabold text-blue-900">{perf?.purchases_last_30_days ?? 0}</div>
              <div className="mt-0.5 text-xs text-blue-700">{formatMoney(perf?.purchases_total_30 ?? 0)}</div>
            </div>
            <Link
              href="/dashboard/listings"
              className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 transition hover:bg-green-100"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Mis publicaciones</div>
              <div className="mt-1 text-lg font-bold text-green-900">Ver artículos →</div>
            </Link>
          </div>

          {analytics.listings_views.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900">Vistas por artículo (top 10)</h3>
              <div className="mt-3 space-y-2">
                {analytics.listings_views.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <Link href={`/listings/${a.id}`} className="min-w-0 max-w-[45%] truncate text-sm font-medium text-gray-900 hover:underline sm:max-w-[55%]">
                      {a.title || 'Sin título'}
                    </Link>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-6 flex-1 overflow-hidden rounded-lg bg-gray-100">
                        <div
                          className="h-full rounded-lg bg-brand-emerald/70 transition-all"
                          style={{ width: `${Math.min(100, (a.view_count / maxViews) * 100)}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs font-semibold text-gray-700">{a.view_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.by_month.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-gray-900">Ventas y compras por mes (últimos 6 meses)</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analytics.by_month.map((m) => (
                  <div key={m.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                    <div className="text-xs font-bold text-gray-700">{m.label}</div>
                    <div className="mt-2 flex gap-2">
                      <div className="flex-1">
                        <div className="text-[10px] text-emerald-600">Ventas</div>
                        <div className="h-5 w-full overflow-hidden rounded bg-gray-200">
                          <div
                            className="h-full rounded bg-emerald-400"
                            style={{ width: `${Math.min(100, (m.sales_count / maxMonth) * 100)}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-gray-900">{m.sales_count} · {formatMoney(m.sales_total)}</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] text-blue-600">Compras</div>
                        <div className="h-5 w-full overflow-hidden rounded bg-gray-200">
                          <div
                            className="h-full rounded bg-blue-400"
                            style={{ width: `${Math.min(100, (m.purchases_count / maxMonth) * 100)}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-gray-900">{m.purchases_count} · {formatMoney(m.purchases_total)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.listings_views.length === 0 && analytics.by_month.length === 0 && (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
              Aún no hay datos de vistas ni de ventas/compras por mes. Publica artículos y realiza operaciones para ver tus gráficas.
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [menuBanner, setMenuBanner] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBanner = async () => {
      try {
        const { data, error } = await supabase
          .from('home_banners')
          .select('*')
          .eq('placement', 'dashboard_menu')
          .eq('is_active', true)
          .single();
        if (!cancelled && data && !error) {
          setMenuBanner(data);
        }
      } catch (err) {
        console.error('Error fetching menu banner:', err);
      }
    };
    fetchBanner();
    return () => { cancelled = true; };
  }, []);

  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Usuario');
  const [isAdmin, setIsAdmin] = useState(false);

  const [documentsUploaded, setDocumentsUploaded] = useState(0);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<Record<string, any[]>>({});
  const [counterpartyNames, setCounterpartyNames] = useState<Record<string, string>>({});
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  const [unansweredQuestionsCount, setUnansweredQuestionsCount] = useState<number>(0);
  const [salesNotifCount, setSalesNotifCount] = useState<number>(0);
  const [responsesCount, setResponsesCount] = useState<number>(0);
  const [adminState, setAdminState] = useState<{ status: string; suspended_until: string | null } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);
  const [isUpdatingTour, setIsUpdatingTour] = useState(false);
  const [balance, setBalance] = useState<{
    disponible: number;
    por_liberar: number;
    estimado: number;
    can_withdraw: boolean;
    wallet_balance: number;
  } | null>(null);
  const [summary, setSummary] = useState<{
    balance: { disponible: number; por_liberar: number; estimado: number; can_withdraw: boolean; mercadopago_configured?: boolean; wallet_balance?: number };
    total_pagado: number;
    total_cobrado: number;
    total_retirado: number;
    operations_count: number;
    sales_count: number;
    purchases_count: number;
    unanswered_questions: number;
    responses_count: number;
    disputes_open: number;
  } | null>(null);

  const [historyFilter, setHistoryFilter] = useState<'todas' | 'ventas' | 'compras'>('todas');
  const [historyPage, setHistoryPage] = useState(1);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const needsIneUpload = useMemo(() => documentsUploaded === 0, [documentsUploaded]);

  const historyFiltered = useMemo(() => {
    if (!userId) return [];
    return orders.filter((o) => {
      if (historyFilter === 'ventas') return String(o.seller_id) === String(userId);
      if (historyFilter === 'compras') return String(o.buyer_id) === String(userId);
      return true;
    });
  }, [orders, userId, historyFilter]);

  const PAGE_SIZE = 8;
  const historyTotalPages = Math.max(1, Math.ceil(historyFiltered.length / PAGE_SIZE));
  const historyPaginated = useMemo(() => {
    const page = Math.min(Math.max(1, historyPage), historyTotalPages);
    const start = (page - 1) * PAGE_SIZE;
    return historyFiltered.slice(start, start + PAGE_SIZE);
  }, [historyFiltered, historyPage, historyTotalPages]);

  useEffect(() => {
    if (historyPage > historyTotalPages && historyTotalPages >= 1) setHistoryPage(1);
  }, [historyTotalPages, historyPage]);

  const loadSummary = useCallback(async (uid: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/dashboard/summary', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any)?.ok) {
        setSummary(null);
        setBalance(null);
        return;
      }
      const b = (json as any).balance ?? {};
      setSummary({
        balance: b,
        total_pagado: Number((json as any)?.total_pagado ?? 0) || 0,
        total_cobrado: Number((json as any)?.total_cobrado ?? 0) || 0,
        total_retirado: Number((json as any)?.total_retirado ?? 0) || 0,
        operations_count: Number((json as any)?.operations_count ?? 0) || 0,
        sales_count: Number((json as any)?.sales_count ?? 0) || 0,
        purchases_count: Number((json as any)?.purchases_count ?? 0) || 0,
        unanswered_questions: Number((json as any)?.unanswered_questions ?? 0) || 0,
        responses_count: Number((json as any)?.responses_count ?? 0) || 0,
        disputes_open: Number((json as any)?.disputes_open ?? 0) || 0,
      });
      setBalance({
        disponible: Number(b?.disponible ?? 0) || 0,
        por_liberar: Number(b?.por_liberar ?? 0) || 0,
        estimado: Number(b?.estimado ?? 0) || 0,
        can_withdraw: Boolean(b?.can_withdraw),
        wallet_balance: Number(b?.wallet_balance ?? 0) || 0,
      });
      setUnansweredQuestionsCount(Number((json as any)?.unanswered_questions ?? 0) || 0);
      setResponsesCount(Number((json as any)?.responses_count ?? 0) || 0);
    } catch {
      setSummary(null);
      setBalance(null);
    }
  }, []);

  const loadBalance = useCallback(
    async (uid: string) => {
      await loadSummary(uid);
    },
    [loadSummary],
  );

  const suspensionCountdown = useMemo(() => {
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

  const loadSalesNotifCount = useCallback(async (_uid: string) => {
    return;
  }, []);

  const loadAlerts = useCallback(async (uid: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const alertsRes = await fetch(`/api/alerts/summary?t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const alertsJson = await alertsRes.json().catch(() => ({}));
      if (alertsRes.ok) {
        const list = (alertsJson?.alerts ?? []) as Array<{ id: string; count: number }>;
        const alertCount = (id: string) => list.find((a) => a.id === id)?.count ?? 0;
        setSalesNotifCount(alertCount('sales'));
        setUnansweredQuestionsCount(alertCount('questions'));
        setResponsesCount(alertCount('responses'));
      }
    } catch (err) {
      console.error('[Dashboard] Error al cargar alertas:', err);
    }
  }, []);

  const loadUnansweredQuestionsCount = useCallback(async (uid: string) => {
    try {
      // Usar el API en lugar de consulta directa para que use el mismo método que la página de preguntas
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (token) {
        const apiRes = await fetch(`/api/questions/list?sellerId=${encodeURIComponent(uid)}&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const apiJson = await apiRes.json().catch(() => ({}));
        if (apiRes.ok && Array.isArray(apiJson?.questions)) {
          const count = apiJson.questions.length;
          console.log('[Dashboard] Conteo de preguntas sin respuesta desde API:', count);
          setUnansweredQuestionsCount(count);
          return;
        }
      }

      // Fallback: consulta directa
      const res: any = await supabase
        .from('listing_questions')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', uid)
        .eq('is_deleted', false)
        .is('answer_text', null);
      if (res?.error) {
        const code = String((res.error as any)?.code || '');
        const msg = String((res.error as any)?.message || '').toLowerCase();
        if (code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache') || code === 'PGRST106') {
          setUnansweredQuestionsCount(0);
          return;
        }
        setUnansweredQuestionsCount(0);
        return;
      }
      setUnansweredQuestionsCount(Number(res?.count ?? 0) || 0);
    } catch (err) {
      console.error('[Dashboard] Error al contar preguntas:', err);
      setUnansweredQuestionsCount(0);
    }
  }, []);

  useEffect(() => {
    if (adminState?.status !== 'suspended') return;
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, [adminState?.status]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setIsBooting(true);
        setPageError(null);

        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/dashboard')}`;
          return;
        }

        const profileRes = await fetch('/api/me/profile', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const profileJson = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok || !(profileJson as any)?.ok) {
          throw new Error((profileJson as any)?.error || 'No se pudo cargar el perfil');
        }

        if (cancelled) return;

        const effectiveId = String((profileJson as any).userId || '').trim();
        const name = String((profileJson as any).displayName || 'Usuario');
        setUserId(effectiveId);
        setDisplayName(name);
        setDocumentsUploaded(Number((profileJson as any).documentsUploaded ?? 0) || 0);
        setHasSeenTour(Boolean((profileJson as any).hasSeenTour));
        if (profileJson.adminState) {
          setAdminState({
            status: String((profileJson as any).adminState?.status ?? 'active'),
            suspended_until: (profileJson as any).adminState?.suspended_until ?? null,
          });
        }

        // Admin check en paralelo (no bloquea las demás cargas)
        supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', sess.session?.user?.id || '')
          .maybeSingle()
          .then(({ data: adminRow }) => {
            if (!cancelled) setIsAdmin(Boolean(adminRow));
          });

        // Cargar todo en paralelo
        await loadOperations(effectiveId);
        void loadAlerts(effectiveId);
        void loadUnansweredQuestionsCount(effectiveId);
        void loadSalesNotifCount(effectiveId);
        void loadBalance(effectiveId);
      } catch (err: unknown) {
        console.error(err);
        setPageError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    const loadOperations = async (uid: string) => {
      try {
        setIsOrdersLoading(true);
        setOrdersError(null);

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
          .order('created_at', { ascending: false })
          .limit(120);

        if (error) {
          setOrders([]);
          setOrdersError('No pude cargar tu historial. Verifica que exista la tabla `orders` y sus políticas (RLS).');
          return;
        }

        const nextOrders = ((data as any[]) ?? []) as OrderRow[];

        // Fetch wallet topups to mix in history
        const { data: topups } = await supabase
          .from('wallet_topups')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50);

        const topupRows: OrderRow[] = (topups || []).map((t: any) => ({
          id: t.id,
          buyer_id: t.user_id,
          seller_id: 'POCKET_APP', // System
          status: t.status === 'pending_proof' ? 'pending_payment' : t.status === 'approved' ? 'completed' : t.status,
          total: t.amount,
          created_at: t.created_at,
          is_topup: true,
          proof_url: t.proof_url
        }));

        // Merge and sort
        const allOps = [...nextOrders, ...topupRows].sort((a, b) => {
          const da = new Date(a.created_at || 0).getTime();
          const db = new Date(b.created_at || 0).getTime();
          return db - da;
        });

        setOrders(allOps);

        const orderIds = nextOrders.map((o) => o.id).filter(Boolean);
        if (orderIds.length === 0) {
          setOrderItemsByOrderId({});
          setCounterpartyNames({});
          return;
        }

        // Items de órdenes
        const itemsRes: any = await supabase
          .from('order_items')
          .select('order_id,listing_id,title,quantity,unit_price,line_total')
          .in('order_id', orderIds);
        if (!itemsRes.error && Array.isArray(itemsRes.data)) {
          const map: Record<string, any[]> = {};
          for (const it of itemsRes.data as any[]) {
            const oid = String(it?.order_id || '').trim();
            if (!oid) continue;
            if (!map[oid]) map[oid] = [];
            map[oid].push(it);
          }
          setOrderItemsByOrderId(map);
        } else {
          setOrderItemsByOrderId({});
        }

        // Nombres de comprador/vendedor
        const ids = Array.from(
          new Set(
            nextOrders
              .flatMap((o) => [String((o as any).buyer_id || ''), String((o as any).seller_id || '')])
              .map((x) => x.trim())
              .filter((x) => x && x !== uid),
          ),
        );
        if (ids.length > 0) {
          let profRes: any = await supabase.from('profiles').select('id,full_name,nickname,username').in('id', ids);
          if (profRes.error) {
            const code = String((profRes.error as any)?.code || '');
            const msg = String((profRes.error as any)?.message || '').toLowerCase();
            // Intentar solo con full_name si hay error de columna o error 400
            if (code === '42703' || msg.includes('does not exist') || msg.includes('column') || code === '400') {
              profRes = await supabase.from('profiles').select('id,full_name').in('id', ids);
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
            setCounterpartyNames(map);
          } else {
            setCounterpartyNames({});
          }
        } else {
          setCounterpartyNames({});
        }
      } finally {
        setIsOrdersLoading(false);
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [loadUnansweredQuestionsCount, loadSalesNotifCount, loadBalance]);

  // Realtime + polling: preguntas y summary
  useEffect(() => {
    if (!userId) return;

    const qChannel = supabase
      .channel(`dash-questions-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listing_questions', filter: `seller_id=eq.${userId}` },
        () => void loadUnansweredQuestionsCount(userId),
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void loadUnansweredQuestionsCount(userId);
      void loadSalesNotifCount(userId);
      void loadSummary(userId);
    }, 30000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(qChannel);
    };
  }, [userId, loadUnansweredQuestionsCount, loadSalesNotifCount, loadSummary]);

  // Realtime: órdenes del vendedor → actualizar balance (admin marca pagado, etc.)
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`dash-orders-seller-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `seller_id=eq.${userId}` }, () => {
        void loadBalance(userId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${userId}` }, () => {
        void loadBalance(userId);
      })
      .subscribe();
    const onPayoutsUpdated = () => void loadBalance(userId);
    window.addEventListener('payouts-updated', onPayoutsUpdated);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener('payouts-updated', onPayoutsUpdated);
    };
  }, [userId, loadBalance]);

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/';
    }
  };

  const menuSections = useMemo(() => {
    const sections: Array<{ title?: string; items: NavItem[] }> = [
      {
        title: 'Navegación',
        items: [
          { label: 'Explorar', href: '/listings' },
          { label: 'Vender', href: '/sell', tone: 'pink' },
          { label: 'Carrito', href: '/cart' },
        ],
      },
      {
        title: 'Mi cuenta',
        items: [
          { label: 'Mi panel', href: '/dashboard', tone: 'pink' },
          { label: 'Mi perfil', href: '/dashboard/perfil' },
          { label: 'Mis publicaciones', href: '/dashboard/listings' },
        ],
      },
      {
        title: 'Operaciones',
        items: [
          { label: 'Ventas', href: '/dashboard/ventas' },
          { label: 'Compras', href: '/dashboard/compras' },
          { label: 'Pagos', href: '/dashboard/pagos' },
        ],
      },
      {
        title: 'Comunicación',
        items: [
          { label: 'Preguntas', href: '/dashboard/preguntas' },
          { label: 'Respuestas', href: '/dashboard/respuestas' },
        ],
      },
      {
        title: 'Otros',
        items: [
          { label: 'Favoritos', href: '/dashboard/favoritos' },
          { label: 'Reputación', href: '/dashboard/reputacion' },
          { label: 'Disputas', href: '/dashboard/devoluciones' },
          { label: 'Cupones', href: '/dashboard/coupons' },
        ],
      },
      {
        items: [
          { label: 'Ayuda', href: '/dashboard/ayuda' },
          ...(isAdmin ? [{ label: 'Admin', href: '/admin/settings' }] : []),
          { label: 'Cerrar sesión', onClick: onSignOut, tone: 'danger' },
        ],
      },
    ];
    return sections;
  }, [isAdmin, unansweredQuestionsCount, salesNotifCount, responsesCount, onSignOut]);

  // Mantener navItems para compatibilidad con el menú móvil
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    menuSections.forEach(section => {
      items.push(...section.items);
    });
    return items;
  }, [menuSections]);

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
          <div className="mt-6 h-32 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="h-28 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
            <div className="h-28 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
          </div>
          <div className="mt-6 h-64 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Navbar */}
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-95">
            <img src="/logo.png" alt="GoVendy Logo" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">GoVendy</div>
              <div className="text-xs text-gray-500">Panel principal</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-sm font-semibold text-gray-600 sm:block">
              Hola, <span className="text-gray-900">{displayName}</span>
            </div>
            <Link href="/" className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-black/5">
              Inicio
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageTour steps={pageTours.dashboard || []} pageId="dashboard" />

        {menuBanner && (
          <div className="mb-6">
            <a
              href={menuBanner.link_url || '#'}
              target={menuBanner.open_in_new_tab ? '_blank' : '_self'}
              rel={menuBanner.open_in_new_tab ? 'noopener noreferrer' : undefined}
              className="block overflow-hidden rounded-2xl shadow-sm transition hover:opacity-95"
            >
              <img
                src={menuBanner.image_url}
                alt={menuBanner.title || 'Anuncio'}
                className="h-auto w-full object-cover"
              />
            </a>
          </div>
        )}

        <SectionMessage section="dashboard" />
        {/* Menú (móvil) */}
        <section className="mb-6 lg:hidden">
          <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-bold text-gray-900">Menú</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {navItems.map((it) => (
                <NavCard key={`${it.label}-${it.href || 'btn'}`} item={it} />
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
          <div>
            {pageError && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {pageError}
              </div>
            )}

            {adminState?.status === 'banned' && (
              <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-center shadow-sm ring-1 ring-red-200">
                <div className="text-base font-extrabold text-red-900">Cuenta bloqueada permanentemente</div>
                <p className="mt-2 text-sm text-red-800">
                  No puedes comprar, vender ni publicar. Todas tus publicaciones han sido deshabilitadas.
                </p>
              </div>
            )}

            {adminState?.status === 'suspended' && (
              <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm ring-1 ring-amber-200 sm:flex-row sm:justify-center sm:gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">⏱</span>
                  <div className="text-left">
                    <div className="text-sm font-extrabold text-amber-900">Cuenta suspendida</div>
                    <div className="text-xs text-amber-800">
                      No puedes comprar, vender ni activar publicaciones hasta que termine la suspensión.
                    </div>
                  </div>
                </div>
                {suspensionCountdown && !suspensionCountdown.ended ? (
                  <div className="rounded-xl bg-amber-100 px-4 py-2 font-mono text-lg font-bold tabular-nums text-amber-900 ring-1 ring-amber-300">
                    {suspensionCountdown.days}d {suspensionCountdown.hours}h
                  </div>
                ) : suspensionCountdown?.ended ? (
                  <div className="rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-900">
                    La suspensión ya terminó. Recarga la página.
                  </div>
                ) : null}
              </div>
            )}

            {/* Bienvenida */}
            <section className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                    Bienvenido a GoVendy
                  </div>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    Hola, <span className="text-brand-emerald">{displayName}</span>
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-gray-600">
                    Administra tu cuenta y tus operaciones (ventas/compras) desde un panel claro, rápido y profesional.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/dashboard/perfil"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                  >
                    Mi perfil
                  </Link>
                  <Link
                    href="/dashboard/ventas"
                    className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                  >
                    Ver ventas
                  </Link>
                </div>
              </div>

              {needsIneUpload && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Aún no detecto documentos subidos en tu perfil. Si ya subiste tu INE, asegúrate de guardar las URLs en
                  tu tabla <span className="font-semibold">profiles</span>. Si no, puedes subirlo ahora.
                </div>
              )}
            </section>

            {/* Banner PocketCash */}
            <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-1 shadow-sm ring-1 ring-black/5">
              <div className="relative overflow-hidden rounded-[20px] bg-gray-900 px-6 py-8 sm:px-10">
                <div className="absolute right-0 top-0 h-full w-1/2 translate-x-1/4 transform bg-gradient-to-l from-brand-emerald/30 to-transparent blur-3xl"></div>
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-emerald/10 px-3 py-1 text-xs font-medium text-brand-emerald ring-1 ring-brand-emerald/20">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-brand-emerald"></span>
                      Novedad
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">
                      Tu saldo ahora es más poderoso
                    </h3>
                    <p className="mt-2 text-sm text-gray-400">
                      Usa tu tarjeta PocketCash virtual para todas tus operaciones. Sin comisiones ocultas y con control total.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/monedero"
                    className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-gray-100"
                  >
                    Ver mi tarjeta
                  </Link>
                </div>
              </div>
            </div>

            <ProExpirationBanner />
            {userId && <PlanWidget userId={userId} />}

            {/* Control: ventas, preguntas, respuestas, operaciones, disputas, pagos */}
            <section className="mt-6 rounded-3xl border-2 border-emerald-200 bg-white p-5 shadow-sm ring-1 ring-emerald-100 sm:p-6">
              <h2 className="text-base font-bold text-gray-900">Control de tu cuenta</h2>
              <p className="mt-1 text-sm text-gray-600">
                Gestiona tus ventas, preguntas, respuestas, operaciones y pagos desde un solo lugar.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                  href="/dashboard/ventas"
                  className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-100/80"
                >
                  <span className="text-sm font-semibold text-gray-900">Ventas</span>
                  <span className="flex items-center gap-2">
                    {summary && summary.sales_count > 0 ? (
                      <span className="rounded-lg bg-brand-emerald px-2 py-0.5 text-xs font-bold text-white">
                        {summary.sales_count}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-gray-400">→</span>
                  </span>
                </Link>
                <Link
                  href="/dashboard/compras"
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 transition hover:border-gray-300 hover:bg-gray-100"
                >
                  <span className="text-sm font-semibold text-gray-900">Compras</span>
                  <span className="flex items-center gap-2">
                    {summary && summary.purchases_count > 0 ? (
                      <span className="rounded-lg bg-gray-300 px-2 py-0.5 text-xs font-bold text-gray-800">
                        {summary.purchases_count}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-gray-400">→</span>
                  </span>
                </Link>
                <Link
                  href="/dashboard/preguntas"
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <span className="text-sm font-semibold text-gray-900">Preguntas</span>
                  <span className="flex items-center gap-2">
                    {summary && summary.unanswered_questions > 0 ? (
                      <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">
                        {summary.unanswered_questions} sin responder
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-gray-400">→</span>
                  </span>
                </Link>
                <Link
                  href="/dashboard/respuestas"
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="text-sm font-semibold text-gray-900">Respuestas</span>
                  <span className="flex items-center gap-2">
                    {summary && summary.responses_count > 0 ? (
                      <span className="rounded-lg bg-blue-200 px-2 py-0.5 text-xs font-bold text-blue-900">
                        {summary.responses_count}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-gray-400">→</span>
                  </span>
                </Link>
                <Link
                  href="/dashboard/devoluciones"
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-gray-50 px-4 py-3 transition hover:border-red-300 hover:bg-red-50"
                >
                  <span className="text-sm font-semibold text-gray-900">Disputas</span>
                  <span className="flex items-center gap-2">
                    {summary && summary.disputes_open > 0 ? (
                      <span className="rounded-lg bg-red-300 px-2 py-0.5 text-xs font-bold text-red-900">
                        {summary.disputes_open} abierta(s)
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-gray-400">→</span>
                  </span>
                </Link>
                <Link
                  href="/dashboard/pagos"
                  className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50/50 px-4 py-3 transition hover:border-green-400 hover:bg-green-100/80"
                >
                  <span className="text-sm font-semibold text-gray-900">Pagos y retiros</span>
                  <span className="text-xs font-bold text-gray-400">→</span>
                </Link>
                <Link
                  href="/dashboard/monedero"
                  className="flex items-center justify-between rounded-2xl border border-brand-emerald bg-emerald-50/50 px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-100/80"
                >
                  <span className="text-sm font-semibold text-gray-900">PocketCash</span>
                  <span className="text-xs font-bold text-gray-400">→</span>
                </Link>
              </div>
            </section>

            {/* Tarjetas */}
            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link
                href="/dashboard/ventas"
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-brand-emerald/40"
                data-tour="recent-operations"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-600">Operaciones recientes</div>
                    <div className="mt-2 text-3xl font-bold text-gray-900">
                      {summary ? summary.operations_count : orders.length}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Ventas y compras registradas</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-brand-emerald ring-1 ring-emerald-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 7h16M6 11h12M8 15h8M10 19h4"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-2 text-right text-xs font-semibold text-brand-emerald">Ver ventas y compras →</div>
              </Link>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-600">Documentos Subidos</div>
                    <div className="mt-2 text-3xl font-bold text-gray-900">{documentsUploaded}</div>
                    <div className="mt-1 text-xs text-gray-500">Detectados desde tu perfil (INE frente/reverso)</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-brand-emerald ring-1 ring-emerald-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M8 3h6l4 4v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/pagos"
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:ring-2 hover:ring-brand-emerald/40"
                data-tour="balance"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-600">Dinero disponible</div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">
                      {balance ? formatMoney(balance.disponible) : '—'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {balance && (balance.por_liberar > 0 || balance.estimado > 0)
                        ? `Por liberar: ${formatMoney(balance.por_liberar)} · Estimado: ${formatMoney(balance.estimado)}`
                        : 'Conectado con ventas y retiros'}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-green-50 p-3 text-green-600 ring-1 ring-green-100">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                </div>
                {/* Resumen: qué pagaste, qué cobraste, qué retiraste */}
                {summary && (summary.total_pagado > 0 || summary.total_cobrado > 0 || summary.total_retirado > 0) && (
                  <div className="mt-4 space-y-1 rounded-xl border border-green-100 bg-green-50/50 px-3 py-2 text-xs">
                    {summary.total_pagado > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Total pagado (compras):</span>
                        <span className="font-semibold">{formatMoney(summary.total_pagado)}</span>
                      </div>
                    )}
                    {summary.total_cobrado > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Total cobrado (ventas):</span>
                        <span className="font-semibold">{formatMoney(summary.total_cobrado)}</span>
                      </div>
                    )}
                    {summary.total_retirado > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Total retirado:</span>
                        <span className="font-semibold">{formatMoney(summary.total_retirado)}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Explicación clara: retenido vs liberado */}
                <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900">
                  <strong>¿Por qué está retenido o liberado?</strong>
                  <p className="mt-1 text-amber-800">
                    El dinero se <strong>libera</strong> cuando el comprador confirma que recibió su pedido o cuando un
                    administrador marca la orden como entregada. Hasta entonces aparece como <em>Por liberar</em> o{' '}
                    <em>Estimado</em>. Lo <strong>liberado</strong> está en «Dinero disponible» y puedes solicitar retiro.
                  </p>
                </div>
                <div className="mt-3 text-right text-xs font-semibold text-brand-emerald">Ver pagos →</div>
              </Link>

              <Link
                href="/dashboard/monedero"
                className="group relative h-56 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-emerald to-emerald-600 p-6 text-white shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl"
              >
                {/* Decorative Elements */}
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-emerald-900/20 blur-3xl"></div>

                {/* Card Header */}
                <div className="relative z-10 flex items-start justify-between">
                  <div className="h-9 w-12 rounded-lg bg-yellow-200/90 shadow-inner ring-1 ring-yellow-400/50 backdrop-blur-sm">
                    <div className="grid h-full w-full grid-cols-2 gap-1 p-2 opacity-60">
                      <div className="rounded-[1px] border border-yellow-700/40"></div>
                      <div className="rounded-[1px] border border-yellow-700/40"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold italic tracking-wider">PocketCash</div>
                    <div className="text-[10px] font-medium opacity-80">DEBIT</div>
                  </div>
                </div>

                {/* Balance Section */}
                <div className="relative z-10 mt-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium opacity-80">Saldo Disponible</span>
                    {balance && (
                      <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                        MXN
                      </span>
                    )}
                  </div>
                  <div className="mt-1 font-mono text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                    {balance ? formatMoney(balance.wallet_balance) : '—'}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="relative z-10 mt-8 flex items-end justify-between">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">TITULAR</div>
                    <div className="max-w-[150px] truncate font-medium uppercase tracking-wide text-white/90">
                      {displayName || 'Miembro GoVendy'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">EXPIRA</div>
                    <div className="font-mono text-sm font-medium text-white/90">12/30</div>
                  </div>
                </div>
              </Link>
            </section>

            {/* Gráficas y desempeño */}
            <DashboardCharts userId={userId} />

          </div>

          {/* Menú (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-black/5" data-tour="menu">
              <div className="text-sm font-bold text-gray-900">Menú</div>
              <div className="mt-3 grid gap-3">
                {navItems.map((it) => (
                  <NavCard key={`${it.label}-${it.href || 'btn'}`} item={it} />
                ))}
              </div>

              {menuBanner && (
                <div className="mt-6 overflow-hidden rounded-2xl bg-gray-900 shadow-lg ring-1 ring-white/10 relative aspect-square">
                  {menuBanner.image_url ? (
                    <img src={menuBanner.image_url} alt={menuBanner.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-purple-600" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-sm font-bold text-white">{menuBanner.title}</h3>
                    {menuBanner.subtitle && <p className="mt-1 text-xs text-gray-200 line-clamp-2">{menuBanner.subtitle}</p>}
                    {menuBanner.cta_href && (
                      <Link href={menuBanner.cta_href} className="mt-3 block w-full rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20">
                        {menuBanner.cta_text || 'Ver más'}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
        {/* Configuración de Tours */}
        {hasSeenTour !== null && (
          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-gray-900">Tours guiados</div>
                <div className="mt-1 text-xs text-gray-600">
                  {hasSeenTour
                    ? 'Los tours están desactivados. Actívalos para ver explicaciones en cada página.'
                    : 'Los tours están activados. Se mostrarán automáticamente en cada página nueva.'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!userId || isUpdatingTour) return;
                    try {
                      setIsUpdatingTour(true);
                      const newValue = !hasSeenTour;
                      const { error } = await supabase
                        .from('profiles')
                        .update({ has_seen_onboarding_tour: newValue })
                        .eq('id', userId);
                      if (error) throw error;
                      setHasSeenTour(newValue);
                      // Si se activa, limpiar localStorage para que se muestren los tours
                      if (newValue === false) {
                        const keys = Object.keys(localStorage);
                        keys.forEach((key) => {
                          if (key.startsWith(`pocket_tour_`) && key.endsWith(`_${userId}`)) {
                            localStorage.removeItem(key);
                          }
                        });
                      }
                    } catch (e) {
                      console.error('Error actualizando tour:', e);
                      alert('No se pudo actualizar la configuración del tour.');
                    } finally {
                      setIsUpdatingTour(false);
                    }
                  }}
                  disabled={isUpdatingTour}
                  className="rounded-xl bg-brand-emerald px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isUpdatingTour ? 'Actualizando…' : hasSeenTour ? 'Activar tours' : 'Desactivar tours'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Mi tienda */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8" data-tour="my-store">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                Mi tienda
              </div>
              <h2 className="mt-3 text-lg font-bold text-gray-900">Ventas y cupones</h2>
              <p className="mt-1 text-sm text-gray-600">Administra tus publicaciones y crea cupones para tus artículos.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Link
              href="/sell"
              className="rounded-3xl border border-black/5 bg-gray-50 p-5 hover:bg-gray-100"
            >
              <div className="text-sm font-semibold text-gray-900">Publicar artículo</div>
              <div className="mt-1 text-xs text-gray-600">Crea una nueva publicación (directa o subasta).</div>
              <div className="mt-4 text-sm font-semibold text-brand-emerald">Ir a vender →</div>
            </Link>
            <Link
              href="/dashboard/listings"
              className="rounded-3xl border border-black/5 bg-gray-50 p-5 hover:bg-gray-100"
            >
              <div className="text-sm font-semibold text-gray-900">Mis publicaciones</div>
              <div className="mt-1 text-xs text-gray-600">Ver, pausar, activar o marcar como vendido.</div>
              <div className="mt-4 text-sm font-semibold text-brand-emerald">Gestionar →</div>
            </Link>
            <Link
              href="/dashboard/coupons"
              className="rounded-3xl border border-black/5 bg-gray-50 p-5 hover:bg-gray-100"
            >
              <div className="text-sm font-semibold text-gray-900">Cupones</div>
              <div className="mt-1 text-xs text-gray-600">Crea cupones y asígnalos a tus publicaciones.</div>
              <div className="mt-4 text-sm font-semibold text-brand-emerald">Crear cupones →</div>
            </Link>
          </div>
        </section>

        {/* Historial de operaciones */}
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Historial de operaciones</h2>
              <p className="mt-1 text-sm text-gray-600">
                Ventas y compras. Filtra, pagina y descarga Excel o estado de cuenta.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!userId || exportingCsv) return;
                  setExportingCsv(true);
                  try {
                    const { data: sess } = await supabase.auth.getSession();
                    const token = sess?.session?.access_token;
                    if (!token) throw new Error('Sesión expirada.');
                    const res = await fetch('/api/dashboard/operations/export', {
                      headers: { authorization: `Bearer ${token}` },
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      throw new Error((j as any)?.error ?? 'Error al exportar.');
                    }
                    const blob = await res.blob();
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = u;
                    a.download = `operaciones-${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(u);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'No se pudo descargar.');
                  } finally {
                    setExportingCsv(false);
                  }
                }}
                disabled={exportingCsv || isOrdersLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 shadow-sm hover:bg-green-100 disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {exportingCsv ? 'Descargando…' : 'Excel (CSV)'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!userId || exportingPdf) return;
                  setExportingPdf(true);
                  try {
                    const { data: sess } = await supabase.auth.getSession();
                    const token = sess?.session?.access_token;
                    if (!token) throw new Error('Sesión expirada.');
                    const res = await fetch('/api/payouts/statement', { headers: { authorization: `Bearer ${token}` } });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      throw new Error((j as any)?.error ?? 'No se pudo descargar.');
                    }
                    const blob = await res.blob();
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = u;
                    a.download = `estado-cuenta-${new Date().toISOString().slice(0, 10)}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(u);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'No se pudo descargar estado de cuenta.');
                  } finally {
                    setExportingPdf(false);
                  }
                }}
                disabled={exportingPdf || isOrdersLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-100 disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                {exportingPdf ? 'Descargando…' : 'Estado de cuenta (PDF)'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['todas', 'ventas', 'compras'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setHistoryFilter(f);
                  setHistoryPage(1);
                }}
                className={classNames(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition',
                  historyFilter === f
                    ? 'bg-brand-emerald text-white ring-2 ring-brand-emerald/50'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                )}
              >
                {f === 'todas' ? 'Todas' : f === 'ventas' ? 'Ventas' : 'Compras'}
              </button>
            ))}
            <Link
              href="/dashboard/ventas"
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Ver ventas →
            </Link>
            <Link
              href="/dashboard/compras"
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Ver compras →
            </Link>
          </div>

          {ordersError && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {ordersError}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-black/5">
            {isOrdersLoading ? (
              <div className="p-6 text-center text-sm text-gray-600">Cargando operaciones…</div>
            ) : historyFiltered.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-600">
                No hay operaciones con este filtro. Prueba «Todas» o ve a <Link href="/dashboard/ventas" className="font-semibold text-brand-emerald hover:underline">Ventas</Link> /{' '}
                <Link href="/dashboard/compras" className="font-semibold text-brand-emerald hover:underline">Compras</Link>.
              </div>
            ) : (
              <>
                <div className="divide-y divide-black/5">
                  {historyPaginated.map((o) => {
                    const isSale = String(o.seller_id) === String(userId);
                    const otherId = isSale ? String(o.buyer_id || '') : String(o.seller_id || '');
                    const otherName = otherId ? counterpartyNames[otherId] || `${otherId.slice(0, 6)}…` : '—';
                    const items = orderItemsByOrderId[o.id] ?? [];
                    const status = String((o as any).status || '');
                    const labelUrl = String((o as any).shipping_label_url || '').trim();
                    const carrier = String((o as any).shipping_carrier || '').trim();
                    const liberado = isSale && !!(o as any).paid_to_seller_at;
                    return (
                      <div key={o.id} className="p-4 hover:bg-emerald-50/30">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={classNames(
                                  'rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                                  isSale ? 'bg-emerald-50 text-brand-emerald ring-emerald-100' : 'bg-gray-100 text-gray-700 ring-black/5',
                                )}
                              >
                                {isSale ? 'Venta' : 'Compra'}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                {o.id.slice(0, 8)}…
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                {status || '—'}
                              </span>
                              {liberado && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-200">
                                  Liberado
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              {isSale ? (
                                <>Comprador: <span className="font-semibold text-gray-900">{otherName}</span></>
                              ) : (
                                <>Vendido por{' '}
                                  {otherId ? (
                                    <Link href={`/perfil/${otherId}`} className="font-semibold text-brand-emerald hover:opacity-90 hover:underline">
                                      {otherName}
                                    </Link>
                                  ) : (
                                    <span className="font-semibold text-gray-900">{otherName}</span>
                                  )}
                                </>
                              )}{' '}
                              · {formatDateTime((o as any).created_at)}
                            </div>
                            {items.length > 0 && (
                              <div className="mt-2 text-xs text-gray-700">
                                <div className="font-semibold text-gray-900">Artículos</div>
                                <div className="mt-1 space-y-1">
                                  {items.slice(0, 3).map((it: any, idx: number) => (
                                    <div key={`${o.id}-${idx}`} className="flex flex-wrap items-center gap-2">
                                      <Link href={`/listings/${String(it.listing_id)}`} className="text-brand-emerald hover:underline">
                                        {String(it.title || 'Artículo')}
                                      </Link>
                                      <span className="text-gray-500">x{Number(it.quantity ?? 1) || 1}</span>
                                    </div>
                                  ))}
                                  {items.length > 3 && <div className="text-gray-500">+ {items.length - 3} más…</div>}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 rounded-2xl bg-gray-50 px-4 py-3 text-sm ring-1 ring-black/5">
                            <div className="text-xs font-semibold text-gray-900">Total</div>
                            <div className="mt-1 text-sm font-extrabold text-gray-900">{formatMoney((o as any).total)}</div>
                            <div className="mt-2 grid gap-1 text-xs text-gray-600">
                              <div className="flex justify-between gap-3">
                                <span>Envío</span>
                                <span className="font-semibold text-gray-900">{formatMoney((o as any).shipping_fee)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span>Comisión</span>
                                <span className="font-semibold text-gray-900">{formatMoney((o as any).commission_fee)}</span>
                              </div>
                            </div>
                            {isSale && (
                              <div className="mt-3">
                                {labelUrl ? (
                                  <a
                                    href={labelUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                                  >
                                    Descargar guía
                                  </a>
                                ) : (
                                  <div className="text-xs text-gray-500">{carrier ? `Paquetería: ${carrier}` : 'Guía pendiente'}</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 bg-gray-50 px-4 py-3">
                  <div className="text-xs text-gray-600">
                    {historyFiltered.length} operación(es) · Página {Math.min(historyPage, historyTotalPages)} de {historyTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      disabled={historyPage >= historyTotalPages}
                      className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}


