'use client';

import { ShieldCheck, CheckCircle2 } from 'lucide-react';

export function SafeShoppingPromo() {
  return (
    <div className="overflow-hidden rounded-[2.5rem] bg-brand-emerald p-6 text-white shadow-lg shadow-brand-emerald/20">
      <div className="text-center">
        <h3 className="text-sm font-medium opacity-90">Consejos de seguridad</h3>
        <div className="mt-1 text-3xl font-black tracking-tight">Compra con Confianza</div>
      </div>

      <div className="mt-6 flex items-center justify-center">
        <ShieldCheck className="h-16 w-16 text-white opacity-90" strokeWidth={1.5} />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
          <span className="text-sm font-bold leading-tight text-white/95">
            Prefiere vendedores con insignia de Verificado
          </span>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
          <span className="text-sm font-bold leading-tight text-white/95">
            Usa la logística oficial de Envíos GoVendy
          </span>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
          <span className="text-sm font-bold leading-tight text-white/95">
            Resuelve todas tus dudas en las preguntas
          </span>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
          <span className="text-sm font-bold leading-tight text-white/95">
            Revisa la reputación antes de comprar
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/10 p-3 text-center text-xs font-semibold leading-relaxed backdrop-blur-sm">
        Tu dinero está protegido. GoVendy retiene el pago hasta que recibes y apruebas tu producto.
      </div>
    </div>
  );
}
