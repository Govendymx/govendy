/**
 * Lógica compartida de pagos a vendedores.
 * Una sola fuente de verdad para cálculo de neto, estados y filtros.
 * Usado por: /api/payouts/balance, /api/payouts/statement, /api/payouts/withdraw,
 * Dashboard Pagos, Admin payouts report.
 */

export function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function isCancelledStatus(s: string): boolean {
  const low = String(s || '').toLowerCase();
  return low === 'cancelled' || low === 'canceled' || low === 'refunded';
}

export function isPaidStatus(s: string): boolean {
  const low = String(s || '').toLowerCase();
  return ['paid', 'shipped', 'delivered', 'disputed'].includes(low);
}

export function isReleasedStatus(s: string): boolean {
  const low = String(s || '').toLowerCase();
  return low === 'delivered';
}

export type OrderLike = {
  subtotal?: unknown;
  total?: unknown;
  shipping_fee?: unknown;
  commission_fee?: unknown;
  coupon_discount?: unknown;
  shipping_subsidy?: unknown;
  shipping_option_id?: unknown;
  shipping_carrier?: unknown;
  shipping_label_url?: unknown;
  shipping_by_seller?: unknown;
  isr_withheld?: unknown;
  iva_withheld?: unknown;
};

/**
 * Neto a pagar al vendedor por una orden (después de comisión, envío, descuentos).
 * Misma fórmula en toda la app para que los números coincidan en usuario y admin.
 *
 * REGLA DE ORO:
 * - Envío GoVendy (Platform): El shipping_fee NO es del vendedor. SE RESTA del TOTAL pagado por el comprador.
 * - Envío Vendedor: El shipping_fee SÍ es del vendedor (él paga su guía). El total ya lo incluye.
 * - Pickup: El shipping_fee es 0.
 */
export function payoutNet(o: OrderLike): number {
  const subtotal = toNumber(o?.subtotal);
  const discount = toNumber((o as any)?.coupon_discount);
  const commission = toNumber(o?.commission_fee);
  const subsidy = toNumber((o as any)?.shipping_subsidy);
  const shippingFee = toNumber(o?.shipping_fee);
  const total = toNumber(o?.total);

  const optionId = String((o as any)?.shipping_option_id || '').trim().toLowerCase();
  const carrier = String((o as any)?.shipping_carrier || '').trim().toLowerCase();

  const isPickup = optionId === 'pickup' || carrier === 'pickup';

  // Si shipping_by_seller es true, el vendedor gestiona y recibe el envío.
  // En cualquier otro caso (false/null/undefined), GoVendy gestiona y el vendedor NO recibe el envío.
  const isSellerManaged = (o as any)?.shipping_by_seller === true && !isPickup;

  // RAMA SUBTOTAL: El subtotal es solo el precio de los productos.
  if (subtotal > 0) {
    const extraShippingIncome = isSellerManaged ? shippingFee : 0;
    // Retenciones fiscales (ISR + IVA)
    const isr = toNumber(o?.isr_withheld);
    const iva = toNumber(o?.iva_withheld);
    return subtotal - discount - commission - subsidy + extraShippingIncome - isr - iva;
  }

  // RAMA TOTAL: El total es (Producto + Envío).
  if (total > 0) {
    if (isPickup || isSellerManaged) {
      // Si el vendedor gestiona o es pickup, el neto es simplemente Total - Comisión.
      return total - commission - subsidy;
    }
    // ES GOPOCKET -> EL ENVÍO SE RESTA DEL TOTAL PAGADO POR EL COMPRADOR
    return total - commission - subsidy - shippingFee;
  }

  return 0;
}

export function statusLabel(s: string): string {
  const low = String(s || '').toLowerCase();
  if (low === 'pending_payment') return 'Pendiente de pago';
  if (low === 'paid') return 'Pagado';
  if (low === 'shipped') return 'Enviado';
  if (low === 'delivered') return 'Completado';
  if (low === 'cancelled' || low === 'canceled') return 'Cancelado';
  if (low === 'refunded') return 'Reembolsado';
  if (low === 'disputed') return 'En disputa';
  return s || '—';
}
