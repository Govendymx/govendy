'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { getNotificationLink } from '@/lib/notifications/getNotificationLink';

export type NotificationRow = {
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

function kind(row: NotificationRow) {
  return String((row?.data as any)?.kind ?? row?.type ?? row?.kind ?? '').trim().toLowerCase();
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

type Props = {
  /** Ocultar en ciertas rutas (ej. /admin) */
  hide?: boolean;
  /** Si el padre ya tiene userId (ej. AccountTopMenu), pasarlo para mostrar la campanita de inmediato */
  userId?: string | null;
};

export function NotificationCenter({ hide = false, userId: userIdProp }: Props) {
  const [open, setOpen] = useState(false);
  const [userIdLocal, setUserIdLocal] = useState<string | null>(null);
  const userId = userIdProp ?? userIdLocal;
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (uid: string) => {
    try {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setRows([]);
        setUnreadCount(0);
        return;
      }
      const res = await fetch(`/api/notifications/list?limit=30&_t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRows([]);
        setUnreadCount(0);
        return;
      }
      const list = (json?.rows ?? []) as NotificationRow[];
      // Solo contar explícitamente false como no leído — null/undefined = ya leído
      const unreadInList = list.filter((r) => r.is_read === false);
      const apiCount = Number(json?.unread_count ?? 0);
      setRows(list);
      setUnreadCount(Math.max(unreadInList.length, apiCount));
    } catch {
      setRows([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userIdProp) {
      setLoading(true);
      void load(userIdProp);
      return;
    }
    const boot = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id ?? null;
        setUserIdLocal(uid ?? null);
        if (uid) {
          void load(uid);
        } else {
          setRows([]);
          setUnreadCount(0);
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };
    void boot();
  }, [load, userIdProp]);

  // Realtime subscription with error handling and logging
  useEffect(() => {
    if (!userId) return;

    // Log for debugging
    // console.log(`[NotificationCenter] Subscribing to notifications for user ${userId}`);

    const ch = supabase
      .channel(`notification-center-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Pequeño delay para dar tiempo a que la BD replique o procese cambios
          setTimeout(() => void load(userId), 1000);
        }
      )
      .subscribe();

    // Polling fallback every 15s
    const t = setInterval(() => void load(userId), 15000);

    return () => {
      // console.log('[NotificationCenter] Cleaning up subscription');
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [userId, load]);

  useEffect(() => {
    if (!userId) return;
    const onUpdated = (e: Event) => {
      const d = (e as CustomEvent)?.detail;
      if (d?.source === 'notification-center') return;
      void load(userId);
    };
    window.addEventListener('notifications-updated', onUpdated);
    return () => window.removeEventListener('notifications-updated', onUpdated);
  }, [userId, load]);

  useEffect(() => {
    const onBlur = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onBlur);
    return () => window.removeEventListener('mousedown', onBlur);
  }, []);

  const markRead = useCallback(async (ids: string[]): Promise<boolean> => {
    if (!ids.length) return false;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return false;
    const res = await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return false;

    // Update local state: mark as read but keep in list (unless we want to remove them)
    // User requested "borrar", so we will implement a delete function separately, 
    // but for mark read we just update visual state.
    setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, is_read: true } : r));
    setUnreadCount((c) => Math.max(0, c - ids.length));
    window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { markedRead: true, ids, source: 'notification-center' } }));
    return true;
  }, []);

  // New function to DELETE notifications
  const deleteNotification = useCallback(async (id: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;

    // Optimistic update
    setRows((prev) => prev.filter((r) => r.id !== id));
    setUnreadCount((c) => {
      // If it was unread, decrease count
      const wasUnread = rows.find(r => r.id === id)?.is_read === false;
      return wasUnread ? Math.max(0, c - 1) : c;
    });

    try {
      const res = await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error('Failed to delete');
    } catch (e) {
      // console.error('Error deleting notification:', e);
      // Revert if needed, but for now we just log
      // Ideally we would reload from server
      if (userId) void load(userId);
    }
  }, [userId, load, rows]);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return false;
    // Delete all notifications so the list clears visually
    const allIds = rows.map(r => r.id).filter(Boolean);
    if (allIds.length === 0) return false;
    // Optimistic update: clear the list immediately
    setRows([]);
    setUnreadCount(0);
    window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { markedRead: true, all: true, source: 'notification-center' } }));
    try {
      const res = await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: allIds }),
      });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      // If delete fails, reload from server
      if (userId) void load(userId);
    }
    return true;
  }, [userId, load, rows]);

  if (hide) return null;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-500 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 hover:text-brand-orange transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            {rows.length > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-brand-orange hover:text-pink-700">
                Marcar leídas
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-orange" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 text-2xl">🔕</div>
                <p className="text-sm text-gray-500">Sin notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const k = kind(row);
                  const ic = icon(k);
                  const st = styleByType(k);
                  const link = getNotificationLink(row) || '#';
                  const hasLink = link && link !== '#';

                  return (
                    <div
                      key={row.id}
                      className={`group relative flex gap-3 p-4 transition-colors ${row.is_read ? 'bg-white hover:bg-gray-50' : 'bg-orange-50/40 hover:bg-orange-50/60'}`}
                    >
                      {/* Icon with unread dot */}
                      <div className="relative shrink-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg shadow-sm ${st}`}>
                          {ic}
                        </div>
                        {!row.is_read && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-orange ring-2 ring-white" />
                        )}
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <Link
                          href={link}
                          onClick={() => {
                            if (!row.is_read) markRead([row.id]);
                            setOpen(false);
                          }}
                          className="block"
                        >
                          <p className={`text-sm ${row.is_read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                            {row.title || 'Nueva notificación'}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {row.body || 'Tienes una nueva actualización'}
                          </p>
                          <p className="mt-1.5 text-[10px] font-medium text-gray-400">
                            {formatTime(row.created_at)}
                          </p>
                          {hasLink && (
                            <p className="mt-0.5 text-[10px] font-medium text-brand-orange/80 break-all">
                              {link}
                            </p>
                          )}
                        </Link>
                      </div>

                      {/* Delete Button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(row.id);
                        }}
                        className="absolute right-2 top-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"
                        title="Eliminar notificación"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50 p-2 text-center">
            <Link href="/dashboard/notificaciones" onClick={() => setOpen(false)} className="text-xs font-medium text-gray-500 hover:text-gray-900">
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
