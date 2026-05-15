'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';
import { useAdminContext } from '@/lib/admin/AdminContext';
import ActivityFeed from './components/ActivityFeed';
import UnifiedDashboardWidget from './components/UnifiedDashboardWidget';
import { AdminAlert } from '@/lib/admin/types';

// Tipos para el sistema de filtrado inteligente
type FilterUrgency = 'critical' | 'high' | 'medium' | 'low';
type FilterCategory = 'payment' | 'logistics' | 'dispute' | 'system';
type ViewMode = 'smart' | 'full';
type TimeRange = 'all' | '24h' | '48h' | '7d';

interface SmartFilters {
  urgency: FilterUrgency[];
  category: FilterCategory[];
  timeRange: TimeRange;
  search: string;
  showAttended: boolean;
}

const DEFAULT_FILTERS: SmartFilters = {
  urgency: ['critical', 'high'], // Por defecto mostrar solo lo importante
  category: [],
  timeRange: 'all',
  search: '',
  showAttended: false,
};

type Summary = {
  ok?: boolean;
  disputes_open: number;
  payments_offline_pending: number;
  orders_today: number;
  orders_paid_pending_ship: number;
  payouts_sellers_to_release: number;
  profiles_count: number;
  listings_active: number;
  support_unread_estimate: number;
  estafeta_paid_pending_guide: number;
  estafeta_paid_today: number;
  recent_events_count?: number;
  pending_events_count?: number;
  urgent_events_count?: number;
  monthly_pocketcash_issued?: number;
  weekly_pocketcash_issued?: number;
  weekly_pocketcash_spent?: number;
  pocketcash_global_liability?: number;
  pocketcash_total_withdrawn?: number;
  pocketcash_total_spent_orders?: number;
  listings_review_needed?: number;
};

type QuickLink = { label: string; href: string; desc: string; badge?: number };

