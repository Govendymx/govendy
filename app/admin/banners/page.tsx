'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type BannerRow = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_href: string;
  sort_order: number;
  is_active: boolean;
  placement?: 'hero' | 'top' | 'mid' | 'mid2' | 'mid3' | 'mid4' | 'mid5' | 'bottom' | 'floating' | 'estafeta' | 'monedero' | 'dashboard_menu' | 'listing_sidebar' | 'live_dashboard';
  image_fit?: 'cover' | 'contain';
  image_position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  floating_frequency?: 'session' | '24h' | '7d';
  floating_position?: 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left';
  floating_delay_ms?: number;
};

const emptyBanner: Omit<BannerRow, 'id'> = {
  title: 'Nueva temporada',
  subtitle: 'Descubre ofertas y prendas únicas',
  image_url: '',
  cta_text: 'Explorar',
  cta_href: '/listings',
  sort_order: 0,
  is_active: true,
  placement: 'hero',
  image_fit: 'cover',
  image_position: 'center',
  floating_frequency: '7d',
  floating_position: 'bottom_right',
  floating_delay_ms: 1500,
};

type Placement = NonNullable<BannerRow['placement']>;

const PLACEMENT_GUIDE: Record<
  Placement,
  {
    label: string;
    where: string;
    aspect: string;
    recommended: string;
    tips: string[];
  }
> = {
  hero: {
    label: 'Hero (arriba)',
    where: 'Sección principal grande (arriba del home).',
    aspect: 'Vertical/hero (se muestra como panel grande).',
    recommended: 'Recomendado: 1600×1200 o 1200×900 (alta calidad).',
    tips: ['Usa imagen limpia + pocos textos (o sin texto).', 'Ideal para promos principales.'],
  },
  top: {
    label: 'Carrusel superior (Liverpool)',
    where: 'Banner ancho justo debajo del header (carrusel).',
    aspect: '24:9 (muy panorámico).',
    recommended: 'Recomendado: 1600×600 o 1200×450.',
    tips: ['Deja “safe area” en el lado izquierdo (texto/CTA encima).', 'Se verá mejor con `cover` y enfoque “center”.'],
  },
  mid: {
    label: 'Banners (medio)',
    where: 'Banners tipo strip a mitad del home (2 columnas en desktop).',
    aspect: '21:9 (panorámico).',
    recommended: 'Recomendado: 1400×600 o 1200×515.',
    tips: ['Si pones texto en la imagen, que sea grande y con contraste.', 'Perfecto para categorías/promos.'],
  },
  mid2: {
    label: 'Banners extra (mid2)',
    where: 'Banners extra (más abajo del home).',
    aspect: '24:9 (panorámico).',
    recommended: 'Recomendado: 1600×600 o 1200×450.',
    tips: ['Úsalos para campañas secundarias.', 'Evita demasiado texto.'],
  },
  mid3: {
    label: 'Banners extra (mid3)',
    where: 'Banner ancho tipo tira (más abajo).',
    aspect: '24:7 (tira).',
    recommended: 'Recomendado: 1600×470 o 1200×350.',
    tips: ['Ideal para “beneficios”: envío gratis, compra protegida, etc.', 'Mantén foco central.'],
  },
  mid4: {
    label: 'Banners extra (mid4)',
    where: 'Entre Destacados y Novedades (2 columnas).',
    aspect: '24:9 (panorámico).',
    recommended: 'Recomendado: 1600×600 o 1200×450.',
    tips: ['Úsalos para campañas secundarias.', 'Evita demasiado texto.'],
  },
  mid5: {
    label: 'Banners extra (mid5)',
    where: 'Entre Novedades y Explorar (2 columnas).',
    aspect: '24:9 (panorámico).',
    recommended: 'Recomendado: 1600×600 o 1200×450.',
    tips: ['Úsalos para campañas secundarias.', 'Evita demasiado texto.'],
  },
  bottom: {
    label: 'Banners (abajo)',
    where: 'Banner ancho al final del home.',
    aspect: '24:7 (tira).',
    recommended: 'Recomendado: 1600×470 o 1200×350.',
    tips: ['Útil para recordatorios o promos finales.', 'CTA claro.'],
  },
  floating: {
    label: 'Flotante (cerrable)',
    where: 'Tarjeta flotante con “X” (esquina de la pantalla).',
    aspect: 'Cuadrado (thumb).',
    recommended: 'Recomendado: 800×800 o 600×600 (se recorta a miniatura).',
    tips: ['Imagen simple (logo/icono) funciona mejor.', 'Configura frecuencia/posición/delay en PRO.'],
  },
  estafeta: {
    label: 'Estafeta (arriba)',
    where: 'Banner ancho en la parte superior de la página de Estafeta.',
    aspect: '24:9 (panorámico).',
    recommended: 'Recomendado: 1600×600 o 1200×450.',
    tips: ['Banner de ancho completo en la página de cotización Estafeta.', 'Ideal para promociones de envíos.'],
  },
  monedero: {
    label: 'Monedero (top)',
    where: 'Banner en la parte superior de la sección Mi PocketCash.',
    aspect: 'Panorámico con degradado.',
    recommended: 'Recomendado: 1200×400 (se usa como fondo/header).',
    tips: ['Usa colores oscuros o transparentes para resaltar el texto blanco.', 'Ideal para promover beneficios del monedero.'],
  },
  dashboard_menu: {
    label: 'Menú Dashboard',
    where: 'Banner pequeño en el menú lateral del dashboard.',
    aspect: 'Cuadrado o vertical.',
    recommended: 'Recomendado: 300×300 o 300×400.',
    tips: ['Visible en el menú de navegación.', 'Úsalo para anuncios importantes.'],
  },
  live_dashboard: {
    label: 'Dashboard Live',
    where: 'Banner debajo del header en /dashboard/live (GoVendy Live).',
    aspect: '24:7 (panorámico).',
    recommended: 'Recomendado: 1200×350 o 1600×470.',
    tips: ['Ideal para promociones de horas live.', 'Auto-rotación si hay múltiples banners.', 'Se muestra con overlay de texto.'],
  },
  listing_sidebar: {
    label: 'Sidebar de Producto',
    where: 'Columna derecha del detalle de producto (sidebar).',
    aspect: 'Cuadrado o Vertical.',
    recommended: 'Recomendado: 400×400 o 400×600.',
    tips: ['Ideal para ofertas cruzadas o publicidad directa.', 'Usa poco texto.'],
  },
};

