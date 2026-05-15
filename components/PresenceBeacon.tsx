'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

function isAbortAuthError(err: unknown) {
  const anyErr = err as any;
  const name = String(anyErr?.name || '');
  const msg = String(anyErr?.message || '');
  return name === 'AbortError' || msg.toLowerCase().includes('aborted');
}

type PresenceRole = 'user' | 'admin' | 'unknown';

export function PresenceBeacon({ role = 'unknown' }: { role?: PresenceRole }) {
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const heartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setUserId(data.user?.id ?? null);
      } catch (e) {
        if (isAbortAuthError(e)) return;
        // si falla auth, simplemente no hacemos presencia
        setUserId(null);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;

    const ch = supabase.channel('presence:global', {
      config: { presence: { key: userId } },
    });
    channelRef.current = ch;

    const track = async () => {
      try {
        await ch.track({ user_id: userId, role, at: new Date().toISOString() });
      } catch {
        // noop
      }
    };

    const registerActivity = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        
        // 1. Heartbeat de actividad
        await fetch('/api/activity/heartbeat', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
        });

        // 2. Registrar IP (seguridad)
        // No necesitamos esperar esto
        fetch('/api/security/record-ip', { 
          method: 'POST',
          headers: { authorization: `Bearer ${token}` }
        }).catch(() => {});
        
      } catch {
        // noop - no es crítico si falla
      }
    };

    ch.subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        void track();
        void registerActivity();
      }
    });

    // heartbeat para mantener la presencia “viva” en conexiones raras
    heartbeatRef.current = window.setInterval(() => {
      if (disposed) return;
      void track();
      void registerActivity();
    }, 25000);

    return () => {
      disposed = true;
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      try {
        void supabase.removeChannel(ch);
      } catch {
        // noop
      }
      channelRef.current = null;
    };
  }, [role, userId]);

  return null;
}

