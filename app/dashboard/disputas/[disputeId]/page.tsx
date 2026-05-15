'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Attachment = { url: string; name?: string; contentType?: string | null; size?: number | null };
type Msg = {
  id: string;
  dispute_id: string;
  sender_id: string;
  sender_role?: string | null;
  body?: string | null;
  attachments?: Attachment[] | any;
  created_at: string;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

function normalizeAttachments(raw: any): Attachment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Attachment[];
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
  if (r === 'admin') return 'Soporte';
  if (r === 'buyer') return 'Comprador';
  if (r === 'seller') return 'Vendedor';
  return 'Usuario';
}

export default function DisputeChatPage() {
  const p = useParams<{ disputeId: string }>();
  const disputeId = String(p?.disputeId || '').trim();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string>('user');
  const [orderId, setOrderId] = useState<string>('');
  const [status, setStatus] = useState<string>('open');
  const [adminDecision, setAdminDecision] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [sellerId, setSellerId] = useState<string>('');
  const [returnGuide, setReturnGuide] = useState<{ url: string | null; tracking: string | null; charged_to: string | null } | null>(null);

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    const t = input.trim();
    if (!t && pending.length === 0) return false;
    if (t.length > 1200) return false;
    return true;
  }, [input, pending.length]);

  const load = async (isBackgroundRefresh = false) => {
    setError(null);
    if (!isBackgroundRefresh) setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent(`/dashboard/disputas/${disputeId}`)}`;
        return;
      }
      setMyId(userData.user.id);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch(`/api/disputes/messages?disputeId=${encodeURIComponent(disputeId)}&limit=400&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar la disputa.');
      setMessages((json?.messages ?? []) as Msg[]);
      setViewerRole(String(json?.viewer?.role || 'user'));
      setOrderId(String(json?.dispute?.order_id || ''));
      setStatus(String(json?.dispute?.status || 'open'));
      setAdminDecision(json?.dispute?.admin_decision ? String(json.dispute.admin_decision).trim() : null);
      setAdminNote(json?.dispute?.admin_note ? String(json.dispute.admin_note).trim() : null);
      setBuyerName(String(json?.dispute?.buyer_name ?? '').trim());
      setSellerName(String(json?.dispute?.seller_name ?? '').trim());
      setSellerId(String(json?.dispute?.seller_id ?? '').trim());
      const rg = json?.dispute?.return_guide;
      setReturnGuide(
        rg && (rg.url || rg.tracking)
          ? { url: rg.url || null, tracking: rg.tracking || null, charged_to: rg.charged_to || null }
          : null,
      );

      if (!isBackgroundRefresh) {
        await fetch('/api/disputes/read', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          cache: 'no-store',
          body: JSON.stringify({ disputeId }),
        }).catch(() => null);
      }
    } catch (e: unknown) {
      if (!isBackgroundRefresh) {
        console.error(e);
        setMessages([]);
        setError(e instanceof Error ? e.message : 'No se pudo cargar la disputa.');
      }
    } finally {
      if (!isBackgroundRefresh) setIsLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    void load(false);
    const t = window.setInterval(() => void load(true), 10000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const uploadOne = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const fd = new FormData();
      fd.append('disputeId', disputeId);
      fd.append('file', file);
      const res = await fetch('/api/disputes/upload', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo subir el archivo.');
      const att = json?.attachment as Attachment | undefined;
      if (att?.url) setPending((p) => [...p, att].slice(0, 6));
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const send = async () => {
    setError(null);
    setIsSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/disputes/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ disputeId, message: input.trim(), attachments: pending }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar el mensaje.');
      const saved = json?.message as Msg | undefined;
      if (saved?.id) setMessages((prev) => [...prev, saved]);
      setInput('');
      setPending([]);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-gray-900">Disputa</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {orderId ? `Orden: ${orderId.slice(0, 8)}…` : `ID: ${disputeId.slice(0, 8)}…`} · {status} · {roleLabel(viewerRole)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard/disputas" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {(status === 'resolved' || status === 'closed') ? (() => {
          const getDecisionLabel = (decision: string | null | undefined): string => {
            if (!decision) return 'Resuelta';
            const d = String(decision).toLowerCase();
            if (d === 'release') return 'Pago liberado al vendedor';
            if (d === 'refund') return 'Reembolso al comprador';
            if (d === 'close') return 'Disputa cerrada';
            if (d === 'assign_return_tracking' || d === 'assign_guide_charged_buyer' || d === 'assign_guide_charged_seller') return 'Guía de devolución asignada';
            if (d === 'keep_money_seller') return 'Dinero mantenido al vendedor';
            if (d === 'partial_refund_seller') return 'Reembolso parcial al vendedor';
            if (d === 'partial_refund_buyer') return 'Reembolso parcial al comprador';
            if (d === 'refund_buyer_minus_fees') return 'Reembolso al comprador (menos comisiones)';
            if (d === 'refund_seller_minus_fees') return 'Pago al vendedor (menos comisiones)';
            return decision;
          };
          
          const decisionLabel = getDecisionLabel(adminDecision);
          
          return (
            <div className="mb-4 rounded-2xl border-2 border-green-300 bg-green-50 px-4 py-4">
              <div className="text-base font-extrabold text-green-900">
                Disputa resuelta: {decisionLabel}
              </div>
              {adminNote && (
                <div className="mt-2 text-sm text-green-800">
                  {adminNote}
                </div>
              )}
              <div className="mt-3 text-sm font-semibold text-green-900">
                Esta disputa se finalizó. Agradecemos tu apoyo.
              </div>
            </div>
          );
        })() : null}

        {returnGuide && (returnGuide.url || returnGuide.tracking) ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm font-semibold text-amber-900">Guía de devolución</div>
            {returnGuide.tracking ? (
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-mono font-bold text-amber-900">
                Rastreo: {returnGuide.tracking}
              </span>
            ) : null}
            {returnGuide.url ? (
              <a
                href={returnGuide.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                Descargar guía
              </a>
            ) : null}
            {returnGuide.charged_to ? (
              <span className="text-xs text-amber-800">
                Con cargo al {returnGuide.charged_to === 'buyer' ? 'comprador' : 'vendedor'}
              </span>
            ) : null}
            {(returnGuide as any)?.cost != null && Number((returnGuide as any).cost) > 0 ? (
              <span className="text-xs font-semibold text-amber-900">
                Costo: ${Number((returnGuide as any).cost).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div ref={listRef} className="h-[65vh] overflow-auto bg-gray-50 p-4">
            {isLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-gray-600">Aún no hay mensajes.</div>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => {
                  const mine = myId && m.sender_id === myId;
                  const atts = normalizeAttachments((m as any)?.attachments);
                  const role = String((m as any)?.sender_role || '').toLowerCase();
                  const otherLabel =
                    role === 'admin'
                      ? 'Soporte'
                      : role === 'buyer'
                        ? buyerName ? `Comprador · ${buyerName}` : 'Comprador'
                        : role === 'seller'
                          ? sellerId
                            ? <>Vendido por <Link href={`/perfil/${sellerId}`} className="font-semibold text-brand-orange hover:opacity-90 hover:underline">{sellerName || 'Vendedor'}</Link></>
                            : sellerName ? `Vendedor · ${sellerName}` : 'Vendedor'
                          : roleLabel((m as any)?.sender_role);
                  const bubble = mine
                    ? 'bg-brand-orange text-white ring-pink-200'
                    : role === 'admin'
                      ? 'bg-white text-gray-900 ring-amber-200'
                      : 'bg-white text-gray-900 ring-black/5';
                  return (
                    <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={classNames('max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1', bubble)}>
                        <div className={classNames('mb-1 text-[11px] font-semibold', mine ? 'text-pink-100' : 'text-gray-500')}>{mine ? 'Tú' : otherLabel}</div>
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
                                    <img src={String(a?.url || '')} alt={label} className="h-36 w-full object-cover" />
                                  ) : (
                                    <div className={classNames('px-3 py-2 text-xs font-semibold', mine ? 'text-white' : 'text-gray-900')}>{label}</div>
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

          <div className="border-t border-black/5 p-4">
            {(status === 'resolved' || status === 'closed') ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
                La disputa está cerrada. No puedes enviar más mensajes.
              </div>
            ) : (
              <>
            {pending.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {pending.map((p, idx) => (
                  <button
                    key={`pending-${idx}`}
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-semibold text-brand-orange ring-1 ring-pink-100 hover:opacity-90"
                  >
                    {String(p?.name || 'Adjunto')} ×
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu mensaje… (sin links ni teléfonos)"
                  className="min-h-[70px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
                <div className="mt-1 text-[11px] text-gray-500">Puedes adjuntar fotos (archivo o cámara) o PDF como evidencia.</div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50">
                  📎
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    disabled={isUploading || pending.length >= 6}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void uploadOne(f);
                    }}
                  />
                </label>
                <label className="cursor-pointer rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50">
                  📷
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    disabled={isUploading || pending.length >= 6}
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

