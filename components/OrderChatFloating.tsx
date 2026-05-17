'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Attachment = { url: string; name?: string; contentType?: string | null; size?: number | null };
type Msg = {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role?: string | null;
  body?: string | null;
  attachments?: Attachment[] | any;
  created_at: string;
};

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
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

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function normalizeAttachments(raw: any): Attachment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Attachment[];
  // si viene como string JSON
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Attachment[];
    } catch {
      return [];
    }
  }
  return [];
}

function roleLabel(role: string | null | undefined) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'buyer') return 'Comprador';
  if (r === 'seller') return 'Vendedor';
  return 'Usuario';
}

export function OrderChatFloating({
  open,
  orderId,
  onClose,
}: {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}) {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<{
    name: string;
    logo?: string | null;
    plan?: string;
    isVerified?: boolean;
  } | null>(null);

  const [shippingOptionId, setShippingOptionId] = useState<string | null>(null);
  const [shippingCarrier, setShippingCarrier] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    // Si el pago está pendiente, no se puede enviar mensajes
    if (orderStatus === 'pending_payment') return false;
    const t = input.trim();
    if (!t && pending.length === 0) return false;
    if (t.length > 800) return false;

    // Permitir enlaces y teléfonos si es envío por su cuenta (Self Ship)
    const isSelfShip = !shippingOptionId && shippingCarrier !== 'pickup';
    
    if (!isSelfShip) {
      if (t && (looksLikeLink(t) || looksLikePhone(t))) return false;
    }
    
    return true;
  }, [input, pending.length, orderStatus, shippingOptionId, shippingCarrier]);

  const load = async (isInitial = false) => {
    if (!open || !orderId) {
      if (isInitial) setIsInitialLoading(false);
      return;
    }
    if (isInitial) {
      setError(null);
      setIsInitialLoading(true);
    }
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!userData.user) {
        if (isInitial) setIsInitialLoading(false);
        window.location.href = '/login';
        return;
      }
      setMyId(userData.user.id);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        if (isInitial) setIsInitialLoading(false);
        throw new Error('Auth session missing');
      }

      console.log('[CHAT] Cargando mensajes para orden:', orderId);
      
      const res = await fetch(`/api/chat/messages-v2?orderId=${encodeURIComponent(orderId)}&limit=200&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      const json = await res.json().catch((parseErr) => {
        console.error('[CHAT] Error al parsear respuesta:', parseErr);
        return { error: 'Error al procesar respuesta del servidor' };
      });
      
      console.log('[CHAT] Respuesta del servidor:', {
        ok: res.ok,
        status: res.status,
        hasMessages: Array.isArray(json?.messages),
        messageCount: Array.isArray(json?.messages) ? json.messages.length : 0,
        error: json?.error,
      });
      
      if (!res.ok) {
        const errorMsg = json?.error || `Error ${res.status}: No se pudo cargar el chat.`;
        console.error('[CHAT] Error del servidor:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Obtener el estado de la orden y datos del vendedor
      if (orderId) {
        (async () => {
          try {
            const { data: orderData, error: orderErr } = await supabase
              .from('orders')
              .select('status, seller_id, shipping_option_id, shipping_carrier')
              .eq('id', orderId)
              .maybeSingle();
              
            if (!orderErr && orderData) {
              setOrderStatus(String(orderData.status || '').trim());
              setShippingOptionId(orderData.shipping_option_id || null);
              setShippingCarrier(orderData.shipping_carrier || null);
              
              // Fetch seller info
              if (orderData.seller_id) {
                const { data: sellerData } = await supabase
                  .from('profiles')
                  .select('full_name, plan_type, store_logo_url, is_verified')
                  .eq('id', orderData.seller_id)
                  .maybeSingle();
                  
                if (sellerData) {
                  setSellerInfo({
                    name: sellerData.full_name || 'Vendedor',
                    logo: sellerData.store_logo_url,
                    plan: sellerData.plan_type,
                    isVerified: !!sellerData.is_verified,
                  });
                }
              }
            }
          } catch (orderErr) {
            console.warn('[CHAT] Error al obtener datos de orden/vendedor:', orderErr);
          }
        })();
      }
      
      const newMessages = (json?.messages ?? []) as Msg[];
      console.log('[CHAT] Mensajes recibidos:', newMessages.length);
      
      // Actualizar mensajes
      setMessages((prev) => {
        if (prev.length !== newMessages.length) return newMessages;
        const prevIds = new Set(prev.map((m) => m.id));
        const hasNew = newMessages.some((m) => !prevIds.has(m.id));
        return hasNew ? newMessages : prev;
      });

      // marcar como leído (best-effort, solo en carga inicial, no bloqueante)
      if (isInitial) {
        fetch('/api/chat/read', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          cache: 'no-store',
          body: JSON.stringify({ orderId }),
        }).catch((readErr) => {
          console.warn('[CHAT] Error al marcar como leído (no crítico):', readErr);
        });
      }
    } catch (e: unknown) {
      console.error('[CHAT] Error completo:', e);
      const errorMessage = e instanceof Error ? e.message : 'No se pudo cargar el chat.';
      if (isInitial) {
        setMessages([]);
        setError(errorMessage);
      } else {
        // En recargas no iniciales, solo loguear el error pero no mostrar
        console.warn('[CHAT] Error en recarga (no crítico):', errorMessage);
      }
    } finally {
      if (isInitial) {
        setIsInitialLoading(false);
        console.log('[CHAT] Carga inicial completada');
      }
    }
  };

  useEffect(() => {
    if (!open || !orderId) {
      setIsInitialLoading(false);
      return;
    }
    
    // Cargar mensajes inicialmente
    void load(true);
    
    // Configurar recarga periódica cada 6 segundos
    const interval = window.setInterval(() => {
      if (open && orderId) {
        void load(false);
      }
    }, 6000);
    
    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  const uploadOne = async (file: File) => {
    if (!orderId) return;
    setError(null);
    setIsUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const fd = new FormData();
      fd.append('orderId', orderId);
      fd.append('file', file);
      const res = await fetch('/api/chat/upload', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo subir el archivo.');
      const att = json?.attachment as Attachment | undefined;
      if (att?.url) setPending((p) => [...p, att].slice(0, 4));
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const send = async () => {
    if (!orderId) {
      setError('No hay orden seleccionada.');
      return;
    }
    
    // Verificar que se puede enviar
    if (!canSend) {
      setError('No se puede enviar este mensaje. Verifica que no contenga enlaces o teléfonos.');
      return;
    }
    
    setError(null);
    setIsSending(true);
    
    try {
      const t = input.trim();
      if (!t && pending.length === 0) {
        setIsSending(false);
        return;
      }
      
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error('Sesión no válida. Por favor, inicia sesión nuevamente.');
      }

      console.log('[CHAT] Enviando mensaje:', {
        orderId,
        messageLength: t.length,
        attachmentsCount: pending.length,
      });

      const res = await fetch('/api/chat/messages-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ orderId, message: t, attachments: pending }),
      });
      
      const json = await res.json().catch((parseErr) => {
        console.error('[CHAT] Error al parsear respuesta de envío:', parseErr);
        return { error: 'Error al procesar respuesta del servidor' };
      });
      
      console.log('[CHAT] Respuesta de envío:', {
        ok: res.ok,
        status: res.status,
        hasMessage: !!json?.message,
        error: json?.error,
      });
      
      if (!res.ok) {
        const errorMsg = json?.error || `Error ${res.status}: No se pudo enviar el mensaje.`;
        console.error('[CHAT] Error al enviar:', errorMsg);
        throw new Error(errorMsg);
      }
      
      const saved = json?.message as Msg | undefined;
      if (saved?.id) {
        console.log('[CHAT] Mensaje guardado exitosamente:', saved.id);
        setMessages((prev) => [...prev, saved]);
        setInput('');
        setPending([]);
        
        // Recargar mensajes después de un breve delay para asegurar sincronización
        setTimeout(() => {
          void load(false);
        }, 500);
      } else {
        console.warn('[CHAT] Mensaje enviado pero no se recibió confirmación');
        // Recargar mensajes para obtener el mensaje recién enviado
        setTimeout(() => {
          void load(false);
        }, 500);
      }
    } catch (e: unknown) {
      console.error('[CHAT] Error completo al enviar:', e);
      const errorMessage = e instanceof Error ? e.message : 'No se pudo enviar el mensaje.';
      setError(`❌ ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!open || !orderId) return null;

  return (
    <div className="fixed bottom-24 right-5 z-[70] w-[320px] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 sm:w-[360px]">
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-emerald to-teal-500 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          {sellerInfo?.plan === 'pro' && sellerInfo.logo ? (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sellerInfo.logo} alt={sellerInfo.name} className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="leading-tight">
            <div className="text-sm font-extrabold flex items-center gap-1">
              {sellerInfo ? sellerInfo.name : 'Chat de compra'}
              {sellerInfo?.isVerified ? (
                 <svg className="h-3 w-3 text-blue-300" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
              ) : null}
            </div>
            <div className="text-[11px] font-semibold text-white/85">Orden: {orderId.slice(0, 8)}…</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-white/20 hover:bg-white/20"
        >
          Cerrar
        </button>
      </div>

      <div className="px-4 py-3">
        {error ? <div className="mb-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div> : null}
        
        {orderStatus === 'pending_payment' ? (
          <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ El chat estará disponible una vez que se acredite el pago.
          </div>
        ) : null}

        <div ref={listRef} className="h-[320px] overflow-auto rounded-2xl border border-black/5 bg-gray-50 p-3">
          {isInitialLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-gray-600">Aún no hay mensajes.</div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => {
                const mine = myId && m.sender_id === myId;
                const atts = normalizeAttachments((m as any)?.attachments);
                const r = roleLabel((m as any)?.sender_role);
                const bubble = mine
                  ? 'bg-brand-emerald text-white ring-pink-200'
                  : String((m as any)?.sender_role || '').toLowerCase() === 'admin'
                    ? 'bg-white text-gray-900 ring-amber-200'
                    : 'bg-white text-gray-900 ring-black/5';
                return (
                  <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={classNames('max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1', bubble)}>
                      <div className={classNames('mb-1 text-[11px] font-semibold', mine ? 'text-pink-100' : 'text-gray-500')}>
                        {mine ? 'Tú' : r}
                      </div>
                      {m.body ? <div className="whitespace-pre-wrap break-words">{m.body}</div> : null}
                      {atts.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {atts.map((a, idx) => {
                            const ct = String(a?.contentType || '').toLowerCase();
                            const isImg = ct.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(String(a?.url || ''));
                            const label = String(a?.name || 'Adjunto');
                            return (
                              <a
                                key={`${m.id}-att-${idx}`}
                                href={String(a?.url || '#')}
                                target="_blank"
                                rel="noreferrer"
                                className={classNames(
                                  'block overflow-hidden rounded-xl ring-1 hover:opacity-90',
                                  mine ? 'ring-white/20 bg-white/10' : 'ring-black/5 bg-gray-50',
                                )}
                              >
                                {isImg ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={String(a?.url || '')} alt={label} className="h-28 w-full object-cover" />
                                ) : (
                                  <div className={classNames('px-3 py-2 text-xs font-semibold', mine ? 'text-white' : 'text-gray-900')}>
                                    {label}
                                  </div>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                      <div className={classNames('mt-1 text-[11px]', mine ? 'text-pink-100' : 'text-gray-500')}>{formatDateTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {pending.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((p, idx) => (
              <button
                key={`pending-${idx}`}
                type="button"
                onClick={() => setPending((prev) => prev.filter((_, i) => i !== idx))}
                className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-semibold text-brand-emerald ring-1 ring-pink-100 hover:opacity-90"
              >
                {String(p?.name || 'Adjunto')} ×
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={orderStatus === 'pending_payment' ? 'El chat estará disponible cuando se acredite el pago' : 'Escribe… (sin links ni teléfonos)'}
              disabled={orderStatus === 'pending_payment'}
              className="min-h-[62px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {!canSend && input.trim().length > 0 ? (
              <div className="mt-1 text-[11px] text-gray-500">No se permiten teléfonos ni enlaces.</div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className={`rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 ${
              orderStatus === 'pending_payment' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}>
              📎
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                disabled={isUploading || pending.length >= 4 || orderStatus === 'pending_payment'}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadOne(f);
                }}
              />
            </label>
            <label className={`rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 ${
              orderStatus === 'pending_payment' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}>
              📷
              <input
                type="file"
                className="hidden"
                accept="image/*"
                capture="environment"
                disabled={isUploading || pending.length >= 4 || orderStatus === 'pending_payment'}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void uploadOne(f);
                }}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend || isSending || isUploading}
            className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
          >
            {isSending ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

