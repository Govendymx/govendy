'use client';

import { useEffect, useState } from 'react';

export function AuctionDeadline({ createdAt, orderStatus }: { createdAt: string | null | undefined; orderStatus?: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  // No mostrar el temporizador si la orden ya fue pagada
  const isPaid = orderStatus && orderStatus !== 'pending_payment';

  useEffect(() => {
    if (!createdAt || isPaid) {
      setTimeLeft(null);
      return;
    }

    const start = new Date(createdAt).getTime();
    const end = start + 7 * 24 * 60 * 60 * 1000; // 7 días desde creación (fin de subasta)

    const update = () => {
      const now = Date.now();
      const remaining = end - now;

      if (remaining <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, totalMs: remaining });
    };

    update();
    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  if (!timeLeft) return null;

  if (timeLeft.totalMs === 0) {
    return (
      <div className="mt-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="text-xs font-extrabold text-red-900">Tiempo agotado</div>
        </div>
        <div className="mt-0.5 text-[10px] text-red-800/80">El plazo de 7 días ha finalizado.</div>
      </div>
    );
  }

  // Alerta visual si queda poco tiempo (menos de 24h)
  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

  return (
    <div className={`mt-2 rounded-xl border px-3 py-2 transition-colors ${isUrgent ? 'border-red-300 bg-red-50 animate-pulse' : 'border-blue-300 bg-blue-50'}`}>
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isUrgent ? 'text-red-700' : 'text-blue-700'}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <div className="flex-1">
          <div className={`text-xs font-extrabold ${isUrgent ? 'text-red-900' : 'text-blue-900'}`}>
            Cierre de operación: {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className={`mt-0.5 text-[10px] ${isUrgent ? 'text-red-800/80' : 'text-blue-800/80'}`}>
            Tiempo límite para concretar la subasta.
          </div>
        </div>
      </div>
    </div>
  );
}
