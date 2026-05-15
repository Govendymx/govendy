'use client';

import { Truck, PackageCheck, MapPin } from 'lucide-react';

export function EnviosPanel() {
  return (
    <div className="rounded-3xl border border-pink-100/50 bg-gradient-to-br from-white to-pink-50/30 p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 mb-5">
        <div className="rounded-full bg-pink-100 p-2">
          <Truck className="h-5 w-5 text-brand-emerald" />
        </div>
        <h3 className="text-base font-extrabold text-gray-900">Envíos Seguros</h3>
      </div>

      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full bg-pink-50 p-2">
              <PackageCheck className="h-5 w-5 text-brand-emerald" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900">Estafeta</h4>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">
              Todos tus envíos están asegurados y rastreados con la red confiable de Estafeta.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full bg-pink-50 p-2">
              <MapPin className="h-5 w-5 text-brand-emerald" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900">Rastreo en tiempo real</h4>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">
              Sigue tu paquete desde que sale hasta que llega a tu puerta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
