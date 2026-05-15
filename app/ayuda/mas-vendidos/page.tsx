'use client';

import DocArticle from '@/components/docs/DocArticle';
import { TrendingUp, Eye, ShoppingCart, Award } from 'lucide-react';

// Mock data for top products
const TOP_PRODUCTS = [
  {
    rank: 1,
    name: 'iPhone 15 Pro Max',
    category: 'Electrónica',
    views: '12.5k',
    sales: 450,
    trend: '+15%',
    imageColor: 'bg-gray-800',
  },
  {
    rank: 2,
    name: 'Nike Dunk Low Panda',
    category: 'Moda',
    views: '10.2k',
    sales: 380,
    trend: '+8%',
    imageColor: 'bg-gray-200',
  },
  {
    rank: 3,
    name: 'Sony WH-1000XM5',
    category: 'Audio',
    views: '8.9k',
    sales: 310,
    trend: '+12%',
    imageColor: 'bg-gray-300',
  },
];

const TRENDING_CATEGORIES = [
  { name: 'Sneakers', growth: '+120%', icon: '👟' },
  { name: 'Gaming', growth: '+85%', icon: '🎮' },
  { name: 'Vintage', growth: '+60%', icon: '👕' },
];

export default function MasVendidosPage() {
  return (
    <DocArticle
      title="Productos Más Vendidos y Tendencias"
      description="Análisis mensual de los productos con mayor demanda, métricas de popularidad y recomendaciones para compradores y vendedores."
      category="Destacados"
      categoryLink="/ayuda"
      lastUpdated="8 de febrero de 2026"
    >
      <div className="mb-10 rounded-2xl bg-gradient-to-r from-emerald-500 to-purple-600 p-6 text-white shadow-lg">
        <h4 className="mb-2 flex items-center text-xl font-bold">
          <TrendingUp className="mr-2 h-6 w-6" />
          Tendencias de Febrero 2026
        </h4>
        <p className="opacity-90">
          Este mes observamos un incremento masivo en la categoría de <strong>Electrónica</strong> y <strong>Moda Vintage</strong>. ¡Es el mejor momento para vender estos artículos!
        </p>
      </div>

      <div className="space-y-12">
        {/* Top 3 Products */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-gray-900 flex items-center">
            <Award className="mr-2 h-6 w-6 text-yellow-500" />
            Top 3 Más Vendidos
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {TOP_PRODUCTS.map((product) => (
              <div key={product.rank} className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
                <div className="absolute top-0 right-0 rounded-bl-xl bg-brand-emerald px-3 py-1 text-xs font-bold text-white">
                  #{product.rank}
                </div>
                <div className={`mb-4 h-32 w-full rounded-xl ${product.imageColor} opacity-20`}></div>
                <h3 className="font-bold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-500">{product.category}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center text-gray-600">
                    <Eye className="mr-1 h-4 w-4" /> {product.views}
                  </div>
                  <div className="flex items-center text-green-600 font-medium">
                    <TrendingUp className="mr-1 h-4 w-4" /> {product.trend}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Market Insights */}
        <section className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-3xl bg-gray-50 p-6 ring-1 ring-black/5">
            <h3 className="mb-4 text-lg font-bold text-gray-900 flex items-center">
              <Eye className="mr-2 h-5 w-5 text-blue-500" />
              Lo más buscado
            </h3>
            <ul className="space-y-3">
              {['iPhone 14', 'Vestidos de fiesta', 'Nintendo Switch', 'Funko Pop'].map((term, i) => (
                <li key={i} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                  <span className="text-gray-700">{term}</span>
                  <span className="text-xs font-medium text-green-600">Alta demanda</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-gray-50 p-6 ring-1 ring-black/5">
            <h3 className="mb-4 text-lg font-bold text-gray-900 flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5 text-green-500" />
              Categorías en auge
            </h3>
            <div className="space-y-3">
              {TRENDING_CATEGORIES.map((cat, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center">
                    <span className="mr-3 text-xl">{cat.icon}</span>
                    <span className="font-medium text-gray-900">{cat.name}</span>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                    {cat.growth}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Personalized Recommendations Info */}
        <section className="rounded-2xl bg-blue-50 p-8 text-center">
          <h2 className="text-2xl font-bold text-blue-900">¿Cómo elegimos estas recomendaciones?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-blue-700">
            Nuestro algoritmo analiza millones de interacciones diarias, considerando factores como volumen de búsquedas, velocidad de venta y satisfacción del comprador para traerte los datos más precisos.
          </p>
        </section>
      </div>
    </DocArticle>
  );
}
