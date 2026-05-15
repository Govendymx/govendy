'use client';

import { ShoppingCart, CreditCard } from 'lucide-react';

export function PocketCashPromo() {
  return (
    <div className="overflow-hidden rounded-[2.5rem] bg-brand-orange p-6 text-white shadow-lg shadow-brand-orange/20">
      <div className="text-center">
        <h3 className="text-sm font-medium opacity-90">Paga tus compras con</h3>
        <div className="mt-1 text-3xl font-black tracking-tight">PocketCash</div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        {/* Visuals - Simplified Card Graphic */}
        <div className="relative h-16 w-24 shrink-0 -rotate-6 transform rounded-xl border-2 border-white/30 bg-white/10 backdrop-blur-sm">
          <div className="absolute top-4 h-2 w-full bg-white/20" />
          <div className="absolute bottom-3 left-2 h-2 w-8 rounded-full bg-white/20" />
          <div className="absolute bottom-3 right-2 h-4 w-4 rounded-full bg-white/20" />
        </div>

        <ShoppingCart className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
          <span className="text-sm font-bold">Realiza Compras</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
          <span className="text-sm font-bold">Recarga Fácilmente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
          <span className="text-sm font-bold">Paga tu Publicidad</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-white" />
          <span className="text-sm font-bold">Transferencias P2P</span>
        </div>
      </div>

      <div className="mt-6 text-center text-xs font-medium leading-relaxed opacity-90">
        Tu monedero digital para compras, recargas y transferencias seguras.
      </div>
    </div>
  );
}
