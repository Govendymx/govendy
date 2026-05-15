'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import PockyAssist from '@/components/docs/PockyAssist';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ShoppingBagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function GavelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

const CATEGORIES = [
  {
    id: 'comprar',
    title: 'Guía de Compra',
    description: 'Aprende a encontrar y comprar tus productos favoritos paso a paso.',
    icon: ShoppingBagIcon,
    href: '/ayuda/comprar',
    color: 'bg-blue-50 text-blue-600 ring-blue-100',
  },
  {
    id: 'vender',
    title: 'Centro de Vendedores',
    description: 'Tips para crear publicaciones efectivas y aumentar tus ventas.',
    icon: TagIcon,
    href: '/ayuda/vender',
    color: 'bg-green-50 text-green-600 ring-green-100',
  },
  {
    id: 'subastas',
    title: 'Subastas',
    description: 'Cómo participar, pujar y ganar en nuestras subastas en vivo.',
    icon: GavelIcon,
    href: '/ayuda/subastas',
    color: 'bg-purple-50 text-purple-600 ring-purple-100',
  },
  {
    id: 'destacados',
    title: 'Productos Destacados',
    description: 'Descubre cómo destacar tus productos para vender más rápido.',
    icon: StarIcon,
    href: '/ayuda/destacados',
    color: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
];

const POPULAR_ARTICLES = [
  { title: '¿Cómo protegen mi compra?', href: '/ayuda/comprar#proteccion' },
  { title: 'Métodos de pago aceptados', href: '/ayuda/comprar#pagos' },
  { title: '¿Cómo funcionan los envíos?', href: '/ayuda/comprar#envios' },
  { title: 'Política de devoluciones', href: '/ayuda/comprar#devoluciones' },
  { title: 'Consejos para tomar buenas fotos', href: '/ayuda/vender#fotos' },
  { title: '¿Cuándo recibo mi dinero?', href: '/ayuda/vender#pagos' },
];

export default function AyudaPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      <PockyAssist />
      {/* Hero Section */}
      <div className="bg-white pb-16 pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                ¿Cómo podemos ayudarte?
              </h1>
              <p className="mt-4 text-xl text-gray-500">
                Encuentra guías, tutoriales y respuestas a todas tus dudas sobre Pocky.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-8"
            >
              <div className="relative mx-auto max-w-2xl">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full rounded-2xl border-0 bg-gray-100 py-4 pl-12 pr-4 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-emerald sm:text-lg sm:leading-6 transition-all"
                  placeholder="Buscar en la documentación (ej. 'cómo vender', 'envíos', 'subastas')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                href={category.href}
                className="group flex h-full flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-lg hover:shadow-brand-emerald/5 hover:ring-brand-emerald/20"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${category.color}`}>
                  <category.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-emerald transition-colors">
                  {category.title}
                </h3>
                <p className="mt-2 flex-1 text-sm text-gray-500">
                  {category.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-semibold text-brand-emerald opacity-0 transition-opacity group-hover:opacity-100">
                  Ver guía <span className="ml-1">→</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Popular Articles */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-gray-900">Artículos populares</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POPULAR_ARTICLES.map((article, index) => (
              <Link
                key={article.title}
                href={article.href}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50 hover:ring-brand-emerald/20"
              >
                <BookIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{article.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Dynamic Sections Link */}
        <div className="mt-20 rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white shadow-xl sm:p-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-brand-emerald/20 blur-3xl"></div>
          <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Descubre lo más popular en Pocky</h2>
              <p className="mt-4 text-lg text-gray-300">
                Explora nuestros listados actualizados de productos más vendidos, tendencias mensuales y recomendaciones personalizadas.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/ayuda/mas-vendidos"
                  className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-sm transition hover:bg-gray-50"
                >
                  Ver Más Vendidos
                </Link>
                <Link
                  href="/explorar"
                  className="rounded-xl bg-gray-700 px-6 py-3 text-sm font-bold text-white shadow-sm ring-1 ring-white/10 transition hover:bg-gray-600"
                >
                  Explorar Todo
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              {/* Abstract visual or illustration could go here */}
              <div className="grid grid-cols-2 gap-4 opacity-50">
                <div className="h-32 rounded-2xl bg-white/10"></div>
                <div className="h-32 rounded-2xl bg-white/10 translate-y-8"></div>
                <div className="h-32 rounded-2xl bg-white/10"></div>
                <div className="h-32 rounded-2xl bg-white/10 translate-y-8"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact/Support Footer */}
        <div className="mt-20 border-t border-gray-200 pt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900">¿No encuentras lo que buscas?</h2>
          <p className="mt-4 text-gray-500">Nuestro equipo de soporte está disponible para ayudarte.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/dashboard/soporte"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-emerald px-6 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 transition"
            >
              <span>💬</span>
              Contactar Soporte
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
