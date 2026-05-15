'use client';

import Link from 'next/link';

export default function CompraProtegidaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </Link>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Compra protegida</div>
              <div className="text-xs text-gray-500">Cómo protegemos tu compra</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
            Seguridad
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Compra protegida en GoVendy</h1>
          <p className="mt-3 text-sm text-gray-700">
            La idea es simple: <span className="font-semibold">retenemos el dinero del comprador</span> mientras el envío está en camino.
            Cuando el paquete llega y todo está correcto, <span className="font-semibold">liberamos el dinero al vendedor</span>.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">1) Pagas con confianza</div>
              <div className="mt-1 text-sm text-gray-600">El pago queda registrado y protegido mientras se procesa el envío.</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">2) El vendedor envía</div>
              <div className="mt-1 text-sm text-gray-600">Se genera guía y se te notifica cuando el paquete es enviado.</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">3) Recibes el producto</div>
              <div className="mt-1 text-sm text-gray-600">Confirmas recepción o se valida la entrega por el tracking.</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">4) Liberamos el pago</div>
              <div className="mt-1 text-sm text-gray-600">Una vez entregado, liberamos el pago al vendedor.</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Nota: el flujo exacto (tiempos, confirmaciones y devoluciones) se complementa con el módulo de operaciones y disputas.
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/listings" className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Explorar artículos
            </Link>
            <Link href="/dashboard/ayuda" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Ir a Ayuda
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}


