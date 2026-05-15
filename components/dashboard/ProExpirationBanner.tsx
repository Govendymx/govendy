'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { differenceInDays, parseISO } from 'date-fns';

export function ProExpirationBanner() {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('profiles')
          .select('plan_type, pro_subscription_end')
          .eq('id', user.id)
          .single();

        if (data) {
          setIsPro(data.plan_type === 'pro');
          setExpirationDate(data.pro_subscription_end);
        }
      } catch (e) {
        console.error('Error checking PRO status:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !isPro || !expirationDate) return null;

  const daysLeft = differenceInDays(parseISO(expirationDate), new Date());
  
  // If more than 5 days left, don't show anything
  if (daysLeft > 5) return null;

  const isExpired = daysLeft < 0;

  if (isExpired) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-xl">
            ⚠️
          </span>
          <div>
            <h3 className="font-bold">Tu suscripción PRO ha expirado</h3>
            <p className="text-sm text-red-700">
              Has perdido los beneficios exclusivos. Renueva ahora para recuperar comisiones reducidas y publicaciones ilimitadas.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/pro"
          className="whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
        >
          Renovar PRO
        </Link>
      </div>
    );
  }

  // Warning zone (0-5 days)
  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-900 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-xl">
          ⏳
        </span>
        <div>
          <h3 className="font-bold">Tu suscripción PRO expira en {daysLeft} {daysLeft === 1 ? 'día' : 'días'}</h3>
          <p className="text-sm text-yellow-700">
            Evita interrupciones en tus ventas. Renueva antes de que termine tu periodo.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/pro"
        className="whitespace-nowrap rounded-lg bg-yellow-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-yellow-700"
      >
        Renovar Ahora
      </Link>
    </div>
  );
}
