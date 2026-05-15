/**
 * Template base profesional para emails estilo MercadoLibre
 * Diseño responsive y profesional con información personalizada
 */

const BASE_URL =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || '')) ||
  'https://gopocket.com.mx';

const BRAND_COLOR = '#ec4899'; // Pink
const BRAND_COLOR_DARK = '#db2777';
const TEXT_COLOR = '#1f2937';
const TEXT_COLOR_LIGHT = '#6b7280';
const BORDER_COLOR = '#e5e7eb';
const BG_COLOR = '#f9fafb';

interface EmailTemplateOptions {
  title: string;
  greeting?: string;
  userName?: string;
  content: string;
  primaryButton?: { text: string; href: string };
  secondaryButton?: { text: string; href: string };
  orderInfo?: {
    orderId: string;
    orderIds?: string[];
    total?: number;
    date?: string;
    status?: string;
  };
  trackingInfo?: {
    carrier?: string;
    tracking?: string;
    estimatedDelivery?: string;
  };
  footerNote?: string;
}

export function createProfessionalEmail(opts: EmailTemplateOptions): string {
  const { title, greeting, userName, content, primaryButton, secondaryButton, orderInfo, trackingInfo, footerNote } = opts;

  const greetingText = greeting || (userName ? `Hola ${userName},` : 'Hola,');
  const dashboardUrl = BASE_URL ? `${BASE_URL}/dashboard` : '/dashboard';

  // Información de orden si existe
  let orderSection = '';
  if (orderInfo) {
    const orderIds = orderInfo.orderIds || (orderInfo.orderId ? [orderInfo.orderId] : []);
    const orderIdText = orderIds.length > 0 ? orderIds.map((id) => id.slice(0, 8).toUpperCase()).join(', ') : '—';
    const totalText = orderInfo.total != null ? orderInfo.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '';
    const dateText = orderInfo.date || new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const statusText = orderInfo.status || '';

    orderSection = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background: #ffffff; border-radius: 8px; border: 1px solid ${BORDER_COLOR};">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: ${TEXT_COLOR};">
              📦 Información de tu orden
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${orderIds.length > 0 ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT}; width: 140px;">Número de orden:</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${TEXT_COLOR};">
                  ${orderIdText}
                </td>
              </tr>
              ` : ''}
              ${totalText ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT};">Total pagado:</td>
                <td style="padding: 8px 0; font-size: 16px; font-weight: 700; color: ${BRAND_COLOR};">
                  ${totalText}
                </td>
              </tr>
              ` : ''}
              ${dateText ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT};">Fecha:</td>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR};">
                  ${dateText}
                </td>
              </tr>
              ` : ''}
              ${statusText ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT};">Estado:</td>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR};">
                  <span style="display: inline-block; padding: 4px 12px; background: ${BG_COLOR}; border-radius: 12px; font-weight: 500;">
                    ${statusText}
                  </span>
                </td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // Información de tracking si existe
  let trackingSection = '';
  if (trackingInfo) {
    trackingSection = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: ${TEXT_COLOR};">
              🚚 Información de envío
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${trackingInfo.carrier ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT}; width: 140px;">Paquetería:</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${TEXT_COLOR};">
                  ${trackingInfo.carrier}
                </td>
              </tr>
              ` : ''}
              ${trackingInfo.tracking ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT};">Número de rastreo:</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${TEXT_COLOR}; font-family: monospace;">
                  ${trackingInfo.tracking}
                </td>
              </tr>
              ` : ''}
              ${trackingInfo.estimatedDelivery ? `
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT};">Entrega estimada:</td>
                <td style="padding: 8px 0; font-size: 14px; color: ${TEXT_COLOR};">
                  ${trackingInfo.estimatedDelivery}
                </td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // Botones de acción
  let buttonsSection = '';
  if (primaryButton || secondaryButton) {
    buttonsSection = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
        <tr>
          <td align="center" style="padding: 0;">
            ${primaryButton ? `
            <a href="${primaryButton.href.startsWith('http') ? primaryButton.href : BASE_URL ? `${BASE_URL}${primaryButton.href}` : primaryButton.href}" 
               style="display: inline-block; padding: 14px 32px; background: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 0 8px 12px 8px;">
              ${primaryButton.text}
            </a>
            ` : ''}
            ${secondaryButton ? `
            <a href="${secondaryButton.href.startsWith('http') ? secondaryButton.href : BASE_URL ? `${BASE_URL}${secondaryButton.href}` : secondaryButton.href}" 
               style="display: inline-block; padding: 14px 32px; background: #ffffff; color: ${BRAND_COLOR}; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; border: 2px solid ${BRAND_COLOR}; margin: 0 8px 12px 8px;">
              ${secondaryButton.text}
            </a>
            ` : ''}
          </td>
        </tr>
      </table>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_COLOR}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Contenedor principal -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid ${BORDER_COLOR};">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%); border-radius: 12px;">
                <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 2px;">GoVendy</span>
              </div>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding: 32px;">
              <!-- Saludo -->
              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: ${TEXT_COLOR}; line-height: 1.3;">
                ${title}
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; color: ${TEXT_COLOR}; line-height: 1.6;">
                ${greetingText}
              </p>

              <!-- Contenido principal -->
              <div style="font-size: 16px; color: ${TEXT_COLOR}; line-height: 1.6; margin-bottom: 24px;">
                ${content}
              </div>

              ${orderSection}
              ${trackingSection}
              ${buttonsSection}

              ${footerNote ? `
              <div style="margin-top: 32px; padding: 16px; background: ${BG_COLOR}; border-radius: 8px; border-left: 4px solid ${BRAND_COLOR};">
                <p style="margin: 0; font-size: 14px; color: ${TEXT_COLOR_LIGHT}; line-height: 1.5;">
                  ${footerNote}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: ${BG_COLOR}; border-top: 1px solid ${BORDER_COLOR}; border-radius: 0 0 12px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding-bottom: 16px;">
                    <a href="${dashboardUrl}" style="color: ${BRAND_COLOR}; text-decoration: none; font-weight: 600; font-size: 14px;">
                      Ir a Mi Panel →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding: 16px 0; border-top: 1px solid ${BORDER_COLOR};">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: ${TEXT_COLOR_LIGHT};">
                      Este email fue enviado porque tienes una operación activa en GoVendy.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: ${TEXT_COLOR_LIGHT};">
                      ¿Necesitas ayuda? <a href="${BASE_URL}/dashboard/ayuda" style="color: ${BRAND_COLOR}; text-decoration: none;">Contáctanos</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 16px;">
                    <p style="margin: 0; font-size: 11px; color: ${TEXT_COLOR_LIGHT};">
                      © ${new Date().getFullYear()} GoVendy. Todos los derechos reservados.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: ${TEXT_COLOR_LIGHT};">
                      <a href="${BASE_URL}" style="color: ${TEXT_COLOR_LIGHT}; text-decoration: none;">gopocket.com.mx</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
