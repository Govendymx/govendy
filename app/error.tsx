'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log para facilitar diagnóstico en consola del navegador
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Ocurrió un error</div>
              <div className="text-xs text-gray-500">Intenta recargar o vuelve al inicio</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error?.message || 'Error inesperado.'}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Reintentar
            </button>
            <Link
              href="/"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Ir al inicio
            </Link>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Si esto se queda en blanco, casi siempre es por caché de Next corrupto. Cierra el servidor, borra `.next` y vuelve a
            correr `npm run dev`.
          </div>
        </div>
      </div>
    </div>
  );
}

