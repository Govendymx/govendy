'use client';

import { useEffect, useState } from 'react';

// Componente para contador regresivo de 48 horas (Calificación/Auto-liberación)
export function Countdown48Hours({ deliveredAt, isBuyer = false }: { deliveredAt: string | null | undefined; isBuyer?: boolean }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  useEffect(() => {
    if (!deliveredAt) {
      setTimeLeft(null);
      return;
    }

    const start = new Date(deliveredAt).getTime();
    const end = start + 48 * 60 * 60 * 1000; // 48 horas en milisegundos

    const update = () => {
      const now = Date.now();
      const remaining = end - now;

      if (remaining <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, totalMs: remaining });
    };

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [deliveredAt]);

  if (!timeLeft) return null;

  if (timeLeft.totalMs === 0) {
    return (
      <div className="rounded-xl border border-gray-300 bg-gray-100 px-3 py-2 mt-2">
        <div className="text-xs font-extrabold text-gray-900">✅ Plazo finalizado</div>
        <div className="mt-0.5 text-[10px] text-gray-800/80">El dinero se ha liberado automáticamente.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-purple-300 bg-purple-50 px-3 py-2 transition-colors mt-2">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-700 animate-pulse">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div className="flex-1">
          <div className="text-xs font-extrabold text-purple-900">
            Auto-liberación: {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className="mt-0.5 text-[10px] text-purple-800/80">
            {isBuyer 
              ? 'Tienes 48h para confirmar y calificar.' 
              : 'El dinero se liberará automáticamente si no hay reclamos.'}
          </div>
        </div>
      </div>
    </div>
  );
}
