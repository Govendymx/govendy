'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { normalizeReturnTo } from '@/lib/auth/redirect';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'register';
};

export function AuthModal({ isOpen, onClose, initialView = 'login' }: Props) {
  const [view, setView] = useState<'login' | 'register'>(initialView);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean | 'google' | 'facebook' | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setError(null);
      setEmail('');
      setPassword('');
    }
  }, [isOpen, initialView]);

  // Lock body scroll while open (without overflow-hidden on body which breaks iOS fixed)
  useEffect(() => {
    if (!isOpen) return;
    const y = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const redirectTo = (() => {
    if (typeof window === 'undefined') return undefined;
    const base = window.location.origin;
    const sp = new URLSearchParams(window.location.search);
    const safe = normalizeReturnTo(sp.get('returnTo'));
    const qp = new URLSearchParams();
    if (safe) qp.set('returnTo', safe);
    const suffix = qp.toString() ? `/?${qp.toString()}` : '/';
    return `${base}${suffix}`;
  })();

  const signInOAuth = async (provider: 'google' | 'facebook') => {
    setError(null);
    setIsLoading(provider);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || undefined,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (authError) throw authError;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
      setIsLoading(null);
    }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      const userId = signInData?.user?.id;
      if (userId) {
        try {
          const stateRes = await fetch(`/api/support/user-state?userId=${userId}`);
          if (stateRes.ok) {
            const stateJson = await stateRes.json();
            if (stateJson?.status === 'banned') {
              await supabase.auth.signOut();
              setError('Tu cuenta ha sido bloqueada permanentemente. No puedes iniciar sesión.');
              setIsLoading(null);
              return;
            }
            if (stateJson?.status === 'suspended') {
              onClose();
              window.location.href = '/dashboard/suspendido';
              return;
            }
          }
        } catch { /* allow login */ }
      }

      onClose();
      window.location.reload();
    } catch (err: unknown) {
      let errorMessage = 'No se pudo iniciar sesión.';
      if (err instanceof Error) {
        if (err.message.includes('invalid login credentials')) {
          errorMessage = 'Email o contraseña incorrectos.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      setIsLoading(null);
    }
  };

  return (
    /* Backdrop: full-screen overlay, scrollable so the modal is reachable on tiny screens */
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Registro e inicio de sesión"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card: full-width on mobile, max 448px on larger */}
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5">
          <div className="mx-auto text-center">
            {view === 'login' ? (
              <>
                <h2 className="text-xl font-bold text-gray-900">Inicia sesión</h2>
                <div className="text-sm text-gray-600 mt-1">Accede para comprar y vender</div>
              </>
            ) : (
              <div className="text-sm text-gray-600">Vende lo que ya no te pones y compra con descuento todo el año</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 -mr-1 rounded-xl p-2 text-gray-500 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2"
            aria-label="Cerrar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {view === 'login' ? (
              <>

                <form onSubmit={signInWithPassword} className="space-y-4">
                  <div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      required
                      inputMode="email"
                      autoComplete="email"
                      className="input w-full"
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        className="input w-full pr-10"
                        placeholder="Contraseña"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <Link
                        href="/forgot-password"
                        onClick={onClose}
                        className="text-xs font-semibold text-brand-emerald hover:opacity-90"
                      >
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading !== null}
                    className="btn btn-primary w-full"
                  >
                    {isLoading === true ? 'Iniciando sesión...' : 'Iniciar sesión'}
                  </button>
                </form>

                <div className="mt-4 text-center text-sm text-gray-600">
                  ¿No tienes cuenta?{' '}
                  <button
                    onClick={() => setView('register')}
                    className="font-semibold text-brand-emerald hover:opacity-90"
                  >
                    Regístrate
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  onClick={onClose}
                  className="btn btn-secondary w-full border-brand-emerald text-brand-emerald hover:bg-pink-50 text-center block"
                >
                  Continuar con E-mail
                </Link>

                <div className="mt-5 text-center text-sm text-gray-600">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    onClick={() => setView('login')}
                    className="font-semibold text-brand-emerald hover:opacity-90"
                  >
                    Inicia Sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
