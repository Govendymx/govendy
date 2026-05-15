'use client';

import DocArticle from '@/components/docs/DocArticle';
import Step from '@/components/docs/Step';
import { Star, TrendingUp, Zap, BarChart } from 'lucide-react';

export default function GuiaDestacados() {
  return (
    <DocArticle
      title="Productos Destacados"
      description="Aumenta la visibilidad de tus ventas y llega a miles de compradores potenciales con nuestros planes de promoción."
      category="Destacados"
      categoryLink="/ayuda"
      lastUpdated="8 de febrero de 2026"
    >
      <div className="mb-10 rounded-2xl bg-amber-50 p-6 text-amber-800">
        <h4 className="mb-2 flex items-center font-bold">
          <TrendingUp className="mr-2 h-5 w-5" />
          ¿Por qué destacar?
        </h4>
        <p className="text-sm">
          Los productos destacados aparecen en la página principal y en los primeros resultados de búsqueda. 
          En promedio, <strong>se venden 3 veces más rápido</strong> que las publicaciones normales.
        </p>
      </div>

      <div className="space-y-2">
        <Step
          number={1}
          title="Ve a 'Mis Publicaciones'"
          description="Ingresa a tu perfil y selecciona la pestaña de publicaciones activas. Busca el artículo que quieres promocionar."
          imageAlt="Lista de publicaciones"
        />

        <Step
          number={2}
          title="Selecciona la opción 'Destacar'"
          description="En el menú de opciones del producto (los tres puntitos), elige 'Destacar Publicación' o busca el ícono de estrella."
          imageAlt="Menú de opciones de producto"
        />

        <Step
          number={3}
          title="Elige tu Plan"
          description="Selecciona entre el plan Básico (3 días) o el plan Pro (7 días + etiqueta especial). El pago se realiza con tu saldo de PockyWallet o tarjeta."
          imageAlt="Selector de planes de destacado"
        />

        <Step
          number={4}
          title="¡Listo! Tu producto está en la cima"
          description="Tu publicación aparecerá inmediatamente en la sección de 'Destacados' y tendrá prioridad en las búsquedas."
          imageAlt="Producto con etiqueta de destacado"
          isLast={true}
        />
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8">
        <h3 className="mb-6 text-xl font-bold text-gray-900">Planes Disponibles</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Plan Básico */}
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
              <Zap className="h-6 w-6" />
            </div>
            <h4 className="mb-2 text-lg font-bold text-gray-900">Plan Básico</h4>
            <div className="mb-4 text-3xl font-bold text-gray-900">$29 <span className="text-sm font-normal text-gray-500">mxn</span></div>
            <ul className="mb-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> 3 días de visibilidad</li>
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> Prioridad en búsqueda</li>
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> Etiqueta estándar</li>
            </ul>
          </div>

          {/* Plan Pro */}
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-brand-emerald/20">
            <div className="absolute right-0 top-0 rounded-bl-xl bg-brand-emerald px-3 py-1 text-xs font-bold text-white">RECOMENDADO</div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-emerald/10 text-brand-emerald">
              <Star className="h-6 w-6" />
            </div>
            <h4 className="mb-2 text-lg font-bold text-gray-900">Plan Pro</h4>
            <div className="mb-4 text-3xl font-bold text-gray-900">$59 <span className="text-sm font-normal text-gray-500">mxn</span></div>
            <ul className="mb-6 space-y-3 text-sm text-gray-600">
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> 7 días de visibilidad</li>
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> Máxima prioridad</li>
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> Etiqueta 'Destacado'</li>
              <li className="flex items-center"><Star className="mr-2 h-4 w-4 text-brand-emerald" /> Reporte de vistas</li>
            </ul>
          </div>
        </div>
      </div>
    </DocArticle>
  );
}
