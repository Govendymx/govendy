'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

function getFriendlyErrorMessage(err: unknown) {
  if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const urlHint =
      url && url.startsWith('http://') && url.includes('.supabase.co')
        ? `\n\nTu URL parece ser http://... (debe ser https://...).`
        : '';

    return (
      'No se pudo conectar con Supabase (Failed to fetch). ' +
      'Esto casi siempre es por URL/keys mal configuradas o por bloqueo de red.\n\n' +
      'Revisa en `.env.local`:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL = https://<tu-proyecto>.supabase.co\n' +
      '- NEXT_PUBLIC_SUPABASE_ANON_KEY = <tu anon key>\n\n' +
      'Luego reinicia `npm run dev`.' +
      urlHint
    );
  }

  return err instanceof Error
    ? err.message
    : 'Error de conexión. Por favor, verifica tu conexión e intenta de nuevo.';
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    nickname: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/subir-ine` : undefined;

  const signInOAuth = async (provider: 'google' | 'facebook') => {
    setError(null);
    setIsOAuthLoading(provider);
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
      setError(e instanceof Error ? e.message : 'No se pudo continuar con el proveedor.');
      setIsOAuthLoading(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Diagnóstico rápido de env en el cliente (valores inyectados en build)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnonKey) {
      setError(
        'Faltan variables de entorno de Supabase. Revisa `.env.local` (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY) y reinicia `npm run dev`.',
      );
      setIsLoading(false);
      return;
    }

    const email = formData.email.trim();
    const fullName = formData.fullName.trim();
    const nickname = formData.nickname.trim();
    const password = formData.password;

    if (!email || !fullName || !nickname || !password || !formData.confirmPassword) {
      setError('Por favor, completa todos los campos.');
      setIsLoading(false);
      return;
    }

    if (password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: nickname,
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        console.error('Error de Supabase:', signUpError);
        setError(signUpError.message || 'Error al crear la cuenta. Por favor, intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError('Error: No se pudo crear el usuario. Por favor, intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      // Enviar email de bienvenida
      try {
        await fetch('/api/auth/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id }),
        });
      } catch (welcomeErr) {
        console.warn('No se pudo enviar el email de bienvenida:', welcomeErr);
        // No bloqueamos el flujo de registro por esto
      }

      setSuccess(true);
      window.location.href = '/subir-ine';
    } catch (err: unknown) {
      console.error('Error inesperado:', err);
      setError(getFriendlyErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="grid w-full items-stretch gap-8 lg:grid-cols-2">
          <section className="hidden lg:flex">
            <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-brand-orange via-liverpool-700 to-liverpool-900 p-10 text-white shadow-2xl">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/25 blur-2xl" />
                <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-white/15 blur-2xl" />
              </div>
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                  GoVendy
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Tu panel, tus contactos y tus documentos</h2>
                <p className="mt-3 text-sm text-white/85">
                  Crea tu cuenta y continúa al siguiente paso para subir tu INE y acceder al Dashboard.
                </p>

                <div className="mt-8 grid gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                      1
                    </span>
                    Registro rápido y seguro
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                      2
                    </span>
                    Sube tus documentos
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                      3
                    </span>
                    Administra tus contactos
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center">
            <div className="w-full">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-sm">
                    <span className="text-sm font-extrabold tracking-tight">GO</span>
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-gray-900">GoVendy</div>
                    <div className="text-xs text-gray-500">Registro</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Crear cuenta</h1>
                  <p className="text-sm text-gray-600">
                    Ingresa tus datos para empezar. Te llevaremos al panel al finalizar.
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  {success && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      ¡Registro exitoso! Redirigiendo...
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {error}
                    </div>
                  )}



                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="tu@email.com"
                        required
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-700">
                          Nombre
                        </label>
                        <input
                          id="fullName"
                          name="fullName"
                          type="text"
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="Tu nombre"
                          required
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        />
                      </div>

                      <div>
                        <label htmlFor="nickname" className="mb-1.5 block text-sm font-medium text-gray-700">
                          Apodo
                        </label>
                        <input
                          id="nickname"
                          name="nickname"
                          type="text"
                          value={formData.nickname}
                          onChange={handleChange}
                          placeholder="Ej. juan123"
                          required
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Mínimo 6 caracteres"
                          required
                          minLength={6}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-10 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-brand-orange"
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

                    <div>
                      <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Repetir contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Repite tu contraseña"
                          required
                          minLength={6}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-10 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || success}
                      style={{ backgroundColor: '#FF6600' }}
                      className="w-full rounded-xl py-3 font-semibold text-white shadow-lg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2"
                    >
                      {isLoading ? 'Creando cuenta...' : success ? '¡Registro exitoso!' : 'Crear cuenta'}
                    </button>
                  </form>
                </div>

                <p className="mt-6 text-xs text-gray-500">Al crear tu cuenta aceptas nuestros términos y políticas.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}