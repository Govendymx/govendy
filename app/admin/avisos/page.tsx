'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type UserPick = { id: string; full_name?: string | null; nickname?: string | null; username?: string | null };

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function displayName(u: UserPick) {
  return (
    String(u.full_name || '').trim() ||
    String(u.nickname || '').trim() ||
    String(u.username || '').trim() ||
    (u.id ? `${u.id.slice(0, 6)}…` : 'Usuario')
  );
}

export default function AdminAvisosPage() {
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [audience, setAudience] = useState<'all' | 'users'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserPick[]>([]);
  const [picked, setPicked] = useState<UserPick[]>([]);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    const boot = async () => {
      try {
        setBootError(null);
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          window.location.href = `/?auth=1&returnTo=${encodeURIComponent('/admin/avisos')}`;
          return;
        }
        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', u.user.id).maybeSingle();
        if (!cancelled) setIsAdmin(Boolean(adminRow));
        if (!adminRow) {
          if (!cancelled) setBootError('No autorizado (admin requerido).');
        }
      } catch (e: unknown) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : 'No se pudo validar admin.');
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const canSend = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (body.trim().length < 1) return false;
    if (audience === 'users' && picked.length === 0) return false;
    return true;
  }, [title, body, audience, picked.length]);

  const runSearch = async () => {
    setError(null);
    setResult(null);
    const needle = q.trim();
    if (!needle) return;
    setSearching(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(needle)}&limit=12&t=${Date.now()}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo buscar usuarios.');
      const users = (json?.users ?? []) as any[];
      setSearchResults(
        users.map((u) => ({ id: String(u?.id || ''), full_name: u?.full_name ?? null, nickname: u?.nickname ?? null, username: u?.username ?? null })),
      );
    } catch (e: unknown) {
      setSearchResults([]);
      setError(e instanceof Error ? e.message : 'No se pudo buscar usuarios.');
    } finally {
      setSearching(false);
    }
  };

  const togglePick = (u: UserPick) => {
    setPicked((prev) => {
      const exists = prev.some((p) => p.id === u.id);
      if (exists) return prev.filter((p) => p.id !== u.id);
      return [...prev, u].slice(0, 200);
    });
  };

  const send = async () => {
    setError(null);
    setResult(null);
    if (!canSend) return;
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const payload: any = {
        audience,
        title: title.trim(),
        body: body.trim(),
        image_url: imageUrl.trim() || null,
        link_url: linkUrl.trim() || null,
      };
      if (audience === 'users') payload.userIds = picked.map((p) => p.id);

      const res = await fetch('/api/admin/announcements/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo enviar el aviso.');
      const sent = Number(json?.sent ?? 0) || 0;
      const failed = Number(json?.failed ?? 0) || 0;
      const hint =
        failed > 0
          ? ` (fallaron ${failed}. Revisa configuración de notificaciones/ENUM/RLS o la lista de usuarios.)`
          : '';
      setResult(`Listo: enviado a ${sent} usuario(s).${hint}`);
      setTitle('');
      setBody('');
      setImageUrl('');
      setLinkUrl('');
      setPicked([]);
      setSearchResults([]);
      setQ('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el aviso.');
    } finally {
      setSending(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
            Panel Admin
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">Avisos a usuarios</h1>
          <p className="mt-1 text-sm text-gray-600">Envía notificaciones globales o por usuario (texto + opcional imagen/link).</p>
        </div>
        <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
          Volver
        </Link>
      </div>

      {bootError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{bootError}</div>
      ) : null}
      {!isAdmin ? null : (
        <div className="mt-6 grid gap-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}
          {result ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{result}</div>
          ) : null}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-bold text-gray-900">Destino</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAudience('all')}
                className={classNames(
                  'rounded-full px-4 py-2 text-sm font-semibold ring-1',
                  audience === 'all' ? 'bg-brand-emerald text-white ring-brand-emerald' : 'bg-white text-gray-900 ring-black/10 hover:bg-gray-50',
                )}
              >
                Todos los usuarios
              </button>
              <button
                type="button"
                onClick={() => setAudience('users')}
                className={classNames(
                  'rounded-full px-4 py-2 text-sm font-semibold ring-1',
                  audience === 'users' ? 'bg-brand-emerald text-white ring-brand-emerald' : 'bg-white text-gray-900 ring-black/10 hover:bg-gray-50',
                )}
              >
                Elegir usuarios
              </button>
            </div>

            {audience === 'users' ? (
              <div className="mt-4 rounded-2xl border border-black/5 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-700">Buscar usuario</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Nombre / username / UUID"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                  <button
                    type="button"
                    onClick={() => void runSearch()}
                    disabled={!q.trim() || searching}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {searching ? '…' : 'Buscar'}
                  </button>
                </div>

                {searchResults.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {searchResults.map((u) => {
                      const active = picked.some((p) => p.id === u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => togglePick(u)}
                          className={classNames(
                            'flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm font-semibold shadow-sm transition',
                            active ? 'border-emerald-200 bg-emerald-50 text-brand-emerald' : 'border-black/5 bg-white text-gray-900 hover:bg-gray-100',
                          )}
                        >
                          <span className="truncate">{displayName(u)}</span>
                          <span className="flex items-center gap-1">
                            <span className="text-xs font-bold">{active ? '✓' : '+'}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigator.clipboard.writeText(u.id);
                                const el = e.currentTarget;
                                const original = el.innerHTML;
                                el.innerHTML = '✅';
                                setTimeout(() => {
                                  el.innerHTML = original;
                                }, 1000);
                              }}
                              className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                              title="Copiar UUID"
                            >
                              📋
                            </button>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {picked.length > 0 ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-gray-700">Seleccionados ({picked.length})</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {picked.map((p) => (
                        <div key={p.id} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-black/10 hover:bg-gray-50">
                          <button
                            type="button"
                            onClick={() => togglePick(p)}
                            className="text-xs font-semibold text-gray-900"
                          >
                            {displayName(p)} ×
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigator.clipboard.writeText(p.id);
                              const el = e.currentTarget;
                              const original = el.innerHTML;
                              el.innerHTML = '✅';
                              setTimeout(() => {
                                el.innerHTML = original;
                              }, 1000);
                            }}
                            className="ml-1 text-[10px] text-gray-400 hover:text-brand-emerald focus:outline-none"
                            title="Copiar UUID"
                          >
                            📋
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-bold text-gray-900">Contenido del aviso</div>
            <div className="mt-4 grid gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-700">Título</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Promo de fin de semana"
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
                <div className="mt-1 text-[11px] text-gray-500">Máx. 80.</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700">Texto</div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escribe el aviso para el usuario…"
                  className="mt-2 h-28 w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
                <div className="mt-1 text-[11px] text-gray-500">Máx. 500.</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-gray-700">Imagen (URL opcional)</div>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700">Link (URL opcional)</div>
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="/listings o https://…"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTitle('');
                  setBody('');
                  setImageUrl('');
                  setLinkUrl('');
                  setPicked([]);
                  setSearchResults([]);
                  setQ('');
                  setError(null);
                  setResult(null);
                }}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                disabled={sending}
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!canSend || sending}
                className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {sending ? 'Enviando…' : 'Enviar aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

