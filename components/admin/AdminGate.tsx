'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type GateState = 'loading' | 'ok' | 'login' | 'denied';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const [state, setState] = useState<GateState>('loading');

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          if (!cancelled) setState('login');
          return;
        }

        const res = await fetch('/api/admin/me', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          setState(res.ok && json?.isAdmin ? 'ok' : 'denied');
        }
      } catch {
        if (!cancelled) setState('denied');
      }
    };

    void verify();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void verify());

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state !== 'login') return;
    const returnTo = encodeURIComponent(pathname);
    router.replace(`/login?returnTo=${returnTo}`);
  }, [state, pathname, router]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-gray-600">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-emerald border-t-transparent" />
        <p className="text-sm font-medium">Verificando acceso de administrador…</p>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Acceso restringido</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tu cuenta no tiene permisos de administrador. Si crees que es un error, pide que te agreguen en{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">admin_users</code> en Supabase.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ir a mi cuenta
          </Link>
          <Link href="/" className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200">
            Inicio
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'login') return null;

  return <>{children}</>;
}
