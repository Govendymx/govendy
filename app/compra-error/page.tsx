'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CompraErrorContent() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams?.get('checkoutId') ?? '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
            <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
          </Link>
          <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Mi cuenta
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 ring-2 ring-red-200">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">
            Pago no completado
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            No pudimos procesar tu pago
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Tu carrito sigue guardado. Puedes volver a intentar con otro método de pago o más tarde.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/checkout"
              className="rounded-xl bg-brand-emerald px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
            >
              Volver al checkout
            </Link>
            <Link
              href="/cart"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Ver carrito
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CompraErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-emerald mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <CompraErrorContent />
    </Suspense>
  );
}
