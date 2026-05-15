export type EmailTemplate = {
  subject: string;
  html: (data: Record<string, unknown>) => string;
  text: (data: Record<string, unknown>) => string;
};

const LOGO_URL = 'https://gopocket.com.mx/logo.png';
const COMPANY_NAME = 'GoVendy';
const COMPANY_ADDRESS = 'Xalapa, Veracruz, México';
const COMPANY_WEBSITE = 'https://gopocket.com.mx';

function baseEmailLayout(opts: {
  title: string;
  previewText?: string;
  content: string;
  actionButton?: { text: string; url: string };
  footerText?: string;
}) {
  const { title, previewText, content, actionButton, footerText } = opts;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f4f5; }
        .wrapper { width: 100%; background-color: #f4f4f5; padding: 20px 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background-color: #ffffff; padding: 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0; }
        .logo { max-height: 40px; width: auto; display: block; margin: 0 auto; }
        .hero { background: linear-gradient(135deg, #FF6600 0%, #ff6b6b 100%); padding: 40px 30px; text-align: center; color: #ffffff; }
        .hero h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .content { padding: 40px 30px; background-color: #ffffff; }
        .content p { margin-bottom: 16px; font-size: 16px; color: #4b5563; }
        .content strong { color: #111827; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { display: inline-block; padding: 14px 28px; background-color: #FF6600; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background-color 0.2s; }
        .button:hover { background-color: #c00f68; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #f0f0f0; }
        .signature { margin-bottom: 20px; text-align: left; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        .signature-table td { vertical-align: middle; }
        .signature-logo { width: 50px; height: 50px; border-radius: 8px; margin-right: 15px; background-color: #f3f4f6; object-fit: cover; }
        .signature-text { font-size: 14px; color: #6b7280; line-height: 1.4; }
        .signature-name { font-weight: bold; color: #111827; font-size: 15px; }
        .footer-links { font-size: 12px; color: #9ca3af; margin-top: 20px; }
        .footer-links a { color: #9ca3af; text-decoration: underline; }
        @media only screen and (max-width: 600px) {
          .container { width: 100% !important; border-radius: 0; }
          .content { padding: 20px; }
          .hero { padding: 30px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <!-- Header with Logo -->
          <div class="header">
            <img src="${LOGO_URL}" alt="${COMPANY_NAME}" class="logo" width="120" height="40" style="color: #FF6600; font-weight: bold; font-size: 20px;">
          </div>

          <!-- Hero Section -->
          <div class="hero">
            <h1>${title}</h1>
          </div>

          <!-- Main Content -->
          <div class="content">
            ${content}
            
            ${actionButton ? `
              <div class="button-container">
                <a href="${actionButton.url}" class="button">${actionButton.text}</a>
              </div>
            ` : ''}

            <!-- Signature -->
            <div class="signature">
              <table class="signature-table" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="GoVendy Logo" class="signature-logo" width="50" height="50">
                  </td>
                  <td>
                    <div class="signature-text">
                      <div class="signature-name">El equipo de ${COMPANY_NAME}</div>
                      <div>Tu marketplace de confianza</div>
                      <div><a href="${COMPANY_WEBSITE}" style="color: #FF6600; text-decoration: none;">${COMPANY_WEBSITE.replace('https://', '')}</a></div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            ${footerText ? `<p style="margin-bottom: 10px; font-size: 13px; color: #6b7280;">${footerText}</p>` : ''}
            <div class="footer-links">
              <p>&copy; ${new Date().getFullYear()} ${COMPANY_NAME}. Todos los derechos reservados.</p>
              <p>${COMPANY_ADDRESS}</p>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// --- Specific Templates ---

export const orderPaymentApprovedBuyer = (data: { orderIds: string[]; total?: number; userName?: string }) => ({
  subject: '✅ Pago Acreditado - GoVendy',
  html: baseEmailLayout({
    title: '¡Pago Acreditado!',
    previewText: 'Tu pago ha sido acreditado exitosamente.',
    content: `
      <p>Hola ${data.userName || 'Comprador'},</p>
      <p>Tu pago ha sido procesado y acreditado exitosamente. ¡Gracias por tu compra!</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
        ${data.total ? `<p style="margin: 5px 0;"><strong>Monto Total:</strong> ${Number(data.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>` : ''}
        <p style="margin: 5px 0;"><strong>Orden(es):</strong> ${data.orderIds.join(', ')}</p>
      </div>

      <p>El vendedor ha sido notificado y preparará tu envío pronto.</p>
    `,
    actionButton: { text: 'Ver Mis Compras', url: `${COMPANY_WEBSITE}/purchases` },
  }),
  text: `¡Pago Acreditado! Tu pago ha sido acreditado. Ordenes: ${data.orderIds.join(', ')}.`
});

export const orderPaymentApprovedSeller = (data: { orderIds: string[]; total?: number }) => ({
  subject: '📦 ¡Venta Confirmada! Prepara el envío',
  html: baseEmailLayout({
    title: '¡Venta Confirmada!',
    previewText: 'El pago ha sido acreditado. Es hora de enviar.',
    content: `
      <p>Hola Vendedor,</p>
      <p>¡Excelentes noticias! El pago para las órdenes <strong>${data.orderIds.join(', ')}</strong> ha sido acreditado.</p>
      ${data.total ? `<p>Total de la venta: <strong>${Number(data.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</strong></p>` : ''}
      <p>Por favor, descarga las guías de envío y despacha los paquetes lo antes posible.</p>
    `,
    actionButton: { text: 'Gestionar Ventas', url: `${COMPANY_WEBSITE}/sell/orders` },
  }),
  text: `¡Venta Confirmada! El pago para las órdenes ${data.orderIds.join(', ')} ha sido acreditado. Prepara el envío.`
});

export const orderPaymentRejectedBuyer = (data: { userName?: string; reason?: string }) => ({
  subject: '⚠️ Pago Rechazado - GoVendy',
  html: baseEmailLayout({
    title: 'Pago No Procesado',
    previewText: 'Hubo un problema con tu pago.',
    content: `
      <p>Hola ${data.userName || 'Comprador'},</p>
      <p>Lo sentimos, no pudimos procesar tu pago.</p>
      ${data.reason ? `<p><strong>Motivo:</strong> ${data.reason}</p>` : ''}
      <p>Esto puede deberse a fondos insuficientes o restricciones bancarias. Te sugerimos intentar con otro método.</p>
    `,
    actionButton: { text: 'Intentar Pago Nuevamente', url: `${COMPANY_WEBSITE}/cart` },
  }),
  text: `Pago Rechazado. No pudimos procesar tu pago. ${data.reason || ''}`
});

export const orderShippedBuyer = (data: { orderId: string; userName?: string; tracking?: string; carrier?: string }) => ({
  subject: '🚚 Tu pedido va en camino',
  html: baseEmailLayout({
    title: '¡Tu pedido va en camino!',
    previewText: 'El vendedor ha enviado tu paquete.',
    content: `
      <p>Hola ${data.userName || 'Comprador'},</p>
      <p>Tu orden <strong>#${data.orderId}</strong> ha sido enviada.</p>
      <p><strong>Paquetería:</strong> ${data.carrier || 'No especificada'}<br>
      <strong>Guía de rastreo:</strong> ${data.tracking || 'No disponible'}</p>
    `,
    actionButton: { text: 'Rastrear Pedido', url: `${COMPANY_WEBSITE}/purchases/${data.orderId}` },
  }),
  text: `Tu pedido #${data.orderId} va en camino. Guía: ${data.tracking || 'N/A'}.`
});

export const orderConfirmReceivedSeller = (data: { orderId: string; userName?: string; amount?: number }) => ({
  subject: '💰 ¡Entrega Confirmada! Fondos liberados',
  html: baseEmailLayout({
    title: '¡Entrega Confirmada!',
    previewText: 'El comprador confirmó la recepción.',
    content: `
      <p>Hola ${data.userName || 'Vendedor'},</p>
      <p>El comprador ha confirmado la recepción de la orden <strong>#${data.orderId}</strong>.</p>
      ${data.amount ? `<p>Tus ganancias de <strong>${Number(data.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</strong> han sido liberadas.</p>` : ''}
    `,
    actionButton: { text: 'Ver Mi Monedero', url: `${COMPANY_WEBSITE}/wallet` },
  }),
  text: `¡Entrega Confirmada! La orden #${data.orderId} fue recibida.`
});

export const orderMarkedDeliveredByAdminSeller = (data: { orderId: string }) => ({
  subject: '📦 Orden marcada como entregada',
  html: baseEmailLayout({
    title: 'Orden Entregada',
    previewText: 'El sistema detectó la entrega del paquete.',
    content: `
      <p>Hola Vendedor,</p>
      <p>La paquetería indica que la orden <strong>#${data.orderId}</strong> ha sido entregada.</p>
      <p>Si el comprador no reporta problemas en las próximas 48 horas, tus fondos serán liberados automáticamente.</p>
    `,
    actionButton: { text: 'Ver Detalles', url: `${COMPANY_WEBSITE}/sell/orders/${data.orderId}` },
  }),
  text: `Orden #${data.orderId} marcada como entregada por paquetería.`
});

export const disputeOpened = (data: { orderId: string; userName?: string; isBuyer?: boolean }) => ({
  subject: '🚨 Reclamo abierto en una orden',
  html: baseEmailLayout({
    title: 'Reclamo Abierto',
    previewText: 'Se ha abierto un reclamo.',
    content: `
      <p>Hola ${data.userName || 'Usuario'},</p>
      <p>Se ha abierto un reclamo para la orden <strong>#${data.orderId}</strong>.</p>
      <p>${data.isBuyer ? 'Has abierto un reclamo. Nuestro equipo lo revisará.' : 'El comprador ha abierto un reclamo. Por favor revisa los detalles.'}</p>
    `,
    actionButton: { text: 'Ver Reclamo', url: `${COMPANY_WEBSITE}/disputes/${data.orderId}` },
  }),
  text: `Reclamo abierto en orden #${data.orderId}.`
});

export const disputeResolved = (data: { orderId: string; decision?: string }) => ({
  subject: '⚖️ Reclamo resuelto',
  html: baseEmailLayout({
    title: 'Reclamo Resuelto',
    previewText: 'El reclamo ha sido cerrado.',
    content: `
      <p>Hola,</p>
      <p>El reclamo de la orden <strong>#${data.orderId}</strong> ha sido resuelto.</p>
      ${data.decision ? `<p><strong>Resolución:</strong> ${data.decision}</p>` : ''}
    `,
    actionButton: { text: 'Ver Detalles', url: `${COMPANY_WEBSITE}/disputes/${data.orderId}` },
  }),
  text: `Reclamo de orden #${data.orderId} resuelto.`
});

export const estafetaPaymentApproved = (data: { amount: number; userName?: string }) => ({
  subject: '✅ Guía Estafeta Generada',
  html: baseEmailLayout({
    title: 'Guía Generada',
    previewText: 'Tu guía de envío está lista.',
    content: `
      <p>Hola ${data.userName || 'Usuario'},</p>
      <p>El pago de $${data.amount} para la guía Estafeta fue exitoso.</p>
      <p>Ya puedes descargarla e imprimirla desde tu panel de ventas.</p>
    `,
    actionButton: { text: 'Ir a Mis Ventas', url: `${COMPANY_WEBSITE}/sell/orders` },
  }),
  text: `Guía Estafeta generada. Monto pagado: $${data.amount}.`
});

export const questionReceived = (data: { userName?: string; questionText: string; listingTitle: string; listingId: string; listingImageUrl?: string }) => ({
  subject: '❓ Nueva pregunta en tu publicación',
  html: baseEmailLayout({
    title: 'Nueva Pregunta',
    previewText: 'Alguien preguntó sobre tu producto.',
    content: `
      <p>Hola ${data.userName || 'Vendedor'},</p>
      <p>Te hicieron una pregunta en <strong>${data.listingTitle}</strong>:</p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #FF6600; margin: 10px 0;">
        "${data.questionText}"
      </blockquote>
      <p>Responde rápido para aumentar tus posibilidades de venta.</p>
    `,
    actionButton: { text: 'Responder', url: `${COMPANY_WEBSITE}/listings/${data.listingId}` },
  }),
  text: `Nueva pregunta en ${data.listingTitle}: "${data.questionText}"`
});

export const answerReceived = (data: { userName?: string; answerText: string; listingTitle: string; listingId: string; listingImageUrl?: string }) => ({
  subject: '💬 Te respondieron una pregunta',
  html: baseEmailLayout({
    title: 'Te respondieron',
    previewText: 'El vendedor respondió tu pregunta.',
    content: `
      <p>Hola ${data.userName || 'Usuario'},</p>
      <p>El vendedor respondió tu pregunta sobre <strong>${data.listingTitle}</strong>:</p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 4px solid #FF6600; margin: 10px 0;">
        "${data.answerText}"
      </blockquote>
    `,
    actionButton: { text: 'Ver Publicación', url: `${COMPANY_WEBSITE}/listings/${data.listingId}` },
  }),
  text: `Te respondieron sobre ${data.listingTitle}: "${data.answerText}"`
});

export const abandonedCart = (data: { userName?: string; items: Array<{ title: string; price: string; image?: string }>; cartLink: string }) => ({
  subject: '🛒 ¿Olvidaste algo?',
  html: baseEmailLayout({
    title: 'Tu carrito te espera',
    previewText: 'No dejes escapar esos productos.',
    content: `
      <p>Hola ${data.userName || 'Usuario'},</p>
      <p>Notamos que dejaste productos en tu carrito. ¡Están esperando por ti!</p>
      <p>Completa tu compra antes de que se agoten.</p>
    `,
    actionButton: { text: 'Ir al Carrito', url: data.cartLink },
  }),
  text: `Hola ${data.userName || 'Usuario'}, dejaste productos en tu carrito. Completa tu compra aquí: ${data.cartLink}`
});

export const auctionLost = (data: { userName?: string; listingTitle: string; listingId: string }) => ({
  subject: '🔨 Subasta finalizada',
  html: baseEmailLayout({
    title: 'Subasta Finalizada',
    previewText: 'La subasta en la que participabas ha terminado.',
    content: `
      <p>Hola ${data.userName || 'Usuario'},</p>
      <p>La subasta de <strong>${data.listingTitle}</strong> ha finalizado y esta vez no ganaste.</p>
      <p>¡No te desanimes! Hay muchos más productos esperándote.</p>
    `,
    actionButton: { text: 'Ver Más Productos', url: `${COMPANY_WEBSITE}/listings` },
  }),
  text: `La subasta de ${data.listingTitle} finalizó.`
});

export const welcome = (data: { userName?: string }) => ({
  subject: '👋 ¡Bienvenido a GoVendy!',
  html: baseEmailLayout({
    title: '¡Bienvenido a GoVendy!',
    previewText: 'Gracias por unirte a nuestra comunidad.',
    content: `
      <p>Hola ${data.userName || 'Nuevo Usuario'},</p>
      <p>Estamos muy felices de que te hayas unido a GoVendy, el mejor lugar para comprar y vender moda de segunda mano.</p>
      <p>Explora miles de productos o comienza a vender lo que ya no usas.</p>
    `,
    actionButton: { text: 'Comenzar a Explorar', url: COMPANY_WEBSITE },
  }),
  text: `¡Bienvenido a GoVendy, ${data.userName || 'Usuario'}! Gracias por unirte.`
});

export const resetPassword = (data: { userName?: string; resetLink: string }) => ({
  subject: '🔒 Restablecer Contraseña',
  html: baseEmailLayout({
    title: 'Restablecer Contraseña',
    previewText: 'Solicitud de cambio de contraseña.',
    content: `
      <p>Hola ${data.userName || 'Usuario'},</p>
      <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
      <p>Si no fuiste tú, puedes ignorar este correo. Si fuiste tú, haz clic en el botón de abajo:</p>
    `,
    actionButton: { text: 'Restablecer Contraseña', url: data.resetLink },
  }),
  text: `Hola ${data.userName || 'Usuario'}, usa este enlace para restablecer tu contraseña: ${data.resetLink}`
});

// Deprecated: use specific functions instead
export const templates: Record<string, any> = {};

export function getEmailTemplate(type: string): EmailTemplate | undefined {
  return (templates as any)[type];
}
