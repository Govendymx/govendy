'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validar formato de email básico
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Por favor, ingresa un email válido.');
        setIsLoading(false);
        return;
      }

      // Usar nuestra API personalizada para tener control total del email (template bonito) y evitar problemas de PKCE/Cross-Browser
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar email');
      }

      // Siempre mostrar éxito para no revelar si el email existe
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error al enviar email de recuperación:', err);
      // Si es rate limit mostramos el error
      if (msg.includes('rate limit') || msg.includes('Demasiados intentos')) {
         setError('Por favor espera unos minutos antes de intentar de nuevo.');
      } else {
         // Para otros errores, mostramos éxito por seguridad
         setSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/90 rounded-3xl shadow-xl ring-1 ring-black/5 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-500 text-white shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-gray-900">GoVendy</div>
                <div className="text-xs text-gray-500">Email enviado</div>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">Revisa tu email</h1>
              <p className="text-gray-600 text-sm mt-2">
                Si el email <strong>{email}</strong> está registrado, recibirás un enlace de recuperación.
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Haz clic en el enlace del email para restablecer tu contraseña.
              </p>
              <p className="text-gray-500 text-xs mt-3 italic">
                Si no recibes el email en unos minutos, verifica tu carpeta de spam o asegúrate de que el email esté correctamente registrado.
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="block w-full text-center rounded-xl bg-brand-emerald text-white py-3 font-semibold hover:opacity-90 transition-opacity shadow-lg"
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
              <div className="text-xs text-gray-500">Recuperar contraseña</div>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">¿Olvidaste tu contraseña?</h1>
            <p className="text-gray-600 text-sm mt-1">
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-emerald focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                placeholder="tu@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{ backgroundColor: '#FF6600' }}
              className="w-full text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2"
            >
              {isLoading ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
          </form>

          <p className="text-xs text-gray-600 text-center">
            ¿Recordaste tu contraseña?{' '}
            <Link href="/login" className="font-semibold text-brand-emerald hover:opacity-90">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
