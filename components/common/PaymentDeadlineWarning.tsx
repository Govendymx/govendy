'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  createdAt: string | Date | null;
  className?: string;
};

export default function PaymentDeadlineWarning({ createdAt, className = '' }: Props) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!createdAt) return;
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const timeRemaining = useMemo(() => {
    if (!createdAt) return null;
    const created = new Date(createdAt);
    const deadline = new Date(created.getTime() + 48 * 60 * 60 * 1000); // 48 horas desde creación
    const diff = deadline.getTime() - currentTime.getTime();
    
    if (diff <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0 };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { expired: false, hours, minutes, seconds };
  }, [createdAt, currentTime]);

  if (!createdAt || !timeRemaining) return null;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 shadow-sm ${
        timeRemaining.expired
          ? 'border-red-300 bg-red-50'
          : timeRemaining.hours < 12
            ? 'border-red-300 bg-red-50 animate-pulse'
            : 'border-orange-300 bg-orange-50'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={timeRemaining.expired ? '#dc2626' : timeRemaining.hours < 12 ? '#dc2626' : '#ea580c'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="flex-1">
          <div className={`text-sm font-extrabold ${timeRemaining.expired ? 'text-red-900' : timeRemaining.hours < 12 ? 'text-red-900' : 'text-orange-900'}`}>
            {timeRemaining.expired
              ? '⚠️ Tiempo de pago vencido'
              : `⚠️ Tiempo restante para pagar: ${timeRemaining.hours}h ${timeRemaining.minutes}m ${timeRemaining.seconds}s`}
          </div>
          <div className={`mt-1 text-xs ${timeRemaining.expired ? 'text-red-800' : timeRemaining.hours < 12 ? 'text-red-800' : 'text-orange-800'}`}>
            {timeRemaining.expired
              ? 'El plazo de 48 horas ha expirado. Tu reputación como comprador se verá afectada negativamente si no completas el pago.'
              : 'Tienes 48 horas desde que agregaste el primer artículo al carrito para completar tu pago. Si no pagas a tiempo, tu reputación como comprador se verá afectada negativamente.'}
          </div>
        </div>
      </div>
    </div>
  );
}
