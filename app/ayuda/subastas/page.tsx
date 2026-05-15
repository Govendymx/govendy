'use client';

import DocArticle from '@/components/docs/DocArticle';
import Step from '@/components/docs/Step';
import Link from 'next/link';
import { Gavel, Clock, AlertCircle, Trophy } from 'lucide-react';

export default function GuiaSubastas() {
  return (
    <DocArticle
      title="Tutorial de Subastas Pocky"
      description="Descubre cómo funcionan nuestras subastas dinámicas, cómo participar para ganar tesoros únicos y cómo crear tus propias subastas."
      category="Subastas"
      categoryLink="/ayuda"
      lastUpdated="8 de febrero de 2026"
    >
      <div className="mb-10 rounded-2xl bg-purple-50 p-6 text-purple-800 border border-purple-100">
        <h4 className="mb-2 flex items-center font-bold">
          <Gavel className="mr-2 h-5 w-5" />
          ¿Qué es una Subasta Pocky?
        </h4>
        <p className="text-sm">
          Es una modalidad emocionante donde el precio lo deciden los compradores. Los productos comienzan con un precio base bajo y los usuarios ofertan hasta que se acaba el tiempo. ¡Quien ofrece más, gana!
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="mb-6 text-2xl font-bold text-gray-900 flex items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-white text-sm font-bold mr-3">A</span>
            Cómo Participar (Comprar)
          </h2>
          <div className="space-y-2">
            <Step
              number={1}
              title="Encuentra una subasta activa"
              description="Navega a la sección 'Subastas' o busca productos con el icono de mazo. Verás el tiempo restante y la oferta actual."
              imageAlt="Listado de subastas"
            />
            <Step
              number={2}
              title="Realiza tu oferta"
              description="Ingresa un monto superior a la oferta actual (el sistema te indicará el mínimo). Confirmaremos tu puja al instante."
              imageAlt="Pantalla de puja"
            />
            <Step
              number={3}
              title="Mantente atento"
              description="Si alguien supera tu oferta, te avisaremos para que puedas contraatacar. ¡Los últimos minutos son los más intensos!"
              imageAlt="Notificación de superado"
            />
             <Step
              number={4}
              title="¡Ganaste!"
              description="Si tu oferta es la más alta al finalizar el tiempo, el producto es tuyo. Tendrás 24 horas para completar el pago."
              imageAlt="Pantalla de ganador"
              isLast={true}
            />
          </div>
        </section>

        <section className="pt-8 border-t border-gray-100">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 flex items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-bold mr-3">B</span>
            Cómo Crear una Subasta (Vender)
          </h2>
          <div className="space-y-2">
            <Step
              number={1}
              title="Selecciona 'Formato Subasta'"
              description="Al crear una publicación, elige 'Subasta' en lugar de 'Venta Directa'."
              imageAlt="Selector de tipo de venta"
            />
            <Step
              number={2}
              title="Define el Precio Base"
              description="Es el precio mínimo desde donde empezarán las ofertas. Recomendamos empezar bajo para atraer a más gente."
              imageAlt="Input de precio base"
            />
            <Step
              number={3}
              title="Establece la Duración"
              description="Elige cuánto durará la subasta (1, 3, 5 o 7 días). Las subastas cortas suelen generar más urgencia."
              imageAlt="Selector de duración"
              isLast={true}
            />
          </div>
        </section>
      </div>

      <div className="mt-12 rounded-3xl bg-gray-900 p-8 text-white">
        <h3 className="mb-4 text-xl font-bold flex items-center">
          <Trophy className="mr-2 h-6 w-6 text-yellow-400" />
          Reglas de Oro
        </h3>
        <ul className="space-y-4">
          <li className="flex items-start">
            <Clock className="mr-3 h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <span className="font-bold text-white">Compromiso de compra:</span> Al ofertar, te comprometes a pagar si ganas. No ofertar "por diversión".
            </div>
          </li>
          <li className="flex items-start">
            <AlertCircle className="mr-3 h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <span className="font-bold text-white">Anti-Sniper:</span> Si hay una oferta en los últimos 2 minutos, el tiempo se extiende automáticamente para dar oportunidad a todos.
            </div>
          </li>
        </ul>
      </div>
    </DocArticle>
  );
}
