'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export function ResetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        // 1. Suscribirse a cambios de estado primero (para no perder eventos)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (mounted && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
            setIsValidToken(true);
            setIsValidating(false);
          }
        });

        // 2. Verificar sesión activa actual
        const { data: { session } } = await supabase.auth.getSession();

        if (session && mounted) {
          setIsValidToken(true);
          setIsValidating(false);
          subscription.unsubscribe(); // Ya tenemos sesión, no necesitamos escuchar
          return;
        }

        // 3. Intentar intercambio manual si hay código (Robustez para PKCE)
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const code = params.get('code');
        const errorDesc = params.get('error_description') || hashParams.get('error_description');
        const errorCode = params.get('error') || hashParams.get('error');

        // Check for tokens in hash (implicit flow - used by Supabase for recovery)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenType = hashParams.get('type');

        // DEBUG: Log all URL parameters
        console.log('[ResetPassword] URL:', window.location.href);
        console.log('[ResetPassword] Code:', code);
        console.log('[ResetPassword] Access Token:', accessToken ? 'present' : 'null');
        console.log('[ResetPassword] Token Type:', tokenType);
        console.log('[ResetPassword] Error:', errorCode);
        console.log('[ResetPassword] Error Description:', errorDesc);

        if (errorDesc && mounted) {
          console.error('[ResetPassword] Error from URL:', errorDesc);
          setError(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
          setIsValidating(false);
          subscription.unsubscribe();
          return;
        }

        // Handle hash fragment tokens (recovery flow)
        if (accessToken && refreshToken && tokenType === 'recovery' && mounted) {
          console.log('[ResetPassword] ✅ Recovery tokens found in hash fragment');
          console.log('[ResetPassword] Creating session from hash tokens...');

          try {
            // Create session from the tokens in the hash
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('[ResetPassword] ❌ Failed to create session:', sessionError);
              setError('Error al validar el enlace de recuperación.');
              setIsValidating(false);
              subscription.unsubscribe();
              return;
            }

            if (data.session) {
              console.log('[ResetPassword] ✅ Session created successfully');
              setIsValidToken(true);
              setIsValidating(false);
              subscription.unsubscribe();
              return;
            }
          } catch (err) {
            console.error('[ResetPassword] ❌ Exception creating session:', err);
            setError('Error al procesar el enlace de recuperación.');
            setIsValidating(false);
            subscription.unsubscribe();
            return;
          }
        }

        // Handle query parameter code (PKCE flow)
        if (code && mounted) {
          console.log('[ResetPassword] Attempting manual code exchange...');
          // Intentamos intercambiar el código manualmente.
          // Esto ayuda si el auto-detect de supabase-js falla o es lento.
          // Si el auto-detect ya consumió el código, esto fallará pero el listener (paso 1) capturará la sesión.
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          console.log('[ResetPassword] Exchange result:', { hasSession: !!data.session, error: exchangeError });
          if (data.session && mounted) {
            console.log('[ResetPassword] ✅ Session obtained via manual exchange');
            setIsValidToken(true);
            setIsValidating(false);
            subscription.unsubscribe();
            return;
          }
          if (exchangeError) {
            console.error('[ResetPassword] ❌ Code exchange failed:', exchangeError);
          }
        }

        // 4. Timeout de seguridad si nada funciona
        setTimeout(() => {
          if (mounted && isValidating) {
            // Verificar una última vez
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (mounted) {
                if (session) {
                  setIsValidToken(true);
                } else {
                  // Si hay un código en la URL, quizás tardó más, pero asumimos error tras el timeout
                  const params = new URLSearchParams(window.location.search);
                  const code = params.get('code');
                  const errorDesc = params.get('error_description');
                  const hash = window.location.hash;

                  if (errorDesc) {
                    setError(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
                  } else if (!code && !hash && !session) {
                    setError('El enlace de recuperación no es válido o ha expirado.');
                  } else if (!session) {
                    setError('No se pudo validar el enlace. Intenta solicitar uno nuevo.');
                  }
                }
                setIsValidating(false);
              }
            });
          }
        }, 8000); // Aumentar timeout a 8s para dar tiempo al intercambio de código PKCE en redes lentas

        return () => {
          subscription.unsubscribe();
        };

      } catch (err) {
        if (mounted) {
          setError('Error al validar el enlace de recuperación.');
          setIsValidating(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Redirigir al login con mensaje de éxito
      router.push('/login?passwordReset=success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/90 rounded-3xl shadow-xl ring-1 ring-black/5 p-8 space-y-6">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-emerald"></div>
              <p className="text-gray-600 text-sm mt-4">Validando enlace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/90 rounded-3xl shadow-xl ring-1 ring-black/5 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500 text-white shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-gray-900">GoVendy</div>
                <div className="text-xs text-gray-500">Enlace inválido</div>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">Enlace inválido</h1>
              <p className="text-gray-600 text-sm mt-2">
                {error || 'El enlace de recuperación no es válido o ha expirado.'}
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/forgot-password"
                className="block w-full text-center rounded-xl bg-brand-emerald text-white py-3 font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                Solicitar nuevo enlace
              </Link>
              <Link
                href="/login"
                className="block w-full text-center rounded-xl bg-white border border-gray-300 text-gray-900 py-3 font-semibold hover:bg-gray-50 transition-colors"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 rounded-3xl shadow-xl ring-1 ring-black/5 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-emerald text-white shadow-sm">
              <span className="text-sm font-extrabold">PO</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">GoVendy</div>
              <div className="text-xs text-gray-500">Nueva contraseña</div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">Restablecer contraseña</h1>
            <p className="text-gray-600 text-sm mt-1">
              Ingresa tu nueva contraseña. Asegúrate de que tenga al menos 6 caracteres.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-emerald focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
              <div className="relative">
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-emerald focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Confirma tu contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{ backgroundColor: '#FF6600' }}
              className="w-full text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2"
            >
              {isLoading ? 'Restableciendo…' : 'Restablecer contraseña'}
            </button>
          </form>

          <p className="text-xs text-gray-600 text-center">
            <Link href="/login" className="font-semibold text-brand-emerald hover:opacity-90">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
