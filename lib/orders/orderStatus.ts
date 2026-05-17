export type NormalizedOrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'unknown';

/** Normaliza variantes históricas (`received`, `completed`, `pending`, etc.). */
export function normalizeOrderStatus(raw: string | null | undefined): NormalizedOrderStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s === 'pending' || s === 'pending_payment' || s === 'awaiting_voucher' || s === 'verifying_payment') return 'pending_payment';
  if (s === 'received' || s === 'completed') return 'delivered';
  if (s === 'canceled') return 'cancelled';
  if (
    s === 'paid' ||
    s === 'shipped' ||
    s === 'delivered' ||
    s === 'cancelled' ||
    s === 'refunded' ||
    s === 'disputed'
  ) {
    return s;
  }
  return 'unknown';
}

export function orderStatusLabel(raw: string | null | undefined): string {
  switch (normalizeOrderStatus(raw)) {
    case 'pending_payment':
      return 'Pendiente de pago';
    case 'paid':
      return 'Pagado';
    case 'shipped':
      return 'Enviado';
    case 'delivered':
      return 'Completado';
    case 'cancelled':
      return 'Cancelado';
    case 'refunded':
      return 'Reembolsado';
    case 'disputed':
      return 'En disputa';
    default:
      return String(raw || '').trim() || '—';
  }
}

export function orderStatusBadgeShort(raw: string | null | undefined): string {
  switch (normalizeOrderStatus(raw)) {
    case 'pending_payment':
      return 'PENDIENTE PAGO';
    case 'paid':
      return 'PAGADO';
    case 'shipped':
      return 'ENVIADO';
    case 'delivered':
      return 'COMPLETADO';
    case 'cancelled':
      return 'CANCELADO';
    case 'refunded':
      return 'REEMBOLSADO';
    case 'disputed':
      return 'EN DISPUTA';
    default:
      return String(raw || '—').toUpperCase();
  }
}

export function orderStatusBadgeClass(raw: string | null | undefined): string {
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1';
  switch (normalizeOrderStatus(raw)) {
    case 'pending_payment':
      return `${base} bg-red-100 text-red-800 ring-red-300`;
    case 'paid':
      return `${base} bg-green-100 text-green-800 ring-green-300`;
    case 'shipped':
      return `${base} bg-blue-100 text-blue-800 ring-blue-300`;
    case 'delivered':
      return `${base} bg-purple-100 text-purple-800 ring-purple-300`;
    case 'cancelled':
      return `${base} bg-gray-100 text-gray-600 ring-gray-200 font-semibold`;
    case 'refunded':
      return `${base} bg-gray-100 text-gray-700 ring-gray-200 font-semibold`;
    case 'disputed':
      return `${base} bg-red-100 text-red-900 ring-red-400`;
    default:
      return `${base} bg-gray-100 text-gray-700 ring-gray-200 font-semibold`;
  }
}

export function isOrderDelivered(raw: string | null | undefined): boolean {
  return normalizeOrderStatus(raw) === 'delivered';
}

export function isOrderPaidOrBeyond(raw: string | null | undefined): boolean {
  const n = normalizeOrderStatus(raw);
  return n === 'paid' || n === 'shipped' || n === 'delivered';
}
