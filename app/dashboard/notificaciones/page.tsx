'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getNotificationLink } from '@/lib/notifications/getNotificationLink';

/** Compatible con /api/notifications/list: usar siempre body, type, link_to. */
type Row = {
  id: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  kind?: string | null;
  link_to?: string | null;
  data?: Record<string, unknown> | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

function formatTime(input: string | null | undefined) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function kind(r: Row) {
  return String((r?.data as any)?.kind ?? r?.type ?? r?.kind ?? '').trim().toLowerCase();
}

function icon(k: string) {
  if (['new_sale', 'sale_paid'].includes(k)) return '💰';
  if (['payment_approved', 'order_completed'].includes(k)) return '✅';
  if (k === 'payment_rejected') return '⚠️';
  if (['order_shipped', 'order_message', 'order_status'].includes(k)) return '📦';
  if (['listing_question', 'listing_answer'].includes(k)) return '💬';
  if (['support_message', 'support_reply', 'support_new_message'].includes(k)) return '🆘';
  if (['auction_won', 'auction_ended', 'outbid', 'bid_received', 'bid_placed'].includes(k)) return '🔨';
  return '🔔';
}

function styleByType(k: string) {
  if (['new_sale', 'sale_paid'].includes(k)) return 'bg-green-50 border-green-200 hover:bg-green-100 text-green-900';
  if (['payment_approved', 'order_completed'].includes(k)) return 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-900';
  if (k === 'payment_rejected') return 'bg-red-50 border-red-200 hover:bg-red-100 text-red-900';
  if (['order_shipped', 'order_message', 'order_status'].includes(k)) return 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-900';
  if (['listing_question', 'listing_answer'].includes(k)) return 'bg-pink-50 border-pink-200 hover:bg-pink-100 text-pink-900';
  if (['auction_won', 'auction_ended', 'outbid', 'bid_received', 'bid_placed'].includes(k)) return 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-900';
  return 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-900';
}

export default function NotificacionesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setRows([]);
        return;
      }
      const res = await fetch(`/api/notifications/list?limit=200&_t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ((json as any)?.table_missing) {
          setError('No existe la tabla notifications. Ejecuta supabase_notifications.sql en Supabase.');
        } else {
          setError((json as any)?.error || 'No se pudieron cargar las notificaciones.');
        }
        setRows([]);
        return;
      }
      const list = ((json as any)?.rows ?? []) as Row[];
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const d = (e as CustomEvent)?.detail;
      if (d?.source === 'notification-center') return;
      void load();
    };
    window.addEventListener('notifications-updated', onUpdated);
    return () => window.removeEventListener('notifications-updated', onUpdated);
  }, [load]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const res = await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, is_read: true } : r)));
    window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { markedRead: true, ids, source: 'notificaciones-page' } }));
  }, []);

  const markAllRead = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    setMarking(true);
    try {
      const res = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) return;
      setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
      window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { markedRead: true, all: true, source: 'notificaciones-page' } }));
    } finally {
      setMarking(false);
    }
  }, []);

  const unreadCount = rows.filter((r) => r.is_read === false).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Notificaciones</div>
              <div className="text-xs text-gray-500">{unreadCount > 0 ? `${unreadCount} sin leer` : 'Al día'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="mx-auto max-w-4xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Tu bandeja</h1>
              <p className="mt-1 text-sm text-gray-600">Pagos, mensajes, preguntas, subastas y avisos.</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={marking}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
              >
                {marking ? 'Marcando…' : '✓ Marcar todo leído'}
              </button>
            )}
            {rows.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('¿Eliminar todas las notificaciones? Esta acción no se puede deshacer.')) return;
                  const { data: sess } = await supabase.auth.getSession();
                  const token = sess.session?.access_token;
                  if (!token) return;
                  setDeleting(true);
                  try {
                    const res = await fetch('/api/notifications/delete', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                      body: JSON.stringify({ all: true }),
                    });
                    if (!res.ok) return;
                    setRows([]);
                    window.dispatchEvent(
                      new CustomEvent('notifications-updated', { detail: { deleted: true, all: true, source: 'notificaciones-page' } }),
                    );
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? 'Eliminando…' : '🗑 Borrar todas'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="mt-6 text-center text-sm text-gray-500">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="mt-6 text-center text-sm text-gray-600">Aún no tienes notificaciones.</div>
          ) : (
            <div className="mt-6 space-y-2">
              {rows.map((n) => {
                const k = kind(n);
                const unread = n.is_read === false;
                const link = getNotificationLink(n);
                return (
                  <div
                    key={n.id}
                    className={`flex w-full items-start gap-3 rounded-xl px-4 py-3 ${styleByType(k)} ${unread ? 'border-l-4 border-l-brand-orange' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={async () => {
                        if (unread) await markRead([n.id]);
                        if (link) window.location.href = link;
                      }}
                      className="flex flex-1 items-start gap-3 text-left transition-colors"
                    >
                      <span className="shrink-0 text-xl">{icon(k)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{n.title || 'Notificación'}</span>
                          {unread && (
                            <span className="shrink-0 rounded-full bg-brand-orange/20 px-2 py-0.5 text-[10px] font-bold text-brand-orange">Nuevo</span>
                          )}
                        </div>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs opacity-90">{n.body}</p>}
                        <p className="mt-1 text-[11px] opacity-70">{formatTime(n.created_at)}</p>
                      </div>
                      {link && <span className="shrink-0 text-xs font-semibold text-brand-orange">→</span>}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const { data: sess } = await supabase.auth.getSession();
                        const token = sess.session?.access_token;
                        if (!token) return;
                        const res = await fetch('/api/notifications/delete', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                          body: JSON.stringify({ ids: [n.id] }),
                        });
                        if (!res.ok) return;
                        setRows((prev) => prev.filter((r) => r.id !== n.id));
                        window.dispatchEvent(
                          new CustomEvent('notifications-updated', {
                            detail: { deleted: true, deletedIds: [n.id], source: 'notificaciones-page' },
                          }),
                        );
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                    >
                      Borrar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
