'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type PlanType = 'basic' | 'pro';

export function PlanWidget({ userId }: { userId: string }) {
  const [plan, setPlan] = useState<PlanType | null>(null);
  const [dates, setDates] = useState<{ start: string | null; end: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('plan_type, pro_subscription_start, pro_subscription_end')
          .eq('id', userId)
          .single();
          
        if (!cancelled && data) {
          const p = data.plan_type;
          setPlan(p === 'pro' ? 'pro' : 'basic');
          setDates({
            start: data.pro_subscription_start || null,
            end: data.pro_subscription_end || null
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return null;

  const isPro = plan === 'pro';
  const endDate = dates?.end ? new Date(dates.end) : null;
  const isExpired = isPro && endDate && endDate < new Date();

  let planName = 'Básico (Gratis)';
  let planColorClass = 'text-gray-700';
  let containerClass = 'border-gray-200 bg-white';
  let description = 'Estás en el plan gratuito. Actualiza a PRO para vender sin límites y acceder a beneficios exclusivos.';
  let buttonText = 'Cámbiate a PRO';
  let buttonClass = 'bg-gray-900 text-white hover:bg-black';
  let badgeColor = 'bg-gray-500';
  let badgeText = 'Activo';

  if (isPro) {
    if (isExpired) {
      planName = 'PRO (Vencido)';
      planColorClass = 'text-red-600';
      containerClass = 'border-red-200 bg-red-50';
      description = 'Tu plan PRO ha vencido. Renueva ahora para recuperar tus beneficios.';
      buttonText = 'Renovar Plan';
      buttonClass = 'bg-red-600 text-white hover:bg-red-700';
      badgeColor = 'bg-red-600';
      badgeText = 'Expirado';
    } else {
      planName = 'PRO';
      planColorClass = 'text-brand-emerald';
      containerClass = 'border-brand-emerald/20 bg-gradient-to-r from-pink-50 to-white';
      description = 'Disfrutas de beneficios PRO: comisiones reducidas (18%) y publicaciones ilimitadas.';
      buttonText = 'Gestionar Plan';
      buttonClass = 'bg-white text-brand-emerald ring-1 ring-brand-emerald/20 hover:bg-pink-50';
      badgeColor = 'bg-brand-emerald';
    }
  } else {
     description = 'Estás en el plan gratuito (23% comisión). Actualiza a PRO para bajar a 18% y vender sin límites.';
  }

  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-6 py-5 shadow-sm ${containerClass}`}>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900">
            Tu Plan: <span className={planColorClass}>{planName}</span>
          </h3>
          {isPro && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow-sm ${badgeColor}`}>
              {badgeText}
            </span>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          {description}
        </p>
        {isPro && dates?.end && (
          <div className="mt-2 text-xs text-gray-500 flex gap-4">
             {dates.start && <span>Inicio: <strong>{new Date(dates.start).toLocaleDateString('es-MX')}</strong></span>}
             <span>{isExpired ? 'Venció' : 'Vence'}: <strong>{new Date(dates.end).toLocaleDateString('es-MX')}</strong></span>
          </div>
        )}
      </div>
      <Link
        href="/dashboard/pro"
        className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition ${buttonClass}`}
      >
        {buttonText}
      </Link>
    </div>
  );
}
