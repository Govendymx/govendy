// Sistema de alertas unificado para administración

import { AdminAlert } from './types';
import { Order, CheckoutSession, Dispute } from '@/lib/types/domain.types';

/**
 * Calcular horas pendientes desde creación
 */
function calculateHoursPending(item: { created_at: string }): number {
  const created = new Date(item.created_at);
  const now = new Date();
  return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
}

/**
 * Calcular prioridad de un pago
 */
function calculatePaymentPriority(payment: CheckoutSession): number {
  let priority = 0;
  const hoursPending = calculateHoursPending(payment);
  
  if (hoursPending > 48) priority += 10;
  else if (hoursPending > 24) priority += 5;
  
  // Pagos offline sin comprobante tienen más prioridad
  if (payment.payment_method === 'bank_transfer' || payment.payment_method === 'bank_deposit' || payment.payment_method === 'oxxo') {
    if (!payment.reference_code) priority += 3;
  }
  
  // Montos altos tienen más prioridad
  if (payment.amount > 10000) priority += 2;
  
  return Math.min(priority, 10);
}

/**
 * Calcular prioridad de una orden
 */
function calculateOrderPriority(order: Order): number {
  let priority = 0;
  
  // Orden pagada sin guía
  if (order.status === 'paid' && !order.shipping_label_url) {
    priority += 8;
  }
  
  // Orden enviada sin tracking
  if (order.status === 'shipped' && !order.tracking_number) {
    priority += 5;
  }
  
  // Orden pagada hace más de 24h sin guía
  if (order.status === 'paid' && order.paid_at && !order.shipping_label_url) {
    const hoursSincePaid = (Date.now() - new Date(order.paid_at).getTime()) / (1000 * 60 * 60);
    if (hoursSincePaid > 24) priority += 3;
  }
  
  return Math.min(priority, 10);
}

/**
 * Calcular prioridad de una disputa
 */
function calculateDisputePriority(dispute: Dispute): number {
  let priority = 0;
  
  if (dispute.status === 'open') {
    priority += 7;
    
    const hoursOpen = calculateHoursPending(dispute);
    if (hoursOpen > 72) priority += 5;
    else if (hoursOpen > 48) priority += 3;
  }
  
  return Math.min(priority, 10);
}

/**
 * Crear alerta de pago pendiente
 */
function createPaymentAlert(payment: CheckoutSession): AdminAlert | null {
  if (payment.status !== 'pending') return null;
  
  const priority = calculatePaymentPriority(payment);
  if (priority === 0) return null;
  
  const hoursPending = calculateHoursPending(payment);
  const isUrgent = hoursPending > 48;
  
  return {
    id: `payment-${payment.id}`,
    type: isUrgent ? 'critical' : 'warning',
    category: 'payment',
    title: isUrgent 
      ? `🚨 Pago pendiente > 48h: ${payment.reference_code || payment.id.slice(0, 8)}`
      : `⚠️ Pago pendiente: ${payment.reference_code || payment.id.slice(0, 8)}`,
    description: `Pago de $${payment.amount.toLocaleString()} pendiente desde hace ${Math.round(hoursPending)}h`,
    actionUrl: `/admin/pagos?paymentId=${payment.id}`,
    actionLabel: 'Ver pago',
    relatedIds: {
      paymentId: payment.id,
      orderId: payment.order_ids?.[0],
    },
    createdAt: payment.created_at,
    priority,
  };
}

/**
 * Crear alerta de orden sin guía
 */
