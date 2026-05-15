'use client';

import { Wallet, CheckCircle2, Zap } from 'lucide-react';
import Image from 'next/image';

export function PocketCashPanel() {
  return (
    <div className="rounded-3xl border border-pink-100/50 bg-gradient-to-br from-white to-pink-50/30 p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 mb-5">
        <div className="rounded-full bg-pink-100 p-2">
          <Wallet className="h-5 w-5 text-brand-orange" />
        </div>
        <h3 className="text-base font-extrabold text-gray-900">PocketCash</h3>
      </div>

      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full bg-pink-50 p-2">
              <Zap className="h-5 w-5 text-brand-orange" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900">Pagos al instante</h4>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">
              Usa tu saldo PocketCash para comprar sin esperas ni comisiones extra.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <div className="rounded-full bg-pink-50 p-2">
              <CheckCircle2 className="h-5 w-5 text-brand-orange" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900">Recargas fáciles</h4>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed">
              Recarga tu saldo en OXXO, transferencia o tarjeta y compra seguro.
            </p>
          </div>
        </div>
        
        <div className="mt-2 flex justify-center">
            <div className="h-8 w-24 relative opacity-80 hover:opacity-100 transition-opacity">
               <Image 
                 src="/payment-logos/pocketcash.svg" 
                 alt="PocketCash" 
                 fill
                 className="object-contain"
               />
            </div>
        </div>
      </div>
    </div>
  );
}
