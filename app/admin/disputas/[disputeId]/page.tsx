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

function formatMoney(v: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

type ResolveDecision =
  | 'release'
  | 'refund'
  | 'close'
  | 'assign_return_tracking'
  | 'assign_guide_charged_buyer'
  | 'assign_guide_charged_seller'
  | 'keep_money_seller'
  | 'partial_refund_seller'
  | 'partial_refund_buyer'
  | 'partial_refund_split'
  | 'refund_buyer_minus_fees'
  | 'refund_seller_minus_fees'
  | 'delete_operation';

export default function AdminDisputeChatPage() {
  const p = useParams<{ disputeId: string }>();
  const disputeId = String(p?.disputeId || '').trim();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [orderId, setOrderId] = useState<string>('');
  const [status, setStatus] = useState<string>('open');
  const [buyerName, setBuyerName] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveDecision, setResolveDecision] = useState<ResolveDecision>('release');
  const [resolveNote, setResolveNote] = useState('');
  const [returnTracking, setReturnTracking] = useState('');
  const [guideCost, setGuideCost] = useState<string>('');
  const [guideAttachment, setGuideAttachment] = useState<{ url: string; name: string } | null>(null);
  const [isGuideUploading, setIsGuideUploading] = useState(false);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [adminNameConfirm, setAdminNameConfirm] = useState('');
  const [orderDetails, setOrderDetails] = useState<{
    subtotal: number;
    shipping_fee: number;
    commission_fee: number;
    total: number;
    available_buyer: number;
    available_seller: number;
    refund_minus_fees: number;
  } | null>(null);
  const [returnGuide, setReturnGuide] = useState<{ url: string | null; tracking: string | null; charged_to: string | null } | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [disputeCreatedAt, setDisputeCreatedAt] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    const t = input.trim();
    if (!t && pending.length === 0) return false;
    if (t.length > 1200) return false;
    return true;
  }, [input, pending.length]);

  const load = async (isInitial = false) => {
    if (isInitial) {
      setError(null);
      setIsLoading(true);
    }
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        if (isInitial) setIsLoading(false);
        window.location.href = `/?auth=1&returnTo=${encodeURIComponent(`/admin/disputas/${disputeId}`)}`;
        return;
      }
      
      console.log('[DISPUTE CHAT] Cargando mensajes para disputa:', disputeId);
      
      const res = await fetch(`/api/disputes/messages?disputeId=${encodeURIComponent(disputeId)}&limit=500&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      const json = await res.json().catch((parseErr) => {
        console.error('[DISPUTE CHAT] Error al parsear respuesta:', parseErr);
        return { error: 'Error al procesar respuesta del servidor' };
      });
      
      console.log('[DISPUTE CHAT] Respuesta del servidor:', {
        ok: res.ok,
        status: res.status,
        hasMessages: Array.isArray(json?.messages),
        messageCount: Array.isArray(json?.messages) ? json.messages.length : 0,
        error: json?.error,
      });
      
      if (!res.ok) {
        const errorMsg = json?.error || `Error ${res.status}: No se pudo cargar la disputa.`;
        console.error('[DISPUTE CHAT] Error del servidor:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!json?.viewer?.is_admin) {
        throw new Error('No autorizado (admin requerido).');
      }
      
      const newMessages = (json?.messages ?? []) as Msg[];
      console.log('[DISPUTE CHAT] Mensajes recibidos:', newMessages.length);
      
      // Actualizar mensajes solo si hay cambios
      setMessages((prev) => {
        if (prev.length !== newMessages.length) return newMessages;
        const prevIds = new Set(prev.map((m) => m.id));
        const hasNew = newMessages.some((m) => !prevIds.has(m.id));
        return hasNew ? newMessages : prev;
      });
      
      const newOrderId = String(json?.dispute?.order_id || '');
      const newStatus = String(json?.dispute?.status || 'open');
      const newCreatedAt = String(json?.dispute?.created_at || '');
      
      console.log('[DISPUTE CHAT] Actualizando estado de disputa:', {
        orderId: newOrderId,
        status: newStatus,
        created_at: newCreatedAt,
        previousStatus: status,
        statusChanged: newStatus !== status,
      });
      
      setOrderId(newOrderId);
      setStatus(newStatus);
      setDisputeCreatedAt(newCreatedAt);
      setBuyerName(String(json?.dispute?.buyer_name ?? '').trim());
      setSellerName(String(json?.dispute?.seller_name ?? '').trim());
      const od = json?.dispute?.order_details;
      setOrderDetails(
        od && typeof od === 'object'
          ? {
              subtotal: Number(od.subtotal) || 0,
              shipping_fee: Number(od.shipping_fee) || 0,
              commission_fee: Number(od.commission_fee) || 0,
              total: Number(od.total) || 0,
              available_buyer: Number(od.available_buyer) || 0,
              available_seller: Number(od.available_seller) || 0,
              refund_minus_fees: Number(od.refund_minus_fees) || 0,
            }
          : null,
      );
      const rg = json?.dispute?.return_guide;
      setReturnGuide(
        rg && (rg.url || rg.tracking)
          ? { url: rg.url || null, tracking: rg.tracking || null, charged_to: rg.charged_to || null }
          : null,
      );

      // Marcar como leído (best-effort, solo en carga inicial, no bloqueante)
      if (isInitial) {
        fetch('/api/disputes/read', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          cache: 'no-store',
          body: JSON.stringify({ disputeId }),
        }).catch((readErr) => {
          console.warn('[DISPUTE CHAT] Error al marcar como leído (no crítico):', readErr);
        });
      }
    } catch (e: unknown) {
      console.error('[DISPUTE CHAT] Error completo:', e);
      const errorMessage = e instanceof Error ? e.message : 'No se pudo cargar la disputa.';
      if (isInitial) {
        setMessages([]);
        setError(errorMessage);
      } else {
        // En recargas no iniciales, solo loguear el error pero no mostrar
        console.warn('[DISPUTE CHAT] Error en recarga (no crítico):', errorMessage);
      }
    } finally {
      if (isInitial) {
        setIsLoading(false);
        console.log('[DISPUTE CHAT] Carga inicial completada');
      }
    }
  };

  useEffect(() => {
    if (!disputeId) {
      setIsLoading(false);
      return;
    }
    
    // Cargar mensajes inicialmente
    void load(true);
    
    // Configurar recarga periódica cada 6 segundos (sin mostrar loading)
    const interval = window.setInterval(() => {
      if (disputeId) {
        void load(false);
      }
    }, 6000);
    
    // Actualizar tiempo actual cada segundo para el contador
    const timeInterval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => {
      window.clearInterval(interval);
      window.clearInterval(timeInterval);
    };
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

  const uploadGuide = async (file: File) => {
    setError(null);
    setIsGuideUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const fd = new FormData();
      fd.append('disputeId', disputeId);
      fd.append('file', file);
      const res = await fetch('/api/disputes/upload', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo subir la guía.');
      const att = json?.attachment as { url?: string; name?: string } | undefined;
      if (att?.url) setGuideAttachment({ url: att.url, name: att.name || 'Guía' });
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir la guía.');
    } finally {
      setIsGuideUploading(false);
    }
  };

  const send = async () => {
    setError(null);
    setSuccess(null);
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
      if (saved?.id) {
        console.log('[DISPUTE CHAT] Mensaje guardado exitosamente:', saved.id);
        setMessages((prev) => [...prev, saved]);
        setInput('');
        setPending([]);
        
        // Recargar mensajes después de un breve delay para asegurar sincronización
        setTimeout(() => {
          void load(false);
        }, 500);
      } else {
        console.warn('[DISPUTE CHAT] Mensaje enviado pero no se recibió confirmación');
        // Recargar mensajes para obtener el mensaje recién enviado
        setTimeout(() => {
          void load(false);
        }, 500);
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const resolve = async () => {
    setError(null);
    setSuccess(null);
    setIsResolving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const payload: Record<string, unknown> = {
        disputeId,
        decision: resolveDecision,
        note: resolveNote,
        return_tracking:
          resolveDecision === 'assign_return_tracking' ||
          resolveDecision === 'assign_guide_charged_buyer' ||
          resolveDecision === 'assign_guide_charged_seller'
            ? returnTracking
            : undefined,
        return_guide_url:
          resolveDecision === 'assign_guide_charged_buyer' || resolveDecision === 'assign_guide_charged_seller'
            ? guideAttachment?.url
            : undefined,
        return_guide_cost:
          resolveDecision === 'assign_guide_charged_buyer' || resolveDecision === 'assign_guide_charged_seller'
            ? Math.max(0, Number.parseFloat(String(guideCost).replace(/,/g, '.')) || 0)
            : undefined,
      };
      if (
        resolveDecision === 'partial_refund_seller' ||
        resolveDecision === 'partial_refund_buyer' ||
        resolveDecision === 'partial_refund_split'
      ) {
        const amt = Math.max(0, Number.parseFloat(String(partialAmount).replace(/,/g, '.')) || 0);
        payload.partial_amount = amt;
      }
      const needsName = [
        'partial_refund_seller',
        'partial_refund_buyer',
        'refund_buyer_minus_fees',
        'refund_seller_minus_fees',
        'assign_guide_charged_buyer',
        'assign_guide_charged_seller',
        'delete_operation',
      ].includes(resolveDecision);
      if (needsName) payload.admin_name_confirm = adminNameConfirm.trim();

      console.log('[DISPUTAS] Enviando resolución:', { disputeId, decision: resolveDecision, payload });
      
      const res = await fetch(`/api/admin/disputes/resolve?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      
      console.log('[DISPUTAS] Respuesta recibida:', { status: res.status, ok: res.ok });
      
      const json = await res.json().catch((parseErr) => {
        console.error('[DISPUTAS] Error parseando JSON:', parseErr);
        return { error: 'Error en la respuesta del servidor' };
      });
      
      console.log('[DISPUTAS] JSON respuesta:', json);
      
      if (!res.ok) {
        const errorMsg = json?.error || `No se pudo resolver la disputa (${res.status}).`;
        console.error('[DISPUTAS] Error del servidor:', { status: res.status, error: errorMsg, json });
        throw new Error(errorMsg);
      }
      
      if (!json?.ok) {
        console.error('[DISPUTAS] Respuesta no exitosa:', json);
        throw new Error(json?.error || 'No se pudo resolver la disputa.');
      }
      
      console.log('[DISPUTAS] ✅ Disputa resuelta exitosamente:', { 
        disputeId, 
        status: json?.status, 
        decision: json?.decision,
        orderUpdateError: json?.orderUpdateError,
      });
      
      // Mostrar advertencia si hubo error actualizando la orden
      if (json?.orderUpdateError) {
        setError(`Disputa resuelta, pero hubo un problema actualizando la orden: ${json.orderUpdateError}. Verifica el estado de la orden manualmente.`);
      } else {
        setSuccess('Disputa resuelta exitosamente.');
      }

      if (json?.status === 'deleted') {
        setSuccess('Operación eliminada correctamente. Redirigiendo...');
        setTimeout(() => {
          window.location.href = '/admin/disputas';
        }, 1500);
        return;
      }
      
      setResolveOpen(false);
      setResolveNote('');
      setReturnTracking('');
      setGuideCost('');
      setGuideAttachment(null);
      setPartialAmount('');
      setAdminNameConfirm('');
      
      // Recargar después de un pequeño delay para asegurar que los cambios persistan
      setTimeout(() => {
        void load();
      }, 500);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo resolver la disputa.');
    } finally {
      setIsResolving(false);
    }
  };

  const needsAdminName = [
    'partial_refund_seller',
    'partial_refund_buyer',
    'partial_refund_split',
    'refund_buyer_minus_fees',
    'refund_seller_minus_fees',
    'assign_guide_charged_buyer',
    'assign_guide_charged_seller',
    'delete_operation',
  ].includes(resolveDecision);
  const partialAmtNum = Math.max(0, Number.parseFloat(String(partialAmount).replace(/,/g, '.')) || 0);
  const availableSeller = orderDetails?.available_seller ?? 0;
  const availableBuyer = orderDetails?.available_buyer ?? 0;
  const refundMinusFees = orderDetails?.refund_minus_fees ?? 0;
  const partialSellerOk =
    resolveDecision !== 'partial_refund_seller' || (partialAmtNum > 0 && partialAmtNum <= availableSeller);
  const partialBuyerOk =
    resolveDecision !== 'partial_refund_buyer' || (partialAmtNum > 0 && partialAmtNum <= availableBuyer);
  const partialSplitOk =
    resolveDecision !== 'partial_refund_split' ||
    (partialAmtNum > 0 && partialAmtNum <= availableBuyer && partialAmtNum <= availableSeller);
  const adminNameOk = !needsAdminName || adminNameConfirm.trim().length > 0;
  const guideDecisions = ['assign_guide_charged_buyer', 'assign_guide_charged_seller'];
  const guideCostNum = Math.max(0, Number.parseFloat(String(guideCost).replace(/,/g, '.')) || 0);
  const guideOk =
    !guideDecisions.includes(resolveDecision) ||
    (Boolean(guideAttachment?.url) && returnTracking.trim().length > 0 && guideCostNum > 0);
  const splitBuyerRefund = resolveDecision === 'partial_refund_split' ? Math.min(partialAmtNum, availableBuyer) : 0;
  const splitSellerNet =
    resolveDecision === 'partial_refund_split' ? Math.max(0, availableSeller - splitBuyerRefund) : 0;
  const canConfirm =
    !isResolving &&
    (resolveDecision !== 'assign_return_tracking' || returnTracking.trim().length > 0) &&
    guideOk &&
    partialSellerOk &&
    partialBuyerOk &&
    partialSplitOk &&
    adminNameOk;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-gray-900">Admin · Disputa</div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <span>ID: {disputeId.slice(0, 8)}…</span>
                <button
                  onClick={() => copyToClipboard(disputeId, 'dispute')}
                  className="hover:text-brand-emerald"
                  title="Copiar ID Disputa"
                >
                  {copiedId === 'dispute' ? '✅' : '📋'}
                </button>
              </div>
              {orderId && (
                <div className="flex items-center gap-1">
                  <span>Orden: {orderId.slice(0, 8)}…</span>
                  <button
                    onClick={() => copyToClipboard(orderId, 'order')}
                    className="hover:text-brand-emerald"
                    title="Copiar ID Orden"
                  >
                    {copiedId === 'order' ? '✅' : '📋'}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>·</span>
                <span>{status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'open' ? (
              <button
                type="button"
                onClick={() => {
                  console.log('[DISPUTE] Abriendo modal de resolución...');
                  setResolveOpen(true);
                }}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800"
                title="Resolver disputa"
              >
                Resolver
              </button>
            ) : (
              <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500">
                {status === 'resolved' ? 'Resuelta' : status === 'closed' ? 'Cerrada' : 'Finalizada'}
              </div>
            )}
            <Link href="/admin/disputas" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>
        ) : null}

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
                Costo: {formatMoney((returnGuide as any).cost)} MXN
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
                  const atts = normalizeAttachments((m as any)?.attachments);
                  const role = String((m as any)?.sender_role || '').toLowerCase();
                  const label =
                    role === 'admin'
                      ? 'Soporte'
                      : role === 'buyer'
                        ? buyerName ? `Comprador · ${buyerName}` : 'Comprador'
                        : role === 'seller'
                          ? sellerName ? `Vendedor · ${sellerName}` : 'Vendedor'
                          : roleLabel((m as any)?.sender_role);
                  const bubble = role === 'admin' ? 'bg-white text-gray-900 ring-amber-200' : 'bg-white text-gray-900 ring-black/5';
                  return (
                    <div key={m.id} className="flex justify-start">
                      <div className={classNames('max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1', bubble)}>
                        <div className="mb-1 text-[11px] font-semibold text-gray-500">{label}</div>
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
                                  className="block overflow-hidden rounded-xl bg-gray-50 ring-1 ring-black/5 hover:opacity-90"
                                >
                                  {isImg ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={String(a?.url || '')} alt={label} className="h-36 w-full object-cover" />
                                  ) : (
                                    <div className="px-3 py-2 text-xs font-semibold text-gray-900">{label}</div>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="mt-1 text-[11px] text-gray-500">{formatDateTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-black/5 p-4">
            {pending.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
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

            {/* Respuestas rápidas de soporte */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                'Gracias por contactarnos. Estamos revisando tu caso y te respondemos a la brevedad.',
                '¿Podrías compartir 2-3 fotos claras del producto y del empaque?',
                'Para agilizar: confirma si deseas devolución o reemplazo del producto.',
                'Asignaremos una guía de devolución. Empaca el producto tal como lo recibiste.',
                'Con gusto ayudamos. Evitemos compartir teléfonos o enlaces en el chat.',
              ].map((txt, i) => (
                <button
                  key={`qr-${i}`}
                  type="button"
                  onClick={() => setInput((prev) => (prev ? `${prev}\n${txt}` : txt))}
                  className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-200"
                  title={txt}
                >
                  {i === 0 ? 'Recibido ✅' : i === 1 ? 'Pedir fotos 📷' : i === 2 ? '¿Devolución o reemplazo?' : i === 3 ? 'Guía de devolución' : 'Reglas del chat'}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe como soporte…"
                  className="min-h-[70px] w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
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
          </div>
        </div>
      </main>

      {resolveOpen ? (
        <div 
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log('[DISPUTE] Cerrando modal al hacer clic fuera...');
              setResolveOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
            <div className="border-b border-black/5 px-5 py-4">
              <div className="text-sm font-extrabold text-gray-900">Resolver disputa</div>
              <div className="mt-1 text-xs text-gray-600">Elige la decisión y escribe una nota (opcional).</div>
              {disputeCreatedAt ? (() => {
                const createdAt = new Date(disputeCreatedAt).getTime();
                const deadline = createdAt + 72 * 60 * 60 * 1000; // 72 horas
                const diff = deadline - currentTime;
                const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
                const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secondsRemaining = Math.floor((diff % (1000 * 60)) / 1000);
                const expired = diff <= 0;
                const canUseNewDecisions = expired;
                
                if (!expired) {
                  return (
                    <div className={`mt-3 rounded-xl border px-3 py-2 ${
                      hoursRemaining < 12
                        ? 'border-red-300 bg-red-50'
                        : hoursRemaining < 24
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-amber-300 bg-amber-50'
                    }`}>
                      <div className="flex items-start gap-2">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={hoursRemaining < 12 ? '#dc2626' : hoursRemaining < 24 ? '#ea580c' : '#d97706'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mt-0.5 shrink-0"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <div className="flex-1">
                          <div className={`text-xs font-extrabold ${
                            hoursRemaining < 12
                              ? 'text-red-900'
                              : hoursRemaining < 24
                                ? 'text-orange-900'
                                : 'text-amber-900'
                          }`}>
                            Tiempo restante: {hoursRemaining}h {minutesRemaining}m {secondsRemaining}s
                          </div>
                          <div className={`mt-0.5 text-[10px] ${
                            hoursRemaining < 12
                              ? 'text-red-800'
                              : hoursRemaining < 24
                                ? 'text-orange-800'
                                : 'text-amber-800'
                          }`}>
                            Después de 72 horas, podrás asignar guía de devolución (reembolso al recibir) o mantener dinero al vendedor. Las guías con cargo al comprador/vendedor están siempre disponibles.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 rounded-xl border border-green-300 bg-green-50 px-3 py-2">
                    <div className="text-xs font-extrabold text-green-900">
                      ✓ Puedes tomar una resolución definitiva
                    </div>
                    <div className="mt-0.5 text-[10px] text-green-800">
                      Han pasado 72 horas. Puedes asignar guía de devolución (reembolso al recibir) o mantener el dinero al vendedor.
                    </div>
                  </div>
                );
              })() : null}
            </div>
            <div className="px-5 py-4">
              <div className="text-xs font-semibold text-gray-900">Decisión</div>
              <select
                value={resolveDecision}
                onChange={(e) => {
                  const v = e.target.value as ResolveDecision;
                  setResolveDecision(v);
                  if (v !== 'assign_return_tracking' && v !== 'assign_guide_charged_buyer' && v !== 'assign_guide_charged_seller') {
                    setReturnTracking('');
                    setGuideCost('');
                    setGuideAttachment(null);
                  }
                  setPartialAmount('');
                }}
                className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
              >
                <option value="release">Liberar pago al vendedor</option>
                <option value="refund">Reembolsar al comprador</option>
                <option value="close">Cerrar disputa (sin decisión)</option>
                <option value="partial_refund_seller">Devolver pago parcial al vendedor</option>
                <option value="partial_refund_buyer">Devolver pago parcial al comprador</option>
                <option value="partial_refund_split">Reembolso parcial al comprador y pago parcial al vendedor</option>
                <option value="refund_buyer_minus_fees">Devolver dinero descontando comisión y envío al comprador</option>
                <option value="refund_seller_minus_fees">Devolver dinero descontando comisión y envío al vendedor</option>
                <option value="assign_guide_charged_buyer">Asignar guía con cargo al comprador</option>
                <option value="assign_guide_charged_seller">Asignar guía con cargo al vendedor</option>
                <option value="delete_operation">⚠️ Eliminar operación (Cancelar y borrar todo)</option>
                {disputeCreatedAt && (Date.now() - new Date(disputeCreatedAt).getTime()) >= 72 * 60 * 60 * 1000 ? (
                  <>
                    <option value="assign_return_tracking">Asignar guía de devolución (reembolso después de recibir)</option>
                    <option value="keep_money_seller">Mantener dinero al vendedor (por trayectoria)</option>
                  </>
                ) : null}
              </select>
              {resolveDecision === 'partial_refund_seller' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                    <div className="text-[10px] font-semibold text-green-800">Disponible para vendedor</div>
                    <div className="text-sm font-extrabold text-green-900">{formatMoney(availableSeller)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Monto a devolver al vendedor ($) *</div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                  </div>
                </div>
              ) : null}
              {resolveDecision === 'partial_refund_buyer' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                    <div className="text-[10px] font-semibold text-green-800">Disponible para reembolso al comprador</div>
                    <div className="text-sm font-extrabold text-green-900">{formatMoney(availableBuyer)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Monto a devolver al comprador ($) *</div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                  </div>
                </div>
              ) : null}
              {resolveDecision === 'partial_refund_split' ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                      <div className="text-[10px] font-semibold text-green-800">Disponible para vendedor</div>
                      <div className="text-sm font-extrabold text-green-900">{formatMoney(availableSeller)}</div>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                      <div className="text-[10px] font-semibold text-green-800">Disponible para reembolso al comprador</div>
                      <div className="text-sm font-extrabold text-green-900">{formatMoney(availableBuyer)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">
                      Diferencia a devolver al comprador ($) *
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder="Ej: 20.00 si bajan de 249 a 229"
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                    {splitBuyerRefund > 0 || splitSellerNet > 0 ? (
                      <div className="mt-3 grid gap-2 rounded-2xl bg-gray-50 p-3 text-[11px] text-gray-800 ring-1 ring-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">Reembolso al comprador</span>
                          <span className="font-extrabold text-green-800">{formatMoney(splitBuyerRefund)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">Pago parcial al vendedor</span>
                          <span className="font-extrabold text-blue-800">{formatMoney(splitSellerNet)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-600">
                          Esta simulación refleja cómo quedará el saldo si confirmas esta resolución.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {(resolveDecision === 'refund_buyer_minus_fees' || resolveDecision === 'refund_seller_minus_fees') ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-amber-800">
                    {resolveDecision === 'refund_buyer_minus_fees' ? 'Se reembolsará al comprador' : 'Se devolverá al vendedor'} (total − comisión − envío)
                  </div>
                  <div className="text-sm font-extrabold text-amber-900">{formatMoney(refundMinusFees)}</div>
                </div>
              ) : null}
              {resolveDecision === 'delete_operation' ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-red-800">⚠️ PELIGRO</div>
                  <div className="text-sm font-extrabold text-red-900">Esta acción eliminará la venta y la compra permanentemente.</div>
                  <div className="mt-1 text-xs text-red-800">
                    Se borrarán: orden, ítems, disputa, mensajes y transacciones.
                    <br/>
                    Se restaurará el saldo del comprador (si aplica) y se anularán comisiones.
                    <br/>
                    No aparecerá en estadísticas ni historiales.
                  </div>
                </div>
              ) : null}
              {resolveDecision === 'assign_return_tracking' ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-900">Código de rastreo de devolución *</div>
                  <input
                    type="text"
                    value={returnTracking}
                    onChange={(e) => setReturnTracking(e.target.value)}
                    placeholder="Ej: 7158588384-770721270743"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                  <div className="mt-1 text-[10px] text-gray-500">
                    El comprador debe devolver el producto usando esta guía. Una vez recibido, se procesará el reembolso.
                  </div>
                </div>
              ) : null}
              {(resolveDecision === 'assign_guide_charged_buyer' || resolveDecision === 'assign_guide_charged_seller') ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Subir guía de devolución *</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-200 disabled:opacity-50">
                        {isGuideUploading ? 'Subiendo…' : '📤 Subir PDF o imagen'}
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf,image/*"
                          disabled={isGuideUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void uploadGuide(f);
                          }}
                        />
                      </label>
                      {guideAttachment ? (
                        <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          ✓ {guideAttachment.name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Número de rastreo *</div>
                    <input
                      type="text"
                      value={returnTracking}
                      onChange={(e) => setReturnTracking(e.target.value)}
                      placeholder="Ej: 7158588384-770721270743"
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                    <div className="mt-1 text-[10px] text-gray-500">
                      La guía y el rastreo estarán disponibles para descargar en el panel de disputa (comprador y vendedor).
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">Costo de la guía (MXN) *</div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={guideCost}
                      onChange={(e) => setGuideCost(e.target.value.replace(/[^0-9.,]/g, ''))}
                      placeholder="Ej: 150.00"
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                    <div className="mt-1 text-[10px] text-gray-500">
                      Este monto se descontará del reembolso (comprador) o del pago al vendedor, según corresponda.
                    </div>
                  </div>
                </div>
              ) : null}
              {needsAdminName ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-900">
                    {(resolveDecision === 'assign_guide_charged_buyer' || resolveDecision === 'assign_guide_charged_seller')
                      ? 'Nombre del asesor que resolvió *'
                      : 'Tu nombre de administrador *'}
                  </div>
                  <input
                    type="text"
                    value={adminNameConfirm}
                    onChange={(e) => setAdminNameConfirm(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                  <div className="mt-1 text-[10px] text-gray-500">
                    Escribe tu nombre tal como aparece en tu perfil para confirmar esta resolución.
                  </div>
                </div>
              ) : null}
              <div className="mt-4 text-xs font-semibold text-gray-900">Nota (opcional)</div>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Explica la resolución para ambas partes."
                className="mt-2 h-28 w-full resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setResolveOpen(false);
                  setPartialAmount('');
                  setAdminNameConfirm('');
                  setGuideAttachment(null);
                  setReturnTracking('');
                  setGuideCost('');
                }}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                disabled={isResolving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void resolve()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
                disabled={!canConfirm}
              >
                {isResolving ? 'Resolviendo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

