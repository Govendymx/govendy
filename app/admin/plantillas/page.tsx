'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { AdminTopMenu } from '@/components/admin/AdminTopMenu';
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

export default function AdminTemplatesPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftPreviewUrl, setDraftPreviewUrl] = useState('');
  const [draftBlocks, setDraftBlocks] = useState<TemplateBlock[]>([]);
  const [draftActive, setDraftActive] = useState(true);
  const [draftGlobal, setDraftGlobal] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/login?returnTo=/admin/plantillas';
          return;
        }
        const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
        if (!cancelled) {
          setIsAdmin(Boolean(adminRow));
          if (!adminRow) setError('No tienes permisos de administrador.');
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo validar el acceso admin.');
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

      const res = await fetch('/api/admin/templates/list?limit=500', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
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
    if (!isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const globals = useMemo(() => rows.filter((r) => r.is_global), [rows]);
  const users = useMemo(() => rows.filter((r) => !r.is_global), [rows]);

  const openNew = () => {
    setSuccess(null);
    setError(null);
    setEditing({
      id: '',
      owner_id: null,
      is_global: true,
      is_active: true,
      title: '',
      description: '',
      preview_image_url: null,
      blocks: [],
    });
    setDraftTitle('Plantilla global');
    setDraftDesc('Plantilla recomendada para vendedores.');
    setDraftPreviewUrl('');
    setDraftBlocks([
      { type: 'heading', text: 'Detalles del producto', level: 2 },
      { type: 'bullets', items: ['Marca', 'Talla', 'Color', 'Condición', 'Medidas'] },
      { type: 'callout', title: 'Envío', body: 'Envío rápido. Empaque seguro.', tone: 'pink' },
    ]);
    setDraftActive(true);
    setDraftGlobal(true);
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
    setDraftGlobal(Boolean(r.is_global));
  };

  const close = () => setEditing(null);

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
          is_global: draftGlobal,
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

  const seedDefaults = async () => {
    setError(null);
    setSuccess(null);
    try {
      setIsSeeding(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const res = await fetch('/api/admin/templates/seed', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudieron crear plantillas de ejemplo.');
      const n = Number(json?.inserted ?? 0) || 0;
      setSuccess(n > 0 ? `Plantillas PRO creadas: ${n}.` : 'Ya existían las plantillas PRO de ejemplo.');
      await load();
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron crear plantillas de ejemplo.');
    } finally {
      setIsSeeding(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <AdminTopMenu />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold text-gray-900">Plantillas (Admin)</div>
            <div className="mt-1 text-sm text-gray-600">Gestiona plantillas globales y revisa plantillas de usuarios.</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/metricas" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
            <button
              type="button"
              onClick={openNew}
              disabled={!isAdmin}
              className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            >
              + Nueva global
            </button>
            <button
              type="button"
              onClick={() => void seedDefaults()}
              disabled={!isAdmin || isSeeding || isLoading}
              className="rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-brand-orange shadow-sm ring-1 ring-pink-200 hover:bg-pink-50 disabled:opacity-60"
            >
              {isSeeding ? 'Creando…' : 'Generar Defaults'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={!isAdmin || isLoading}
              className="rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-60"
            >
              {isLoading ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {success ? <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div> : null}

        {!isAdmin ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-bold text-gray-900">Acceso denegado</div>
            <div className="mt-2 text-sm text-gray-600">Necesitas ser admin para ver este panel.</div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-gray-900">Globales</div>
                  <div className="mt-1 text-sm text-gray-600">Se muestran a todos los usuarios (si están activas).</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-brand-orange ring-1 ring-pink-100">
                  {globals.length} total
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {globals.map((r) => (
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
                          onClick={() => void del(r.id)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {globals.length === 0 ? (
                  <div className="rounded-3xl border border-pink-200 bg-pink-50 p-5 ring-1 ring-pink-100">
                    <div className="text-sm font-extrabold text-gray-900">Aún no hay plantillas globales</div>
                    <div className="mt-1 text-sm text-gray-700">
                      Crea una con <span className="font-semibold">“+ Nueva global”</span> o genera ejemplos PRO automáticamente.
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void seedDefaults()}
                        disabled={isSeeding || isLoading}
                        className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                      >
                        {isSeeding ? 'Creando…' : 'Crear plantillas PRO de ejemplo'}
                      </button>
                      <Link
                        href="/sell"
                        className="rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                      >
                        Ir a vender →
                      </Link>
                    </div>
                    <div className="mt-3 text-xs text-gray-600">
                      Nota: para que salgan en el selector de <span className="font-semibold">/sell</span>, deben estar <span className="font-semibold">Activas</span> y <span className="font-semibold">Global</span>.
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-gray-900">Usuarios</div>
                  <div className="mt-1 text-sm text-gray-600">Para soporte y revisión (no se muestran como globales).</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/10">
                  {users.length} total
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {users.map((r) => (
                  <div key={r.id} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-gray-900">{r.title}</div>
                        <div className="mt-1 text-xs text-gray-600 line-clamp-2">{r.description || '—'}</div>
                        <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1">
                          Owner: <span className="font-mono">{String(r.owner_id || '—').slice(0, 8)}…</span>
                          {r.owner_id && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(r.owner_id!, r.id);
                              }}
                              className="text-gray-400 hover:text-brand-orange focus:outline-none"
                              title="Copiar Owner ID"
                            >
                              {copiedId === r.id ? '✅' : '📋'}
                            </button>
                          )}
                          · Actualizado: {formatDateTime(r.updated_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
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
                ))}
                {users.length === 0 ? (
                  <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-black/5">Aún no hay plantillas de usuarios.</div>
                ) : null}
              </div>
            </section>
          </div>
        )}

        {editing ? (
          <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true">
            <div className="mx-auto my-6 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-900">{editing.id ? 'Editar plantilla (Admin)' : 'Nueva plantilla global'}</div>
                  <div className="mt-1 text-xs text-gray-500">Puedes marcarla como global y activa para que aparezca a todos.</div>
                </div>
                <button type="button" onClick={close} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 ring-1 ring-black/10">
                  Cerrar
                </button>
              </div>

              <div className="grid flex-1 gap-0 overflow-auto lg:grid-cols-[1fr_380px]">
                <div className="p-5">
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Título</label>
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Vista previa (URL opcional)</label>
                        <input
                          value={draftPreviewUrl}
                          onChange={(e) => setDraftPreviewUrl(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                          placeholder="https://res.cloudinary.com/..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700">Descripción</label>
                      <textarea
                        value={draftDesc}
                        onChange={(e) => setDraftDesc(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                      />
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
                        Activa
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <input type="checkbox" checked={draftGlobal} onChange={(e) => setDraftGlobal(e.target.checked)} />
                        Global (visible para todos si está activa)
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
                        className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
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
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

