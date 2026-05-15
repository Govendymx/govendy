'use client';

import { ShieldCheck, CreditCard, RotateCcw } from 'lucide-react';
import Image from 'next/image';

const PaymentLogos = () => {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {/* MercadoPago */}
      <div className="group relative flex h-8 w-12 items-center justify-center overflow-hidden rounded-md bg-white px-1 py-0.5 shadow-sm ring-1 ring-gray-100 transition-all hover:scale-105 hover:shadow-md">
        <Image 
          src="/payment-logos/mercadopago.png" 
          alt="MercadoPago" 
          width={48} 
          height={32} 
          className="h-full w-auto object-contain"
        />
      </div>

      {/* PocketCash */}
      <div className="group relative flex h-8 w-12 items-center justify-center overflow-hidden rounded-md bg-white px-1 py-0.5 shadow-sm ring-1 ring-gray-100 transition-all hover:scale-105 hover:shadow-md">
        <Image 
          src="/payment-logos/pocketcash.svg" 
          alt="PocketCash" 
          width={48} 
          height={32} 
          className="h-full w-auto object-contain"
        />
      </div>

      {/* OXXO */}
      <div className="group relative flex h-8 w-12 items-center justify-center overflow-hidden rounded-md bg-white px-1 py-0.5 shadow-sm ring-1 ring-gray-100 transition-all hover:scale-105 hover:shadow-md">
        <Image 
          src="/payment-logos/oxxo.png" 
          alt="OXXO" 
          width={48} 
          height={32} 
          className="h-full w-auto object-contain"
        />
      </div>

      {/* Transferencia */}
      <div className="group relative flex h-8 w-12 items-center justify-center overflow-hidden rounded-md bg-white px-1 py-0.5 shadow-sm ring-1 ring-gray-100 transition-all hover:scale-105 hover:shadow-md">
        <Image 
          src="/payment-logos/transferencia.png" 
          alt="Transferencia" 
          width={48} 
          height={32} 
          className="h-full w-auto object-contain"
        />
      </div>

      {/* Depósito */}
      <div className="group relative flex h-8 w-12 items-center justify-center overflow-hidden rounded-md bg-white px-1 py-0.5 shadow-sm ring-1 ring-gray-100 transition-all hover:scale-105 hover:shadow-md">
        <Image 
          src="/payment-logos/deposito.png" 
          alt="Depósito" 
          width={48} 
          height={32} 
          className="h-full w-auto object-contain"
        />
      </div>
    </div>
  );
};

export function BuyerProtection() {
  return (
    <div className="h-full rounded-3xl border border-pink-100/50 bg-gradient-to-br from-white to-pink-50/30 p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-full bg-pink-100 p-1.5">
          <ShieldCheck className="h-4 w-4 text-brand-orange" />
        </div>
        <h3 className="text-sm font-extrabold text-gray-900 leading-tight">Protección al Comprador</h3>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full bg-pink-50 p-1.5">
              <CreditCard className="h-4 w-4 text-brand-orange" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900">Pagos seguros</h4>
            <p className="mt-0.5 text-[10px] text-gray-600 leading-snug">
              Tecnología de encriptación líder.
            </p>
            <PaymentLogos />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full bg-pink-50 p-1.5">
              <RotateCcw className="h-4 w-4 text-brand-orange" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900">Reembolso garantizado</h4>
            <p className="mt-0.5 text-[10px] text-gray-600 leading-snug">
              Si no es lo que esperabas, te devolvemos tu dinero.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-pink-100/50 pt-3">
        <div className="h-2 w-2 rounded-full bg-yellow-400" />
        <span className="text-[10px] font-medium text-gray-500">Compras protegidas de principio a fin</span>
      </div>
    </div>
  );
}
