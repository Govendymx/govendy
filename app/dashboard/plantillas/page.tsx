'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TemplateBlock } from '@/lib/templates/blocks';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { BlocksRenderer } from '@/components/templates/BlocksRenderer';

type TemplateRow = {
  id: string;
  owner_id: string | null;
  is_global: boolean;
  is_active: boolean;
  title: string;
  description: string;
  preview_image_url: string | null;
  blocks: TemplateBlock[];
  updated_at?: string | null;
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function DashboardTemplatesPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftPreviewUrl, setDraftPreviewUrl] = useState('');
  const [draftBlocks, setDraftBlocks] = useState<TemplateBlock[]>([]);
  const [draftActive, setDraftActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = '/login?returnTo=/dashboard/plantillas';
          return;
        }
        if (!cancelled) setUserId(userData.user.id);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = async () => {
    setError(null);
    setSuccess(null);
    try {
      setIsLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/templates/list?limit=200', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar plantillas.');
      setRows((((json?.rows as any[]) ?? []) as TemplateRow[]) || []);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar plantillas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const globals = useMemo(() => rows.filter((r) => r.is_global), [rows]);
  const mine = useMemo(() => rows.filter((r) => !r.is_global), [rows]);

  const openNew = () => {
    setSuccess(null);
    setError(null);
    setEditing({
      id: '',
      owner_id: userId,
      is_global: false,
      is_active: true,
      title: '',
      description: '',
      preview_image_url: null,
      blocks: [],
    });
    setDraftTitle('Mi plantilla');
    setDraftDesc('Plantilla para describir mis productos.');
    setDraftPreviewUrl('');
    setDraftBlocks([{ type: 'heading', text: 'Condición y detalles', level: 2 }, { type: 'bullets', items: ['Estado', 'Medidas', 'Marca'] }]);
    setDraftActive(true);
  };

  const openEdit = (r: TemplateRow) => {
    setSuccess(null);
    setError(null);
    setEditing(r);
    setDraftTitle(r.title || '');
    setDraftDesc(r.description || '');
    setDraftPreviewUrl(r.preview_image_url || '');
    setDraftBlocks((Array.isArray(r.blocks) ? r.blocks : []) as TemplateBlock[]);
    setDraftActive(r.is_active !== false);
  };

  const close = () => {
    setEditing(null);
  };

  const save = async () => {
    if (!editing) return;
    setError(null);
    setSuccess(null);
    try {
      setIsSaving(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/templates/upsert', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editing.id || null,
          title: draftTitle,
          description: draftDesc,
          preview_image_url: draftPreviewUrl || null,
          blocks: draftBlocks,
          is_active: draftActive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo guardar.');
      setSuccess('Plantilla guardada.');
      close();
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setIsSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!id) return;
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/templates/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo eliminar.');
      setSuccess('Plantilla eliminada.');
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.');
    }
  };

  const duplicate = async (id: string) => {
    if (!id) return;
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/templates/duplicate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo duplicar.');
      setSuccess('Plantilla duplicada (ya es tuya).');
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo duplicar.');
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 items-center justify-center rounded-xl bg-brand-emerald px-3 text-white shadow-sm hover:opacity-95">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </Link>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Plantillas</div>
              <div className="text-xs text-gray-500">Crea descripciones tipo “MercadoLibre” sin HTML peligroso</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
            <button
              type="button"
              onClick={openNew}
              className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
            >
              + Nueva
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {success ? <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-gray-900">Plantillas PRO (globales)</div>
                <div className="mt-1 text-sm text-gray-600">Úsalas como base y duplica a tu cuenta.</div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                disabled={isLoading}
              >
                {isLoading ? 'Cargando…' : 'Actualizar'}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {globals.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-black/5">Aún no hay plantillas globales.</div>
              ) : (
                globals.map((r) => (
                  <div key={r.id} className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
                    {r.preview_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.preview_image_url} alt={r.title} className="h-28 w-full object-cover" draggable={false} />
                    ) : (
                      <div className="h-28 bg-gradient-to-r from-emerald-100 via-emerald-100 to-emerald-200" />
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-gray-900">{r.title}</div>
                          <div className="mt-1 text-xs text-gray-600 line-clamp-2">{r.description || '—'}</div>
                          <div className="mt-2 text-[11px] text-gray-500">Actualizado: {formatDateTime(r.updated_at)}</div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => void duplicate(r.id)}
                            className="rounded-xl bg-brand-emerald px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:opacity-90"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                          >
                            Ver
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-gray-900">Mis plantillas</div>
                <div className="mt-1 text-sm text-gray-600">Crea tus diseños y aplícalos al publicar.</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                {mine.length} total
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {mine.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-black/5">
                  Aún no tienes plantillas. Crea una con <span className="font-semibold">+ Nueva</span>.
                </div>
              ) : (
                mine.map((r) => (
                  <div key={r.id} className={classNames('rounded-3xl border p-4 shadow-sm', r.is_active ? 'border-black/5 bg-white' : 'border-amber-200 bg-amber-50')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-extrabold text-gray-900">{r.title}</div>
                          {r.is_active ? null : (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold text-amber-700 ring-1 ring-amber-200">
                              Inactiva
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-600 line-clamp-2">{r.description || '—'}</div>
                        <div className="mt-2 text-[11px] text-gray-500">Actualizado: {formatDateTime(r.updated_at)}</div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void duplicate(r.id)}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => void del(r.id)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {editing ? (
          <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true">
            <div className="mx-auto my-6 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-900">{editing.id ? 'Editar plantilla' : 'Nueva plantilla'}</div>
                  <div className="mt-1 text-xs text-gray-500">Sin HTML libre. Todo se renderiza seguro por bloques.</div>
                </div>
                <button type="button" onClick={close} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 ring-1 ring-black/10">
                  Cerrar
                </button>
              </div>

              <div className="grid flex-1 gap-0 overflow-auto lg:grid-cols-[1fr_360px]">
                <div className="p-5">
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Título</label>
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Vista previa (URL opcional)</label>
                        <input
                          value={draftPreviewUrl}
                          onChange={(e) => setDraftPreviewUrl(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                          placeholder="https://res.cloudinary.com/..."
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-gray-700">Descripción (para identificarla)</label>
                        <textarea
                          value={draftDesc}
                          onChange={(e) => setDraftDesc(e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
                        Activa
                      </label>
                    </div>

                    <TemplateEditor blocks={draftBlocks} onChange={setDraftBlocks} />

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={close}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void save()}
                        disabled={isSaving}
                        className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                      >
                        {isSaving ? 'Guardando…' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-l border-black/5 bg-gray-50 p-5">
                  <div className="text-sm font-extrabold text-gray-900">Preview</div>
                  <div className="mt-3 overflow-hidden rounded-3xl border border-black/5 bg-white p-4">
                    <BlocksRenderer blocks={draftBlocks} />
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    Tip: usa un bloque <span className="font-semibold">Callout</span> rosa para “Garantía / Envío / Medidas”.
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

