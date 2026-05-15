/**
 * Obtiene el enlace de destino para una notificación según type/kind, link_to y data.
 * Usado en AccountTopMenu (dropdown), NotificationCenter y /dashboard/notificaciones.
 */

export type NotificationForLink = {
  data?: Record<string, unknown> | null;
  type?: string | null;
  kind?: string | null;
  /** Ruta de la app almacenada en BD (link_to). Tiene prioridad si existe. */
  link_to?: string | null;
};

export function getNotificationLink(notification: NotificationForLink): string | null {
  const linkTo = typeof (notification as any)?.link_to === 'string' ? (notification as any).link_to.trim() : null;
  if (linkTo) return linkTo;

  const data = notification.data || {};
  const type = String(notification.type || '').toLowerCase();
  const kind = String((notification.kind ?? (data as any)?.kind) || '').toLowerCase();

  if ((data as any)?.link_url) return String((data as any).link_url);
  if ((data as any)?.href) return String((data as any).href);
  if ((data as any)?.link) return String((data as any).link);
  if ((data as any)?.url) return String((data as any).url);

  if (kind === 'live_started') {
    if ((data as any)?.session_id) return `/live/${(data as any).session_id}`;
    if ((data as any)?.sessionId) return `/live/${(data as any).sessionId}`;
  }

  // Preguntas y respuestas
  if (type === 'listing_question' || kind === 'listing_question') {
    if ((data as any)?.listingId) return `/listings/${(data as any).listingId}`;
    if ((data as any)?.listing_id) return `/listings/${(data as any).listing_id}`;
    return '/dashboard/preguntas';
  }
  if (type === 'listing_answer' || kind === 'listing_answer') {
    if ((data as any)?.listingId) return `/listings/${(data as any).listingId}`;
    if ((data as any)?.listing_id) return `/listings/${(data as any).listing_id}`;
    return '/dashboard/respuestas';
  }
  
  // COMPRAS (para el comprador)
  if (type === 'payment_approved' || kind === 'payment_approved') {
    if ((data as any)?.orderId) return `/dashboard/compras?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/compras?order=${(data as any).order_id}`;
    if ((data as any)?.checkoutId) return `/dashboard/compras`;
    return '/dashboard/compras';
  }
  if (type === 'payment_rejected' || kind === 'payment_rejected') {
    if ((data as any)?.checkoutId) return `/pago/${(data as any).checkoutId}`;
    return '/dashboard/compras';
  }
  if (type === 'order_shipped' || kind === 'order_shipped') {
    if ((data as any)?.orderId) return `/dashboard/compras?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/compras?order=${(data as any).order_id}`;
    return '/dashboard/compras';
  }
  if (type === 'order_completed' || kind === 'order_completed') {
    if ((data as any)?.orderId) return `/dashboard/compras?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/compras?order=${(data as any).order_id}`;
    return '/dashboard/compras';
  }
  if (type === 'order_message' || kind === 'order_message') {
    if ((data as any)?.orderId) return `/dashboard/compras?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/compras?order=${(data as any).order_id}`;
    return '/dashboard/compras';
  }
  if (type === 'order_status' || kind === 'order_status') {
    if ((data as any)?.orderId) return `/dashboard/compras?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/compras?order=${(data as any).order_id}`;
    return '/dashboard/compras';
  }
  
  // VENTAS (para el vendedor)
  if (type === 'new_sale' || kind === 'new_sale') {
    if ((data as any)?.orderId) return `/dashboard/ventas?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/ventas?order=${(data as any).order_id}`;
    return '/dashboard/ventas';
  }
  if (type === 'sale_paid' || kind === 'sale_paid') {
    if ((data as any)?.orderId) return `/dashboard/ventas?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/ventas?order=${(data as any).order_id}`;
    return '/dashboard/ventas';
  }
  if (type === 'payment' || kind === 'payment') {
    if ((data as any)?.orderId) return `/dashboard/ventas?order=${(data as any).orderId}`;
    if ((data as any)?.order_id) return `/dashboard/ventas?order=${(data as any).order_id}`;
    return '/dashboard/ventas';
  }
  
  // Soporte
  if (type === 'support' || kind === 'support') {
    if ((data as any)?.conversationId) return `/dashboard/soporte?conversation=${(data as any).conversationId}`;
    if ((data as any)?.conversation_id) return `/dashboard/soporte?conversation=${(data as any).conversation_id}`;
    return '/dashboard/soporte';
  }
  
  // Subastas
  if (type === 'auction' || kind === 'auction') {
    if ((data as any)?.listingId) return `/listings/${(data as any).listingId}`;
    if ((data as any)?.listing_id) return `/listings/${(data as any).listing_id}`;
    return '/subastas';
  }

  // Admin: pago MP acreditado → supervisión

  if (type === 'mp_payment_approved' || kind === 'mp_payment_approved') {
    return (data as any)?.href ?? '/admin/supervision';
  }

  // Disputas
  if (type === 'dispute_resolved' || kind === 'dispute_resolved' || type === 'dispute' || kind === 'dispute') {
    if ((data as any)?.disputeId) return `/dashboard/disputas/${(data as any).disputeId}`;
    if ((data as any)?.dispute_id) return `/dashboard/disputas/${(data as any).dispute_id}`;
    return '/dashboard/disputas';
  }
  
  // Calificaciones
  if (type === 'rating' || kind === 'rating' || type === 'review' || kind === 'review') {
    return '/dashboard/reputacion';
  }

  // Subastas: auction_won, auction_ended, outbid
  if (type === 'auction_won' || kind === 'auction_won' || type === 'auction_ended' || kind === 'auction_ended' || type === 'outbid' || kind === 'outbid') {
    if ((data as any)?.listingId) return `/listings/${(data as any).listingId}`;
    if ((data as any)?.listing_id) return `/listings/${(data as any).listing_id}`;
    return '/subastas';
  }

  return null;
}

/**
 * Construye link_to a partir de type y data. Útil al crear notificaciones.
 */
export function buildLinkFromPayload(type: string, data?: Record<string, unknown> | null): string | null {
  return getNotificationLink({ type, data, kind: type });
}