const PLACEMENT_PREVIEW_ASPECT: Record<Placement, string> = {
  hero: 'aspect-[18/9]',
  top: 'aspect-[24/9]',
  mid: 'aspect-[21/9]',
  mid2: 'aspect-[24/9]',
  mid3: 'aspect-[24/7]',
  mid4: 'aspect-[24/9]',
  mid5: 'aspect-[24/9]',
  bottom: 'aspect-[24/7]',
  floating: 'aspect-square',
  estafeta: 'aspect-[24/9]',
  monedero: 'aspect-[24/9]',
  dashboard_menu: 'aspect-square',
  live_dashboard: 'aspect-[24/7]',
  listing_sidebar: 'aspect-square',
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function PlacementSelector({
  value,
  onChange,
}: {
  value: Placement;
  onChange: (v: Placement) => void;
}) {
  const items = (Object.keys(PLACEMENT_GUIDE) as Placement[]).map((k) => ({ key: k, ...PLACEMENT_GUIDE[k] }));
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={classNames(
              'rounded-2xl border p-4 text-left shadow-sm transition',
              active ? 'border-pink-200 bg-pink-50 ring-2 ring-brand-orange/40' : 'border-black/5 bg-white hover:bg-gray-50',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-gray-900">{it.label}</div>
                <div className="mt-1 text-xs font-semibold text-gray-600">{it.where}</div>
              </div>
              <span
                className={classNames(
                  'shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ring-1',
                  active ? 'bg-white text-brand-orange ring-pink-200' : 'bg-gray-100 text-gray-700 ring-black/5',
                )}
              >
                {it.key}
              </span>
            </div>
            <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] text-gray-700 ring-1 ring-black/5">
              <div className="font-semibold text-gray-900">Medidas</div>
              <div className="mt-1">
                {it.recommended}
                <span className="text-gray-500"> · {it.aspect}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PlacementHelp({ placement }: { placement: Placement }) {
  const g = PLACEMENT_GUIDE[placement];
  return (
    <div className="rounded-2xl border border-black/5 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-gray-900">Vista rápida: {g.label}</div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-700 ring-1 ring-black/5">
          {placement} · {g.aspect}
        </span>
      </div>
      <div className="mt-1 text-sm text-gray-700">{g.where}</div>
      <div className="mt-3 text-xs font-semibold text-gray-900">Recomendado</div>
      <div className="mt-1 text-xs text-gray-700">{g.recommended}</div>
      <div className="mt-3 text-xs font-semibold text-gray-900">Tips</div>
      <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">
        {g.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminBannersPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [supportsPlacement, setSupportsPlacement] = useState(true);
  const [supportsFloatingConfig, setSupportsFloatingConfig] = useState(true);

  const [rows, setRows] = useState<BannerRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [draft, setDraft] = useState(emptyBanner);
  const [showGuide, setShowGuide] = useState(true);

  // AI Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', 'banner'); // Usamos 'banner' para que caiga en bucket 'upload' o cloudinary

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir imagen');

      setDraft(prev => ({ ...prev, image_url: data.url }));
      setSuccess('Imagen subida correctamente');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al subir la imagen');
    } finally {
      setIsUploading(false);
      // Limpiar input
      e.target.value = '';
    }
  };

  const generateAiBanner = async () => {
    if (!aiPrompt.trim()) {
      setAiError('Por favor escribe un prompt para generar la imagen.');
      return;
    }

    try {
      setIsGenerating(true);
      setAiError(null);
      setError(null);

      // Determine aspect ratio based on placement
      let aspectRatio = '16:9';
      const p = draft.placement || 'hero';

      if (['top', 'mid', 'mid2', 'mid4', 'mid5', 'estafeta', 'monedero'].includes(p)) {
        aspectRatio = '21:9'; // Wide
      } else if (['mid3', 'bottom'].includes(p)) {
        aspectRatio = '21:9'; // Ultra wide (fallback to 21:9 as flux might not support 24:7)
      } else if (['hero'].includes(p)) {
        aspectRatio = '4:3'; // Boxy/Vertical
      } else if (['floating', 'dashboard_menu'].includes(p)) {
        aspectRatio = '1:1'; // Square
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No se encontró sesión activa.');
      }

      const res = await fetch('/api/admin/banners/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          aspectRatio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al generar imagen');
      }

      if (data.url) {
        setDraft((prev) => ({ ...prev, image_url: data.url }));
        setSuccess('Imagen generada con éxito.');
        setAiError(null);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error al generar la imagen con IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const canCreate = useMemo(() => draft.title.trim().length > 0 && draft.cta_href.trim().length > 0, [draft]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase().trim();
    return rows.filter((r) => {
      const title = String(r.title || '').toLowerCase();
      const subtitle = String(r.subtitle || '').toLowerCase();
      const cta = String(r.cta_text || '').toLowerCase();
      const href = String(r.cta_href || '').toLowerCase();
      return title.includes(term) || subtitle.includes(term) || cta.includes(term) || href.includes(term);
    });
  }, [rows, searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/';
          return;
        }

        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (!adminRow) {
          if (!cancelled) {
            setIsAdmin(false);
            setError('No tienes permisos de administrador para ver esta página.');
          }
          return;
        }

        if (!cancelled) setIsAdmin(true);

        // Intento 1: schema nuevo (incluye config floating pro)
        let listRes: any = await supabase
          .from('home_banners')
          .select(
            'id,title,subtitle,image_url,cta_text,cta_href,sort_order,is_active,placement,image_fit,image_position,floating_frequency,floating_position,floating_delay_ms',
          )
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        // Si faltan columnas pro, reintentar sin ellas (manteniendo placement)
        if (listRes?.error) {
          const code = String((listRes.error as any)?.code || '');
          const msg = String((listRes.error as any)?.message || '').toLowerCase();
          if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
            setSupportsFloatingConfig(false);
            listRes = await supabase
              .from('home_banners')
              .select('id,title,subtitle,image_url,cta_text,cta_href,sort_order,is_active,placement,image_fit,image_position')
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: false });
          }
        }

        if (listRes?.error) {
          const listErr = listRes.error;
          const code = String((listErr as any)?.code || '');
          const msg = String((listErr as any)?.message || '');
          if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
            setSupportsPlacement(false);
            const legacy = await supabase
              .from('home_banners')
              .select('id,title,subtitle,image_url,cta_text,cta_href,sort_order,is_active')
              .order('sort_order', { ascending: true })
              .order('created_at', { ascending: false });
            if (legacy.error) throw legacy.error;
            if (!cancelled) setRows((legacy.data as BannerRow[]) ?? []);
          } else {
            throw listErr as any;
          }
        } else {
          if (!cancelled) setRows(((listRes.data as BannerRow[]) ?? []) as BannerRow[]);
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de banners.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const createBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!canCreate) return;

    try {
      setIsSaving(true);
      const payload: any = supportsPlacement
        ? (() => {
          const base: any = { ...draft };
          // Si la BD aún no tiene columnas PRO, no las mandamos.
          if (!supportsFloatingConfig) {
            delete base.floating_frequency;
            delete base.floating_position;
            delete base.floating_delay_ms;
          }
          return base;
        })()
        : {
          title: draft.title,
          subtitle: draft.subtitle,
          image_url: draft.image_url,
          cta_text: draft.cta_text,
          cta_href: draft.cta_href,
          sort_order: draft.sort_order,
          is_active: draft.is_active,
        };
      const { data, error: insertErr } = await supabase
        .from('home_banners')
        .insert([payload])
        .select(
          supportsPlacement
            ? supportsFloatingConfig
              ? 'id,title,subtitle,image_url,cta_text,cta_href,sort_order,is_active,placement,image_fit,image_position,floating_frequency,floating_position,floating_delay_ms'
              : 'id,title,subtitle,image_url,cta_text,cta_href,sort_order,is_active,placement,image_fit,image_position'
            : 'id,title,subtitle,image_url,cta_text,cta_href,sort_order,is_active',
        )
        .single();

      if (insertErr) throw insertErr;
      if (!data) throw new Error('No se recibió data del insert');
      setRows((prev) => [data as unknown as BannerRow, ...prev].sort((a, b) => a.sort_order - b.sort_order));
      setDraft(emptyBanner);
      setSuccess('Banner creado.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo crear el banner.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateBanner = async (id: string, patch: Partial<BannerRow>) => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const { error: updErr } = await supabase.from('home_banners').update(patch).eq('id', id);
      if (updErr) throw updErr;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as BannerRow : r)));
      setSuccess('Cambios guardados.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo guardar el banner.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBanner = async (id: string) => {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const { error: delErr } = await supabase.from('home_banners').delete().eq('id', id);
      if (delErr) {
        // Fallback: si RLS/policies no permiten DELETE, desactivamos para que deje de mostrarse en Home.
        const code = String((delErr as any)?.code || '');
        const msg = String((delErr as any)?.message || '');
        const low = msg.toLowerCase();

        // Intentar desactivar (soft-delete UI)
        const { error: updErr } = await supabase.from('home_banners').update({ is_active: false }).eq('id', id);
        if (!updErr) {
          setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, is_active: false } as BannerRow) : r)));
          setSuccess('No se pudo eliminar por permisos, pero se desactivó (ya no se mostrará en el Home).');
          return;
        }

        // Si también falla update, mostrar error original con guía
        const hint =
          code || low.includes('row-level security')
            ? 'Parece un problema de permisos/RLS. Asegúrate de haber ejecutado `supabase_home_banners.sql` y de que tu usuario esté en `admin_users`.'
            : '';
        throw new Error(`${msg || 'No se pudo eliminar el banner.'}${hint ? `\n\n${hint}` : ''}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSuccess('Banner eliminado.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el banner.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-brand-orange ring-1 ring-pink-100">
            Admin
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Banners del Home</h1>
          <p className="mt-2 text-sm text-gray-600">Configura los banners que se ven en la página principal.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {!isAdmin ? null : (
          <div className="space-y-6">
            {/* Guía rápida para el admin */}
            {supportsPlacement ? (
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">Guía de ubicaciones (Home)</div>
                    <div className="mt-1 text-sm text-gray-600">Elige el “slot” viendo dónde aparece y qué medidas usar.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide((v) => !v)}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                  >
                    {showGuide ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>

                {showGuide ? (
                  <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
                    <div>
                      <div className="text-xs font-semibold text-gray-700">Selector visual</div>
                      <div className="mt-2">
                        <PlacementSelector
                          value={(draft.placement || 'hero') as Placement}
                          onChange={(v) => setDraft((p) => ({ ...p, placement: v }))}
                        />
                      </div>
                    </div>
                    <div>
                      <PlacementHelp placement={(draft.placement || 'hero') as Placement} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={createBanner} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Crear banner</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                  placeholder="Título"
                  required
                />
                <input
                  value={draft.subtitle}
                  onChange={(e) => setDraft((p) => ({ ...p, subtitle: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                  placeholder="Subtítulo"
                />

                {/* Generador AI */}
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 sm:col-span-2">
                  <div className="mb-2 text-xs font-bold text-purple-900">✨ Generar imagen con IA (Replicate)</div>
                  <div className="flex gap-2">
                    <input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="flex-1 rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="Describe tu banner (ej: 'Fashion sale banner with minimal pink background')"
                      disabled={isGenerating}
                    />
                    <button
                      type="button"
                      onClick={generateAiBanner}
                      disabled={isGenerating || !aiPrompt.trim()}
                      className="shrink-0 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isGenerating ? 'Generando...' : 'Generar'}
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-purple-700">
                    Se usará la relación de aspecto recomendada para el slot seleccionado ({draft.placement || 'hero'}).
                  </div>
                  {aiError && (
                    <div className="mt-2 rounded-lg bg-red-100 p-2 text-xs text-red-700 font-medium">
                      ⚠️ {aiError}
                    </div>
                  )}
                  {isGenerating && (
                    <div className="mt-2 text-xs text-purple-600 animate-pulse font-medium">
                      ⏳ Generando imagen... esto puede tardar unos segundos.
                    </div>
                  )}
                </div>

                {/* Subida de imagen manual */}
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Imagen del Banner
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="cursor-pointer rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors text-center border border-gray-200">
                      <span>{isUploading ? 'Subiendo...' : '📂 Subir imagen desde mi equipo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                    <div className="text-xs text-gray-500">o pega la URL directa abajo 👇</div>
                  </div>
                </div>

                <input
                  value={draft.image_url}
                  onChange={(e) => setDraft((p) => ({ ...p, image_url: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange sm:col-span-2"
                  placeholder="URL de imagen (Cloudinary o externa)"
                />

                {/* Preview en tiempo real del draft */}
                {draft.image_url && (
                  <div className="overflow-hidden rounded-2xl border border-black/5 bg-gray-100 sm:col-span-2">
                    <div className={classNames('relative', PLACEMENT_PREVIEW_ASPECT[((draft.placement || 'hero') as Placement)] || 'aspect-[21/9]')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.image_url}
                        alt="Vista previa"
                        className="h-full w-full object-cover"
                        style={{
                          objectFit: (draft.image_fit as any) || 'cover',
                          objectPosition: (draft.image_position as any) || 'center'
                        }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-gray-900">
                            {draft.title || 'Título del Banner'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-2 text-xs text-center text-gray-500 font-medium">
                      Vista previa ({draft.placement || 'hero'})
                    </div>
                  </div>
                )}
                <input
                  value={draft.cta_text}
                  onChange={(e) => setDraft((p) => ({ ...p, cta_text: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                  placeholder="Texto del botón (CTA)"
                />
                <input
                  value={draft.cta_href}
                  onChange={(e) => setDraft((p) => ({ ...p, cta_href: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                  placeholder="Ruta (ej. /listings)"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                  <input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => setDraft((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                    placeholder="Orden"
                  />
                  <label className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    Activo
                  </label>
                </div>

                {supportsPlacement && (
                  <div className="grid gap-4 sm:col-span-2">
                    <div>
                      <div className="mb-1 block text-xs font-semibold text-gray-700">Lugar (slot)</div>
                      <div className="text-[11px] text-gray-500">
                        Consejo: si no sabes cuál elegir, selecciona uno y mira la “Vista rápida” (medidas y dónde aparece).
                      </div>
                      <div className="mt-3">
                        <PlacementSelector
                          value={(draft.placement || 'hero') as Placement}
                          onChange={(v) => setDraft((p) => ({ ...p, placement: v }))}
                        />
                      </div>
                      <div className="mt-3">
                        <PlacementHelp placement={(draft.placement || 'hero') as Placement} />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Ajuste</label>
                        <select
                          value={draft.image_fit || 'cover'}
                          onChange={(e) => setDraft((p) => ({ ...p, image_fit: e.target.value as any }))}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        >
                          <option value="cover">Recortar (cover) · recomendado</option>
                          <option value="contain">Ajustar (contain) · sin recorte</option>
                        </select>
                        <div className="mt-1 text-[11px] text-gray-500">
                          `cover` recorta un poco (mejor para banners). `contain` muestra toda la imagen (puede dejar bordes).
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-700">Enfoque</label>
                        <select
                          value={draft.image_position || 'center'}
                          onChange={(e) => setDraft((p) => ({ ...p, image_position: e.target.value as any }))}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        >
                          <option value="center">Centro</option>
                          <option value="top">Arriba</option>
                          <option value="bottom">Abajo</option>
                          <option value="left">Izquierda</option>
                          <option value="right">Derecha</option>
                        </select>
                        <div className="mt-1 text-[11px] text-gray-500">
                          Útil cuando `cover` recorta (ej: enfocar “top” para texto arriba).
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Config PRO para flotantes */}
                {supportsPlacement && supportsFloatingConfig && draft.placement === 'floating' ? (
                  <div className="grid gap-4 sm:grid-cols-3 sm:col-span-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">Frecuencia</label>
                      <select
                        value={draft.floating_frequency || '7d'}
                        onChange={(e) => setDraft((p) => ({ ...p, floating_frequency: e.target.value as any }))}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                      >
                        <option value="session">1 vez por sesión</option>
                        <option value="24h">1 vez cada 24h</option>
                        <option value="7d">1 vez cada 7 días</option>
                      </select>
                      <div className="mt-1 text-[11px] text-gray-500">Se aplica al cerrar con la X.</div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">Posición</label>
                      <select
                        value={draft.floating_position || 'bottom_right'}
                        onChange={(e) => setDraft((p) => ({ ...p, floating_position: e.target.value as any }))}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                      >
                        <option value="bottom_right">Abajo derecha</option>
                        <option value="bottom_left">Abajo izquierda</option>
                        <option value="top_right">Arriba derecha</option>
                        <option value="top_left">Arriba izquierda</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">Delay (ms)</label>
                      <input
                        type="number"
                        min={0}
                        max={600000}
                        value={Number(draft.floating_delay_ms ?? 0)}
                        onChange={(e) => setDraft((p) => ({ ...p, floating_delay_ms: Number(e.target.value) }))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        placeholder="1500"
                      />
                      <div className="mt-1 text-[11px] text-gray-500">Ej: 1500 = aparece tras 1.5s.</div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving || !canCreate || isUploading}
                  className="rounded-xl bg-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Guardando…' : isUploading ? 'Subiendo imagen...' : 'Crear banner'}
                </button>
              </div>
            </form>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <h2 className="text-lg font-bold text-gray-900">Banners existentes</h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar banner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 rounded-xl border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {rows.length === 0 ? (
                  <div className="text-sm text-gray-600">Aún no hay banners.</div>
                ) : filteredRows.length === 0 ? (
                  <div className="text-sm text-gray-600">No se encontraron banners con "{searchTerm}".</div>
                ) : (
                  filteredRows.map((b) => (
                    <div key={b.id} className="rounded-2xl border border-black/5 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">
                            {b.id.slice(0, 8)}...
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(b.id);
                                const el = document.getElementById(`bid-${b.id}`);
                                if (el) {
                                  const original = el.innerText;
                                  el.innerText = 'Copiado!';
                                  setTimeout(() => {
                                    el.innerText = original;
                                  }, 1000);
                                }
                              }}
                              className="ml-1 hover:text-brand-orange focus:outline-none"
                              title="Copiar ID"
                            >
                              <span id={`bid-${b.id}`}>📋</span>
                            </button>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteBanner(b.id)}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>

                      {supportsPlacement && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/5">
                            Slot: {b.placement || 'hero'}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/5">
                            Imagen: {b.image_fit || 'cover'} · {b.image_position || 'center'}
                          </span>
                        </div>
                      )}

                      {/* Vista previa (solo si está activo) */}
                      {Boolean(b.is_active) && String(b.image_url || '').trim() ? (
                        <div className="mb-3 overflow-hidden rounded-2xl border border-black/5 bg-gray-100">
                          <div className={classNames('relative', PLACEMENT_PREVIEW_ASPECT[((b.placement || 'hero') as Placement)] || 'aspect-[24/9]')}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={String(b.image_url || '').trim()}
                              alt={String(b.title || 'Banner')}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-gray-900">
                                  {String(b.title || 'Banner')}
                                </span>
                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-gray-900">
                                  {b.placement || 'hero'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {supportsPlacement ? (
                        <div className="mb-3 rounded-2xl border border-black/5 bg-gray-50 p-3">
                          <div className="text-xs font-semibold text-gray-900">Dónde se ve</div>
                          <div className="mt-1 text-xs text-gray-700">
                            {PLACEMENT_GUIDE[((b.placement || 'hero') as Placement)]?.where}
                          </div>
                          <div className="mt-2 text-[11px] text-gray-600">
                            {PLACEMENT_GUIDE[((b.placement || 'hero') as Placement)]?.recommended}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          defaultValue={b.title}
                          onBlur={(e) => updateBanner(b.id, { title: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        />
                        <input
                          defaultValue={b.subtitle}
                          onBlur={(e) => updateBanner(b.id, { subtitle: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                        />
                        <input
                          defaultValue={b.image_url}
                          onBlur={(e) => updateBanner(b.id, { image_url: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange sm:col-span-2"
                          placeholder="URL de imagen"
                        />

                        {supportsPlacement && (
                          <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
                            <select
                              defaultValue={b.placement || 'hero'}
                              onChange={(e) => updateBanner(b.id, { placement: (e.target as any).value })}
                              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                            >
                              <option value="hero">Hero</option>
                              <option value="top">Carrusel superior</option>
                              <option value="mid">Mid</option>
                              <option value="mid2">Mid2</option>
                              <option value="mid3">Mid3</option>
                              <option value="mid4">Mid4</option>
                              <option value="mid5">Mid5</option>
                              <option value="bottom">Bottom</option>
                              <option value="floating">Floating</option>
                              <option value="estafeta">Estafeta</option>
                              <option value="monedero">Monedero</option>
                              <option value="dashboard_menu">Menú Dashboard</option>
                            </select>
                            <select
                              defaultValue={b.image_fit || 'cover'}
                              onChange={(e) => updateBanner(b.id, { image_fit: (e.target as any).value })}
                              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                            >
                              <option value="cover">cover</option>
                              <option value="contain">contain</option>
                            </select>
                            <select
                              defaultValue={b.image_position || 'center'}
                              onChange={(e) => updateBanner(b.id, { image_position: (e.target as any).value })}
                              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                            >
                              <option value="center">center</option>
                              <option value="top">top</option>
                              <option value="bottom">bottom</option>
                              <option value="left">left</option>
                              <option value="right">right</option>
                            </select>
                          </div>
                        )}
                        <input
                          defaultValue={b.cta_text}
                          onBlur={(e) => updateBanner(b.id, { cta_text: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                          placeholder="CTA"
                        />
                        <input
                          defaultValue={b.cta_href}
                          onBlur={(e) => updateBanner(b.id, { cta_href: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                          placeholder="/listings"
                        />
                        <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2">
                          <input
                            type="number"
                            defaultValue={b.sort_order}
                            onBlur={(e) => updateBanner(b.id, { sort_order: Number(e.target.value) })}
                            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                            placeholder="Orden"
                          />
                          <label className="inline-flex items-center justify-between gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700">
                            <span>Activo</span>
                            <input
                              type="checkbox"
                              checked={b.is_active}
                              onChange={(e) => updateBanner(b.id, { is_active: e.target.checked })}
                            />
                          </label>
                        </div>

                        {supportsPlacement && supportsFloatingConfig && (b.placement || 'hero') === 'floating' ? (
                          <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
                            <div>
                              <div className="mb-1 text-xs font-semibold text-gray-700">Frecuencia</div>
                              <select
                                defaultValue={b.floating_frequency || '7d'}
                                onChange={(e) => updateBanner(b.id, { floating_frequency: (e.target as any).value })}
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                              >
                                <option value="session">session</option>
                                <option value="24h">24h</option>
                                <option value="7d">7d</option>
                              </select>
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-semibold text-gray-700">Posición</div>
                              <select
                                defaultValue={b.floating_position || 'bottom_right'}
                                onChange={(e) => updateBanner(b.id, { floating_position: (e.target as any).value })}
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                              >
                                <option value="bottom_right">bottom_right</option>
                                <option value="bottom_left">bottom_left</option>
                                <option value="top_right">top_right</option>
                                <option value="top_left">top_left</option>
                              </select>
                            </div>
                            <div>
                              <div className="mb-1 text-xs font-semibold text-gray-700">Delay (ms)</div>
                              <input
                                type="number"
                                min={0}
                                max={600000}
                                defaultValue={Number(b.floating_delay_ms ?? 0)}
                                onBlur={(e) => updateBanner(b.id, { floating_delay_ms: Number((e.target as any).value) })}
                                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-orange"
                                placeholder="1500"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => deleteBanner(b.id)}
                          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

