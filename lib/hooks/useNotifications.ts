// Hook reutilizable para manejo de notificaciones

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Notification } from '@/lib/types/domain.types';

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(limit: number = 100, unreadOnly: boolean = false): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const url = `/api/notifications/list-v2?limit=${limit}${unreadOnly ? '&unread_only=true' : ''}&t=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Error al cargar notificaciones');
      }

      setNotifications(json.notifications || []);
      setUnreadCount(json.unreadCount || 0);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [limit, unreadOnly]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const res = await fetch('/api/notifications/mark-read-v2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Error al marcar como leída');
      }

      // Actualizar estado local
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('[useNotifications] Error marcando como leída:', e);
      throw e;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const res = await fetch('/api/notifications/mark-read-v2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAll: true }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Error al marcar todas como leídas');
      }

      // Actualizar estado local
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('[useNotifications] Error marcando todas como leídas:', e);
      throw e;
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh: loadNotifications,
    markAsRead,
    markAllAsRead,
  };
}
