'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

const CHANNEL = 'admin-logistica';
const BROADCAST_EVENT = 'order_updated';

/**
 * Escucha cambios de órdenes (mismo canal que admin/logística) para refrescar paneles de vendedor.
 */
export function useOrderUpdatesRealtime(onUpdate: () => void, pollMs = 45000) {
  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (!cancelled) onUpdate();
      }, 400);
    };

    const ch = supabase
      .channel(CHANNEL)
      .on('broadcast', { event: BROADCAST_EVENT }, () => schedule())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => schedule())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => schedule())
      .subscribe();

    const poll = pollMs > 0 ? setInterval(() => {
      if (!cancelled) onUpdate();
    }, pollMs) : null;

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (poll) clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [onUpdate, pollMs]);
}
