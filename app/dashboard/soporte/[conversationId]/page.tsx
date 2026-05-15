'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

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

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function looksLikeLink(text: string) {
  const t = text.toLowerCase();
  if (t.includes('http://') || t.includes('https://')) return true;
  if (t.includes('www.')) return true;
  if (/\b[a-z0-9-]+\.(com|mx|net|org|io|app|me|gg|ly|co|tv|xyz)\b/i.test(t)) return true;
  if (t.includes('wa.me') || t.includes('t.me')) return true;
  return false;
}

function looksLikePhone(text: string) {
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 10) return true;
  if (/\b\d{7,}\b/.test(text)) return true;
  return false;
}

export default function DashboardSoporteChatPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = String((params as any)?.conversationId || '').trim();

  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [subject, setSubject] = useState<string>('');
  const [status, setStatus] = useState<string>('open');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string>('');
  const [isUploadingAttach, setIsUploadingAttach] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('basic');
  const [botStep, setBotStep] = useState<'welcome' | 'category' | 'done'>('welcome');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const reloadTimerRef = useRef<number | null>(null);
  const lastReloadAtRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);

  const canSend = useMemo(() => {
    const t = input.trim();
    if (!t && !attachFile) return false;
    if (t.length > 800) return false;
    if (String(status || '').toLowerCase() === 'closed') return false;
    return true;
  }, [input, status, attachFile]);

  const load = async () => {
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/dashboard/soporte')}`;
        return;
      }

      const res = await fetch(`/api/support/messages-v2?conversationId=${encodeURIComponent(conversationId)}&limit=300&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = json?.error || 'No se pudo cargar el chat.';
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

      setMessages(normalizedMessages);
      setSubject(String(json?.conversation?.subject || 'Soporte'));
      setStatus(String(json?.conversation?.status || 'open'));

      // Marcar como leído (best-effort)
      void fetch('/api/support/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ conversationId }),
      }).catch(() => null);
    } catch (e: unknown) {
      console.error(e);
      setMessages([]);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el chat.');
    }
  };

  const scheduleReload = (reason: string) => {
    // debounce + throttle (evitar tormenta de eventos)
    const now = Date.now();
    if (now - lastReloadAtRef.current < 500) return;
    if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      lastReloadAtRef.current = Date.now();
      void load();
    }, reason === 'message' ? 120 : 260);
  };

  const send = async () => {
    setError(null);
    setIsSending(true);
    try {
      const msg = input.trim();
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

      const res = await fetch('/api/support/messages-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({
          conversationId,
          message: msg,
          attachmentUrl: attachmentUrl || undefined,
          attachmentName: attachmentName || undefined,
          attachmentMime: attachmentMime || undefined,
          attachmentSize: attachmentSize || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar el mensaje.');

      const saved = json?.message as Msg | undefined;
      if (saved?.id) setMessages((prev) => [...prev, saved]);
      setInput('');
      void broadcastTyping(false);
      setAttachFile(null);
      try {
        if (attachPreview) URL.revokeObjectURL(attachPreview);
      } catch {
        // noop
      }
      setAttachPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const broadcastTyping = async (isTyping: boolean) => {
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 700 && isTyping) return;
    lastTypingSentAtRef.current = now;
    try {
      const ch: any = supabase.channel('support:events');
      await ch.send({
        type: 'broadcast',
        event: 'support_event',
        payload: { conversationId, kind: 'typing', by: 'user', isTyping, t: Date.now() },
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

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        await load();
        // Fetch user plan for SLA banner
        try {
          const { data: sess } = await supabase.auth.getSession();
          const uid = sess.session?.user?.id;
          if (uid) {
            const { data: prof } = await supabase.from('profiles').select('plan_type,pro_subscription_end').eq('id', uid).maybeSingle();
            if (prof) {
              const rawPlan = String((prof as any)?.plan_type || 'basic').toLowerCase();
              const endStr = String((prof as any)?.pro_subscription_end || '').trim();
              if ((rawPlan === 'pro' || rawPlan === 'platinum') && endStr) {
                const expired = new Date(endStr).getTime() < Date.now();
                if (!cancelled) setUserPlan(expired ? 'basic' : rawPlan);
              } else {
                if (!cancelled) setUserPlan(rawPlan === 'pro' || rawPlan === 'platinum' ? rawPlan : 'basic');
              }
            }
          }
        } catch { /* best effort */ }
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Realtime: broadcast + postgres_changes. Fallback: polling.
  useEffect(() => {
    let disposed = false;
    try {
      const ch = supabase
        .channel(`support-user-${conversationId}`)
        .on('broadcast', { event: 'support_event' }, (payload: any) => {
          if (disposed) return;
          const cid = String(payload?.payload?.conversationId || payload?.conversationId || '').trim();
          if (!cid || cid !== conversationId) return;
          const kind = String(payload?.payload?.kind || '').trim();
          const by = String(payload?.payload?.by || '').trim();
          if (kind === 'typing' && by === 'admin') {
            setIsAdminTyping(Boolean(payload?.payload?.isTyping));
            if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
            typingTimerRef.current = window.setTimeout(() => setIsAdminTyping(false), 2500);
          }
          scheduleReload(String(payload?.payload?.kind || 'event') === 'message' ? 'message' : 'event');
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${conversationId}` },
          () => {
            if (disposed) return;
            scheduleReload('message');
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'support_conversations', filter: `id=eq.${conversationId}` },
          () => {
            if (disposed) return;
            scheduleReload('event');
          },
        )
        .subscribe((status) => {
          if (disposed) return;
          setRealtimeOk(status === 'SUBSCRIBED');
        });

      return () => {
        disposed = true;
        if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
        void supabase.removeChannel(ch);
      };
    } catch {
      setRealtimeOk(false);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (realtimeOk) return;
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeOk, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Soporte</div>
              <div className="text-xs text-gray-500">
                {subject} · {String(status || '').toLowerCase() === 'closed' ? 'Cerrado' : 'Abierto'}
                {isAdminTyping ? <span className="ml-2 font-semibold text-green-700">Soporte está escribiendo…</span> : null}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link
              href="/dashboard/soporte"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Mis chats
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
        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">Chat</div>
              <div className="mt-1 text-xs text-gray-500">
                Escribe tu consulta y un agente te responderá.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Actualizar
            </button>
          </div>

          <div className="mt-4 h-[55vh] overflow-auto rounded-2xl border border-black/5 bg-gray-50 p-3">
            {isBooting ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                {/* Bot welcome message */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-brand-emerald">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-emerald text-[10px] text-white">🤖</span>
                      PocketBot
                    </div>
                    <div className="whitespace-pre-wrap text-gray-900">
                      ¡Hola! 👋 Soy el asistente virtual de GoVendy.
                    </div>
                    <div className="mt-2 text-gray-700">Deja tu consulta aquí y un agente la resolverá lo más pronto posible.</div>
                    <div className={`mt-2 rounded-xl px-3 py-2 text-xs font-medium ${userPlan === 'platinum' ? 'bg-amber-50 text-amber-800' :
                        userPlan === 'pro' ? 'bg-blue-50 text-blue-800' :
                          'bg-emerald-50 text-emerald-800'
                      }`}>
                      {userPlan === 'pro' || userPlan === 'platinum'
                        ? `⚡ Tu plan ${userPlan === 'platinum' ? 'Platinum 👑' : 'Pro 🔵'} tiene prioridad · Respuesta en 12 a 24 horas`
                        : '⏳ Tiempo estimado de respuesta: 24 a 48 horas · Plan Básico'
                      }
                    </div>
                  </div>
                </div>
                {/* Bot category prompt */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-brand-emerald">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-emerald text-[10px] text-white">🤖</span>
                      PocketBot
                    </div>
                    <div className="text-gray-900">¿Sobre qué necesitas ayuda? Selecciona un tema o escribe directamente tu mensaje:</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { id: 'pagos', label: '💳 Pagos', prefix: '[Pagos] ' },
                        { id: 'envios', label: '📦 Envíos', prefix: '[Envíos] ' },
                        { id: 'cuenta', label: '👤 Mi Cuenta', prefix: '[Cuenta] ' },
                        { id: 'reembolsos', label: '💸 Reembolsos', prefix: '[Reembolsos] ' },
                        { id: 'producto', label: '📋 Producto', prefix: '[Producto] ' },
                        { id: 'planes', label: '👑 Planes', prefix: '[Planes] ' },
                        { id: 'subastas', label: '🔨 Subastas', prefix: '[Subastas] ' },
                        { id: 'otro', label: '💬 Otro', prefix: '' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setInput(cat.prefix);
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${selectedCategory === cat.id
                              ? 'border-brand-emerald bg-brand-emerald text-white shadow-sm'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Chatbot welcome bubbles at top of messages */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-brand-emerald">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-emerald text-[10px] text-white">🤖</span>
                      PocketBot
                    </div>
                    <div className="text-gray-900">¡Hola! 👋 Bienvenido al soporte de GoVendy. Un agente revisará tu consulta lo antes posible.</div>
                    <div className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-medium ${userPlan === 'platinum' ? 'bg-amber-50 text-amber-800' :
                        userPlan === 'pro' ? 'bg-blue-50 text-blue-800' :
                          'bg-emerald-50 text-emerald-800'
                      }`}>
                      {userPlan === 'pro' || userPlan === 'platinum'
                        ? `⚡ Plan ${userPlan === 'platinum' ? 'Platinum 👑' : 'Pro 🔵'} · Respuesta en 12 a 24 horas`
                        : '⏳ Respuesta estimada: 24 a 48 horas · Plan Básico'
                      }
                    </div>
                  </div>
                </div>
                {messages.map((m) => {
                  const role = String(m.sender_role || '').toLowerCase();
                  const isAdmin = role === 'admin';
                  const isUser = role === 'user' || !role;
                  const isSys = m.sender_id === 'system';
                  const attUrl = String((m as any)?.attachment_url || '').trim();
                  const attName = String((m as any)?.attachment_name || '').trim();
                  const attMime = String((m as any)?.attachment_mime || '').trim().toLowerCase();
                  const isImage = !!attUrl && (attMime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(attUrl));
                  const tone = isSys ? 'bot' : isUser ? 'mine' : isAdmin ? 'admin' : 'other';
                  const styles =
                    tone === 'mine'
                      ? 'bg-brand-emerald text-white ring-emerald-200'
                      : tone === 'bot'
                        ? 'bg-white text-gray-900 ring-black/5'
                        : tone === 'admin'
                          ? 'bg-white text-gray-900 ring-amber-200'
                          : 'bg-white text-gray-900 ring-black/5';
                  const align = tone === 'mine' ? 'justify-end' : 'justify-start';
                  return (
                    <div key={m.id} className={`flex ${align}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${styles}`}>
                        {tone === 'bot' ? (
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-brand-emerald">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-emerald text-[10px] text-white">🤖</span>
                            PocketBot
                          </div>
                        ) : tone === 'admin' ? (
                          <div className="mb-1 text-[11px] font-semibold text-amber-700">Soporte</div>
                        ) : null}
                        {String(m.body || '').trim() ? <div className="whitespace-pre-wrap break-words">{m.body}</div> : null}

                        {attUrl ? (
                          isImage ? (
                            <a href={attUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={attUrl} alt={attName || 'Adjunto'} className="max-h-64 w-auto rounded-xl ring-1 ring-black/10" />
                              <div className="mt-1 text-[11px] font-semibold text-gray-600">{attName || 'Ver imagen'}</div>
                            </a>
                          ) : (
                            <a
                              href={attUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50"
                            >
                              📎 {attName || 'Ver archivo'}
                            </a>
                          )
                        ) : null}
                        <div className={`mt-1 text-[11px] ${tone === 'mine' ? 'text-emerald-100' : 'text-gray-500'}`}>{formatDateTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {String(status || '').toLowerCase() === 'closed' ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este chat está cerrado. Si necesitas más ayuda, crea uno nuevo en “Mis chats”.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full">
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
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    void broadcastTyping(Boolean(e.target.value.trim().length));
                  }}
                  placeholder="Escribe tu mensaje…"
                  className="min-h-[80px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />

                {attachFile ? (
                  <div className="mt-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-gray-700">
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
              </div>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend || isSending || isUploadingAttach}
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
          )}
        </div>
      </main>
    </div>
  );
}

