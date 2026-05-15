'use client';

import { useMemo, useRef, useState } from 'react';
import type { TemplateBlock } from '@/lib/templates/blocks';
import { isAllowedImageUrl } from '@/lib/templates/validate';
import { supabase } from '@/lib/supabase/client';

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type Props = {
  blocks: TemplateBlock[];
  onChange: (next: TemplateBlock[]) => void;
  availableImages?: string[]; // Imágenes ya subidas que se pueden insertar
};

const blockOptions: Array<{ id: TemplateBlock['type']; label: string }> = [
  { id: 'heading', label: 'Título' },
  { id: 'paragraph', label: 'Párrafo' },
  { id: 'bullets', label: 'Lista (bullets)' },
  { id: 'callout', label: 'Recuadro (callout)' },
  { id: 'image', label: 'Imagen' },
  { id: 'divider', label: 'Separador' },
];

export function TemplateEditor({ blocks, onChange, availableImages = [] }: Props) {
  const arr = useMemo(() => (Array.isArray(blocks) ? blocks : []), [blocks]);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const makeSlotId = () => {
    try {
      const g = (globalThis as any)?.crypto?.randomUUID;
      if (typeof g === 'function') return String(g()).slice(0, 80);
    } catch {
      // noop
    }
    return `slot-${Date.now()}-${Math.random().toString(16).slice(2)}`.slice(0, 80);
  };

  const addBlock = (type: TemplateBlock['type']) => {
    const next = [...arr];
    if (type === 'heading') next.push({ type: 'heading', text: 'Título', level: 2 });
    if (type === 'paragraph') next.push({ type: 'paragraph', text: 'Escribe aquí…' });
    if (type === 'bullets') next.push({ type: 'bullets', items: ['Punto 1', 'Punto 2'] });
    if (type === 'callout') next.push({ type: 'callout', title: 'Tip', body: 'Texto del recuadro…', tone: 'pink' });
    if (type === 'image')
      next.push({ type: 'image', url: '', alt: '', caption: '', is_slot: true, slot_id: makeSlotId(), slot_label: 'Imagen' });
    if (type === 'divider') next.push({ type: 'divider' });
    onChange(next);
  };

  const removeAt = (idx: number) => {
    onChange(arr.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const next = [...arr];
    const tmp = next[idx];
    next[idx] = next[j] as any;
    next[j] = tmp as any;
    onChange(next);
  };

  const setAt = (idx: number, patch: Partial<any>) => {
    const next = [...arr];
    next[idx] = { ...(next[idx] as any), ...patch } as any;
    onChange(next);
  };

  const uploadIntoImageBlock = async (idx: number, file: File) => {
    setUploadError(null);
    setSlotError(null);
    setUploadingIdx(idx);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Inicia sesión para subir imágenes.');

      const fd = new FormData();
      fd.append('file', file);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: fd,
        signal: controller.signal,
      }).catch((e: any) => {
        if (String(e?.name || '').toLowerCase().includes('abort')) {
          throw new Error('La subida tardó demasiado. Intenta de nuevo con una imagen más ligera.');
        }
        throw e;
      });
      clearTimeout(timeout);

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(String(json?.error || 'No se pudo subir la imagen.'));
      const url = String(json?.url || '').trim();
      if (!url) throw new Error('Respuesta inválida del servidor de upload.');
      setAt(idx, { url });
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">Bloques</div>
        <div className="flex flex-wrap gap-2">
          {blockOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => addBlock(o.id)}
              className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
            >
              + {o.label}
            </button>
          ))}
        </div>
      </div>

      {arr.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-black/5">
          Aún no hay bloques. Agrega uno arriba.
        </div>
      ) : null}

      <div className="space-y-3">
        {arr.map((b, idx) => (
          <div key={idx} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-gray-700">
                #{idx + 1} · <span className="text-brand-orange">{b.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  className="rounded-lg bg-gray-50 px-2 py-1 text-xs font-bold text-gray-700 ring-1 ring-black/5 hover:bg-gray-100"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  className="rounded-lg bg-gray-50 px-2 py-1 text-xs font-bold text-gray-700 ring-1 ring-black/5 hover:bg-gray-100"
                  title="Bajar"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                >
                  Eliminar
                </button>
              </div>
            </div>

            {b.type === 'heading' ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-3">
                  <label className="text-xs font-semibold text-gray-700">Texto</label>
                  <input
                    value={b.text}
                    onChange={(e) => setAt(idx, { text: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Nivel</label>
                  <select
                    value={b.level ?? 2}
                    onChange={(e) => setAt(idx, { level: Number(e.target.value) as any })}
                    className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                </div>
              </div>
            ) : null}

            {b.type === 'paragraph' ? (
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-700">Texto</label>
                <textarea
                  value={b.text}
                  onChange={(e) => setAt(idx, { text: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            ) : null}

            {b.type === 'bullets' ? (
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-700">Elementos (uno por línea)</label>
                <textarea
                  value={(b.items || []).join('\n')}
                  onChange={(e) =>
                    setAt(idx, {
                      items: e.target.value
                        .split('\n')
                        .map((x) => x.trim())
                        .filter(Boolean)
                        .slice(0, 20),
                    })
                  }
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                />
                <div className="mt-1 text-[11px] text-gray-500">Máx 20.</div>
              </div>
            ) : null}

            {b.type === 'callout' ? (
              <div className="mt-3 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Título (opcional)</label>
                    <input
                      value={b.title ?? ''}
                      onChange={(e) => setAt(idx, { title: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Estilo</label>
                    <select
                      value={b.tone ?? 'pink'}
                      onChange={(e) => setAt(idx, { tone: e.target.value as any })}
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    >
                      <option value="pink">Rosa</option>
                      <option value="neutral">Neutro</option>
                      <option value="success">Verde</option>
                      <option value="blue">Azul</option>
                      <option value="purple">Morado</option>
                      <option value="amber">Ámbar</option>
                      <option value="red">Rojo</option>
                      <option value="indigo">Índigo</option>
                      <option value="teal">Turquesa</option>
                      <option value="cyan">Cian</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Texto</label>
                  <textarea
                    value={b.body}
                    onChange={(e) => setAt(idx, { body: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              </div>
            ) : null}

            {b.type === 'image' ? (
              <div className="mt-3 grid gap-3">
                {(() => {
                  const urlNow = String((b as any)?.url || '').trim();
                  const isSlotMode = (b as any)?.is_slot === false ? false : true;
                  const slotId = String((b as any)?.slot_id || '').trim();
                  const slotLabel = String((b as any)?.slot_label || '').trim();

                  return (
                    <div className="rounded-2xl border border-black/5 bg-gray-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-gray-700">Modo</div>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-900">
                          <input
                            type="checkbox"
                            checked={isSlotMode}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (checked) {
                                setAt(idx, {
                                  is_slot: true,
                                  url: '',
                                  slot_id: slotId || makeSlotId(),
                                  slot_label: slotLabel || 'Imagen',
                                });
                              } else {
                                // imagen fija (requiere url para guardar)
                                setAt(idx, {
                                  is_slot: false,
                                  slot_id: slotId || makeSlotId(),
                                  slot_label: slotLabel || 'Imagen',
                                });
                              }
                            }}
                          />
                          Espacio para publicar (recomendado)
                        </label>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600">
                        {isSlotMode
                          ? 'Se guardará vacío y el vendedor subirá la imagen al publicar.'
                          : 'Esta imagen se guarda dentro de la plantilla (debes subir/pegar el URL antes de guardar).'}
                      </div>
                      {!isSlotMode && !urlNow ? (
                        <div className="mt-2 text-[11px] font-semibold text-amber-800">
                          Falta subir/pegar la imagen para poder guardar.
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-700">Imagen</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={(el) => {
                        fileRefs.current[idx] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        e.currentTarget.value = '';
                        if (!f) return;
                        void uploadIntoImageBlock(idx, f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRefs.current[idx]?.click()}
                      disabled={uploadingIdx === idx || ((b as any)?.is_slot !== false)}
                      className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-black disabled:opacity-60"
                    >
                      {uploadingIdx === idx ? 'Subiendo…' : 'Subir imagen'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const slotId = String((b as any)?.slot_id || '').trim() || makeSlotId();
                        const slotLabel = String((b as any)?.slot_label || '').trim() || 'Imagen';
                        setAt(idx, { url: '', is_slot: true, slot_id: slotId, slot_label: slotLabel });
                      }}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                      title="Quitar URL"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* Galería de imágenes ya subidas */}
                {availableImages.length > 0 && (b as any)?.is_slot === false && (
                  <div className="rounded-2xl border border-brand-orange/20 bg-pink-50/50 p-3">
                    <div className="text-xs font-semibold text-gray-700 mb-2">
                      📸 Seleccionar de imágenes subidas
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {availableImages.map((imgUrl, imgIdx) => (
                        <button
                          key={imgIdx}
                          type="button"
                          onClick={() => setAt(idx, { url: imgUrl, is_slot: false })}
                          className="group relative aspect-square overflow-hidden rounded-xl border-2 border-gray-200 hover:border-brand-orange transition-all"
                        >
                          <img
                            src={imgUrl}
                            alt={`Imagen ${imgIdx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-brand-orange/0 group-hover:bg-brand-orange/20 transition-all flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-white font-bold text-xs bg-brand-orange px-2 py-1 rounded-lg">
                              Usar
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {uploadError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{uploadError}</div>
                ) : null}
                {slotError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{slotError}</div>
                ) : null}

                <div>
                  <label className="text-xs font-semibold text-gray-700">URL (Cloudinary o Supabase Storage público)</label>
                  <input
                    value={b.url}
                    onChange={(e) => setAt(idx, { url: e.target.value })}
                    disabled={(b as any)?.is_slot !== false}
                    className={classNames(
                      'mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2',
                      !b.url || isAllowedImageUrl(b.url) ? 'border-gray-300 focus:ring-brand-orange' : 'border-red-300 focus:ring-red-300',
                    )}
                    placeholder="https://res.cloudinary.com/..."
                  />
                  {b.url && !isAllowedImageUrl(b.url) ? (
                    <div className="mt-1 text-[11px] font-semibold text-red-700">
                      URL no permitida. Usa Cloudinary o Supabase Storage público.
                    </div>
                  ) : null}
                </div>

                {b.url && isAllowedImageUrl(b.url) ? (
                  <div className="overflow-hidden rounded-2xl border border-black/5 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.url} alt={b.alt || ''} className="h-auto w-full object-cover" draggable={false} />
                    {b.caption ? <div className="px-4 py-3 text-xs text-gray-600">{b.caption}</div> : null}
                  </div>
                ) : null}

                {(b as any)?.is_slot !== false ? (
                  <div className="rounded-2xl border border-black/5 bg-gray-50 p-3">
                    <div className="text-[11px] font-semibold text-gray-700">Espacio para publicar</div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      Puedes dejarlo vacío y el vendedor subirá esta imagen desde <span className="font-semibold">/sell</span>.
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700">Nombre del espacio</label>
                        <input
                          value={String((b as any).slot_label || '')}
                          onChange={(e) => setAt(idx, { slot_label: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                          placeholder="Ej. Foto del outfit"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">ID del espacio</label>
                        <input
                          value={String((b as any).slot_id || '')}
                          onChange={(e) => setAt(idx, { slot_id: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                          placeholder="slot-..."
                          onBlur={() => {
                            const slotId = String((b as any)?.slot_id || '').trim();
                            if (!slotId) setAt(idx, { slot_id: makeSlotId() });
                            if (slotId && slotId.length < 4) setSlotError('El ID del espacio debe tener al menos 4 caracteres.');
                            else setSlotError(null);
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-semibold text-gray-700">Tamaño recomendado</label>
                      <select
                        value={String((b as any).slot_aspect || 'portrait')}
                        onChange={(e) => setAt(idx, { slot_aspect: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                      >
                        <option value="portrait">Vertical (4:5) · 1080×1350</option>
                        <option value="square">Cuadrada (1:1) · 1080×1080</option>
                        <option value="landscape">Horizontal (16:9) · 1600×900</option>
                      </select>
                      <div className="mt-1 text-[11px] text-gray-600">
                        En <span className="font-semibold">/sell</span> se mostrará el preview en este formato.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Alt (opcional)</label>
                    <input
                      value={b.alt ?? ''}
                      onChange={(e) => setAt(idx, { alt: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Caption (opcional)</label>
                    <input
                      value={b.caption ?? ''}
                      onChange={(e) => setAt(idx, { caption: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {b.type === 'divider' ? (
              <div className="mt-3 text-sm text-gray-600">Separador (sin configuración).</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

