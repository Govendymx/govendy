'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ListingForm from '@/components/listings/ListingForm';
import { supabase } from '@/lib/supabase/client';

type VerificationState = 'loading' | 'none' | 'pending' | 'approved' | 'rejected';

export default function SellPage() {
  const [vState, setVState] = useState<VerificationState>('loading');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          window.location.href = '/';
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('verification_status, verification_rejection_reason')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (!cancelled) {
          const status = (profile as any)?.verification_status || 'none';
          setVState(status);
          setRejectionReason((profile as any)?.verification_rejection_reason || '');
        }
      } catch {
        if (!cancelled) setVState('none');
      }
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  if (vState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-emerald border-t-transparent" />
      </div>
    );
  }

  if (vState === 'approved') {
    return <ListingForm mode="create" />;
  }

  // Gate: show verification status and redirect
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Publicar producto</div>
              <div className="text-xs text-gray-500">Verificación requerida</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
          >
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 text-center">
          {vState === 'none' && (
            <>
              <div className="text-5xl mb-4">🔒</div>
              <h1 className="text-2xl font-extrabold text-gray-900">Verificación requerida</h1>
              <p className="mt-3 text-sm text-gray-600">
                Para vender en GoVendy necesitas verificar tu identidad subiendo tu INE y una selfie sosteniendo tu INE.
              </p>
              <Link
                href="/verificacion"
                className="mt-6 inline-flex rounded-xl bg-brand-emerald px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
              >
                Completar verificación →
              </Link>
            </>
          )}

          {vState === 'pending' && (
            <>
              <div className="text-5xl mb-4">⏳</div>
              <h1 className="text-2xl font-extrabold text-gray-900">Verificación en revisión</h1>
              <p className="mt-3 text-sm text-gray-600">
                Tus documentos fueron enviados y están siendo revisados por nuestro equipo. Te notificaremos cuando se aprueben para que puedas empezar a vender.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
              >
                Volver al panel
              </Link>
            </>
          )}

          {vState === 'rejected' && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h1 className="text-2xl font-extrabold text-gray-900">Verificación rechazada</h1>
              {rejectionReason && (
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                  <strong>Motivo:</strong> {rejectionReason}
                </div>
              )}
              <p className="mt-3 text-sm text-gray-600">
                Por favor corrige tus documentos y vuelve a enviarlos para poder vender.
              </p>
              <Link
                href="/verificacion"
                className="mt-6 inline-flex rounded-xl bg-brand-emerald px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
              >
                Volver a enviar documentos →
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

