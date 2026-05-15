'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { isAuthSessionMissingError, redirectToLogin } from '@/lib/auth/redirect';

type UploadResult = { url: string };

function formatUnknownError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  const anyErr = err as any;
  const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';
  const details = typeof anyErr?.details === 'string' ? anyErr.details : '';
  const hint = typeof anyErr?.hint === 'string' ? anyErr.hint : '';
  const code = typeof anyErr?.code === 'string' ? anyErr.code : '';
  const base = msg || fallback;
  const extra = [code ? `Código: ${code}` : '', details ? `Detalles: ${details}` : '', hint ? `Hint: ${hint}` : '']
    .filter(Boolean)
    .join('\n');
  return extra ? `${base}\n\n${extra}` : base;
}

async function uploadVerificationFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', 'verification');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string };
  if (!res.ok) throw new Error(json?.error || 'No se pudo subir la imagen.');
  if (!json?.url) throw new Error('Respuesta inválida del servidor de upload.');
  return json.url;
}

export default function SubirInePage() {
  const [isBooting, setIsBooting] = useState(true);
  const [ineFront, setIneFront] = useState<File | null>(null);
  const [ineBack, setIneBack] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(ineFront && ineBack) && !isLoading && !success;
  }, [ineFront, ineBack, isLoading, success]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          if (isAuthSessionMissingError(userErr)) {
            redirectToLogin();
            return;
          }
          throw new Error(formatUnknownError(userErr, 'No se pudo validar tu sesión.'));
        }
        if (!userData.user) {
          redirectToLogin();
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('ine_front_url,ine_back_url')
          .eq('id', userData.user.id)
          .maybeSingle();
        if (profileErr) {
          const anyErr = profileErr as any;
          const code = String(anyErr?.code || '');
          const msg = String(anyErr?.message || '');
          if (code === '42703' && msg.includes('ine_front_url')) {
            throw new Error(
              "Tu tabla `profiles` no tiene las columnas `ine_front_url` y `ine_back_url`.\n\n" +
                "Solución: ejecuta el SQL `supabase_profiles_ine_migration.sql` en Supabase (SQL Editor) y recarga esta página.",
            );
          }
          throw new Error(formatUnknownError(profileErr, 'No se pudo cargar tu perfil.'));
        }

        const front = typeof (profile as any)?.ine_front_url === 'string' ? (profile as any).ine_front_url.trim() : '';
        const back = typeof (profile as any)?.ine_back_url === 'string' ? (profile as any).ine_back_url.trim() : '';

        // Si ya está completo, no tiene sentido repetir este paso.
        if (front && back) {
          window.location.href = '/dashboard';
          return;
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(formatUnknownError(err, 'No se pudo iniciar la verificación.'));
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIneFront(e.target.files[0]);
      setError(null);
    }
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIneBack(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!ineFront || !ineBack) {
      setError('Por favor, sube ambas imágenes del INE (frente y reverso)');
      setIsLoading(false);
      return;
    }

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const frontUrl = await uploadVerificationFile(ineFront);
      const backUrl = await uploadVerificationFile(ineBack);

      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            ine_front_url: frontUrl,
            ine_back_url: backUrl,
          },
          { onConflict: 'id' },
        );
      if (upsertErr) throw upsertErr;

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (err: unknown) {
      console.error('Error al subir imágenes:', err);
      setError(
        `Error: ${
          err instanceof Error ? err.message : 'Error al subir las imágenes. Por favor, intenta de nuevo.'
        }`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-96 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold text-gray-900">Subir INE</div>
              <div className="text-xs text-gray-500">Verificación de identidad</div>
            </div>
          </div>

          <div className="text-xs text-gray-600">
            <span className="font-semibold text-brand-emerald">Paso 2</span> de 2
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-pink-100">
              Documentos
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">
              Sube tu INE <span className="text-brand-emerald">(frente y reverso)</span>
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Asegúrate de que las fotos sean claras, sin reflejos y con toda la información visible.
            </p>
          </div>

          <div className="bg-white/90 rounded-3xl shadow-xl ring-1 ring-black/5 p-6 sm:p-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
                <div className="text-xs font-semibold text-gray-700">Consejo</div>
                <div className="mt-1 text-sm text-gray-600">Evita sombras y recortes.</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-gray-50 px-4 py-3">
                <div className="text-xs font-semibold text-gray-700">Siguiente</div>
                <div className="mt-1 text-sm text-gray-600">Al finalizar te llevaremos al Dashboard.</div>
              </div>
            </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-2xl text-sm">
              ¡Imágenes subidas exitosamente! Redirigiendo al panel...
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="ineFront" className="block text-sm font-medium text-gray-700 mb-1.5">
                INE Frente
              </label>
              <input
                id="ineFront"
                name="ineFront"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFrontChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-emerald focus:border-transparent outline-none transition-all text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-emerald file:text-white hover:file:opacity-90"
              />
            </div>

            <div>
              <label htmlFor="ineBack" className="block text-sm font-medium text-gray-700 mb-1.5">
                INE Reverso
              </label>
              <input
                id="ineBack"
                name="ineBack"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleBackChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-emerald focus:border-transparent outline-none transition-all text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-emerald file:text-white hover:file:opacity-90"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-brand-emerald text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2"
            >
              {isLoading ? 'Subiendo...' : success ? '¡Subido exitosamente!' : 'Subir imágenes'}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
