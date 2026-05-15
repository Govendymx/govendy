'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Msg = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
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

export default function DashboardChatPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = String((params as any)?.orderId || '').trim();

  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<{ name: string; logo?: string | null; plan?: string; isVerified?: boolean } | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    const t = input.trim();
    if (!t) return false;
    if (t.length > 800) return false;
    if (looksLikeLink(t) || looksLikePhone(t)) return false;
    return true;
  }, [input]);

  const load = async () => {
    setError(null);
    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!userData.user) {
        window.location.href = '/login';
        return;
      }
      setMyId(userData.user.id);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch(`/api/chat/messages-v2?orderId=${encodeURIComponent(orderId)}&limit=200`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar el chat.');
      setMessages((json?.messages ?? []) as Msg[]);
    } catch (e: unknown) {
      console.error(e);
      setMessages([]);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el chat.');
    }
  };

  const send = async () => {
    setError(null);
    setIsSending(true);
    try {
      const msg = input.trim();
      if (!msg) return;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/chat/messages-v2', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ orderId, message: msg }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar el mensaje.');

      const saved = json?.message as Msg | undefined;
      if (saved?.id) setMessages((prev) => [...prev, saved]);
      setInput('');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        if (!orderId) return;
        await load();
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    const t = window.setInterval(() => void load(), 6000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const fetchSeller = async () => {
      try {
        const { data: order } = await supabase.from('orders').select('seller_id').eq('id', orderId).single();
        if (order?.seller_id) {
          const { data: seller } = await supabase.from('profiles').select('name, store_logo_url, plan_type, is_verified').eq('id', order.seller_id).single();
          if (seller) {
            setSellerInfo({
              name: seller.name || 'Vendedor',
              logo: seller.store_logo_url,
              plan: seller.plan_type,
              isVerified: seller.is_verified,
            });
          }
        }
      } catch (e) {
        console.error('Error fetching seller info:', e);
      }
    };
    void fetchSeller();
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {sellerInfo?.plan === 'pro' && sellerInfo.logo ? (
               <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={sellerInfo.logo} alt={sellerInfo.name} className="h-full w-full object-cover" />
               </div>
            ) : (
              <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            )}
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                {sellerInfo ? sellerInfo.name : 'Chat'}
                {sellerInfo?.isVerified ? (
                  <svg className="h-3 w-3 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                ) : null}
              </div>
              <div className="text-xs text-gray-500">Operación: {orderId ? `${orderId.slice(0, 8)}…` : '—'}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
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
              <div className="text-lg font-bold text-gray-900">Mensajes</div>
              <div className="mt-1 text-xs text-gray-600">
                Por seguridad, aquí <span className="font-semibold">no se permiten teléfonos ni enlaces</span>.
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
              <div className="text-sm text-gray-600">Aún no hay mensajes.</div>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => {
                  const mine = myId && m.sender_id === myId;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${
                          mine ? 'bg-brand-emerald text-white ring-emerald-200' : 'bg-white text-gray-900 ring-black/5'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`mt-1 text-[11px] ${mine ? 'text-emerald-100' : 'text-gray-500'}`}>{formatDateTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="w-full">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje…"
                className="min-h-[80px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
              />
              {!canSend && input.trim().length > 0 ? (
                <div className="mt-1 text-[11px] text-gray-500">
                  No se permiten teléfonos, enlaces o mensajes muy largos.
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!canSend || isSending}
              className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60"
            >
              {isSending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