function createOrderAlert(order: Order): AdminAlert | null {
  if (order.status !== 'paid' || order.shipping_label_url) return null;

  // Filtrar solo órdenes que requieren guía de la plataforma
  // Lógica de "GoVendy": 
  // 1. shipping_option_id no es nulo y no es 'pickup' (envío pagado por plataforma)
  // 2. O shipping_subsidy > 0 (envío subsidiado pero gestionado por plataforma)
  // 3. O shipping_label_url existe (ya cubierto arriba)
  // 4. Excluir explícitamente pickup y envíos por vendedor sin subsidio
  
  const isPickup = String(order.shipping_option_id || '').toLowerCase() === 'pickup' || 
                   String(order.shipping_carrier || '').toLowerCase() === 'pickup';
                   
  const hasShippingOption = Boolean(order.shipping_option_id) && !isPickup;
  const hasSubsidy = Number(order.shipping_subsidy || 0) > 0;
  
  // Si es pickup, no requiere alerta de guía
  if (isPickup) return null;
  
  // Si NO tiene opción de envío Y NO tiene subsidio, asumimos que es "Envío por vendedor"
  // y no requiere guía de la plataforma.
  if (!hasShippingOption && !hasSubsidy) return null;
  
  const priority = calculateOrderPriority(order);
  if (priority === 0) return null;
  
  const hoursSincePaid = order.paid_at 
    ? (Date.now() - new Date(order.paid_at).getTime()) / (1000 * 60 * 60)
    : 0;
  
  const isUrgent = hoursSincePaid > 24;
  
  return {
    id: `order-${order.id}`,
    type: isUrgent ? 'critical' : 'warning',
    category: 'logistics',
    title: isUrgent
      ? `🚨 Orden GoVendy sin guía > 24h: ${order.id.slice(0, 8)}`
      : `⚠️ Orden GoVendy sin guía: ${order.id.slice(0, 8)}`,
    description: `Orden GoVendy pagada hace ${Math.round(hoursSincePaid)}h sin guía de envío`,
    actionUrl: `/admin/logistica?orderId=${order.id}`,
    actionLabel: 'Subir guía',
    relatedIds: {
      orderId: order.id,
    },
    createdAt: order.paid_at || order.created_at,
    priority,
  };
}

/**
 * Crear alerta de disputa abierta
 */
function createDisputeAlert(dispute: Dispute): AdminAlert | null {
  if (dispute.status !== 'open') return null;
  
  const priority = calculateDisputePriority(dispute);
  if (priority === 0) return null;
  
  const hoursOpen = calculateHoursPending(dispute);
  const isUrgent = hoursOpen > 72;
  
  return {
    id: `dispute-${dispute.id}`,
    type: isUrgent ? 'critical' : 'warning',
    category: 'dispute',
    title: isUrgent
      ? `🚨 Disputa abierta > 72h: ${dispute.id.slice(0, 8)}`
      : `⚠️ Disputa abierta: ${dispute.id.slice(0, 8)}`,
    description: `Disputa abierta hace ${Math.round(hoursOpen)}h - ${dispute.reason_code}`,
    actionUrl: `/admin/disputas/${dispute.id}`,
    actionLabel: 'Resolver',
    relatedIds: {
      disputeId: dispute.id,
      orderId: dispute.order_id,
    },
    createdAt: dispute.created_at,
    priority,
  };
}

/**
 * Calcular todas las alertas desde todos los paneles
 */
export async function calculateAllAlerts(
  payments: CheckoutSession[],
  orders: Order[],
  disputes: Dispute[]
): Promise<AdminAlert[]> {
  const alerts: AdminAlert[] = [];
  
  // Alertas de pagos
  for (const payment of payments) {
    const alert = createPaymentAlert(payment);
    if (alert) alerts.push(alert);
  }
  
  // Alertas de órdenes
  for (const order of orders) {
    const alert = createOrderAlert(order);
    if (alert) alerts.push(alert);
  }
  
  // Alertas de disputas
  for (const dispute of disputes) {
    const alert = createDisputeAlert(dispute);
    if (alert) alerts.push(alert);
  }
  
  // Ordenar por prioridad (mayor primero)
  alerts.sort((a, b) => b.priority - a.priority);
  
  return alerts;
}

/**
 * Agrupar alertas por categoría
 */
export interface AlertGroup {
  category: string;
  items: AdminAlert[];
  totalPriority: number;
  actionUrl: string;
}

export function groupAlerts(alerts: AdminAlert[]): AlertGroup[] {
  const groups: Record<string, AdminAlert[]> = {};
  
  for (const alert of alerts) {
    if (!groups[alert.category]) {
      groups[alert.category] = [];
    }
    groups[alert.category].push(alert);
  }
  
  return Object.entries(groups).map(([category, items]) => {
    const totalPriority = items.reduce((sum, item) => sum + item.priority, 0);
    const actionUrl = items.length > 0 ? items[0].actionUrl : '/admin';
    
    return {
      category,
      items,
      totalPriority,
      actionUrl,
    };
  }).sort((a, b) => b.totalPriority - a.totalPriority);
}
