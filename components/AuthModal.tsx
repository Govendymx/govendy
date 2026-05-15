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
            className="-mt-1 -mr-1 rounded-xl p-2 text-gray-500 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2"
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
            {view === 'register' && (
              <p className="text-center text-xs font-medium text-gray-500">
                Opciones para registrarte:
              </p>
            )}

            {/* Google */}
            <button
              type="button"
              onClick={() => signInOAuth('google')}
              disabled={isLoading !== null}
              className="btn btn-secondary flex w-full items-center justify-center"
            >
              {isLoading === 'google' ? (
                'Conectando…'
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>

            {view === 'login' ? (
              <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs font-semibold text-gray-500">o con Email</span>
                  </div>
                </div>

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
                        className="text-xs font-semibold text-brand-orange hover:opacity-90"
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
                    className="font-semibold text-brand-orange hover:opacity-90"
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
                  className="btn btn-secondary w-full border-brand-orange text-brand-orange hover:bg-pink-50 text-center block"
                >
                  Continuar con E-mail
                </Link>

                <div className="mt-5 text-center text-sm text-gray-600">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    onClick={() => setView('login')}
                    className="font-semibold text-brand-orange hover:opacity-90"
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
