'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

export function LoginClient({ initialEmail, returnTo }: { initialEmail?: string; returnTo?: string }) {
  const safeReturnTo = useMemo(() => {
    const rt = String(returnTo || '').trim();
    if (!rt) return '';
    if (!rt.startsWith('/')) return '';
    return rt;
  }, [returnTo]);

  const [email, setEmail] = useState(String(initialEmail || ''));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);

  useEffect(() => {
    // Verificar si hay un parámetro de éxito en la URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('passwordReset') === 'success') {
        setPasswordResetSuccess(true);
        // Limpiar la URL
        window.history.replaceState({}, '', '/login');
      }
    }
    
    // Verificar configuración de Supabase al cargar
    const checkSupabaseConfig = async () => {
      try {
        // Intentar una llamada simple para verificar conexión
        const { error } = await supabase.auth.getSession();
        if (error && error.message.toLowerCase().includes('fetch')) {
          setError('⚠️ Error de configuración: No se puede conectar con Supabase. Verifica que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén configurados en .env.local');
        }
      } catch (e) {
        // Si falla silenciosamente, probablemente es un problema de configuración
        const errMsg = e instanceof Error ? e.message.toLowerCase() : '';
        if (errMsg.includes('fetch') || errMsg.includes('network')) {
          setError('⚠️ Error de configuración: No se puede conectar con Supabase. Verifica las variables de entorno en .env.local y reinicia el servidor de desarrollo.');
        }
      }
    };
    
    void checkSupabaseConfig();
  }, []);

  useEffect(() => {
    // Prefill seguro: último email usado (si no viene uno por URL)
    if (String(initialEmail || '').trim()) return;
    try {
      const saved = window.localStorage.getItem('pocket_last_login_email');
      if (saved && !email) setEmail(saved);
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail]);

  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const base = window.location.origin;
    // Home-first: si no hay returnTo, vuelve al Home.
    const target = safeReturnTo || '/';
    return `${base}${target}`;
  }, [safeReturnTo]);

  const signInOAuth = async (provider: 'google' | 'facebook') => {
    setError(null);
    setIsLoading(true);
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
      let errorMessage = 'No se pudo iniciar sesión.';
      
      if (e instanceof Error) {
        const errMsg = e.message.toLowerCase();
        
        // Detectar errores de conexión
        if (errMsg.includes('failed to fetch') || errMsg.includes('network error') || errMsg.includes('fetch')) {
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet y que las variables de entorno de Supabase estén configuradas correctamente en .env.local';
        } else {
          errorMessage = e.message;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      try {
        window.localStorage.setItem('pocket_last_login_email', email.trim());
      } catch {
        // noop
      }

      // Si viene returnTo, respétalo
      if (safeReturnTo) {
        window.location.href = safeReturnTo;
        return;
      }

      // Verificar si el usuario es administrador
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        
        // Si es admin, redirigir al panel de administrador
        if (adminRow) {
          window.location.href = '/admin/metricas';
          return;
        }
      }

      // Si no es admin, redirigir al dashboard o home
      window.location.href = '/';
    } catch (err: unknown) {
      let errorMessage = 'No se pudo iniciar sesión.';
      
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();
        
        // Detectar errores de conexión
        if (errMsg.includes('failed to fetch') || errMsg.includes('network error') || errMsg.includes('fetch')) {
          errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet y que las variables de entorno de Supabase estén configuradas correctamente en .env.local';
        } else if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid')) {
          errorMessage = 'Email o contraseña incorrectos.';
        } else if (errMsg.includes('email not confirmed')) {
          errorMessage = 'Por favor, confirma tu email antes de iniciar sesión.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/90 rounded-3xl shadow-xl ring-1 ring-black/5 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-sm">
              <span className="text-sm font-extrabold">GO</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">GoVendy</div>
              <div className="text-xs text-gray-500">Inicia sesión</div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inicia sesión</h1>
            <p className="text-gray-600 text-sm mt-1">Accede para comprar y vender.</p>
          </div>

          {passwordResetSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm text-center">
              ✓ Contraseña restablecida exitosamente. Ya puedes iniciar sesión.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}



          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="input"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-brand-orange hover:opacity-90"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          <p className="text-xs text-gray-600 text-center">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="font-semibold text-brand-orange hover:opacity-90">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

