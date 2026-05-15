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
              <ShieldCheck className="h-7 w-7 text-brand-orange" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-brand-orange leading-none">GoVendy</div>
              <div className="text-sm font-bold text-brand-orange">Compra Segura</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
              <Truck className="h-6 w-6 text-brand-orange" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-brand-orange leading-none">Envios Seguros</div>
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
              <RefreshCw className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Devoluciones fáciles</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                Realiza devoluciones locales gratuitas por defectos en compras elegibles.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="shrink-0">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Garantía de devolución de dinero</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                Solicita un reembolso si tu pedido no se envía, no llega o hay defectos en el producto.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-2 text-[10px] text-gray-400 leading-tight">
          Solo los pedidos realizados y pagados a través de GoVendy reciben la protección gratuita de <span className="font-bold text-yellow-500">GoVendy Compra Segura</span>
        </div>
      </div>
    </div>
  );
}
