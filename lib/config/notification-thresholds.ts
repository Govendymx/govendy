export const NOTIFICATION_THRESHOLDS = {
  // Retraso de envío: Tiempo máximo desde el pago hasta que se considera retrasado (en horas)
  SHIPPING_DELAY_HOURS: 72, 
  
  // Calificación pendiente: Tiempo sugerido para calificar después de la entrega (en horas)
  RATING_PENDING_HOURS: 24,

  // Límite de notificaciones (anti-spam): Horas antes de volver a mostrar una notificación cerrada/ignorada (si se implementara lógica de reaparición)
  // Nota: Actualmente si el usuario cierra la notificación, esta permanece cerrada (persistencia local/servidor).
  SPAM_PROTECTION_HOURS: 24,
};

export const NOTIFICATION_MESSAGES = {
  SHIPPING_DELAY: {
    title: '⚠️ Envío Retrasado',
    body: (orderId: string, deadline: string) => `
      <div class="space-y-2">
        <p>El pedido <strong>#${orderId.slice(0, 8)}</strong> ha excedido el tiempo estimado de envío.</p>
        <p class="text-sm text-gray-600">Fecha límite sugerida: ${deadline}</p>
        <p class="text-xs text-red-500 mt-1">El retraso puede afectar tu reputación de vendedor.</p>
        <div class="mt-2 text-center text-blue-600 font-semibold text-sm">Gestionar Envío &rarr;</div>
      </div>
    `,
  },
  RATING_PENDING_BUYER: {
    title: '⭐ Calificación Pendiente',
    body: (orderId: string) => `
      <div class="space-y-2">
        <p>Recibiste el pedido <strong>#${orderId.slice(0, 8)}</strong>. ¿Todo bien?</p>
        <p class="text-sm text-gray-600">Califica al vendedor para liberar su pago.</p>
        <div class="mt-2 text-center text-blue-600 font-semibold text-sm">Calificar Ahora &rarr;</div>
      </div>
    `,
  },
  RATING_PENDING_SELLER: {
    title: '⭐ Califica a tu Comprador',
    body: (orderId: string) => `
      <div class="space-y-2">
        <p>El pedido <strong>#${orderId.slice(0, 8)}</strong> fue entregado.</p>
        <p class="text-sm text-gray-600">Califica a tu comprador para cerrar el ciclo.</p>
        <div class="mt-2 text-center text-blue-600 font-semibold text-sm">Calificar Ahora &rarr;</div>
      </div>
    `,
  },
};
