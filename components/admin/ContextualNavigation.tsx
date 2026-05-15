'use client';

// Navegación contextual entre operaciones relacionadas

import Link from 'next/link';
import { useAdminContext } from '@/lib/admin/AdminContext';
import { Order, CheckoutSession, Dispute } from '@/lib/types/domain.types';

interface ContextualNavigationProps {
  currentItem: Order | CheckoutSession | Dispute;
  type: 'order' | 'payment' | 'dispute';
}

export function ContextualNavigation({ currentItem, type }: ContextualNavigationProps) {
  const { orders, payments, disputes } = useAdminContext();
  
  // Encontrar operaciones relacionadas
  const related: {
    order?: Order;
    payment?: CheckoutSession;
    dispute?: Dispute;
  } = {};
  
  if (type === 'payment') {
    const payment = currentItem as CheckoutSession;
    // Buscar orden relacionada
    if (payment.order_ids && payment.order_ids.length > 0) {
      related.order = orders.find(o => payment.order_ids.includes(o.id));
    }
    // Buscar disputa relacionada
    if (related.order) {
      related.dispute = disputes.find(d => d.order_id === related.order!.id);
    }
  } else if (type === 'order') {
    const order = currentItem as Order;
    // Buscar pago relacionado
    related.payment = payments.find(p => p.order_ids?.includes(order.id));
    // Buscar disputa relacionada
    related.dispute = disputes.find(d => d.order_id === order.id);
  } else if (type === 'dispute') {
    const dispute = currentItem as Dispute;
    // Buscar orden relacionada
    related.order = orders.find(o => o.id === dispute.order_id);
    // Buscar pago relacionado
    if (related.order) {
      related.payment = payments.find(p => p.order_ids?.includes(related.order!.id));
    }
  }
  
  const hasRelated = related.order || related.payment || related.dispute;
  
  if (!hasRelated) {
    return null;
  }
  
  return (
    <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
      <div className="text-xs font-semibold text-gray-600 mb-3">Operaciones relacionadas</div>
      <div className="space-y-2">
        {related.order && (
          <Link
            href={`/admin/operations?orderId=${related.order.id}`}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-gray-50 border border-gray-200 transition"
          >
            <div className="flex items-center gap-2">
              <span>📦</span>
              <span className="text-sm font-semibold">Orden #{related.order.id.slice(0, 8)}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                related.order.status === 'paid' ? 'bg-green-100 text-green-800' :
                related.order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                related.order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {related.order.status}
              </span>
            </div>
            <span className="text-xs text-gray-500">→</span>
          </Link>
        )}
        {related.payment && (
          <Link
            href={`/admin/operations?paymentId=${related.payment.id}`}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-gray-50 border border-gray-200 transition"
          >
            <div className="flex items-center gap-2">
              <span>💰</span>
              <span className="text-sm font-semibold">
                Pago {related.payment.reference_code || related.payment.id.slice(0, 8)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                related.payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                related.payment.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {related.payment.status}
              </span>
            </div>
            <span className="text-xs text-gray-500">→</span>
          </Link>
        )}
        {related.dispute && (
          <Link
            href={`/admin/operations?disputeId=${related.dispute.id}`}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-gray-50 border border-gray-200 transition"
          >
            <div className="flex items-center gap-2">
              <span>⚖️</span>
              <span className="text-sm font-semibold">Disputa #{related.dispute.id.slice(0, 8)}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                related.dispute.status === 'open' ? 'bg-red-100 text-red-800' :
                related.dispute.status === 'resolved' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {related.dispute.status}
              </span>
            </div>
            <span className="text-xs text-gray-500">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}
