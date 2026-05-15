'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type HealthData = {
  payments: {
    status: 'healthy' | 'warning' | 'critical';
    last24h: number;
    success: number;
    errors: number;
    errorRate: string;
  };
  notifications: {
    status: string;
    sent: number;
  };
  users: {
    active: number;
    suspended: number;
    banned: number;
  };
  orders: {
    pending: number;
    paid: number;
    shipped: number;
  };
  recentErrors: Array<{
    id: string;
    error: string;
    stage: string;
    created_at: string;
  }>;
  timestamp: string;
};

export default function AdminSaludPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [errorSearch, setErrorSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setError(null);
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          window.location.href = '/login?returnTo=/admin/salud';
          return;
        }

        const res = await fetch('/api/admin/health', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const json = (await res.json().catch(() => ({}))) as { health?: HealthData; error?: string };
        if (!res.ok) throw new Error(json?.error || 'No se pudo cargar la salud del sistema.');

        if (!cancelled && json.health) {
          setHealth(json.health);
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la salud del sistema.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    // Actualizar cada 30 segundos
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '🚨';
      default:
        return '❓';
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-emerald border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="text-center text-gray-500">No hay datos disponibles</div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Salud del Sistema</h1>
          <p className="mt-1 text-sm text-gray-600">Monitoreo en tiempo real del estado de la plataforma</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pagos */}
        <div className={`rounded-2xl border p-6 ${getStatusColor(health.payments.status)}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium opacity-75">Pagos (24h)</div>
              <div className="mt-1 text-2xl font-bold">{health.payments.last24h}</div>
              <div className="mt-2 text-xs">
                {health.payments.success} exitosos, {health.payments.errors} errores
              </div>
              <div className="mt-1 text-xs font-semibold">Tasa de error: {health.payments.errorRate}</div>
            </div>
            <div className="text-3xl">{getStatusIcon(health.payments.status)}</div>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Notificaciones (24h)</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{health.notifications.sent}</div>
            </div>
            <div className="text-3xl">📧</div>
          </div>
        </div>

        {/* Usuarios */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Usuarios</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{health.users.active}</div>
              <div className="mt-2 text-xs text-gray-600">
                {health.users.suspended} suspendidos, {health.users.banned} baneados
              </div>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>

        {/* Órdenes */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Órdenes</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{health.orders.pending + health.orders.paid}</div>
              <div className="mt-2 text-xs text-gray-600">
                {health.orders.pending} pendientes, {health.orders.shipped} enviadas
              </div>
            </div>
            <div className="text-3xl">📦</div>
          </div>
        </div>
      </div>

      {/* Errores Recientes */}
      {health.recentErrors && health.recentErrors.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900">Errores Recientes</h2>
            <input
              type="text"
              value={errorSearch}
              onChange={(e) => setErrorSearch(e.target.value)}
              placeholder="Buscar error (ID, mensaje, etapa)..."
              className="w-full max-w-xs rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
            />
          </div>
          <div className="mt-4 space-y-2">
            {health.recentErrors
              .filter((err) => {
                if (!errorSearch.trim()) return true;
                const q = errorSearch.toLowerCase();
                return (
                  (err.id || '').toLowerCase().includes(q) ||
                  (err.error || '').toLowerCase().includes(q) ||
                  (err.stage || '').toLowerCase().includes(q)
                );
              })
              .map((err) => (
              <div key={err.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-red-900">{err.stage}</div>
                      <span className="text-[10px] text-red-400 font-mono">{err.id.slice(0, 8)}...</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(err.id, err.id)}
                        className="text-red-400 hover:text-red-700 focus:outline-none"
                        title="Copiar ID de error"
                      >
                        {copiedId === err.id ? '✅' : '📋'}
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-red-700 flex items-start gap-1">
                      <span className="break-all">{err.error}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(err.error, `msg-${err.id}`)}
                        className="shrink-0 text-red-400 hover:text-red-700 focus:outline-none"
                        title="Copiar mensaje de error"
                      >
                        {copiedId === `msg-${err.id}` ? '✅' : '📋'}
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-red-600">
                      {new Date(err.created_at).toLocaleString('es-MX')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        Última actualización: {new Date(health.timestamp).toLocaleString('es-MX')}
      </div>
    </div>
  );
}
