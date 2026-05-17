'use client';

// Vista unificada de operaciones (orden + pago + disputa)

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdminContext } from '@/lib/admin/AdminContext';
import { ContextualNavigation } from '@/components/admin/ContextualNavigation';
import { supabase } from '@/lib/supabase/client';
import { Order, CheckoutSession, Dispute } from '@/lib/types/domain.types';
import Link from 'next/link';
import { CancelOrderModal } from '../components/CancelOrderModal';
import { CopyButton } from '@/components/ui/CopyButton';

function OperationViewContent() {
  const searchParams = useSearchParams();
  const { orders, payments, disputes, refreshAll } = useAdminContext();

  const [showCancelModal, setShowCancelModal] = useState(false);

  const orderId = searchParams?.get('orderId');
  const paymentId = searchParams?.get('paymentId');
  const disputeId = searchParams?.get('disputeId');
  const topupId = searchParams?.get('topupId');

  const [loading, setLoading] = useState(true);
  const [topup, setTopup] = useState<any>(null);

  // Lógica de búsqueda de operaciones memoizada para evitar re-renderizados infinitos
  const { order, payment, dispute } = useMemo(() => {
    let foundOrder: Order | null = null;
    let foundPayment: CheckoutSession | null = null;
    let foundDispute: Dispute | null = null;

    // Buscar orden
    if (orderId) {
      foundOrder = orders.find(o => o.id === orderId) || null;
      if (foundOrder) {
        // Buscar pago relacionado
        foundPayment = payments.find(p => p.order_ids?.includes(foundOrder!.id)) || null;
        // Buscar disputa relacionada
        foundDispute = disputes.find(d => d.order_id === foundOrder!.id) || null;
      }
    }

    // Buscar pago (si no se encontró por orden)
    if (paymentId && !foundPayment) {
      foundPayment = payments.find(p => p.id === paymentId) || null;
      if (foundPayment) {
        // Buscar orden relacionada
        if (foundPayment.order_ids && foundPayment.order_ids.length > 0) {
          foundOrder = orders.find(o => foundPayment!.order_ids!.includes(o.id)) || null;
          if (foundOrder) {
            // Buscar disputa relacionada
            foundDispute = disputes.find(d => d.order_id === foundOrder!.id) || null;
          }
        }
      }
    }

    // Buscar disputa (si no se encontró por orden)
    if (disputeId && !foundDispute) {
      foundDispute = disputes.find(d => d.id === disputeId) || null;
      if (foundDispute) {
        // Buscar orden relacionada
        foundOrder = orders.find(o => o.id === foundDispute!.order_id) || null;
        if (foundOrder) {
          // Buscar pago relacionado
          foundPayment = payments.find(p => p.order_ids?.includes(foundOrder!.id)) || null;
        }
      }
    }

    return { order: foundOrder, payment: foundPayment, dispute: foundDispute };
  }, [orders, payments, disputes, orderId, paymentId, disputeId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        await refreshAll();
      } catch (e) {
        console.error('Error refreshing operations:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => { mounted = false; };
    // Eliminamos orders, payments, disputes de las dependencias para evitar bucle infinito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAll, orderId, paymentId, disputeId]);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-emerald"></div>
      </div>
    );
  }

  if (!order && !payment && !dispute) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
        <div className="text-center py-12">
          <p className="text-gray-600">No se encontró la operación solicitada.</p>
          <Link href="/admin" className="mt-4 inline-block text-brand-emerald hover:underline">
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vista Unificada de Operación</h1>
          <p className="mt-1 text-sm text-gray-600">
            Información completa de la operación y operaciones relacionadas
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
        >
          ← Volver al dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resumen de Recarga (Topup) */}
          {topup && (
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">💳 Recarga de Saldo</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ID:</span>
                  <span className="text-sm font-mono">{topup.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Usuario:</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{topup.user?.full_name || 'Sin nombre'}</div>
                    <div className="text-xs text-gray-500">{topup.user?.email}</div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Monto:</span>
                  <span className="text-sm font-semibold">${Number(topup.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${topup.status === 'approved' ? 'bg-green-100 text-green-800' :
                      topup.status === 'pending' || topup.status === 'pending_approval' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {topup.status}
                  </span>
                </div>
                {topup.metadata?.proof_url && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Comprobante:</span>
                    <a
                      href={topup.metadata.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-emerald hover:underline"
                    >
                      Ver imagen
                    </a>
                  </div>
                )}
                <div className="pt-3 border-t">
                  <div className="text-xs text-gray-400">
                    Creado el {new Date(topup.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumen de Orden */}
          {order && (
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">📦 Orden</h2>
                <div className="flex gap-2">
                  {order.status !== 'completed' && order.status !== 'cancelled' && (
                    <button
                      onClick={async () => {
                        if (!confirm('¿Estás seguro de liberar el dinero? Esto marcará la orden como completada.')) return;
                        const { error } = await supabase
                          .from('orders')
                          .update({
                            status: 'completed',
                            completed_at: new Date().toISOString()
                          })
                          .eq('id', order.id);

                        if (error) {
                          alert('Error al liberar dinero: ' + error.message);
                        } else {
                          alert('Orden completada y dinero liberado.');
                          window.location.reload();
                        }
                      }}
                      className="rounded-lg bg-green-50 px-3 py-1 text-xs font-semibold text-green-600 hover:bg-green-100 ring-1 ring-green-200"
                    >
                      Liberar Dinero
                    </button>
                  )}
                  {order.shipping_option_id !== 'pickup' && order.shipping_carrier !== 'pickup' && (
                    <button
                      onClick={async () => {
                        if (!confirm('¿Forzar que este envío sea de plataforma (GoVendy)? Esto hará que el envío no se sume al neto del vendedor.')) return;
                        const { error } = await supabase
                          .from('orders')
                          .update({ shipping_by_seller: false })
                          .eq('id', order.id);
                        if (error) {
                          alert('Error al actualizar envío: ' + error.message);
                        } else {
                          alert('Envío forzado como plataforma. Los cálculos de neto reflejarán el cambio.');
                          window.location.reload();
                        }
                      }}
                      className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 ring-1 ring-blue-200"
                    >
                      Forzar Envío Plataforma
                    </button>
                  )}
                  {(order.shipping_option_id === 'pickup' || order.shipping_carrier === 'pickup') && order.delivery_proof_url && order.status !== 'completed' && order.status !== 'cancelled' && (
                    <button
                      onClick={async () => {
                        const reason = prompt('Motivo del rechazo (ej. "Fotos borrosas", "Falta INE"):');
                        if (!reason) return;

                        try {
                          const res = await fetch('/api/orders/reject-proof', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId: order.id, reason }),
                          });

                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.error || 'Error al rechazar evidencia');
                          }

                          alert('Evidencia rechazada. Se ha notificado al vendedor.');
                          window.location.reload();
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }}
                      className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 ring-1 ring-red-200"
                    >
                      Rechazar Evidencia
                    </button>
                  )}
                  {order.status !== 'cancelled' && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 ring-1 ring-red-200"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ID:</span>
                  <span className="text-sm font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(order.id);
                        const el = document.getElementById(`oid-${order.id}`);
                        if (el) {
                          const original = el.innerText;
                          el.innerText = 'Copiado!';
                          setTimeout(() => {
                            el.innerText = original;
                          }, 1000);
                        }
                      }}
                      className="hover:text-brand-emerald hover:underline focus:outline-none text-left"
                    >
                      <span id={`oid-${order.id}`}>{order.id}</span>
                    </button>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${order.status === 'paid' ? 'bg-green-100 text-green-800' :
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                    }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Método de Envío:</span>
                  {(() => {
                    const isPickup = order.shipping_option_id === 'pickup' || order.shipping_carrier === 'pickup';
                    const isGoVendyCarrier = String(order.shipping_carrier).toLowerCase() === 'gopocket' || String((order as any).shipping_method).toLowerCase().startsWith('gopocket');
                    const isGoVendy = !isPickup && (isGoVendyCarrier || Boolean(order.shipping_option_id) || Boolean(order.shipping_label_url));
                    const isSellerManaged = !isPickup && !isGoVendy && Boolean(order.shipping_carrier);
                    if (isPickup) {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-bold text-purple-800 ring-1 ring-inset ring-purple-600/20">
                          ENTREGA PERSONAL
                        </span>
                      );
                    }
                    if (isGoVendy) {
                      const freeForBuyer = Number(order.shipping_fee || 0) === 0;
                      return (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-600/20" title={freeForBuyer ? 'Envío Gratis (lo cubre vendedor vía subsidio)' : 'Cobrado al comprador'}>
                          {freeForBuyer ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍOS GOVENDY'}
                        </span>
                      );
                    }
                    if (isSellerManaged) {
                      const freeForBuyer = Number(order.shipping_fee || 0) === 0;
                      return (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                          {freeForBuyer ? 'ENVÍO GRATIS POR EL VENDEDOR' : 'ENVÍO GESTIONADO POR EL VENDEDOR'}
                        </span>
                      );
                    }
                    return <span className="text-sm font-semibold text-gray-800">—</span>;
                  })()}
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Envío:</span>
                  <span className="text-sm font-semibold">
                    {order.shipping_option_id === 'pickup' || order.shipping_carrier === 'pickup' ? (
                      <span className="text-green-600">Entrega Personal ($0)</span>
                    ) : (
                      `$${Number(order.shipping_fee || 0).toLocaleString()}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total:</span>
                  <span className="text-sm font-semibold">${order.total.toLocaleString()}</span>
                </div>
                {order.shipping_label_url && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Guía:</span>
                    <a
                      href={order.shipping_label_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-emerald hover:underline"
                    >
                      Ver guía
                    </a>
                  </div>
                )}
                {order.buyer_payment_voucher_url && (
                  <div className="flex justify-between items-start mt-2">
                    <span className="text-sm text-gray-600">Comprobante (P2P):</span>
                    <a
                      href={order.buyer_payment_voucher_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline font-bold"
                    >
                      Ver Comprobante
                    </a>
                  </div>
                )}
                {order.delivery_proof_url && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-600">Evidencia:</span>
                    <div className="flex flex-col text-right gap-2">
                      <div className="flex flex-col text-right">
                        {order.delivery_proof_url.split(',').map((url, idx) => {
                          const total = order.delivery_proof_url!.split(',').length;
                          const label = total > 1 ? (idx === 0 ? '📄 Constancia' : '🪪 INE') : 'Ver evidencia';
                          return (
                            <a
                              key={idx}
                              href={url.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-brand-emerald hover:underline"
                            >
                              {label}
                            </a>
                          );
                        })}
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm('¿Rechazar evidencia y solicitar nueva carga? La orden volverá a estado "Pendiente de Envío".')) return;

                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) throw new Error('No session');

                            const res = await fetch('/api/orders/reject-proof', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                              },
                              body: JSON.stringify({ orderId: order.id })
                            });

                            const json = await res.json();
                            if (!res.ok) throw new Error(json.error || 'Error al rechazar');

                            alert('Evidencia rechazada. Se ha solicitado nueva carga al vendedor.');
                            window.location.reload();
                          } catch (e: any) {
                            alert('Error: ' + e.message);
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 underline self-end"
                      >
                        Rechazar y Solicitar Nueva
                      </button>
                    </div>
                  </div>
                )}
                <div className="pt-3 border-t">
                  <Link
                    href={`/admin/logistica?orderId=${order.id}`}
                    className="text-sm text-brand-emerald hover:underline"
                  >
                    Ver en logística →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Resumen de Pago */}
          {payment && (
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">💰 Pago</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Referencia:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{payment.reference_code || payment.id}</span>
                    <CopyButton
                      text={payment.reference_code || payment.id}
                      className="text-gray-400 hover:text-brand-emerald"
                      size="sm"
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                      payment.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {payment.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Monto:</span>
                  <span className="text-sm font-semibold">${payment.amount.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t">
                  <Link
                    href={`/admin/pagos?paymentId=${payment.id}`}
                    className="text-sm text-brand-emerald hover:underline"
                  >
                    Ver en pagos →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Resumen de Disputa */}
          {dispute && (
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">⚖️ Disputa</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ID:</span>
                  <span className="text-sm font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(dispute.id);
                        const el = document.getElementById(`did-${dispute.id}`);
                        if (el) {
                          const original = el.innerText;
                          el.innerText = 'Copiado!';
                          setTimeout(() => {
                            el.innerText = original;
                          }, 1000);
                        }
                      }}
                      className="hover:text-brand-emerald hover:underline focus:outline-none text-left"
                    >
                      <span id={`did-${dispute.id}`}>{dispute.id.slice(0, 8)}</span>
                    </button>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estado:</span>
                  <span className={`text-sm font-semibold px-2 py-1 rounded ${dispute.status === 'open' ? 'bg-red-100 text-red-800' :
                      dispute.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {dispute.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Razón:</span>
                  <span className="text-sm">{dispute.reason_code}</span>
                </div>
                <div className="pt-3 border-t">
                  <Link
                    href={`/admin/disputas/${dispute.id}`}
                    className="text-sm text-brand-emerald hover:underline"
                  >
                    Ver disputa completa →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Navegación contextual */}
        <div className="space-y-6">
          {order && <ContextualNavigation currentItem={order} type="order" />}
          {payment && !order && <ContextualNavigation currentItem={payment} type="payment" />}
          {dispute && !order && !payment && <ContextualNavigation currentItem={dispute} type="dispute" />}
        </div>
      </div>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-emerald"></div>
      </div>
    }>
      <OperationViewContent />
    </Suspense>
  );
}
