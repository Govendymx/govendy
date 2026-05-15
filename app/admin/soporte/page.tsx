'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ScrollArea } from '@/components/ScrollArea';

type Conv = {
  id: string;
  // ... existing types remain same, just updating the component structure
  created_by: string;
  subject: string;
  status: 'open' | 'closed' | string;
  last_message_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  assigned_admin_id?: string | null;
  assigned_at?: string | null;
  last_read_by_admin_at?: string | null;
  last_read_by_user_at?: string | null;
  last_delivered_to_user_at?: string | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin' | string;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  created_at: string;
};

function safeTs(input: string | null | undefined) {
  if (!input) return 0;
  const d = new Date(input);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function presenceDot(online: boolean) {
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${online ? 'bg-green-500' : 'bg-red-500'
        }`}
      title={online ? 'En línea' : 'No en línea'}
    />
  );
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatListTime(input: string | null | undefined) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-MX', { month: 'short', day: '2-digit' });
}

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (a + b).toUpperCase();
}

export default function AdminSoportePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando soporte...</div>}>
      <AdminSoporteContent />
    </Suspense>
  );
}

function AdminSoporteContent() {
  const searchParams = useSearchParams();
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rows, setRows] = useState<Conv[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [planById, setPlanById] = useState<Record<string, string>>({});
  const [lastByConv, setLastByConv] = useState<Record<string, { body: string; sender_role: string; created_at: string }>>({});
  const [needsReplyById, setNeedsReplyById] = useState<Record<string, boolean>>({});
  const [unreadCountById, setUnreadCountById] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>((searchParams.get('status') as any) || 'open');

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && ['all', 'open', 'closed'].includes(s)) {
      setStatusFilter(s as any);
    }
  }, [searchParams]);

  const [tab, setTab] = useState<'all' | 'unassigned' | 'mine'>('all');
  const [myAdminId, setMyAdminId] = useState<string | null>(null);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Record<string, boolean>>({});

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState('');
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string>('');
  const [isUploadingAttach, setIsUploadingAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastAdminReadMarkRef = useRef<number>(0);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState('');
  const [deleteOrderLoading, setDeleteOrderLoading] = useState(false);
  const [deleteOrderResult, setDeleteOrderResult] = useState<string | null>(null);
  const [showDeleteOrderPanel, setShowDeleteOrderPanel] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((c) => {
      const st = String(c.status || '').toLowerCase();
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (tab === 'unassigned' && c.assigned_admin_id) return false;
      if (tab === 'mine' && (!myAdminId || c.assigned_admin_id !== myAdminId)) return false;
      if (!qq) return true;
      const subj = String(c.subject || '').toLowerCase();
      const uid = String(c.created_by || '').toLowerCase();
      const nm = String(nameById[c.created_by] || '').toLowerCase();
      return subj.includes(qq) || uid.includes(qq) || nm.includes(qq);
    });
  }, [rows, q, statusFilter, nameById, tab, myAdminId]);

  const load = async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/admin/soporte')}`;
        return;
      }
      const res = await fetch(`/api/admin/support/conversations?limit=200&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).catch((fetchError) => {
        // Capturar errores de red
        console.error('Error de red al cargar conversaciones:', fetchError);
        throw new Error(`Error de conexión: ${fetchError.message || 'No se pudo conectar con el servidor. Verifica que el servidor esté corriendo.'}`);
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Error ${res.status}: No se pudieron cargar conversaciones.`);
      setRows((json?.conversations ?? []) as Conv[]);
      setNameById((json?.nameById ?? {}) as any);
      setPlanById((json?.planById ?? {}) as any);
      setLastByConv((json?.lastByConv ?? {}) as any);
      setNeedsReplyById((json?.needsReplyById ?? {}) as any);
      setUnreadCountById((json?.unreadCountById ?? {}) as any);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setNameById({});
      setPlanById({});
      setLastByConv({});
      setNeedsReplyById({});
      setUnreadCountById({});
      setError(e instanceof Error ? e.message : 'No se pudieron cargar conversaciones.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChat = async (conversationId: string, opts?: { silent?: boolean; skipMarkRead?: boolean }) => {
    setError(null);
    setSuccess(null);
    if (!opts?.silent) setIsLoadingChat(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const res = await fetch(`/api/admin/support/messages?conversationId=${encodeURIComponent(conversationId)}&limit=300&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).catch((fetchError) => {
        // Capturar errores de red
        console.error('Error de red al cargar mensajes:', fetchError);
        throw new Error(`Error de conexión: ${fetchError.message || 'No se pudo conectar con el servidor.'}`);
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = json?.error || `Error ${res.status}: No se pudo cargar el chat.`;
        console.error('Error al cargar mensajes:', errorMsg, json);
        throw new Error(errorMsg);
      }

      // Asegurar que los mensajes tengan la estructura correcta
      const messagesData = Array.isArray(json?.messages) ? json.messages : [];
      const normalizedMessages = messagesData.map((msg: any) => ({
        id: String(msg?.id || ''),
        conversation_id: String(msg?.conversation_id || conversationId),
        sender_id: String(msg?.sender_id || ''),
        sender_role: String(msg?.sender_role || 'user'),
        body: String(msg?.body || ''),
        attachment_url: msg?.attachment_url || null,
        attachment_name: msg?.attachment_name || null,
        attachment_mime: msg?.attachment_mime || null,
        attachment_size: msg?.attachment_size || null,
        created_at: String(msg?.created_at || new Date().toISOString()),
      }));

      setActiveConv(json?.conversation ?? null);
      setMessages(normalizedMessages);

      if (!opts?.skipMarkRead) {
        // Marcar como leído SOLO si hay mensajes del usuario más nuevos que last_read_by_admin_at
        const conv = (json?.conversation ?? null) as Conv | null;
        const msgs = ((json?.messages ?? []) as Msg[]) ?? [];
        const lastUserMsgAt = Math.max(
          0,
          ...msgs
            .filter((m) => String(m?.sender_role || '').toLowerCase() === 'user')
            .map((m) => safeTs(m?.created_at)),
        );
        const lastReadAt = safeTs(conv?.last_read_by_admin_at);
        const shouldMark = Boolean(lastUserMsgAt && lastUserMsgAt > lastReadAt);
        const now = Date.now();
        const throttled = now - lastAdminReadMarkRef.current < 2000;

        if (shouldMark && !throttled) {
          lastAdminReadMarkRef.current = now;
          void fetch('/api/admin/support/read', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            cache: 'no-store',
            body: JSON.stringify({ conversationId }),
          }).catch(() => null);
        }
      }
    } catch (e: unknown) {
      console.error(e);
      setActiveConv(null);
      setMessages([]);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el chat.');
    } finally {
      if (!opts?.silent) setIsLoadingChat(false);
    }
  };

  const send = async () => {
    if (!activeId) return;
    setError(null);
    setSuccess(null);
    setIsSending(true);
    try {
      const msg = reply.trim();
      if (!msg && !attachFile) return;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      let attachmentUrl = '';
      let attachmentName = '';
      let attachmentMime = '';
      let attachmentSize = 0;

      if (attachFile) {
        setIsUploadingAttach(true);
        try {
          const fd = new FormData();
          fd.append('file', attachFile);
          fd.append('kind', 'support_attachment');
          const up = await fetch('/api/upload', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
          const upJson = await up.json().catch(() => ({}));
          if (!up.ok) throw new Error(upJson?.error || 'No se pudo subir el adjunto.');
          attachmentUrl = String(upJson?.url || '').trim();
          if (!attachmentUrl) throw new Error('No se pudo obtener la URL del adjunto.');
          attachmentName = String(attachFile.name || '').trim();
          attachmentMime = String(attachFile.type || '').trim();
          attachmentSize = Number((attachFile as any)?.size ?? 0) || 0;
        } finally {
          setIsUploadingAttach(false);
        }
      }

      const res = await fetch('/api/admin/support/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({
          conversationId: activeId,
          message: msg,
          attachmentUrl: attachmentUrl || undefined,
          attachmentName: attachmentName || undefined,
          attachmentMime: attachmentMime || undefined,
          attachmentSize: attachmentSize || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar la respuesta.');
      const saved = json?.message as Msg | undefined;
      if (saved?.id) setMessages((prev) => [...prev, saved]);
      setReply('');
      void broadcastTyping(false);
      setAttachFile(null);
      try {
        if (attachPreview) URL.revokeObjectURL(attachPreview);
      } catch {
        // noop
      }
      setAttachPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess('Respuesta enviada.');
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo enviar la respuesta.');
    } finally {
      setIsSending(false);
    }
  };

  const setStatus = async (action: 'open' | 'close') => {
    if (!activeId) return;
    setError(null);
    setSuccess(null);
    setIsUpdating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const res = await fetch('/api/admin/support/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ conversationId: activeId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar el estado.');
      setSuccess(action === 'close' ? 'Chat cerrado.' : 'Chat reabierto.');
      await loadChat(activeId);
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el estado.');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        const { data: u } = await supabase.auth.getUser();
        if (!cancelled) setMyAdminId(u.user?.id ?? null);
        await load();
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime (WhatsApp-like). Fallback: polling.
  useEffect(() => {
    let disposed = false;
    try {
      const ch = supabase
        .channel('admin-support-wa')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_messages' },
          (payload: any) => {
            if (disposed) return;
            const cid = String(payload?.new?.conversation_id || '').trim();
            void load();
            if (activeId && cid === activeId) void loadChat(activeId, { silent: true, skipMarkRead: true });
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'support_conversations' },
          () => {
            if (disposed) return;
            void load();
            // Importante: NO recargar chat aquí para evitar loops (read/updated_at).
          },
        )
        .subscribe((status) => {
          if (disposed) return;
          setRealtimeOk(status === 'SUBSCRIBED');
        });

      return () => {
        disposed = true;
        void supabase.removeChannel(ch);
      };
    } catch {
      setRealtimeOk(false);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Broadcast realtime (no depende de Realtime en tablas / RLS)
  useEffect(() => {
    let disposed = false;
    try {
      const ch = supabase
        .channel('support:events')
        .on('broadcast', { event: 'support_event' }, (payload: any) => {
          if (disposed) return;
          const cid = String(payload?.payload?.conversationId || payload?.conversationId || '').trim();
          if (!cid) return;
          const kind = String(payload?.payload?.kind || '').trim();
          const by = String(payload?.payload?.by || '').trim();
          if (activeId && cid === activeId && kind === 'typing' && by === 'user') {
            setIsUserTyping(Boolean(payload?.payload?.isTyping));
            if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
            typingTimerRef.current = window.setTimeout(() => setIsUserTyping(false), 2500);
          }
          void load();
          if (activeId && cid === activeId) void loadChat(activeId, { silent: true, skipMarkRead: true });
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') setRealtimeOk(true);
        });
      return () => {
        disposed = true;
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
        void supabase.removeChannel(ch);
      };
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const broadcastTyping = async (isTyping: boolean) => {
    if (!activeId) return;
    const now = Date.now();
    // throttle: no enviar más de 1 cada 700ms
    if (now - lastTypingSentAtRef.current < 700 && isTyping) return;
    lastTypingSentAtRef.current = now;
    try {
      const ch: any = supabase.channel('support:events');
      await ch.send({
        type: 'broadcast',
        event: 'support_event',
        payload: { conversationId: activeId, kind: 'typing', by: 'admin', isTyping, t: Date.now() },
      });
      try {
        supabase.removeChannel(ch);
      } catch {
        // noop
      }
    } catch {
      // noop
    }
  };

  // Presencia (online/offline) estilo WhatsApp Web
  useEffect(() => {
    if (!myAdminId) return;
    let disposed = false;
    try {
      const ch = supabase.channel('presence:global', { config: { presence: { key: myAdminId } } });

      const compute = () => {
        const state = ch.presenceState() as Record<string, any[]>;
        const next: Record<string, boolean> = {};
        for (const [key, arr] of Object.entries(state || {})) {
          const items = Array.isArray(arr) ? arr : [];
          // Si hay items de presencia, el usuario está en línea
          // Solo consideramos usuarios (no admins) para el indicador de estado
          if (items.length > 0) {
            const isUser = items.some((p) => String((p as any)?.role || '').toLowerCase() === 'user');
            // Si es un usuario (no admin), está en línea
            if (isUser) {
              next[String(key)] = true;
            }
          }
        }
        setOnlineUserIds(next);
      };

      ch.on('presence', { event: 'sync' }, () => {
        if (disposed) return;
        compute();
      })
        .on('presence', { event: 'join' }, () => {
          if (disposed) return;
          compute();
        })
        .on('presence', { event: 'leave' }, () => {
          if (disposed) return;
          compute();
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            void ch.track({ user_id: myAdminId, role: 'admin', at: new Date().toISOString() });
            compute();
          }
        });

      return () => {
        disposed = true;
        void supabase.removeChannel(ch);
      };
    } catch {
      return;
    }
  }, [myAdminId]);

  useEffect(() => {
    if (realtimeOk) return;
    const t = window.setInterval(() => {
      void load();
      if (activeId) void loadChat(activeId);
    }, 3500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, realtimeOk]);

  // Auto-scroll al final cuando llegan mensajes y el agente está en un chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [activeId, messages.length]);

  const takeOrRelease = async (action: 'take' | 'release') => {
    if (!activeId) return;
    setError(null);
    setSuccess(null);
    setIsUpdating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const res = await fetch('/api/admin/support/assign', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ conversationId: activeId, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo actualizar la asignación.');
      await loadChat(activeId);
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la asignación.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-gray-900">Admin · Soporte</div>
          <div className="mt-1 text-sm text-gray-600">Aquí verás todos los chats de soporte creados por los usuarios.</div>
          <div className="mt-1 text-[11px] text-gray-500">
            Estado: {realtimeOk ? 'Tiempo real' : 'Actualización automática'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/usuarios" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Usuarios
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
          >
            Actualizar
          </button>
        </div>
      </div>

      {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {success ? <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div> : null}

      <div className="mt-6 grid gap-4 h-[72vh] lg:h-[72vh] lg:grid-cols-[380px_1fr] min-h-0">
        <aside className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5 flex flex-col min-h-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tab === 'all' ? 'bg-pink-50 text-brand-emerald ring-pink-100' : 'bg-white text-gray-700 ring-black/10'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTab('unassigned')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tab === 'unassigned' ? 'bg-pink-50 text-brand-emerald ring-pink-100' : 'bg-white text-gray-700 ring-black/10'}`}
            >
              Sin asignar
            </button>
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tab === 'mine' ? 'bg-pink-50 text-brand-emerald ring-pink-100' : 'bg-white text-gray-700 ring-black/10'}`}
            >
              Mis chats
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por asunto o usuario…"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="open">Abiertos</option>
              <option value="closed">Cerrados</option>
              <option value="all">Todos</option>
            </select>
          </div>

          <div className="mt-4 text-xs font-semibold text-gray-600">{isLoading ? 'Cargando…' : `${filtered.length} chats`}</div>

          <ScrollArea className="mt-3 flex-1 min-h-0 rounded-2xl border border-black/5 bg-white" viewportClassName="divide-y divide-black/5">
            {isBooting ? (
              <div className="p-4 text-sm text-gray-600">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">
                No hay chats.
                <div className="mt-2 text-xs text-gray-500">Nota: si es la primera vez, ejecuta `supabase_support_chat.sql` en Supabase.</div>
              </div>
            ) : (
              filtered.map((c) => {
                const active = activeId === c.id;
                const name = nameById[c.created_by] || `${String(c.created_by || '').slice(0, 6)}…`;
                const userPlan = String(planById[c.created_by] || 'basic').toLowerCase();
                const planLabel = userPlan === 'platinum' ? '👑 Platinum' : userPlan === 'pro' ? '🔵 Pro' : '🟢 Básico';
                const planColor = userPlan === 'platinum' ? 'bg-amber-100 text-amber-800 ring-amber-200' : userPlan === 'pro' ? 'bg-blue-100 text-blue-800 ring-blue-200' : 'bg-gray-100 text-gray-600 ring-gray-200';
                const slaLabel = userPlan === 'pro' || userPlan === 'platinum' ? '⚡ 12-24h' : '24-48h';
                const st = String(c.status || '').toLowerCase();
                const last = lastByConv[c.id];
                const lastText = String(last?.body || '').trim();
                const preview = lastText.length > 80 ? `${lastText.slice(0, 80)}…` : lastText;
                const needs = Boolean(needsReplyById[c.id]);
                const unread = Number((unreadCountById as any)?.[c.id] ?? 0) || 0;
                const time = formatListTime(last?.created_at || c.last_message_at || c.updated_at || c.created_at);
                const who = String(last?.sender_role || '').toLowerCase() === 'admin' ? 'Soporte: ' : '';
                const assignee = c.assigned_admin_id ? (c.assigned_admin_id === myAdminId ? 'Asignado a mí' : 'Asignado') : 'Sin asignar';
                const online = Boolean(onlineUserIds[c.created_by]);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveId(c.id);
                      void loadChat(c.id);
                    }}
                    className={`w-full text-left p-4 hover:bg-pink-50/30 ${active ? 'bg-pink-50/40' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-50 text-brand-emerald ring-1 ring-pink-100 text-sm font-extrabold">
                        {initials(name)}
                        {presenceDot(online)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">{name}</div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-gray-400">{c.id.slice(0, 8)}…</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(c.id, `list-${c.id}`);
                                }}
                                className="text-gray-400 hover:text-brand-emerald"
                                title="Copiar ID de conversación"
                              >
                                {copiedId === `list-${c.id}` ? (
                                  <span className="text-[10px] font-bold text-green-500">OK</span>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                )}
                              </button>
                            </div>
                            <div className="mt-0.5 truncate text-xs text-gray-500">{c.subject || 'Soporte'}</div>
                          </div>
                          <div className="shrink-0 text-[11px] font-semibold text-gray-500">{time}</div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="min-w-0 truncate text-xs text-gray-600">
                            {preview ? `${who}${preview}` : '—'}
                          </div>
                          {(unread > 0 || needs) ? (
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-emerald px-2 text-[11px] font-extrabold text-white">
                              {unread > 0 ? unread : 1}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${planColor}`}>{planLabel}</span>
                          <span className="text-[10px] text-gray-400">{slaLabel}</span>
                          <span className="text-[10px] text-gray-400">·</span>
                          <span className="text-[10px] text-gray-500">{st === 'closed' ? 'Cerrado' : 'Abierto'} · {assignee}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </aside>

        <section className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5 flex flex-col min-h-0">
          {!activeId ? (
            <div className="p-6 text-sm text-gray-600">Selecciona un chat para ver la conversación.</div>
          ) : isLoadingChat ? (
            <div className="p-6 text-sm text-gray-600">Cargando conversación…</div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{activeConv?.subject || 'Soporte'}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const uid = String(activeConv?.created_by || '').trim();
                      const nm = uid ? nameById[uid] || `${uid.slice(0, 6)}…` : '—';
                      const online = uid ? Boolean(onlineUserIds[uid]) : false;
                      return (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="font-semibold text-gray-700">Usuario:</span> {nm}
                            {uid && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(uid, `user-${uid}`)}
                                className="text-gray-400 hover:text-brand-emerald"
                                title="Copiar ID de usuario"
                              >
                                {copiedId === `user-${uid}` ? (
                                  <span className="text-[10px] font-bold text-green-500">Copiado</span>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>ID: {activeId.slice(0, 8)}…</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeId, `header-${activeId}`)}
                              className="text-gray-400 hover:text-brand-emerald"
                              title="Copiar ID de conversación"
                            >
                              {copiedId === `header-${activeId}` ? (
                                <span className="text-[10px] font-bold text-green-500">Copiado</span>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                              )}
                            </button>
                            <span>·</span>
                            <span>Estado: {String(activeConv?.status || '—')}</span>
                            {(() => {
                              const uid = String(activeConv?.created_by || '').trim();
                              const p = String(planById[uid] || 'basic').toLowerCase();
                              const lbl = p === 'platinum' ? '👑 Platinum' : p === 'pro' ? '🔵 Pro' : '🟢 Básico';
                              const cls = p === 'platinum' ? 'bg-amber-100 text-amber-800 ring-amber-200' : p === 'pro' ? 'bg-blue-100 text-blue-800 ring-blue-200' : 'bg-gray-100 text-gray-600 ring-gray-200';
                              const sla = p === 'pro' || p === 'platinum' ? '⚡ 12-24h' : '24-48h';
                              return (
                                <>
                                  <span>·</span>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>{lbl}</span>
                                  <span className="inline-flex items-center rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-700 ring-1 ring-pink-200">SLA {sla}</span>
                                </>
                              );
                            })()}
                            {isUserTyping && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-800 ring-1 ring-green-200">
                                  escribiendo…
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadChat(activeId)}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                  >
                    Actualizar
                  </button>
                  {!activeConv?.assigned_admin_id ? (
                    <button
                      type="button"
                      onClick={() => void takeOrRelease('take')}
                      disabled={isUpdating}
                      className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                    >
                      Tomar chat
                    </button>
                  ) : activeConv?.assigned_admin_id === myAdminId ? (
                    <button
                      type="button"
                      onClick={() => void takeOrRelease('release')}
                      disabled={isUpdating}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Soltar
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-xl bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-black/5">
                      Asignado
                    </span>
                  )}
                  {String(activeConv?.status || '').toLowerCase() === 'closed' ? (
                    <button
                      type="button"
                      onClick={() => void setStatus('open')}
                      disabled={isUpdating}
                      className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                    >
                      Reabrir
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void setStatus('close')}
                      disabled={isUpdating}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>

              {/* ===== DELETE UNPAID ORDER PANEL ===== */}
              <div className="mt-2 rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteOrderPanel(v => !v); setDeleteOrderResult(null); }}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="text-sm font-semibold text-orange-900">🗑 Eliminar compra/venta (antes de pago)</span>
                  <span className="ml-auto text-xs text-orange-400">{showDeleteOrderPanel ? '▲ cerrar' : '▼ abrir'}</span>
                </button>
                {showDeleteOrderPanel && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-xs text-orange-700">Ingresa el ID de la orden <span className="font-semibold">o</span> el ID del usuario para eliminar todas sus órdenes no pagadas.</p>
                    <div className="flex gap-2">
                      <input
                        value={deleteOrderId}
                        onChange={(e) => setDeleteOrderId(e.target.value)}
                        placeholder="ID de orden o ID de usuario…"
                        className="flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      <button
                        type="button"
                        disabled={deleteOrderLoading || !deleteOrderId.trim()}
                        onClick={async () => {
                          const val = deleteOrderId.trim();
                          if (!val) return;
                          if (!confirm(`¿Eliminar compra/venta "${val}" permanentemente? Esta acción no se puede deshacer.`)) return;
                          setDeleteOrderLoading(true);
                          setDeleteOrderResult(null);
                          try {
                            const { data: sess } = await supabase.auth.getSession();
                            const token = sess.session?.access_token;
                            // Detect if it looks like a UUID (order ID) or not (user ID)
                            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
                            const res = await fetch('/api/admin/orders/delete', {
                              method: 'POST',
                              headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                              body: JSON.stringify(isUUID ? { orderId: val } : { userId: val }),
                            });
                            const json = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              setDeleteOrderResult(`❌ ${json?.error || 'Error al eliminar.'}`);
                            } else {
                              const n = json?.deleted ?? 0;
                              const ids = (json?.orders ?? []).map((o: any) => o.id?.slice(0, 8)).join(', ');
                              setDeleteOrderResult(`✅ ${n} orden(es) eliminada(s) permanentemente${ids ? `: ${ids}…` : ''}.`);
                              setDeleteOrderId('');
                            }
                          } catch (e: any) {
                            setDeleteOrderResult(`❌ ${e?.message || 'Error inesperado.'}`);
                          } finally {
                            setDeleteOrderLoading(false);
                          }
                        }}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {deleteOrderLoading ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                    {deleteOrderResult && (
                      <div className={`rounded-xl px-3 py-2 text-sm font-medium ${deleteOrderResult.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {deleteOrderResult}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ScrollArea className="mt-3 flex-1 min-h-0 rounded-2xl border border-black/5 bg-[#f5f7fb] p-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-gray-600">Aún no hay mensajes.</div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => {
                      const isAdmin = String(m.sender_role || '').toLowerCase() === 'admin';
                      const userId = String(activeConv?.created_by || '').trim();
                      const userName = userId ? nameById[userId] || `${userId.slice(0, 6)}…` : 'Usuario';
                      const isMineAdminMessage = Boolean(isAdmin && myAdminId && String(m.sender_id || '').trim() === myAdminId);
                      const attUrl = String((m as any)?.attachment_url || '').trim();
                      const attName = String((m as any)?.attachment_name || '').trim();
                      const attMime = String((m as any)?.attachment_mime || '').trim().toLowerCase();
                      const isImage = !!attUrl && (attMime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(attUrl));

                      // Palomitas para mensajes enviados por soporte (admin)
                      let ticks: { text: string; className: string } | null = null;
                      if (isAdmin) {
                        const deliveredAt = safeTs((activeConv as any)?.last_delivered_to_user_at);
                        const readAt = safeTs(activeConv?.last_read_by_user_at);
                        const msgAt = safeTs(m.created_at);
                        const isRead = Boolean(readAt && msgAt && readAt >= msgAt);
                        const isDelivered = Boolean(deliveredAt && msgAt && deliveredAt >= msgAt);
                        if (isRead) ticks = { text: '✓✓', className: 'text-white/90' };
                        else if (isDelivered) ticks = { text: '✓', className: 'text-white/80' };
                        else ticks = null; // aún no recibido
                      }
                      return (
                        <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${isAdmin ? 'bg-brand-emerald text-white ring-pink-200' : 'bg-white text-gray-900 ring-black/5'
                              }`}
                          >
                            <div className={`mb-1 text-[11px] font-extrabold ${isAdmin ? 'text-white/85' : 'text-gray-600'}`}>
                              {isAdmin ? (isMineAdminMessage ? 'Soporte técnico (tú)' : 'Soporte técnico') : userName}
                            </div>
                            {String(m.body || '').trim() ? <div className="whitespace-pre-wrap break-words">{m.body}</div> : null}

                            {attUrl ? (
                              isImage ? (
                                <a href={attUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={attUrl}
                                    alt={attName || 'Adjunto'}
                                    className={`max-h-64 w-auto rounded-xl ring-1 ${isAdmin ? 'ring-white/20' : 'ring-black/10'}`}
                                  />
                                  <div className={`mt-1 text-[11px] font-semibold ${isAdmin ? 'text-white/80' : 'text-gray-600'}`}>
                                    {attName || 'Ver imagen'}
                                  </div>
                                </a>
                              ) : (
                                <a
                                  href={attUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ${isAdmin ? 'bg-white/10 text-white ring-white/20' : 'bg-gray-50 text-gray-900 ring-black/10'
                                    }`}
                                  title="Abrir adjunto"
                                >
                                  📎 {attName || 'Ver archivo'}
                                </a>
                              )
                            ) : null}
                            <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isAdmin ? 'text-white/80' : 'text-gray-500'}`}>
                              <span>{formatDateTime(m.created_at)}</span>
                              {isAdmin && ticks ? <span className={`font-extrabold ${ticks.className}`}>{ticks.text}</span> : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </ScrollArea>

              {String(activeConv?.status || '').toLowerCase() === 'closed' ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Este chat está cerrado. Puedes reabrirlo para responder.
                </div>
              ) : (
                <div className="mt-3">
                  {/* ===== QUICK-REPLY TEMPLATES (Chatbot) ===== */}
                  {(() => {
                    const categories = [
                      {
                        id: 'pagos', label: '💳 Pagos', color: 'bg-blue-50 text-blue-700 ring-blue-200',
                        replies: [
                          { title: 'Pago recibido', text: '✅ ¡Hola! Tu pago ha sido recibido y verificado correctamente. El vendedor ha sido notificado y procederá con el envío de tu pedido. Te notificaremos cuando sea enviado.' },
                          { title: 'Comprobante necesario', text: '📄 Hola, para poder verificar tu pago necesitamos que subas el comprobante de tu transferencia/depósito/OXXO. Ve a Mi cuenta → Compras, busca tu orden y haz clic en "Subir comprobante". ¡Gracias!' },
                          { title: 'Pago no encontrado', text: '🔍 Hola, hemos revisado y aún no encontramos un pago asociado a tu orden. Por favor verifica que:\n1. Los datos de la transferencia sean correctos\n2. El monto sea exacto\n3. Sube el comprobante desde tu panel de Compras\nSi ya lo hiciste, envíanos el comprobante por este chat.' },
                          { title: 'Comisión MercadoPago', text: '💡 Hola, al pagar con tarjeta a través de MercadoPago se cobra una comisión por procesamiento del pago. Esta comisión es de MercadoPago, no de GoVendy. Para evitarla, puedes pagar por transferencia bancaria, depósito o PocketCash.' },
                        ],
                      },
                      {
                        id: 'envios', label: '📦 Envíos', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                        replies: [
                          { title: 'Guía generada', text: '📦 ¡Tu guía de envío ha sido generada! El vendedor tiene 72 horas para entregar el paquete en la sucursal de la paquetería. Te enviaremos el número de rastreo una vez que sea escaneado.' },
                          { title: 'Paquete en tránsito', text: '🚚 Tu paquete ya está en camino. Puedes rastrear tu envío desde Mi cuenta → Compras → tu orden → "Rastrear envío". El tiempo estimado de entrega es de 3 a 7 días hábiles dependiendo de tu zona.' },
                          { title: 'Retraso en envío', text: '⚠️ Lamentamos el retraso en tu envío. Hemos contactado al vendedor para solicitar información actualizada. Te responderemos en cuanto tengamos novedades. Si el vendedor no envía en las próximas 48 horas, procederemos con las opciones correspondientes.' },
                          { title: 'Paquete extraviado', text: '📌 Hemos iniciado una investigación con la paquetería sobre tu envío. Este proceso puede tardar de 5 a 10 días hábiles. Si se confirma el extravío, te reembolsaremos el monto total a tu PocketCash. Te mantendremos informado del avance.' },
                        ],
                      },
                      {
                        id: 'cuenta', label: '👤 Cuenta', color: 'bg-violet-50 text-violet-700 ring-violet-200',
                        replies: [
                          { title: 'Verificación de identidad', text: '🪪 Para verificar tu cuenta necesitas subir:\n1. Una foto de tu INE/IFE (frente y reverso) clara y legible\n2. Un selfie sosteniendo tu INE\nVe a Mi cuenta → Perfil → Verificar identidad. La verificación tarda de 1 a 3 días hábiles.' },
                          { title: 'Cambiar contraseña', text: '🔐 Para cambiar tu contraseña:\n1. Ve a la página de inicio de sesión\n2. Haz clic en "¿Olvidaste tu contraseña?"\n3. Ingresa tu correo electrónico\n4. Recibirás un link para crear una nueva contraseña\nSi no recibes el correo, revisa tu carpeta de spam.' },
                          { title: 'Cuenta suspendida', text: '⚠️ Tu cuenta ha sido suspendida temporalmente por [RAZÓN]. Para reactivarla, necesitas [ACCIÓN]. Si crees que esto es un error, responde a este mensaje con más detalles y revisaremos tu caso.' },
                        ],
                      },
                      {
                        id: 'reembolsos', label: '💸 Reembolsos', color: 'bg-amber-50 text-amber-700 ring-amber-200',
                        replies: [
                          { title: 'Reembolso procesado', text: '💰 ¡Tu reembolso ha sido procesado! El monto de $[MONTO] MXN ha sido acreditado a tu PocketCash. Puedes usarlo para futuras compras o retirarlo desde Mi cuenta → Monedero.' },
                          { title: 'Reembolso en proceso', text: '⏳ Tu solicitud de reembolso está en proceso. Estamos revisando tu caso y te informaremos la resolución en un máximo de 72 horas. Gracias por tu paciencia.' },
                          { title: 'Producto diferente', text: '📸 Lamentamos que el producto no sea lo que esperabas. Para proceder con tu reclamo, necesitamos:\n1. Fotos del producto recibido (mínimo 3)\n2. Foto de la etiqueta o embalaje\n3. Descripción del problema\nEnvíalas por este chat y revisaremos tu caso.' },
                        ],
                      },
                      {
                        id: 'planes', label: '👑 Planes', color: 'bg-pink-50 text-pink-700 ring-pink-200',
                        replies: [
                          { title: 'Info planes', text: '📋 GoVendy ofrece 3 planes:\n\n🟢 Básico (Gratis): 50 publicaciones, 15 subastas, 25 cupones/mes, comisión 23%, retiro cada 7 días.\n\n🔵 Pro: Publicaciones y subastas ilimitadas, envío por vendedor, Lives (con créditos), comisión 18%, retiro cada 48 hrs.\n\n👑 Platinum: Todo lo de Pro + entrega personal, 2 hrs gratis de Lives/día, publicaciones destacadas ilimitadas, retiro cada 24 hrs.\n\nCambia tu plan en Mi cuenta → Pro.' },
                          { title: 'Plan expirado', text: '⏰ Tu plan [PRO/PLATINUM] ha expirado y tu cuenta ha vuelto al plan Básico. Para renovarlo, ve a Mi cuenta → Pro y selecciona tu plan. Los beneficios se activan al instante.' },
                        ],
                      },
                      {
                        id: 'subastas', label: '🔨 Subastas', color: 'bg-orange-50 text-orange-700 ring-orange-200',
                        replies: [
                          { title: 'Ganaste subasta', text: '🎉 ¡Felicidades! Ganaste la subasta. Tu orden de compra ya fue creada. Ve a Mi cuenta → Compras para:\n1. Seleccionar método de envío (Envío GoVendy o Entrega Personal)\n2. Elegir tu método de pago\n3. Completar la compra\nRecuerda completar el pago lo antes posible.' },
                          { title: 'Subasta sin pujas', text: '📌 Tu subasta finalizó sin recibir pujas. El producto se ha pausado automáticamente. Puedes:\n1. Volver a publicar como subasta con precio inicial más bajo\n2. Cambiar a venta directa con precio fijo\nVe a Mi cuenta → Publicaciones para editarlo.' },
                        ],
                      },
                      {
                        id: 'digital', label: '💻 Digital', color: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
                        replies: [
                          { title: 'Producto digital entregado', text: '💻 El vendedor ha entregado tu producto digital. Puedes ver los códigos/links/seriales en Mi cuenta → Compras → tu orden. Si no ves la información, actualiza la página.' },
                          { title: 'Producto digital no recibido', text: '⚠️ Hemos contactado al vendedor para que entregue tu producto digital (código, serial o link). Si no lo entrega en las próximas 24 horas, procederemos con el reembolso a tu PocketCash.' },
                        ],
                      },
                      {
                        id: 'general', label: '💬 General', color: 'bg-gray-100 text-gray-700 ring-gray-200',
                        replies: [
                          { title: 'Saludo inicial', text: '👋 ¡Hola! Bienvenido al soporte de GoVendy. ¿En qué puedo ayudarte hoy?' },
                          { title: 'Solicitar más info', text: '📝 Para poder ayudarte mejor, ¿podrías proporcionarme más detalles?\n• ID de tu orden (lo encuentras en Compras o Ventas)\n• Descripción detallada del problema\n• Capturas de pantalla si aplica\nAsí podré resolver tu caso más rápido.' },
                          { title: 'Problema resuelto', text: '✅ ¡Me alegra que se haya resuelto! Si tienes alguna otra duda, no dudes en escribirnos. ¡Que tengas un excelente día! 😊' },
                          { title: 'Escalamiento', text: '🔄 Tu caso ha sido escalado a un agente especializado. Te responderá a la brevedad. Gracias por tu paciencia.' },
                          { title: 'Cierre de caso', text: '📋 Tu caso ha sido resuelto. Voy a cerrar este chat de soporte. Si necesitas ayuda en el futuro, puedes crear un nuevo chat desde Mi cuenta → Soporte. ¡Gracias por contactarnos!' },
                        ],
                      },
                    ];
                    return (
                      <div className="mb-3 rounded-2xl border border-black/5 bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('quick-replies-panel');
                            if (el) el.classList.toggle('hidden');
                          }}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                        >
                          <span className="text-sm font-bold text-gray-900">⚡ Respuestas rápidas</span>
                          <span className="text-xs text-gray-400">Clic para expandir</span>
                        </button>
                        <div id="quick-replies-panel" className="hidden border-t border-black/5 px-4 py-3">
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {categories.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  document.querySelectorAll('[data-qr-cat]').forEach((el) => el.classList.add('hidden'));
                                  const target = document.querySelector(`[data-qr-cat="${cat.id}"]`);
                                  if (target) target.classList.toggle('hidden');
                                }}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 hover:opacity-80 ${cat.color}`}
                              >
                                {cat.label}
                              </button>
                            ))}
                          </div>
                          {categories.map((cat) => (
                            <div key={cat.id} data-qr-cat={cat.id} className="hidden space-y-1.5">
                              {cat.replies.map((r, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    setReply(r.text);
                                    document.getElementById('quick-replies-panel')?.classList.add('hidden');
                                  }}
                                  className="w-full rounded-xl border border-black/5 bg-gray-50 px-3 py-2 text-left text-xs text-gray-700 hover:bg-pink-50 hover:ring-1 hover:ring-pink-200 transition-all"
                                >
                                  <span className="font-bold text-gray-900">{r.title}</span>
                                  <span className="ml-1.5 text-gray-500">{r.text.slice(0, 80)}…</span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setAttachFile(f);
                        try {
                          if (attachPreview) URL.revokeObjectURL(attachPreview);
                        } catch {
                          // noop
                        }
                        if (f && String(f.type || '').startsWith('image/')) setAttachPreview(URL.createObjectURL(f));
                        else setAttachPreview('');
                      }}
                    />
                    <textarea
                      value={reply}
                      onChange={(e) => {
                        setReply(e.target.value);
                        void broadcastTyping(Boolean(e.target.value.trim().length));
                      }}
                      placeholder="Responder como soporte… (sin links ni teléfonos)"
                      className="min-h-[80px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    {attachFile ? (
                      <div className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-gray-700 sm:max-w-[220px]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-gray-900">Adjunto</div>
                            <div className="truncate text-[11px] text-gray-600">{attachFile.name}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachFile(null);
                              try {
                                if (attachPreview) URL.revokeObjectURL(attachPreview);
                              } catch {
                                // noop
                              }
                              setAttachPreview('');
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-200"
                          >
                            Quitar
                          </button>
                        </div>
                        {attachPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={attachPreview} alt="Preview" className="mt-2 max-h-24 w-auto rounded-xl ring-1 ring-black/10" />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={isSending || isUploadingAttach || (reply.trim().length < 1 && !attachFile)}
                      className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
                    >
                      {isUploadingAttach ? 'Subiendo…' : isSending ? 'Enviando…' : 'Enviar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending || isUploadingAttach}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-60"
                      title="Adjuntar archivo"
                    >
                      Adjuntar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

