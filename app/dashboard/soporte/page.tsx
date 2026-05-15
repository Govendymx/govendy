'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DashboardSoportePage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [subject, setSubject] = useState('');

  const load = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/dashboard/soporte';
        return;
      }
      const res = await fetch(`/api/support/conversations-v2?t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar tus chats de soporte.');
      setRows((json?.conversations ?? []) as any[]);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar tus chats de soporte.');
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async () => {
    setError(null);
    setIsCreating(true);
    try {
      const s = subject.trim();
      if (s.length < 3) {
        setError('Escribe un asunto (mínimo 3 caracteres).');
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');
      const res = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify({ subject: s }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo crear el chat.');
      const id = String(json?.conversation?.id || '').trim();
      if (id) {
        window.location.href = `/dashboard/soporte/${id}`;
        return;
      }
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo crear el chat.');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        await load();
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Soporte</div>
              <div className="text-xs text-gray-500">Ayuda y seguimiento</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">Chats de soporte</div>
              <div className="mt-1 text-sm text-gray-600">Crea un chat para que el equipo te ayude.</div>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={isLoading || isCreating}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
            >
              Actualizar
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-black/5 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Nuevo chat</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej. No veo mi compra / Problema con un pago / No puedo subir INE"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
              />
              <button
                type="button"
                onClick={createConversation}
                disabled={isCreating || subject.trim().length < 3}
                className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {isCreating ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>

          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no tienes chats de soporte.</div>
          ) : (
            <div className="mt-6 divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5">
              {rows.map((c) => (
                <Link key={String(c?.id)} href={`/dashboard/soporte/${String(c?.id)}`} className="block p-4 hover:bg-emerald-50/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{String(c?.subject || 'Soporte')}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {String(c?.status || '—')} · {String(c?.id || '').slice(0, 8)}…
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-gray-700">{String(c?.status || '').toLowerCase() === 'closed' ? 'Cerrado' : 'Abierto'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


