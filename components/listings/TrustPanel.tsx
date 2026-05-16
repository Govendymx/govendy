'use client';

import Image from 'next/image';
import { ShieldCheck, Truck, RefreshCw, DollarSign } from 'lucide-react';

export function TrustPanel() {
  return (
    <div className="rounded-[2.5rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-6">
        {/* Logos Section */}
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
              <ShieldCheck className="h-7 w-7 text-brand-emerald" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-brand-emerald leading-none">GoVendy</div>
              <div className="text-sm font-bold text-brand-emerald">Compra Segura</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
              <Truck className="h-6 w-6 text-brand-emerald" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-brand-emerald leading-none">Envios Seguros</div>
              <div className="relative h-7 w-28">
                <Image
                  src="/estafeta-logo.svg"
                  alt="Estafeta"
                  fill
                  className="object-contain object-left"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="shrink-0">
              <ShieldCheck className="h-5 w-5 text-brand-emerald" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Tu paquete asegurado</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                Con envíos GoVendy tu paquete está asegurado, pídele a tu vendedor que te envíe por envío GoVendy para que podamos vigilar tu producto.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="shrink-0">
              <DollarSign className="h-5 w-5 text-brand-emerald" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Pagos Seguros</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                Transacciones monitoreadas con tecnología de encriptación líder para proteger tu información.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 text-[10px] text-gray-400 leading-tight">
          Solo los pedidos realizados y pagados a través de GoVendy reciben la protección gratuita de <span className="font-bold text-yellow-500">GoVendy Entrega Segura</span>
        </div>
      </div>
    </div>
  );
}