export default function AdminDashboardPage() {
  const { alerts, metrics: contextMetrics, refreshAll } = useAdminContext();
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Estado del sistema inteligente
  const [viewMode, setViewMode] = useState<ViewMode>('smart');
  const [filters, setFilters] = useState<SmartFilters>(DEFAULT_FILTERS);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Persistencia de configuración
  useEffect(() => {
    const savedMode = localStorage.getItem('admin_view_mode');
    if (savedMode) setViewMode(savedMode as ViewMode);

    const savedFilters = localStorage.getItem('admin_smart_filters');
    if (savedFilters) {
      try {
        setFilters(JSON.parse(savedFilters));
      } catch (e) {
        console.error('Error parsing filters', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('admin_smart_filters', JSON.stringify(filters));
  }, [filters]);

  // Polling en tiempo real (cada 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll().then(() => setLastUpdate(new Date()));
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setError(null);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          window.location.href = '/login?returnTo=/admin';
          return;
        }
        const res = await fetch('/api/admin/dashboard/summary', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = (await res.json().catch(() => ({}))) as Summary & { error?: string };
        if (!res.ok) throw new Error(json?.error || 'No se pudo cargar el resumen.');
        if (!cancelled) {
          setSummary(json);
          await refreshAll();
          setLastUpdate(new Date());
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  const s = summary ?? contextMetrics ?? null;

  // Filtrado Inteligente de Alertas
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Filtro de Búsqueda
      if (filters.search) {
        const term = filters.search.toLowerCase();
        if (!alert.title.toLowerCase().includes(term) &&
          !alert.description.toLowerCase().includes(term)) {
          return false;
        }
      }

      // Filtro de Urgencia
      if (filters.urgency.length > 0) {
        const priority = alert.priority;
        let urgency: FilterUrgency = 'low';
        if (priority >= 8) urgency = 'critical';
        else if (priority >= 6) urgency = 'high';
        else if (priority >= 4) urgency = 'medium';

        if (!filters.urgency.includes(urgency)) return false;
      }

      // Filtro de Categoría
      if (filters.category.length > 0) {
        // Mapeo simple de categoría
        const cat = alert.category as FilterCategory;
        if (!filters.category.includes(cat)) return false;
      }

      // Filtro de Tiempo
      if (filters.timeRange !== 'all') {
        const created = new Date(alert.createdAt).getTime();
        const now = Date.now();
        const diffHours = (now - created) / (1000 * 60 * 60);

        if (filters.timeRange === '24h' && diffHours > 24) return false;
        if (filters.timeRange === '48h' && diffHours > 48) return false;
        if (filters.timeRange === '7d' && diffHours > 168) return false;
      }

      return true;
    });
  }, [alerts, filters]);

  // Agrupación por Urgencia para visualización
  const alertsByUrgency = useMemo(() => {
    const groups = {
      critical: [] as AdminAlert[],
      high: [] as AdminAlert[],
      medium: [] as AdminAlert[],
      low: [] as AdminAlert[],
    };

    filteredAlerts.forEach(alert => {
      if (alert.priority >= 8) groups.critical.push(alert);
      else if (alert.priority >= 6) groups.high.push(alert);
      else if (alert.priority >= 4) groups.medium.push(alert);
      else groups.low.push(alert);
    });

    return groups;
  }, [filteredAlerts]);

  // KPIs Críticos para el Dashboard Inteligente
  const smartKPIs = [
    { label: 'Disputas', value: s?.disputes_open ?? 0, href: '/admin/disputas?status=open', critical: (s?.disputes_open ?? 0) > 0 },
    { label: 'Revisión Pubs', value: (s as any)?.listings_review_needed ?? 0, href: '/admin/listings?filter=review', critical: ((s as any)?.listings_review_needed ?? 0) > 0 },
    { label: 'Pagos Offline', value: s?.payments_offline_pending ?? 0, href: '/admin/pagos?status=pending', critical: (s?.payments_offline_pending ?? 0) > 0 },
    { label: 'Por Enviar', value: s?.orders_paid_pending_ship ?? 0, href: '/admin/logistica?status=paid', critical: (s?.orders_paid_pending_ship ?? 0) > 5 },
    { label: 'Soporte', value: s?.support_unread_estimate ?? 0, href: '/admin/soporte?status=open', critical: (s?.support_unread_estimate ?? 0) > 0 },
  ];

  // Configuración de vista completa (KPIs originales)
  const kpis = [
    { label: 'Supervisión', value: 'Ver todo', href: '/admin/supervision' },
    { label: 'Disputas abiertas', value: s?.disputes_open ?? '—', href: '/admin/disputas?status=open', alert: (s?.disputes_open ?? 0) > 0 },
    {
      label: 'Pagos offline pendientes',
      value: s?.payments_offline_pending ?? '—',
      href: '/admin/pagos?status=pending',
      alert: (s?.payments_offline_pending ?? 0) > 0,
      highlight: (s?.payments_offline_pending ?? 0) > 0,
    },
    { label: 'Órdenes hoy', value: s?.orders_today ?? '—', href: '/admin/logistica' },
    {
      label: 'Por enviar (paid)',
      value: s?.orders_paid_pending_ship ?? '—',
      href: '/admin/logistica?status=paid',
      alert: (s?.orders_paid_pending_ship ?? 0) > 0,
    },
    {
      label: 'Vendedores por liberar pago',
      value: s?.payouts_sellers_to_release ?? '—',
      href: '/admin/metricas',
      alert: (s?.payouts_sellers_to_release ?? 0) > 0,
    },
    { label: 'Usuarios', value: s?.profiles_count ?? '—', href: '/admin/usuarios' },
    { label: 'Publicaciones activas', value: s?.listings_active ?? '—', href: '/admin/listings' },
    {
      label: 'Soporte abierto',
      value: s?.support_unread_estimate ?? '—',
      href: '/admin/soporte',
      alert: (s?.support_unread_estimate ?? 0) > 0,
    },
    {
      label: 'Estafeta: pagadas sin guía',
      value: s?.estafeta_paid_pending_guide ?? '—',
      href: '/admin/estafeta?status=paid',
      alert: (s?.estafeta_paid_pending_guide ?? 0) > 0,
    },
    {
      label: 'Estafeta: acreditaciones hoy',
      value: s?.estafeta_paid_today ?? '—',
      href: '/admin/estafeta',
    },
    {
      label: 'Eventos hoy',
      value: s?.recent_events_count ?? '—',
      href: '/admin/supervision',
      alert: (s?.recent_events_count ?? 0) > 0,
    },
    {
      label: 'Eventos urgentes',
      value: s?.urgent_events_count ?? '—',
      href: '/admin/supervision',
      alert: (s?.urgent_events_count ?? 0) > 0,
      highlight: (s?.urgent_events_count ?? 0) > 0,
    },
    {
      label: 'PocketCash Emitido (Mes)',
      value: s?.monthly_pocketcash_issued !== undefined ? `$${s.monthly_pocketcash_issued.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
      href: '/admin/pocketcash',
    },
    {
      label: 'PocketCash Gastado (Semana)',
      value: s?.weekly_pocketcash_spent !== undefined ? `$${s.weekly_pocketcash_spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
      href: '/admin/pocketcash',
    },
    {
      label: 'PocketCash Global (Pasivo)',
      value: s?.pocketcash_global_liability !== undefined ? `$${s.pocketcash_global_liability.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
      href: '/admin/pocketcash',
    },
    {
      label: 'PocketCash Liberado (Total)',
      value: s?.pocketcash_total_withdrawn !== undefined ? `$${s.pocketcash_total_withdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
      href: '/admin/pocketcash',
    },
    {
      label: 'PocketCash en Compras (Total)',
      value: s?.pocketcash_total_spent_orders !== undefined ? `$${s.pocketcash_total_spent_orders.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
      href: '/admin/pocketcash',
    },
  ];

  const quickLinks: QuickLink[] = [
    { label: 'Supervisión', href: '/admin/supervision', desc: 'Pagos, compras, ventas, disputas, envíos y cobros en un solo lugar' },
    { label: 'Métricas y payouts', href: '/admin/metricas', desc: 'Ventas, comisiones, liberar pagos a vendedores' },
    { label: 'Usuarios', href: '/admin/usuarios', desc: 'Gestión, suspender, verificar, ver operaciones' },
    { label: 'Logística', href: '/admin/logistica', desc: 'Órdenes, etiquetas, envíos' },
    { label: 'Pagos offline', href: '/admin/pagos', desc: 'Confirmar transferencias, OXXO, depósitos' },
    { label: 'Disputas', href: '/admin/disputas', desc: 'Resolver conflictos comprador / vendedor' },
    { label: 'Devoluciones', href: '/admin/devoluciones', desc: 'Devoluciones y guías' },
    { label: 'Publicaciones', href: '/admin/listings', desc: 'Listados, moderación' },
    { label: 'Soporte', href: '/admin/soporte', desc: 'Conversaciones de ayuda' },
    { label: 'Tienda Estafeta', href: '/admin/estafeta', desc: 'Cotizaciones y guías Estafeta' },
    { label: 'Correo', href: '/admin/correo', desc: 'Bandeja y envío de correos' },
    { label: 'Banners y avisos', href: '/admin/banners', desc: 'Contenido destacado' },
    { label: 'Mensajes flotantes', href: '/admin/mensajes-flotantes', desc: 'Popups por sección' },
    { label: 'Configuración', href: '/admin/settings', desc: 'Comisión, envíos, negocio' },
    { label: 'Anuncios en Lives', href: '/admin/ad-campaigns', desc: '📺 Campañas de publicidad en transmisiones' },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  // Toggle de filtros
  const toggleUrgency = (u: FilterUrgency) => {
    setFilters(prev => ({
      ...prev,
      urgency: prev.urgency.includes(u)
        ? prev.urgency.filter(x => x !== u)
        : [...prev.urgency, u]
    }));
  };

  const toggleCategory = (c: FilterCategory) => {
    setFilters(prev => ({
      ...prev,
      category: prev.category.includes(c)
        ? prev.category.filter(x => x !== c)
        : [...prev.category, c]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header moderno con control de vista */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 shadow-xl">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/20 backdrop-blur-sm p-3">
                <span className="text-3xl">
                  {viewMode === 'smart' ? '🧠' : '📊'}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {viewMode === 'smart' ? 'Panel Inteligente' : 'Panel General'}
                </h1>
                <p className="mt-1 text-sm text-white/90">
                  {viewMode === 'smart'
                    ? 'Visualizando alertas prioritarias y operaciones pendientes.'
                    : 'Visión completa de todas las métricas del sistema.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'smart' ? 'full' : 'smart')}
                className="rounded-xl bg-white/20 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/30 transition flex items-center gap-2"
              >
                {viewMode === 'smart' ? '👁️ Ver Todo' : '⚡ Modo Focus'}
              </button>
              <button
                type="button"
                onClick={() => { refreshAll(); setLastUpdate(new Date()); }}
                className="rounded-xl bg-white/20 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/30 transition"
                title={`Actualizado: ${lastUpdate.toLocaleTimeString()}`}
              >
                🔄
              </button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent"></div>
      </div>

      {/* Contenido principal */}
      <div className="min-h-[600px]">
        {/* Unified Integration Widget */}
        <UnifiedDashboardWidget />

        {error ? (
          <div className="mb-6 rounded-xl border-l-4 border-red-500 bg-red-50/80 backdrop-blur-sm px-5 py-4 shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <div className="font-bold text-red-900">Error</div>
                <div className="mt-1 text-sm text-red-800">{error}</div>
              </div>
            </div>
          </div>
        ) : null}

        {isBooting ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
              <p className="mt-4 text-sm font-semibold text-gray-600">Cargando sistema...</p>
            </div>
          </div>
        ) : viewMode === 'smart' ? (
          // === VISTA INTELIGENTE ===
          <div className="space-y-6">
            {/* Barra de Filtros */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 border-r border-gray-100 pr-4">
                  <span className="text-xs font-bold text-gray-400 uppercase">Prioridad</span>
                  <button
                    onClick={() => toggleUrgency('critical')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${filters.urgency.includes('critical') ? 'bg-red-100 text-red-700 ring-2 ring-red-500/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    Crítica
                  </button>
                  <button
                    onClick={() => toggleUrgency('high')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${filters.urgency.includes('high') ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-500/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    Alta
                  </button>
                  <button
                    onClick={() => toggleUrgency('medium')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${filters.urgency.includes('medium') ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    Media
                  </button>
                </div>

                <div className="flex items-center gap-2 border-r border-gray-100 pr-4">
                  <span className="text-xs font-bold text-gray-400 uppercase">Tiempo</span>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as TimeRange }))}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1.5"
                  >
                    <option value="all">Todo el tiempo</option>
                    <option value="24h">Últimas 24h</option>
                    <option value="48h">Últimas 48h</option>
                    <option value="7d">Últimos 7 días</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Buscar alertas..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-400">
                  {filteredAlerts.length} resultados
                </div>
              </div>

              {/* Filtros de Categoría */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
                <span className="text-xs font-bold text-gray-400 uppercase mr-2">Categoría:</span>
                <button
                  onClick={() => toggleCategory('payment')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filters.category.includes('payment') ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/30' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  💰 Pagos
                </button>
                <button
                  onClick={() => toggleCategory('logistics')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filters.category.includes('logistics') ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500/30' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  🚚 Logística
                </button>
                <button
                  onClick={() => toggleCategory('dispute')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filters.category.includes('dispute') ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-500/30' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  ⚖️ Disputas
                </button>
                <button
                  onClick={() => toggleCategory('system')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filters.category.includes('system') ? 'bg-gray-200 text-gray-800 ring-1 ring-gray-500/30' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  ⚙️ Sistema
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Columna Principal: Alertas */}
              <div className="xl:col-span-2 space-y-6">

                {/* Alertas Críticas */}
                {alertsByUrgency.critical.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 rounded-2xl border border-red-100 overflow-hidden shadow-sm"
                  >
                    <div className="bg-red-100/50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                      <h3 className="font-bold text-red-900 flex items-center gap-2">
                        <span className="animate-pulse">🚨</span> Atención Inmediata
                      </h3>
                      <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full font-bold">
                        {alertsByUrgency.critical.length}
                      </span>
                    </div>
                    <div className="divide-y divide-red-100/50">
                      {alertsByUrgency.critical.map(alert => (
                        <div key={alert.id} className="p-4 hover:bg-white/50 transition-colors group">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="font-bold text-gray-900 group-hover:text-red-700 transition-colors">
                                {alert.title}
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                <span>Hace {Math.round((Date.now() - new Date(alert.createdAt).getTime()) / (1000 * 60 * 60))}h</span>
                                <span>•</span>
                                <span className="uppercase font-medium">{alert.category}</span>
                              </div>
                            </div>
                            <Link
                              href={alert.actionUrl}
                              className="shrink-0 bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm"
                            >
                              {alert.actionLabel || 'Resolver'}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Alertas Alta Prioridad */}
                {alertsByUrgency.high.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm"
                  >
                    <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center justify-between">
                      <h3 className="font-bold text-orange-900 flex items-center gap-2">
                        <span>⚡</span> Prioridad Alta
                      </h3>
                      <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">
                        {alertsByUrgency.high.length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {alertsByUrgency.high.map(alert => (
                        <div key={alert.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-center gap-4">
                            <div>
                              <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                              <p className="text-sm text-gray-500 mt-0.5">{alert.description}</p>
                            </div>
                            <Link
                              href={alert.actionUrl}
                              className="text-orange-600 hover:text-orange-800 font-medium text-sm whitespace-nowrap"
                            >
                              Ver detalles →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Otras Alertas (Media/Baja) */}
                {(alertsByUrgency.medium.length > 0 || alertsByUrgency.low.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                  >
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-700">Pendientes Generales</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {[...alertsByUrgency.medium, ...alertsByUrgency.low].map(alert => (
                        <div key={alert.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                          <div>
                            <h4 className="font-medium text-gray-800 text-sm">{alert.title}</h4>
                            <span className="text-xs text-gray-400 mt-1 block">{alert.description}</span>
                          </div>
                          <Link href={alert.actionUrl} className="text-gray-400 hover:text-indigo-600">
                            →
                          </Link>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {filteredAlerts.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="text-4xl mb-3">✨</div>
                    <h3 className="text-lg font-bold text-gray-800">Todo al día</h3>
                    <p className="text-gray-500 text-sm">No hay alertas pendientes con los filtros actuales.</p>
                  </div>
                )}
              </div>

              {/* Columna Lateral: KPIs y Actividad */}
              <div className="space-y-6">
                {/* KPIs Críticos */}
                <div className="grid grid-cols-2 gap-3">
                  {smartKPIs.map(k => (
                    <Link
                      key={k.label}
                      href={k.href}
                      className={`p-3 rounded-xl border transition-all hover:scale-105 ${k.critical
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200'
                        }`}
                    >
                      <div className="text-2xl font-bold">{k.value}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{k.label}</div>
                    </Link>
                  ))}
                </div>

                {/* Feed de Actividad */}
                <ActivityFeed />
              </div>
            </div>
          </div>
        ) : (
          // === VISTA COMPLETA (Original) ===
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
              <div className="xl:col-span-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Indicadores Rápidos</h2>
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4"
                >
                  {kpis.map((k) => {
                    const isHighlighted = (k as any).highlight;
                    return (
                      <motion.div key={k.label} variants={item}>
                        <Link
                          href={k.href}
                          className={`group relative overflow-hidden block h-full rounded-xl border-2 p-5 shadow-lg transition-all hover:scale-105 hover:shadow-xl ${isHighlighted
                            ? 'border-purple-500 bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 ring-2 ring-purple-500/30'
                            : k.alert
                              ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 ring-2 ring-amber-400/30'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                        >
                          <div className={`text-3xl font-extrabold mb-2 ${isHighlighted
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'
                            : 'text-gray-900'
                            }`}>
                            {String(k.value)}
                          </div>
                          <div className={`text-xs font-bold ${isHighlighted ? 'text-gray-800' : k.alert ? 'text-amber-900' : 'text-gray-700'}`}>
                            {k.label}
                          </div>
                          <div className={`mt-2 text-[10px] font-semibold ${isHighlighted
                            ? 'text-purple-600'
                            : k.alert
                              ? 'text-amber-600'
                              : 'text-gray-400'
                            }`}>
                            {isHighlighted ? '⚡ Acción requerida →' : 'Ver →'}
                          </div>
                          {isHighlighted && (
                            <div className="absolute top-2 right-2">
                              <span className="inline-flex items-center rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                ⚠️
                              </span>
                            </div>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>

              <div className="xl:col-span-1">
                <ActivityFeed />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Navegación Rápida</h2>
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {quickLinks.map((q) => (
                  <motion.div key={q.href} variants={item}>
                    <Link
                      href={q.href}
                      className={`group relative overflow-hidden flex h-full items-start gap-4 rounded-xl border-2 p-5 shadow-md transition-all hover:scale-[1.02] hover:shadow-xl ${q.badge && q.badge > 0
                        ? 'border-purple-400 bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 ring-2 ring-purple-400/30 hover:ring-purple-500/40'
                        : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-gradient-to-br hover:from-purple-50/50 hover:to-pink-50/50'
                        }`}
                    >
                      <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 p-2.5 shadow-md group-hover:scale-110 transition-transform">
                        <span className="text-xl">📋</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`font-bold text-sm ${q.badge && q.badge > 0 ? 'text-purple-700' : 'text-gray-900'}`}>
                            {q.label}
                          </div>
                          {q.badge && q.badge > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-md">
                              {q.badge}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-600 leading-relaxed">{q.desc}</div>
                      </div>
                      <span className={`text-xl font-bold transition-transform group-hover:translate-x-1 ${q.badge && q.badge > 0 ? 'text-purple-600' : 'text-gray-400'
                        }`}>→</span>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
