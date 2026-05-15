'use client';

import DocArticle from '@/components/docs/DocArticle';
import Step from '@/components/docs/Step';
import Link from 'next/link';
import { ShoppingBag, Search, CreditCard, CheckCircle } from 'lucide-react';

export default function GuiaComprar() {
  return (
    <DocArticle
      title="Cómo comprar en Pocky"
      description="Guía paso a paso para realizar tu primera compra de forma segura y sencilla."
      category="Comprar"
      categoryLink="/ayuda"
      lastUpdated="8 de febrero de 2026"
    >
      <div className="mb-10 rounded-2xl bg-blue-50 p-6 text-blue-800">
        <h4 className="mb-2 flex items-center font-bold">
          <CheckCircle className="mr-2 h-5 w-5" />
          Antes de empezar
        </h4>
        <p className="text-sm">
          Asegúrate de haber iniciado sesión en tu cuenta. Si aún no tienes una,{' '}
          <Link href="/login" className="font-medium underline hover:text-blue-600">
            regístrate aquí
          </Link>{' '}
          en menos de 1 minuto.
        </p>
      </div>

      <div className="space-y-2">
        <Step
          number={1}
          title="Encuentra lo que buscas"
          description="Usa la barra de búsqueda en la parte superior para encontrar productos específicos, o navega por nuestras categorías destacadas. Puedes filtrar por precio, talla, condición y más."
          imageAlt="Barra de búsqueda y filtros"
        />

        <Step
          number={2}
          title="Revisa los detalles del producto"
          description="Haz clic en el producto que te interesa. Revisa atentamente las fotos, la descripción, el estado del artículo y la reputación del vendedor. Si tienes dudas, puedes preguntar directamente en la sección de preguntas."
          imageAlt="Página de detalle del producto"
        />

        <Step
          number={3}
          title="Agrega al carrito o compra ahora"
          description="Si quieres seguir viendo más cosas, selecciona 'Agregar al carrito'. Si ya estás decidido, presiona 'Comprar ahora' para ir directo al pago."
          imageAlt="Botones de compra"
        />

        <Step
          number={4}
          title="Elige tu método de envío y pago"
          description="Ingresa tu dirección de envío y selecciona tu método de pago preferido (tarjeta de crédito/débito, transferencia, o saldo en Pocky). Todos los pagos están protegidos por nuestra Garantía de Compra Segura."
          imageAlt="Pantalla de checkout"
        />

        <Step
          number={5}
          title="¡Listo! Recibe tu pedido"
          description="Una vez confirmado el pago, recibirás un correo con los detalles. El vendedor preparará tu paquete y podrás seguir el envío desde la sección 'Mis Compras'."
          imageAlt="Confirmación de pedido"
          isLast={true}
        />
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8">
        <h3 className="mb-4 text-xl font-bold text-gray-900">Preguntas frecuentes sobre compras</h3>
        <ul className="space-y-4">
          <li>
            <Link href="/ayuda/envios" className="group flex items-start">
              <span className="mr-2 text-brand-emerald">•</span>
              <span className="text-gray-600 group-hover:text-brand-emerald transition-colors">
                ¿Cuánto tarda en llegar mi pedido?
              </span>
            </Link>
          </li>
          <li>
            <Link href="/ayuda/devoluciones" className="group flex items-start">
              <span className="mr-2 text-brand-emerald">•</span>
              <span className="text-gray-600 group-hover:text-brand-emerald transition-colors">
                ¿Qué pasa si el producto no es lo que esperaba?
              </span>
            </Link>
          </li>
          <li>
            <Link href="/ayuda/pagos" className="group flex items-start">
              <span className="mr-2 text-brand-emerald">•</span>
              <span className="text-gray-600 group-hover:text-brand-emerald transition-colors">
                ¿Es seguro usar mi tarjeta de crédito?
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </DocArticle>
  );
}
