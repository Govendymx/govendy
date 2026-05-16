'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { SellerDisplay } from '@/components/SellerDisplay';

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDate(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function getStatusLabel(status: string) {
  const s = status.toLowerCase();
  if (s === 'open') return 'En revisión';
  if (s === 'resolved') return 'Resuelta';
  if (s === 'closed') return 'Cerrada';
  return status;
}

function getStatusColor(status: string) {
  const s = status.toLowerCase();
  if (s === 'open') return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  if (s === 'resolved') return 'bg-green-100 text-green-800 ring-1 ring-green-200';
  if (s === 'closed') return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200';
  return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200';
}

function getDecisionLabel(decision: string | null) {
  if (!decision) return null;
  const d = decision.toLowerCase();
  if (d === 'release') return 'Liberar pago al vendedor';
  if (d === 'refund') return 'Reembolso al comprador';
  if (d === 'partial') return 'Reembolso parcial';
  if (d === 'close') return 'Cerrar sin acción';
  return decision;
}

export default function DevolucionSeguimientoPage() {
  const p = useParams<{ disputeId: string }>();
  const disputeId = String(p?.disputeId || '').trim();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispute, setDispute] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [sellerName, setSellerName] = useState<string>('Vendedor');
  const [sellerId, setSellerId] = useState<string>('');
  const [sellerState, setSellerState] = useState<string | null>(null);
  const [sellerCity, setSellerCity] = useState<string | null>(null);
  const [sellerOperationsCount, setSellerOperationsCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = `/login?returnTo=${encodeURIComponent(`/dashboard/devoluciones/${disputeId}`)}`;
          return;
        }

        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error('Auth session missing');

        // Cargar disputa
        const disputeRes = await fetch(`/api/disputes/get?disputeId=${encodeURIComponent(disputeId)}&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const disputeJson = await disputeRes.json().catch(() => ({}));
        if (!disputeRes.ok) throw new Error(disputeJson?.error || 'No se pudo cargar la devolución.');
        
        const disputeData = disputeJson?.dispute;
        if (!disputeData) throw new Error('Devolución no encontrada.');
        setDispute(disputeData);

        // Verificar que el usuario es el comprador
        if (String(disputeData.buyer_id) !== userData.user.id) {
          throw new Error('No tienes permiso para ver esta devolución.');
        }

        // Cargar orden
        const orderId = String(disputeData.order_id || '').trim();
        if (orderId) {
          const { data: orderData } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();
          if (orderData) setOrder(orderData);
        }

        // Cargar mensajes
        const messagesRes = await fetch(`/api/disputes/messages?disputeId=${encodeURIComponent(disputeId)}&limit=400&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const messagesJson = await messagesRes.json().catch(() => ({}));
        if (messagesRes.ok) {
          setMessages((messagesJson?.messages ?? []) as any[]);
        }

        // Cargar nombre y ubicación del vendedor
        const sid = String(disputeData.seller_id || '').trim();
        if (sid) {
          setSellerId(sid);
          let res: any = await supabase.from('profiles').select('full_name, nickname, username, state, city').eq('id', sid).maybeSingle();
          if (res?.error && (String((res.error as any)?.code || '') === '42703' || String((res.error as any)?.message || '').toLowerCase().includes('column'))) {
            res = await supabase.from('profiles').select('full_name, nickname, username').eq('id', sid).maybeSingle();
          }
          const sellerData = res?.data;
          if (sellerData) {
            const name = String(sellerData.full_name || sellerData.nickname || sellerData.username || 'Vendedor').trim();
            setSellerName(name || 'Vendedor');
            const st = typeof (sellerData as any).state === 'string' ? String((sellerData as any).state).trim() || null : null;
            const ct = typeof (sellerData as any).city === 'string' ? String((sellerData as any).city).trim() || null : null;
            setSellerState(st);
            setSellerCity(ct);
          }
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la devolución.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [disputeId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-gray-900">Seguimiento de devolución</div>
                <div className="text-xs text-gray-500">Cargando…</div>
              </div>
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Cargando información de la devolución…</div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-gray-900">Seguimiento de devolución</div>
              </div>
            </div>
            <Link href="/dashboard/compras" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver a compras
            </Link>
          </div>
        </div>
        <main className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-bold text-red-800">Error</div>
            <div className="mt-2 text-sm text-gray-600">{error || 'Devolución no encontrada.'}</div>
            <div className="mt-4">
              <Link href="/dashboard/compras" className="inline-flex rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Volver a compras
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const status = String(dispute.status || 'open').trim();
  const reasonCode = String(dispute.reason_code || 'not_received').trim();
  const reasonText = String(dispute.reason_text || '').trim();
  const adminDecision = String(dispute.admin_decision || '').trim() || null;
  const adminNote = String(dispute.admin_note || '').trim() || null;

  const reasonLabels: Record<string, string> = {
    not_received: 'No recibí el producto',
    damaged: 'Producto dañado',
    not_as_described: 'No coincide con la descripción',
    missing_items: 'Faltan artículos',
    other: 'Otro motivo',
  };

  // Timeline de estados
  const timelineSteps = [
    {
      label: 'Devolución iniciada',
      date: dispute.created_at,
      completed: true,
      icon: '📝',
    },
    {
      label: 'En revisión',
      date: dispute.created_at,
      completed: status === 'open',
      active: status === 'open',
      icon: '🔍',
    },
    {
      label: status === 'resolved' ? 'Resuelta' : status === 'closed' ? 'Cerrada' : 'Pendiente de resolución',
      date: status !== 'open' ? dispute.updated_at : null,
      completed: status === 'resolved' || status === 'closed',
      active: false,
      icon: status === 'resolved' ? '✅' : status === 'closed' ? '🔒' : '⏳',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Seguimiento de devolución</div>
              <div className="text-xs text-gray-500">ID: {disputeId.slice(0, 8)}…</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard/compras" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver a compras
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Estado actual */}
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-600">Estado actual</div>
              <div className="mt-1 text-2xl font-extrabold text-gray-900">{getStatusLabel(status)}</div>
            </div>
            <div className={`rounded-xl px-4 py-2 ${getStatusColor(status)}`}>
              <div className="text-sm font-bold">{getStatusLabel(status)}</div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-lg font-bold text-gray-900 mb-4">Seguimiento</div>
          <div className="space-y-4">
            {timelineSteps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                  step.completed 
                    ? 'bg-green-100 text-green-700' 
                    : step.active 
                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${
                    step.completed || step.active ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </div>
                  {step.date && (
                    <div className="mt-1 text-xs text-gray-500">{formatDateTime(step.date)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Información de la devolución */}
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-lg font-bold text-gray-900 mb-4">Detalles de la devolución</div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-gray-600">Motivo</div>
              <div className="mt-1 text-sm text-gray-900">{reasonLabels[reasonCode] || reasonCode}</div>
            </div>
            {reasonText && (
              <div>
                <div className="text-xs font-semibold text-gray-600">Descripción</div>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{reasonText}</div>
              </div>
            )}
            {order && (
              <div>
                <div className="text-xs font-semibold text-gray-600">Orden</div>
                <div className="mt-1 text-sm text-gray-900">
                  {String(order.id || '').slice(0, 8)}… · {formatMoney(order.total || 0)}
                </div>
              </div>
            )}
            <div>
              {sellerId ? (
                <SellerDisplay
                  sellerId={sellerId}
                  sellerName={sellerName}
                  state={sellerState}
                  city={sellerCity}
                  operationsCount={sellerOperationsCount}
                  size="sm"
                />
              ) : (
                <>
                  <div className="text-xs font-semibold text-gray-600">Vendedor</div>
                  <div className="mt-1 text-sm text-gray-900">{sellerName}</div>
                </>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">Fecha de inicio</div>
              <div className="mt-1 text-sm text-gray-900">{formatDateTime(dispute.created_at)}</div>
            </div>
          </div>
        </div>

        {/* Decisión del administrador */}
        {adminDecision && (
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-bold text-gray-900 mb-4">Decisión</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-600">Resolución</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{getDecisionLabel(adminDecision) || adminDecision}</div>
              </div>
              {adminNote && (
                <div>
                  <div className="text-xs font-semibold text-gray-600">Nota del administrador</div>
                  <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{adminNote}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat de la disputa */}
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-bold text-gray-900">Conversación</div>
            <Link
              href={`/dashboard/disputas/${disputeId}`}
              className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Ver chat completo
            </Link>
          </div>
          {messages.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {messages.slice(-5).map((msg) => (
                <div key={msg.id} className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-gray-700">
                      {msg.sender_role === 'admin' ? 'Soporte' : msg.sender_role === 'buyer' ? 'Tú' : 'Vendedor'}
                    </div>
                    <div className="text-xs text-gray-500">{formatDateTime(msg.created_at)}</div>
                  </div>
                  {msg.body && <div className="text-sm text-gray-900 whitespace-pre-wrap">{msg.body}</div>}
                  {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {msg.attachments.length} archivo(s) adjunto(s)
                    </div>
                  )}
                </div>
              ))}
              {messages.length > 5 && (
                <div className="text-center text-xs text-gray-500">
                  Mostrando los últimos 5 mensajes de {messages.length} totales
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600">Aún no hay mensajes en esta conversación.</div>
          )}
        </div>
      </main>
    </div>
  );
}

function formatMoney(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
