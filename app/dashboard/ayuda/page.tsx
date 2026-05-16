'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Section = {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
};

export default function DashboardAyudaPage() {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const startSupportChat = async () => {
    setStartError(null);
    setIsStarting(true);
    try {
      const { data: sess, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/dashboard/ayuda';
        return;
      }

      const listRes = await fetch(`/api/support/conversations?t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const listJson = await listRes.json().catch(() => ({} as any));
      if (listRes.ok) {
        const convs = (listJson?.conversations ?? []) as any[];
        const open = convs.find((c) => String(c?.status || '').toLowerCase() === 'open');
        const openId = String(open?.id || '').trim();
        if (openId) {
          window.location.href = `/dashboard/soporte/${openId}`;
          return;
        }
      }

      const createRes = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ subject: 'Ayuda · Iniciar chat con soporte' }),
      });
      const createJson = await createRes.json().catch(() => ({} as any));
      if (!createRes.ok) throw new Error(createJson?.error || 'No se pudo iniciar el chat de soporte.');
      const id = String(createJson?.conversation?.id || '').trim();
      if (!id) throw new Error('No se recibió conversationId.');
      window.location.href = `/dashboard/soporte/${id}`;
    } catch (e: unknown) {
      console.error(e);
      setStartError(e instanceof Error ? e.message : 'No se pudo iniciar el chat de soporte.');
    } finally {
      setIsStarting(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const sections: Section[] = [
    {
      id: 'inicio',
      title: '1. Inicio y Exploración',
      icon: '🏠',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo exploro los productos?</h3>
            <p className="mt-1 text-gray-600">
              Al entrar a <strong>GoVendy</strong> verás la página principal con secciones como <strong>Productos destacados</strong>, <strong>Más vistos</strong>, <strong>Subastas activas</strong> y <strong>Tiendas oficiales</strong>. Puedes desplazarte para descubrir productos o usar la barra de búsqueda en la parte superior para buscar algo específico (por ejemplo: &ldquo;Nike Air Max talla 28&rdquo;).
            </p>
            <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              <strong>💡 Tip:</strong> Usa los filtros por <strong>categoría</strong> (Electrónica, Ropa, Sneakers, etc.), <strong>precio</strong> (mínimo y máximo), <strong>condición</strong> (Nuevo, Usado, Seminuevo) y <strong>género</strong> para encontrar exactamente lo que buscas.
            </div>
            {/* IMG_01: Página principal con productos destacados y barra de búsqueda */}
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <img src="/help/ayuda_explorar_productos.png" alt="Página principal con productos destacados y barra de búsqueda" className="w-full" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo veo los detalles de un producto?</h3>
            <p className="mt-1 text-gray-600">
              Haz clic en cualquier tarjeta de producto para abrir su página de detalle. Ahí encontrarás:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Galería de fotos</strong> — desliza para ver todas las imágenes del producto</li>
              <li><strong>Precio y condición</strong> — si es nuevo, usado o seminuevo</li>
              <li><strong>Descripción completa</strong> del vendedor</li>
              <li><strong>Información del vendedor</strong> — nombre, reputación y calificaciones</li>
              <li><strong>Preguntas y respuestas</strong> — puedes hacer preguntas antes de comprar</li>
              <li><strong>Costo de envío estimado</strong> según tu ubicación</li>
            </ul>
            {/* IMG_02: Página de detalle de un producto */}
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <img src="/help/ayuda_detalle_producto.png" alt="Página de detalle de un producto" className="w-full" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Necesito cuenta para ver productos?</h3>
            <p className="mt-1 text-gray-600">
              <strong>No</strong>, puedes explorar y ver todos los productos sin tener cuenta. Pero para <strong>comprar</strong>, <strong>hacer preguntas</strong>, <strong>agregar a favoritos</strong> o <strong>pujar en subastas</strong> sí necesitas registrarte e iniciar sesión.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo me registro?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-1 text-gray-600">
              <li>Haz clic en <strong>Registrarse</strong> en la esquina superior derecha</li>
              <li>Ingresa tu correo electrónico y crea una contraseña segura</li>
              <li>Revisa tu correo y haz clic en el enlace de confirmación</li>
              <li>¡Listo! Ya puedes comprar, vender y participar en subastas</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'vender',
      title: '2. Publicar y Vender',
      icon: '💰',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo publico un producto para vender?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Haz clic en <strong>Vender</strong> en el menú superior</li>
              <li>Sube entre <strong>2 y 6 fotos</strong> del producto (mínimo 2 obligatorias). Usa fotos claras, con buena iluminación y que muestren el producto desde diferentes ángulos</li>
              <li>Completa toda la información: <strong>título descriptivo</strong>, <strong>descripción detallada</strong> (estado real, defectos si los hay), <strong>precio</strong>, <strong>categoría</strong>, <strong>condición</strong> (Nuevo/Usado/Seminuevo), <strong>género</strong>, <strong>talla</strong>, <strong>color</strong></li>
              <li>Ingresa el <strong>peso y dimensiones</strong> del paquete — esto es necesario para calcular el costo de envío</li>
              <li>Elige el <strong>tipo de venta</strong>: <strong>Precio fijo</strong> o <strong>Subasta</strong></li>
              <li>Si es subasta: define fecha/hora de inicio y fin, precio inicial e incremento mínimo de puja</li>
              <li>Elige el <strong>método de envío</strong>: GoVendy (nosotros generamos la guía) o Envío por vendedor (tú envías con tu propia paquetería)</li>
              <li>Revisa todo y haz clic en <strong>Publicar</strong></li>
            </ol>
            {/* IMG_03: Formulario de publicación de producto (3 imágenes) */}
            <div className="mt-3 space-y-3">
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <img src="/help/ayuda_publicar_fotos.png" alt="Subir fotos del producto" className="w-full" />
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <img src="/help/ayuda_publicar_detalles.png" alt="Detalles del producto: precio, marca, tallas" className="w-full" />
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <img src="/help/ayuda_publicar_envio.png" alt="Configuración de envío y dimensiones" className="w-full" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Puedo vender productos digitales?</h3>
            <p className="mt-1 text-gray-600">
              <strong>Sí</strong>. Al publicar, selecciona <strong>Producto Digital</strong> como tipo de producto. Los productos digitales no requieren envío físico — cuando alguien compre, podrás ingresar los datos de entrega (licencias, códigos, seriales, links de descarga) directamente desde tu panel de <strong>Ventas</strong>.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <img src="/help/ayuda_producto_digital.png" alt="Configuración de producto digital con campos de entrega" className="w-full" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo administro mis publicaciones?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Mis publicaciones</strong> puedes ver todas tus publicaciones activas. Desde ahí puedes: <strong>pausar</strong> (deja de aparecer en búsquedas), <strong>editar</strong> (cambiar precio, descripción, fotos), o <strong>eliminar</strong> la publicación.
            </p>
            {/* IMG_04: Lista de mis publicaciones */}
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <img src="/help/ayuda_mis_publicaciones.png" alt="Lista de mis publicaciones activas" className="w-full" />
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cuánto cobra GoVendy de comisión?</h3>
            <p className="mt-1 text-gray-600">
              GoVendy cobra una <strong>comisión</strong> sobre cada venta completada. La comisión se descuenta automáticamente del total de la venta antes de liberar el pago al vendedor. Puedes ver el desglose exacto (comisión, envío, neto) en tu panel de <strong>Ventas</strong> para cada orden.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo creo un cupón de descuento?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Cupones</strong> puedes crear códigos de descuento para tus productos. Define el tipo (<strong>porcentaje</strong> o <strong>monto fijo</strong>), el valor del descuento, las fechas de vigencia y un límite de usos. Comparte el código con tus compradores para que lo apliquen al momento de pagar.
            </p>
            {/* IMG_05: Panel de cupones del vendedor */}
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <img src="/help/ayuda_cupones.png" alt="Panel de cupones del vendedor" className="w-full" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'comprar',
      title: '3. Comprar Productos',
      icon: '🛒',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo compro un producto?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Encuentra el producto que quieres y haz clic en <strong>Agregar al carrito</strong> (selecciona talla, color y cantidad si aplica)</li>
              <li>Ve al <strong>Carrito</strong> (ícono en la esquina superior) y revisa tus artículos</li>
              <li>Si tienes un <strong>cupón de descuento</strong>, ingrésalo en el campo correspondiente</li>
              <li>Haz clic en <strong>Proceder al pago</strong></li>
              <li>Confirma tu <strong>dirección de envío</strong> — asegúrate de que esté completa y correcta</li>
              <li>Elige tu <strong>método de pago</strong> y completa el pago</li>
              <li>Recibirás una confirmación y podrás dar seguimiento en <strong>Mi cuenta → Compras</strong></li>
            </ol>
            {/* IMG_06: Proceso de checkout paso a paso */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_06: Proceso de checkout</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué métodos de pago aceptan?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-2 text-gray-600">
              <li><strong>Mercado Pago</strong> — Tarjeta de crédito/débito. El pago se procesa al instante y queda protegido</li>
              <li><strong>Transferencia bancaria (SPEI)</strong> — Se te mostrarán los datos para transferir. Debes subir tu comprobante de pago. El vendedor se acreditará cuando se verifique</li>
              <li><strong>Depósito en OXXO</strong> — Recibirás una referencia de pago. Ve a cualquier OXXO, da la referencia y paga en efectivo. Sube tu comprobante</li>
              <li><strong>Saldo GoVendy</strong> — Si tienes saldo disponible en tu cuenta (por reembolsos o promociones), puedes usarlo parcial o totalmente</li>
            </ul>
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠️ Importante:</strong> Para transferencia y OXXO, <strong>debes subir tu comprobante de pago</strong> para que se acredite. Sin comprobante, la orden puede cancelarse.
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo hago preguntas al vendedor antes de comprar?</h3>
            <p className="mt-1 text-gray-600">
              En la página del producto, desplázate hasta la sección <strong>Preguntas y respuestas</strong>. Escribe tu pregunta y envíala. El vendedor recibirá una notificación y cuando responda, tú también recibirás una alerta. Puedes ver todas tus preguntas y respuestas en <strong>Mi cuenta → Respuestas</strong>.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Puedo comprar varios productos de diferentes vendedores?</h3>
            <p className="mt-1 text-gray-600">
              <strong>Sí</strong>. Puedes agregar productos de distintos vendedores al carrito. Al pagar, se creará una orden separada por cada vendedor, cada una con su propio envío y seguimiento.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Es seguro comprar en GoVendy?</h3>
            <p className="mt-1 text-gray-600">
              <strong>Sí</strong>. Tu dinero está protegido: se retiene en GoVendy hasta que confirmes que recibiste el producto en las condiciones descritas. Si hay algún problema, puedes abrir una disputa y el dinero no se libera al vendedor hasta que se resuelva.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'subastas',
      title: '4. Subastas',
      icon: '🔨',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo funciona una subasta?</h3>
            <p className="mt-1 text-gray-600">
              Las subastas permiten comprar productos al mejor precio. El vendedor define un <strong>precio inicial</strong>, un <strong>incremento mínimo por puja</strong> y una <strong>fecha/hora de inicio y fin</strong>. Los compradores van pujando cantidades cada vez mayores. Cuando termina el tiempo, el <strong>último pujador</strong> gana el producto.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo participo en una subasta?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Busca productos con la etiqueta <strong>&ldquo;Subasta&rdquo;</strong> o explora la sección de subastas activas</li>
              <li>Abre el producto y verás: la <strong>puja actual</strong>, el <strong>incremento mínimo</strong> y un <strong>contador de tiempo restante</strong></li>
              <li>Ingresa tu oferta (debe ser al menos la puja actual + el incremento mínimo) y haz clic en <strong>Pujar</strong></li>
              <li>Si alguien puja más que tú, recibirás una <strong>notificación</strong> para que puedas decidir si subes tu oferta</li>
              <li>Cuando el tiempo se agote, si eres el último en pujar, <strong>¡ganaste!</strong></li>
            </ol>
            {/* IMG_07: Página de subasta con contador y botón pujar */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_07: Subasta activa con contador de tiempo</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué pasa si gano una subasta?</h3>
            <p className="mt-1 text-gray-600">
              Recibirás una notificación de que ganaste. Se creará automáticamente una <strong>orden de compra</strong> con el precio de tu puja ganadora. Tendrás que completar el pago como cualquier otra compra (Mercado Pago, transferencia o OXXO). Si no pagas dentro del plazo, la subasta puede asignarse al siguiente pujador.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo sigo una subasta que me interesa?</h3>
            <p className="mt-1 text-gray-600">
              Agrega cualquier subasta a <strong>Favoritos</strong> (ícono de estrella). Recibirás alertas cuando la subasta esté por terminar y cuando alguien puje. El <strong>punto rosa</strong> en el menú te avisará de las alertas.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'ventas',
      title: '5. Gestionar Ventas (Vendedor)',
      icon: '📦',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Dónde veo mis ventas?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Ventas</strong> verás todas tus órdenes. Cada orden muestra: <strong>estado</strong> (Pendiente, Pagado, Enviado, Entregado), datos del <strong>comprador</strong>, <strong>artículos vendidos</strong>, <strong>desglose de cobro</strong> (total, comisión, envío, tu ganancia neta) y las <strong>acciones disponibles</strong>.
            </p>
            {/* IMG_08: Panel de ventas con lista de órdenes */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_08: Panel de ventas con órdenes</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo envío un producto con GoVendy (guía prepagada)?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Cuando una orden cambie a estado <strong>Pagado</strong>, verás el mensaje &ldquo;Generando Guía&rdquo;</li>
              <li>En minutos (hasta 24 horas), aparecerá el botón <strong>Descargar guía</strong></li>
              <li>Descarga e imprime la guía de envío</li>
              <li>Empaqueta bien el producto y pega la guía en el paquete</li>
              <li>Lleva el paquete a la sucursal de la paquetería indicada (Estafeta, DHL, Fedex, etc.)</li>
              <li>Ingresa el <strong>número de rastreo</strong> y la <strong>paquetería</strong> en tu panel de Ventas, luego haz clic en <strong>Marcar como enviado</strong></li>
            </ol>
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠️ Tienes 72 horas</strong> desde que se genera la guía para enviar el producto. Si no envías a tiempo, la orden puede cancelarse.
            </div>
            {/* IMG_09: Botón descargar guía y campo de tracking */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_09: Descargar guía y marcar como enviado</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo envío si elegí &ldquo;Envío por vendedor&rdquo;?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Cuando la orden esté <strong>Pagada</strong>, verás el mensaje: &ldquo;El envío corre por tu cuenta&rdquo;</li>
              <li>Elige la <strong>paquetería</strong> del menú desplegable (DHL, Estafeta, Fedex, Paquetexpress, UPS, Sendex, Castores, Tres guerras u Otra)</li>
              <li>Ingresa el <strong>número de rastreo</strong> proporcionado por la paquetería</li>
              <li>Sube la <strong>evidencia de envío</strong> (foto del comprobante, constancia y/o tu INE)</li>
              <li>Haz clic en <strong>Marcar como enviado</strong></li>
            </ol>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo entrego un producto digital?</h3>
            <p className="mt-1 text-gray-600">
              Para productos digitales, no hay envío físico. Cuando la orden esté <strong>Pagada</strong>, verás un formulario para ingresar los <strong>datos de entrega digital</strong> (código, serial, link de descarga, instrucciones). El comprador recibirá esta información directamente en su panel de Compras.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cuándo puedo calificar al comprador?</h3>
            <p className="mt-1 text-gray-600">
              Podrás calificar al comprador una vez que él confirme la recepción del producto y te califique a ti. La calificación es de <strong>1 a 10 estrellas</strong> con un comentario opcional. Calificar al comprador también desbloquea la <strong>liberación del pago</strong> de esa orden.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo respondo las preguntas de compradores?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Preguntas</strong> verás todas las preguntas que recibes sobre tus productos. Haz clic en una pregunta para responderla. El comprador recibirá una notificación con tu respuesta. Responder rápido y de forma clara mejora tu reputación y aumenta las ventas.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'compras',
      title: '6. Seguimiento de Compras',
      icon: '📥',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo doy seguimiento a mis compras?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Compras</strong> encontrarás todas tus órdenes organizadas por estado:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Pendiente de pago</strong> — Aún no has completado el pago (si pagaste por transferencia/OXXO, sube tu comprobante)</li>
              <li><strong>Pagado</strong> — Tu pago fue acreditado. El vendedor está preparando el envío</li>
              <li><strong>Enviado</strong> — El producto ya va en camino. Puedes ver el número de rastreo</li>
              <li><strong>Entregado</strong> — YA fue entregado, confirma recepción y califica</li>
              <li><strong>Completado</strong> — Transacción finalizada con calificación mutua</li>
            </ul>
            {/* IMG_10: Panel de compras con estados de orden */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_10: Panel de compras con estados</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo confirmo que recibí mi producto?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Ve a <strong>Compras</strong> y busca la orden con estado <strong>Enviado</strong> o <strong>Entregado</strong></li>
              <li>Revisa que el producto sea el correcto y esté en las condiciones descritas</li>
              <li>Haz clic en <strong>Confirmar recepción</strong></li>
              <li>Califica al vendedor (<strong>1 a 10 estrellas</strong>) y opcionalmente deja un comentario sobre tu experiencia</li>
              <li>Al confirmar, el <strong>dinero se libera al vendedor</strong></li>
            </ol>
            <div className="mt-2 rounded-xl bg-white p-3 text-xs text-green-800">
              <strong>✅ Importante:</strong> Al confirmar recepción estás indicando que recibiste el producto correctamente. Si hay algún problema, <strong>abre una disputa antes de confirmar</strong>.
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">Compré un producto digital, ¿dónde lo veo?</h3>
            <p className="mt-1 text-gray-600">
              En tu orden de compra verás una sección especial de <strong>Entrega Digital</strong> con los datos que el vendedor ingresó (código, serial, link, instrucciones). Si el vendedor aún no entrega, verás un mensaje indicando que está <strong>pendiente de entrega digital</strong>.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Puedo chatear con el vendedor?</h3>
            <p className="mt-1 text-gray-600">
              <strong>Sí</strong>. En cada orden verás un <strong>botón de chat</strong> que te permite comunicarte directamente con el vendedor para coordinar detalles del envío, hacer preguntas sobre el producto o resolver cualquier duda. Los mensajes quedan registrados en la orden.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'pagos',
      title: '7. Pagos y Retiros (Vendedor)',
      icon: '💳',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo funciona el sistema de pagos?</h3>
            <p className="mt-1 text-gray-600">
              Cuando vendes un producto, el dinero <strong>no se te envía directamente</strong>. Se retiene de forma segura en GoVendy hasta que el comprador confirme que recibió el producto correctamente. Este sistema protege tanto al comprador como al vendedor.
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Dinero retenido</strong> — Ventas pagadas donde el comprador aún no confirma recepción</li>
              <li><strong>Dinero liberado</strong> — Ventas donde el comprador ya confirmó. Este dinero está listo para retirar</li>
              <li><strong>Dinero en disputa</strong> — Ventas donde hay una disputa abierta. Se retiene hasta resolución</li>
            </ul>
            {/* IMG_11: Panel de pagos con resumen de saldos */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_11: Panel de pagos con resumen</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo configuro mi cuenta para recibir pagos?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Ve a <strong>Mi cuenta → Mi perfil</strong></li>
              <li>Busca la sección <strong>Datos de cobro</strong></li>
              <li>Ingresa tu <strong>email de Mercado Pago</strong> o tu <strong>ID de cuenta</strong></li>
              <li>Guarda los cambios</li>
            </ol>
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠️ Sin cuenta de Mercado Pago configurada</strong>, no podrás retirar tu dinero. Asegúrate de configurarla antes de tu primera venta.
            </div>
            {/* IMG_12: Formulario de datos de cobro con Mercado Pago */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_12: Datos de cobro (Mercado Pago)</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo retiro mi dinero?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Ve a <strong>Mi cuenta → Pagos</strong></li>
              <li>Verifica que tengas <strong>saldo liberado</strong> disponible</li>
              <li>Haz clic en <strong>Retirar a Mercado Pago</strong></li>
              <li>Ingresa el monto que deseas retirar</li>
              <li>Confirma la operación. El dinero se transferirá a tu cuenta de Mercado Pago</li>
              <li>Desde Mercado Pago puedes transferir a tu cuenta bancaria o usar el saldo directamente</li>
            </ol>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cuánto tiempo tarda en liberarse mi pago?</h3>
            <p className="mt-1 text-gray-600">
              El pago se libera <strong>inmediatamente</strong> después de que el comprador confirme recepción y ambos se califiquen mutuamente. No hay periodo de espera adicional. Si hay una disputa, el dinero se retiene hasta que se resuelva.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'disputas',
      title: '8. Disputas y Devoluciones',
      icon: '⚖️',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cuándo debo abrir una disputa?</h3>
            <p className="mt-1 text-gray-600">Abre una disputa si:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li>El producto <strong>no llegó</strong> y el vendedor no responde</li>
              <li>El producto <strong>no es como se describía</strong> (diferente estado, color, talla, modelo)</li>
              <li>El producto llegó <strong>dañado o defectuoso</strong></li>
              <li>Recibiste un <strong>producto diferente</strong> al que compraste</li>
              <li>El vendedor <strong>no entregó el producto digital</strong> prometido</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo abro una disputa?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Ve a <strong>Compras</strong> y encuentra la orden con el problema</li>
              <li>Haz clic en <strong>Abrir disputa</strong></li>
              <li>Selecciona el <strong>motivo</strong> (No recibido, No es como se describía, Dañado, etc.)</li>
              <li>Describe el problema con <strong>detalle</strong></li>
              <li>Opcionalmente, adjunta <strong>fotos o documentos</strong> como evidencia</li>
              <li>Se abrirá un <strong>chat con el vendedor y soporte técnico</strong></li>
            </ol>
            {/* IMG_13: Formulario para abrir disputa */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_13: Abrir disputa con formulario</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo se resuelve una disputa?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Tienes <strong>72 horas</strong> para resolverla directamente con el vendedor por chat</li>
              <li>Si llegan a un acuerdo, cualquiera puede solicitar cerrar la disputa</li>
              <li>Si <strong>no se resuelve en 72 horas</strong>, el equipo de soporte de GoVendy intervendrá</li>
              <li>Soporte <strong>revisará la evidencia</strong> de ambas partes y tomará una decisión</li>
              <li>La decisión puede ser: <strong>reembolso al comprador</strong>, <strong>liberación del pago al vendedor</strong>, o un <strong>acuerdo parcial</strong></li>
            </ol>
            <div className="mt-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              <strong>💡 Tip:</strong> Siempre adjunta fotos y evidencia clara. Mientras más información proporciones, más rápido se resolverá la disputa.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'notificaciones',
      title: '9. Notificaciones y Alertas',
      icon: '🔔',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo funcionan las notificaciones?</h3>
            <p className="mt-1 text-gray-600">
              GoVendy te mantiene informado con un sistema de <strong>alertas en tiempo real</strong>. El <strong>punto rosa parpadeante</strong> en el menú superior te indica que tienes alertas nuevas sin leer. Haz clic en él para ver un resumen rápido.
            </p>
            <div className="mt-2 rounded-xl bg-white p-3 text-xs text-gray-700">
              <strong>Te notificamos sobre:</strong>
              <ul className="mt-1 ml-4 list-disc space-y-1">
                <li>🛒 <strong>Nuevas ventas</strong> — Alguien compró tu producto</li>
                <li>💬 <strong>Preguntas nuevas</strong> — Preguntas en tus publicaciones</li>
                <li>📩 <strong>Respuestas</strong> — El vendedor respondió tu pregunta</li>
                <li>⭐ <strong>Calificaciones</strong> — Te calificaron como comprador o vendedor</li>
                <li>🔨 <strong>Pujas superadas</strong> — Alguien pujó más que tú en una subasta</li>
                <li>⏰ <strong>Subastas por terminar</strong> — Tus subastas favoritas están a punto de cerrar</li>
                <li>📧 <strong>Mensajes de soporte</strong> — Respuesta del equipo de soporte</li>
                <li>⚖️ <strong>Disputas</strong> — Actualizaciones y resoluciones de disputas</li>
              </ul>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Dónde veo todas mis notificaciones?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Notificaciones</strong> encontrarás el historial completo de todas tus alertas. Puedes marcarlas como leídas individualmente o eliminarlas.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'perfil',
      title: '10. Mi Perfil y Cuenta',
      icon: '👤',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo edito mi perfil?</h3>
            <p className="mt-1 text-gray-600">
              En <strong>Mi cuenta → Mi perfil</strong> puedes actualizar:
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Nombre completo</strong> y <strong>nickname</strong></li>
              <li><strong>Teléfono</strong> de contacto</li>
              <li><strong>Dirección de envío</strong> completa (calle, número, colonia, CP, ciudad, estado, referencias, entre calles)</li>
              <li><strong>Foto de perfil</strong></li>
              <li><strong>Datos de cobro</strong> para recibir pagos como vendedor</li>
            </ul>
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠️ Importante:</strong> Tu dirección de envío debe estar completa y correcta. Es la dirección que se usará para calcular costos de envío y recibir tus compras.
            </div>
            {/* IMG_14: Formulario de perfil */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_14: Formulario de perfil del usuario</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué es la verificación con INE?</h3>
            <p className="mt-1 text-gray-600">
              Para mayor seguridad, los vendedores pueden verificar su identidad subiendo fotos del <strong>frente y reverso de su INE/IFE</strong> en <strong>Mi perfil → Subir INE</strong>. Una vez que el equipo de GoVendy apruebe tu verificación, obtendrás una marca de <strong>vendedor verificado</strong> que da más confianza a los compradores.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo cambio mi contraseña?</h3>
            <p className="mt-1 text-gray-600">
              Ve a <strong>Mi cuenta</strong> y busca la opción de <strong>cambiar contraseña</strong>. Si olvidaste tu contraseña, en la pantalla de login haz clic en <strong>&ldquo;¿Olvidaste tu contraseña?&rdquo;</strong> y te enviaremos un enlace de recuperación a tu correo.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué es la membresía Member Pro?</h3>
            <p className="mt-1 text-gray-600">
              <strong>Member Pro</strong> es una membresía premium que te da beneficios exclusivos como vendedor: mejor posicionamiento de tus publicaciones, acceso a funciones avanzadas y una insignia Pro visible en tu perfil. Puedes ver los detalles y activarla desde <strong>Mi cuenta</strong>.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'favoritos',
      title: '11. Favoritos',
      icon: '⭐',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo agrego un producto a favoritos?</h3>
            <p className="mt-1 text-gray-600">
              En cualquier producto (tarjeta o página de detalle), haz clic en el <strong>ícono de estrella ⭐</strong>. El producto se guardará en tu lista de favoritos para que puedas encontrarlo fácilmente después.
            </p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Para qué sirven los favoritos?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Guardar productos</strong> que te interesan pero no quieres comprar ahora</li>
              <li><strong>Seguir subastas</strong> — recibirás alertas cuando estén por terminar o alguien puje</li>
              <li><strong>Comparar precios</strong> — tener una lista de productos similares para decidir cuál comprar</li>
              <li><strong>Acceso rápido</strong> desde <strong>Mi cuenta → Favoritos</strong></li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'reputacion',
      title: '12. Reputación y Calificaciones',
      icon: '🏆',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo funciona la reputación?</h3>
            <p className="mt-1 text-gray-600">
              Cada usuario tiene un <strong>puntaje de reputación</strong> basado en las calificaciones que recibe como comprador y vendedor. Las calificaciones van de <strong>1 a 10 estrellas</strong> e incluyen un comentario opcional. Tu reputación es visible para todos los usuarios y afecta la confianza que generan tus publicaciones.
            </p>
            {/* IMG_15: Panel de reputación con calificaciones */}
            <div className="mt-3 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center">
              <p className="text-xs font-semibold text-indigo-400">📸 IMG_15: Panel de reputación</p>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo mejoro mi reputación?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-2 text-gray-600">
              <li><strong>Como vendedor:</strong> Responde preguntas rápido, envía a tiempo, empaqueta bien, describe tus productos con honestidad</li>
              <li><strong>Como comprador:</strong> Paga a tiempo, confirma recepción cuando recibas el producto, sé amable en el chat</li>
              <li><strong>General:</strong> Evita disputas, resuelve problemas de buena fe, califica a otros usuarios para que ellos te califiquen a ti</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Puedo eliminar una calificación negativa?</h3>
            <p className="mt-1 text-gray-600">
              Las calificaciones <strong>no se pueden eliminar</strong>. Si consideras que una calificación es injusta o falsa, puedes contactar a <strong>soporte técnico</strong> para que revise el caso. Sin embargo, la mejor estrategia es acumular calificaciones positivas para que las negativas tengan menos impacto.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'envios',
      title: '13. Métodos de Envío',
      icon: '🚚',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué métodos de envío existen en GoVendy?</h3>
            <p className="mt-1 text-gray-600">Existen <strong>4 formas de envío</strong> en la plataforma. El vendedor define al publicar cuál(es) estará(n) disponible(s):</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-center gap-2 font-bold text-blue-800">📦 Envío GoVendy</div>
                <p className="mt-1 text-xs text-gray-600">GoVendy genera una <strong>guía de envío prepagada</strong> automáticamente con paqueterías como <strong>Paquete Express, Estafeta, DHL, FedEx, UPS, 99 Minutos, J&T y Sendex</strong>. La paquetería se asigna al azar dependiendo la distancia, código postal, medidas y peso del paquete, sin posibilidad de elegirla. El costo se calcula según el <strong>peso y dimensiones</strong> del paquete. El vendedor descarga la guía, la pega en el paquete y lo deja en la sucursal. Incluye <strong>rastreo automático</strong>.</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-center gap-2 font-bold text-blue-800">📦 Envío GoVendy Gratis</div>
                <p className="mt-1 text-xs text-gray-600">Igual que el Envío GoVendy, pero el vendedor <strong>absorbe el costo del envío</strong> (se descuenta de sus ganancias). El comprador no paga envío. Ideal para vendedores que quieren ser más competitivos.</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white/50 p-3">
                <div className="flex items-center gap-2 font-bold text-emerald-800">📬 Envío Gestionado por el Vendedor</div>
                <p className="mt-1 text-xs text-gray-600">El vendedor <strong>elige su propia paquetería</strong> y envía por su cuenta. Debe ingresar el número de rastreo, la paquetería y subir evidencia de envío (foto del comprobante). Disponible para planes <strong>Pro y Platinum</strong>.</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                <div className="flex items-center gap-2 font-bold text-violet-800">🤝 Entrega Personal</div>
                <p className="mt-1 text-xs text-gray-600">Comprador y vendedor coordinan la entrega en persona. No hay costo de envío. Disponible exclusivamente para el plan <strong>Platinum</strong>. En subastas, todos los planes pueden ofrecer entrega personal.</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white/50 p-3">
                <div className="flex items-center gap-2 font-bold text-emerald-800">💻 Producto Digital</div>
                <p className="mt-1 text-xs text-gray-600">No requiere envío físico. El vendedor entrega códigos, licencias, seriales o links de descarga directamente desde su panel de Ventas. El comprador los ve en su panel de Compras.</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo se calcula el costo de envío GoVendy?</h3>
            <p className="mt-1 text-gray-600">El costo se basa en el <strong>peso real</strong> del paquete y su <strong>peso volumétrico</strong> (calculado con largo × ancho × alto ÷ 5000). Se usa el mayor de los dos. Los rangos van desde <strong>$175 MXN</strong> (hasta 1 kg) hasta <strong>$325 MXN</strong> (hasta 30 kg). GoVendy puede subsidiar parte del envío en promociones.</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <strong>⚠️ Importante:</strong> El vendedor tiene <strong>72 horas</strong> para enviar el paquete después de que se genera la guía. Si no lo hace, la orden puede cancelarse automáticamente.
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué paquetería se utiliza para realizar los envíos GoVendy?</h3>
            <p className="mt-1 text-gray-600">
              Para cumplir con la demanda y dar los costos más bajos posibles, GoVendy tiene una <strong>alianza importante con las principales paqueterías de México</strong>. Es por eso que tu envío puede ser enviado por <strong>Estafeta, DHL, FedEx, UPS, 99 Minutos, J&T, Paquete Express y Sendex</strong>. La paquetería se selecciona al azar dependiendo la distancia y código postal, <strong>sin posibilidad de elegirla</strong>.
            </p>
            <div className="mt-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
              <strong>📦 Paqueterías aliadas:</strong> Paquete Express · Estafeta · DHL · FedEx · UPS · 99 Minutos · J&T · Sendex
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo evito sobrepesos en mis envíos?</h3>
            <p className="mt-1 text-gray-600">
              <strong>Agrega medidas y peso exactos</strong> de tu producto al publicar para calcular el peso volumétrico correcto. Si el comprador requiere más de 2 piezas, puedes generarle una <strong>publicación especial</strong> para que pague el envío correcto sin generarte sobrepesos.
            </p>
            <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠️ Tip:</strong> El peso volumétrico se calcula como <strong>largo × ancho × alto ÷ 5000</strong>. La paquetería cobra por el mayor entre el peso real y el volumétrico. Si tus medidas son incorrectas, podrías recibir un cargo por sobrepeso.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'pocketcash',
      title: '14. PocketCash (Monedero Digital)',
      icon: '💰',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué es PocketCash?</h3>
            <p className="mt-1 text-gray-600">PocketCash es tu <strong>monedero digital</strong> dentro de GoVendy. Funciona como un saldo disponible que puedes usar para pagar compras <strong>al instante</strong> sin necesidad de transferencias ni tarjetas.</p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo se carga saldo a PocketCash?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-2 text-gray-600">
              <li><strong>Recarga manual:</strong> Ve a <strong>Mi cuenta → Monedero</strong> y haz clic en &ldquo;Recargar&rdquo;. Puedes depositar fondos mediante transferencia bancaria (SPEI) o depósito en OXXO.</li>
              <li><strong>Gift Cards:</strong> Si compraste o recibiste una <strong>tarjeta de regalo GoVendy</strong>, canjéala en el monedero ingresando el código.</li>
              <li><strong>Reembolsos:</strong> Si se cancela una orden o se resuelve una disputa a tu favor, el monto se abona automáticamente a tu PocketCash.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo pago con PocketCash?</h3>
            <p className="mt-1 text-gray-600">Al momento de pagar en el checkout, selecciona <strong>&ldquo;PocketCash&rdquo;</strong> como método de pago. Si tu saldo es suficiente, el pago se procesa <strong>al instante</strong> sin comisiones adicionales. Si tu saldo es insuficiente, la opción aparecerá deshabilitada.</p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Dónde veo mi saldo y movimientos?</h3>
            <p className="mt-1 text-gray-600">En <strong>Mi cuenta → Monedero</strong> verás tu saldo actual, historial de movimientos (recargas, pagos, reembolsos) y el estado de cada transacción.</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-xs text-green-800">
            <strong>✅ Ventaja:</strong> Pagar con PocketCash es <strong>instantáneo</strong> y no tiene la comisión extra de MercadoPago. Es la forma más rápida de comprar en GoVendy.
          </div>
        </div>
      ),
    },
    {
      id: 'metodos-pago',
      title: '15. Métodos de Pago (Detallado)',
      icon: '💳',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">Métodos de pago disponibles</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                <div className="font-bold text-blue-800">💳 Tarjeta (MercadoPago)</div>
                <p className="mt-1 text-xs text-gray-600">Paga con tarjeta de <strong>crédito o débito</strong> a través de MercadoPago. El pago se acredita <strong>al instante</strong>. Se cobra una pequeña comisión por procesamiento (visible antes de confirmar). Acepta Visa, Mastercard, American Express.</p>
              </div>
              <div className="rounded-xl border border-green-200 bg-white/50 p-3">
                <div className="font-bold text-green-800">💰 PocketCash</div>
                <p className="mt-1 text-xs text-gray-600">Usa tu saldo disponible en el monedero digital. Pago <strong>instantáneo, sin comisiones</strong>. Requiere saldo suficiente.</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                <div className="font-bold text-gray-800">🏦 Transferencia Bancaria (SPEI)</div>
                <p className="mt-1 text-xs text-gray-600">Se te proporcionan los datos bancarios de GoVendy para transferir. Acreditación en <strong>1 a 24 horas</strong>. <strong>Debes subir tu comprobante de pago</strong> para que se verifique.</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                <div className="font-bold text-gray-800">🏧 Depósito Bancario</div>
                <p className="mt-1 text-xs text-gray-600">Deposita en ventanilla o practicaja con los datos proporcionados. Acreditación en <strong>1 a 24 horas</strong>. Sube tu comprobante para acelerar la verificación.</p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                <div className="font-bold text-orange-800">🏪 OXXO Pay</div>
                <p className="mt-1 text-xs text-gray-600">Paga en efectivo en cualquier tienda OXXO con la referencia que se te genera. Acreditación puede tardar hasta <strong>24 horas</strong>. Sube tu comprobante.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <strong>⚠️ Para pagos offline</strong> (Transferencia, Depósito, OXXO): siempre <strong>sube tu comprobante de pago</strong> desde el panel de Compras. Sin comprobante, tu orden puede cancelarse por falta de verificación.
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo subo mi comprobante de pago?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-1 text-gray-600">
              <li>Ve a <strong>Mi cuenta → Compras</strong></li>
              <li>Encuentra tu orden con estado <strong>Pendiente de pago</strong></li>
              <li>Haz clic en <strong>Subir comprobante</strong></li>
              <li>Sube foto o captura del comprobante de la transferencia, depósito o ticket de OXXO</li>
              <li>El equipo de GoVendy lo verificará y acreditará tu pago</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'planes',
      title: '16. Planes de Suscripción',
      icon: '👑',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué planes existen?</h3>
            <p className="mt-1 text-gray-600">GoVendy ofrece <strong>3 planes</strong> para vendedores. Cada uno tiene diferentes beneficios y límites:</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-3 py-2 text-left font-bold">Característica</th>
                  <th className="border border-gray-200 px-3 py-2 text-center font-bold text-gray-600">🟢 Básico</th>
                  <th className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">🔵 Pro</th>
                  <th className="border border-gray-200 px-3 py-2 text-center font-bold text-amber-600">👑 Platinum</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border border-gray-200 px-3 py-2">Precio</td><td className="border border-gray-200 px-3 py-2 text-center font-bold text-green-600">Gratis</td><td className="border border-gray-200 px-3 py-2 text-center">Suscripción mensual</td><td className="border border-gray-200 px-3 py-2 text-center">Suscripción mensual</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">Comisión por venta</td><td className="border border-gray-200 px-3 py-2 text-center">23%</td><td className="border border-gray-200 px-3 py-2 text-center font-bold text-blue-600">18%</td><td className="border border-gray-200 px-3 py-2 text-center font-bold text-amber-600">18%</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2">Publicaciones activas</td><td className="border border-gray-200 px-3 py-2 text-center">50</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitadas</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitadas</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">Subastas activas</td><td className="border border-gray-200 px-3 py-2 text-center">15</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitadas</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitadas</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2">Cupones de descuento</td><td className="border border-gray-200 px-3 py-2 text-center">25/mes</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitados</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitados</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">Publicaciones destacadas</td><td className="border border-gray-200 px-3 py-2 text-center">3</td><td className="border border-gray-200 px-3 py-2 text-center">25</td><td className="border border-gray-200 px-3 py-2 text-center">Ilimitadas</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2">Envío gestionado por vendedor</td><td className="border border-gray-200 px-3 py-2 text-center">❌</td><td className="border border-gray-200 px-3 py-2 text-center">✅</td><td className="border border-gray-200 px-3 py-2 text-center">✅</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">Entrega personal</td><td className="border border-gray-200 px-3 py-2 text-center">❌</td><td className="border border-gray-200 px-3 py-2 text-center">❌</td><td className="border border-gray-200 px-3 py-2 text-center">✅</td></tr>
                <tr><td className="border border-gray-200 px-3 py-2">Lives (transmisiones)</td><td className="border border-gray-200 px-3 py-2 text-center">❌</td><td className="border border-gray-200 px-3 py-2 text-center">✅ (con créditos)</td><td className="border border-gray-200 px-3 py-2 text-center">✅ (2 hrs gratis/día)</td></tr>
                <tr className="bg-gray-50"><td className="border border-gray-200 px-3 py-2">Retiro de ganancias</td><td className="border border-gray-200 px-3 py-2 text-center">Cada 7 días</td><td className="border border-gray-200 px-3 py-2 text-center">Cada 48 hrs</td><td className="border border-gray-200 px-3 py-2 text-center">Cada 24 hrs</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo cambio de plan?</h3>
            <p className="mt-1 text-gray-600">Ve a <strong>Mi cuenta → Pro</strong> para ver los planes disponibles y activar o cambiar tu suscripción. El cambio se aplica de inmediato y los beneficios se activan al instante.</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
            <strong>💡 Tip:</strong> Si apenas empiezas, el plan <strong>Básico (gratis)</strong> es suficiente. Cuando crezcas y necesites más publicaciones, envío por vendedor o Lives, considera <strong>Pro</strong> o <strong>Platinum</strong>.
          </div>
        </div>
      ),
    },
    {
      id: 'lives',
      title: '17. Lives y Tienda en Vivo',
      icon: '📺',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué son los Lives?</h3>
            <p className="mt-1 text-gray-600">Los Lives son <strong>transmisiones en vivo</strong> donde los vendedores pueden mostrar sus productos en tiempo real, interactuar con compradores y vender directamente. Es como un &ldquo;show de ventas&rdquo; en línea.</p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo inicio un Live?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>Ve a <strong>Mi cuenta → Live</strong></li>
              <li>Configura tu transmisión: título, descripción y productos que mostrarás</li>
              <li>Haz clic en <strong>Iniciar Live</strong></li>
              <li>Usa tu cámara para mostrar los productos en vivo</li>
              <li>Los compradores pueden ver, hacer preguntas en el chat y comprar directamente</li>
            </ol>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Quién puede hacer Lives?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Plan Básico:</strong> No tiene acceso a Lives</li>
              <li><strong>Plan Pro:</strong> Puede hacer Lives comprando créditos de tiempo extra</li>
              <li><strong>Plan Platinum:</strong> <strong>2 horas gratis diarias</strong> de transmisión (no acumulables). Puede comprar horas adicionales si las necesita</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué es la Tienda de Lives?</h3>
            <p className="mt-1 text-gray-600">La <strong>Tienda de Lives</strong> es una sección de GoVendy donde los compradores pueden explorar todos los Lives activos en ese momento. Es como un &ldquo;canal de ventas en vivo&rdquo; donde puedes descubrir productos y vendedores nuevos. Accede desde el menú principal.</p>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo compro durante un Live?</h3>
            <p className="mt-1 text-gray-600">Mientras ves un Live, los productos que muestra el vendedor aparecen en un panel lateral. Puedes hacer clic en cualquier producto para ver sus detalles, agregarlo al carrito y comprarlo — <strong>todo sin salir del Live</strong>.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'subastas-detalle',
      title: '18. Subastas (Guía Completa)',
      icon: '🔨',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo funciona una subasta paso a paso?</h3>
            <ol className="mt-2 ml-4 list-decimal space-y-2 text-gray-600">
              <li>El vendedor publica un producto con tipo de venta <strong>&ldquo;Subasta&rdquo;</strong></li>
              <li>Define: <strong>precio inicial</strong> (la primera puja mínima), <strong>incremento mínimo</strong> (cuánto debe subir cada puja), <strong>fecha/hora de inicio</strong> y <strong>fecha/hora de fin</strong></li>
              <li>Cuando inicia la subasta, los compradores pueden <strong>pujar</strong>. Cada puja debe ser al menos la puja actual + el incremento mínimo</li>
              <li>Un <strong>contador de tiempo</strong> muestra cuánto falta para que termine</li>
              <li>Cuando el tiempo se agota, el <strong>último pujador gana</strong></li>
              <li>Se crea automáticamente una <strong>orden de compra</strong> con el precio de la puja ganadora</li>
              <li>El ganador elige entre <strong>Envío</strong> o <strong>Entrega Personal</strong> y completa el pago</li>
            </ol>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué pasa cuando gano una subasta?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-2 text-gray-600">
              <li>Recibes una <strong>notificación</strong> de que ganaste</li>
              <li>En <strong>Compras</strong> verás la orden con estado &ldquo;Pendiente de Pago&rdquo;</li>
              <li>Antes de pagar, podrás elegir el <strong>método de envío</strong> (Envío GoVendy o Entrega Personal)</li>
              <li>Selecciona tu <strong>método de pago</strong> (Tarjeta, PocketCash, Transferencia, Depósito, OXXO)</li>
              <li>Completa el pago y el vendedor procederá con el envío</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cuántas subastas puedo crear como vendedor?</h3>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Plan Básico:</strong> Hasta 15 subastas activas simultáneas</li>
              <li><strong>Plan Pro y Platinum:</strong> Subastas ilimitadas</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué pasa si nadie puja?</h3>
            <p className="mt-1 text-gray-600">Si la subasta termina sin ninguna puja, el producto se <strong>pausa automáticamente</strong>. El vendedor puede volver a publicarlo como subasta con nuevas fechas o cambiarlo a precio fijo.</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <strong>⚠️ Importante:</strong> Al pujar en una subasta te comprometes a comprar si ganas. Si ganas y no pagas, tu reputación puede verse afectada.
          </div>
        </div>
      ),
    },
    {
      id: 'panel-compras',
      title: '19. Panel de Compras (Detallado)',
      icon: '🛍️',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué veo en el Panel de Compras?</h3>
            <p className="mt-1 text-gray-600">En <strong>Mi cuenta → Compras</strong> verás <strong>todas tus órdenes de compra</strong>. Cada tarjeta de orden muestra:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Imagen y nombre</strong> del producto comprado</li>
              <li><strong>Precio total</strong> pagado (incluyendo envío)</li>
              <li><strong>Estado de la orden</strong> con un chip de color</li>
              <li><strong>Tipo de envío</strong> (Envío GoVendy, Vendedor, Entrega Personal, Digital)</li>
              <li><strong>Fecha de compra</strong></li>
              <li>Si es subasta: etiqueta <strong>&ldquo;Subasta&rdquo;</strong></li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">Estados de una orden de compra</h3>
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2"><span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">PENDIENTE PAGO</span><span className="text-xs text-gray-600">— Aún no has pagado. Puedes subir comprobante o seleccionar método de pago.</span></div>
              <div className="flex items-start gap-2"><span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">PAGADO</span><span className="text-xs text-gray-600">— Tu pago fue verificado. El vendedor está preparando el envío.</span></div>
              <div className="flex items-start gap-2"><span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">ENVIADO</span><span className="text-xs text-gray-600">— El producto va en camino. Verás número de rastreo y paquetería.</span></div>
              <div className="flex items-start gap-2"><span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">ENTREGADO</span><span className="text-xs text-gray-600">— La paquetería reporta entrega. Confirma recepción y califica.</span></div>
              <div className="flex items-start gap-2"><span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">COMPLETADO</span><span className="text-xs text-gray-600">— Transacción finalizada. Ambas partes calificaron.</span></div>
            </div>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">Botones y acciones disponibles</h3>
            <ul className="mt-2 ml-4 list-disc space-y-2 text-gray-600">
              <li><strong>💳 Pagar</strong> — Abre el modal de pago para elegir método y completar el pago</li>
              <li><strong>📄 Subir comprobante</strong> — Sube foto/captura de tu comprobante de transferencia o depósito</li>
              <li><strong>📞 Chat</strong> — Abre el chat directo con el vendedor para resolver dudas</li>
              <li><strong>✅ Confirmar recepción</strong> — Confirma que recibiste el producto correctamente y califica al vendedor</li>
              <li><strong>⭐ Dejar reseña</strong> — Escribe una reseña del producto con fotos y calificación</li>
              <li><strong>⚖️ Abrir disputa</strong> — Si hay un problema con el producto o la entrega</li>
              <li><strong>📦 Rastrear envío</strong> — Ver número de rastreo y link a la paquetería</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'panel-ventas',
      title: '20. Panel de Ventas (Detallado)',
      icon: '📊',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué veo en el Panel de Ventas?</h3>
            <p className="mt-1 text-gray-600">En <strong>Mi cuenta → Ventas</strong> verás todas tus órdenes de venta con:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-600">
              <li><strong>Producto vendido</strong> con imagen y nombre</li>
              <li><strong>Datos del comprador</strong> (nombre, dirección de envío)</li>
              <li><strong>Estado de la orden</strong> con chip de color</li>
              <li><strong>Desglose financiero</strong>: total de venta, comisión GoVendy, costo de envío, y tu <strong>ganancia neta</strong></li>
              <li><strong>Tipo de envío</strong> configurado</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">Botones y acciones del vendedor</h3>
            <ul className="mt-2 ml-4 list-disc space-y-2 text-gray-600">
              <li><strong>📥 Descargar guía</strong> — Descarga la guía de envío prepagada (solo Envío GoVendy)</li>
              <li><strong>📦 Marcar como enviado</strong> — Ingresa número de rastreo, selecciona paquetería y confirma el envío</li>
              <li><strong>📄 Subir evidencia</strong> — Sube foto del comprobante de envío (envío por vendedor)</li>
              <li><strong>💻 Entregar digital</strong> — Ingresa códigos, seriales o links para productos digitales</li>
              <li><strong>📞 Chat</strong> — Comunícate con el comprador</li>
              <li><strong>⭐ Calificar comprador</strong> — Califica de 1 a 10 estrellas cuando la transacción termine</li>
            </ul>
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">¿Cómo veo mis ganancias?</h3>
            <p className="mt-1 text-gray-600">En cada orden verás el desglose: <strong>Total de venta</strong> − <strong>Comisión GoVendy</strong> − <strong>Costo de envío</strong> = <strong>Tu ganancia neta</strong>. También puedes ver el resumen general en <strong>Mi cuenta → Pagos</strong>.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'menus-usuario',
      title: '21. Menús del Panel de Usuario',
      icon: '📋',
      content: (
        <div className="space-y-5 text-sm text-gray-700">
          <div>
            <h3 className="font-extrabold text-gray-900">¿Qué opciones tengo en Mi Cuenta?</h3>
            <p className="mt-1 text-gray-600">Al hacer clic en tu avatar o en <strong>Mi cuenta</strong>, accedes al panel de usuario con las siguientes secciones:</p>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>👤 Mi Perfil</strong> — Edita tu nombre, foto, teléfono, dirección de envío y datos de cobro (MercadoPago)</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>📦 Mis Publicaciones</strong> — Lista de todos tus productos publicados. Edita, pausa o elimina publicaciones</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>🛍️ Compras</strong> — Historial de todas tus compras con seguimiento de estado y acciones</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>📊 Ventas</strong> — Historial de tus ventas, envíos pendientes, guías y desglose de cobros</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>💰 Monedero (PocketCash)</strong> — Tu saldo digital, recargas, movimientos y gift cards</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>💳 Pagos</strong> — Resumen de dinero retenido, liberado y en disputa. Retira tus ganancias</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>⭐ Favoritos</strong> — Productos que marcaste como favoritos para ver después</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>🏆 Reputación</strong> — Tu puntaje de reputación y calificaciones recibidas</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>🔔 Notificaciones</strong> — Historial de todas tus alertas y avisos</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>❓ Preguntas</strong> — Preguntas que te han hecho sobre tus productos (como vendedor)</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>💬 Respuestas</strong> — Respuestas que has recibido a tus preguntas (como comprador)</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>📺 Live</strong> — Configura y gestiona tus transmisiones en vivo</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>🎫 Cupones</strong> — Crea y administra códigos de descuento para tus productos</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>📝 Plantillas</strong> — Guarda plantillas de descripción para reutilizar en publicaciones</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>📢 Publicidad</strong> — Promociona tus productos con publicidad pagada dentro de GoVendy</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>👑 Pro</strong> — Información sobre planes de suscripción y beneficios premium</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>👥 Siguiendo</strong> — Vendedores y tiendas que sigues para ver sus novedades</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>⚖️ Disputas</strong> — Gestiona disputas abiertas con compradores o vendedores</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>🔄 Devoluciones</strong> — Solicitudes de devolución y su estado</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>💬 Soporte</strong> — Chats con el equipo de soporte técnico de GoVendy</div>
              <div className="rounded-lg border border-gray-200 p-2.5"><strong>❓ Ayuda</strong> — Esta guía completa de la plataforma</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Centro de Ayuda</div>
              <div className="text-xs text-gray-500">Guía completa de la plataforma</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h1 className="text-2xl font-extrabold text-gray-900">Centro de Ayuda - GoVendy</h1>
          <p className="mt-2 text-sm text-gray-600">
            Guía completa para usar la plataforma. Aquí encontrarás respuestas a las preguntas más frecuentes sobre cómo comprar, vender, enviar productos, gestionar pagos y más. Haz clic en cualquier sección para expandirla.
          </p>
        </div>

        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{section.icon}</span>
                  <span className="text-base font-extrabold text-gray-900">{section.title}</span>
                </div>
                <span className="text-xl text-gray-400">{expandedSection === section.id ? '▲' : '▼'}</span>
              </button>
              {expandedSection === section.id && <div className="border-t border-black/5 p-5">{section.content}</div>}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-extrabold text-gray-900">Preguntas Frecuentes Rápidas</h2>
          <div className="mt-4 space-y-4 text-sm text-gray-700">
            <div>
              <div className="font-semibold text-gray-900">¿Cuánto tiempo tengo para enviar un producto vendido?</div>
              <div className="mt-1 text-gray-600">Tienes <strong>72 horas</strong> desde que se genera la guía de envío para empaquetar, pegar la guía y dejar el paquete en la paquetería. Si no lo haces a tiempo, la orden podría cancelarse automáticamente.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿Cuándo recibo mi dinero como vendedor?</div>
              <div className="mt-1 text-gray-600">El dinero se libera <strong>inmediatamente</strong> cuando el comprador confirma que recibió el producto y ambos se califican mutuamente. Después puedes retirarlo a tu cuenta de Mercado Pago.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Pagué por transferencia/OXXO pero no se acredita, ¿qué hago?</div>
              <div className="mt-1 text-gray-600">Asegúrate de haber <strong>subido tu comprobante de pago</strong> en la sección de la orden. Si ya lo subiste y han pasado más de 24 horas, contacta a <strong>soporte técnico</strong> con tu comprobante a la mano.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿Puedo cancelar una compra?</div>
              <div className="mt-1 text-gray-600">Depende del estado. Si el producto <strong>aún no se ha enviado</strong>, contacta al vendedor por chat para solicitar la cancelación. Si <strong>ya se envió</strong>, deberás recibir el producto y abrir una disputa si hay algún problema.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿Qué pasa si el vendedor no envía mi producto?</div>
              <div className="mt-1 text-gray-600">Si el vendedor no envía dentro de las 72 horas, la orden puede cancelarse automáticamente y recibirás un <strong>reembolso</strong>. También puedes abrir una disputa desde tu panel de Compras.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿El envío tiene costo?</div>
              <div className="mt-1 text-gray-600">Sí, el costo de envío se calcula automáticamente según el <strong>peso y dimensiones</strong> del producto y la <strong>distancia</strong> entre el vendedor y el comprador. Lo verás desglosado antes de pagar. En algunos casos, el vendedor puede subsidiar parte del envío.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿GoVendy es seguro?</div>
              <div className="mt-1 text-gray-600"><strong>Sí</strong>. Tu dinero se retiene en GoVendy hasta que confirmes la recepción del producto. Si hay algún problema, puedes abrir una disputa y el equipo de soporte intervendrá. Además, los vendedores pueden verificarse con su INE para mayor confianza.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿Puedo vender sin ser Member Pro?</div>
              <div className="mt-1 text-gray-600"><strong>Sí</strong>, puedes vender sin membresía. Member Pro te da beneficios adicionales como mejor posicionamiento y funciones avanzadas, pero no es obligatorio para vender.</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">¿Cómo sé si un vendedor es confiable?</div>
              <div className="mt-1 text-gray-600">Revisa su <strong>reputación</strong> (calificaciones y comentarios de otros compradores), si tiene la <strong>marca de verificado</strong> (INE verificado), cuántas ventas ha completado, y lee las preguntas y respuestas de sus productos.</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-semibold text-gray-900">¿Necesitas ayuda adicional?</div>
          <div className="mt-1 text-sm text-gray-600">Abre un chat de soporte para que te atendamos personalmente.</div>
          {startError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{startError}</div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void startSupportChat()}
              disabled={isStarting}
              className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              {isStarting ? 'Iniciando…' : 'Iniciar chat con soporte'}
            </button>
            <Link
              href="/dashboard/soporte"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Ver mis chats
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

