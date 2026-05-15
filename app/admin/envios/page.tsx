'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ShippingOption = {
  id: string;
  name: string;
  logo_url: string;
  cost: number;
  delivery_days: number;
  max_weight_kg?: number | null;
  is_active: boolean;
  display_order: number;
};

export default function AdminEnviosPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/login?returnTo=/admin/envios';
          return;
        }

        const { data: adminRow, error: aErr } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (aErr) throw aErr;
        if (!cancelled) setIsAdmin(Boolean(adminRow));
        if (!adminRow && !cancelled) {
          setError('No tienes permisos de administrador.');
          return;
        }

        await load();
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
    setIsLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('shipping_options')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchErr) throw fetchErr;
      setOptions((data as ShippingOption[]) || []);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las opciones de envío.');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadLogo = async (optionId: string, file: File) => {
    if (!optionId) {
      setError('Primero guarda la opción de envío antes de subir el logo.');
      return;
    }

    setError(null);
    setIsUploading((prev) => ({ ...prev, [optionId]: true }));

    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = '/login?returnTo=/admin/envios';
        return;
      }

      // Subir a Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${optionId}-${Date.now()}.${fileExt}`;
      const filePath = `shipping-logos/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from('pocket').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (uploadErr) throw uploadErr;

      // Obtener URL pública
      const {
        data: { publicUrl },
      } = supabase.storage.from('pocket').getPublicUrl(filePath);

      // Actualizar la opción con la URL del logo
      const { error: updateErr } = await supabase
        .from('shipping_options')
        .update({ logo_url: publicUrl })
        .eq('id', optionId);

      if (updateErr) throw updateErr;

      await load();
      setSuccess('Logo subido correctamente.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo subir el logo.');
    } finally {
      setIsUploading((prev) => ({ ...prev, [optionId]: false }));
    }
  };

  const saveOption = async (index: number, option: ShippingOption) => {
    setError(null);
    setIsSaving(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = '/login?returnTo=/admin/envios';
        return;
      }

      const payload: Partial<ShippingOption> = {
        name: option.name.trim(),
        cost: Number(option.cost) || 0,
        delivery_days: Math.max(1, Math.floor(Number(option.delivery_days) || 1)),
        max_weight_kg: option.max_weight_kg ? Number(option.max_weight_kg) : null,
        is_active: option.is_active,
        display_order: index,
      };

      if (option.logo_url) {
        payload.logo_url = option.logo_url;
      }

      if (option.id) {
        // Actualizar existente
        const { error: updateErr } = await supabase.from('shipping_options').update(payload).eq('id', option.id);
        if (updateErr) throw updateErr;
      } else if (option.name.trim()) {
        // Crear nuevo
        const { data: newOption, error: insertErr } = await supabase
          .from('shipping_options')
          .insert([payload])
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        // Actualizar el estado local con el nuevo ID
        setOptions((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], id: newOption.id };
          return next;
        });
      }

      await load();
      setSuccess('Opción de envío guardada correctamente.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo guardar la opción de envío.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta opción de envío?')) return;

    setError(null);
    setIsSaving(true);

    try {
      const { error: deleteErr } = await supabase.from('shipping_options').delete().eq('id', optionId);
      if (deleteErr) throw deleteErr;

      await load();
      setSuccess('Opción de envío eliminada correctamente.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la opción de envío.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateOption = (index: number, updates: Partial<ShippingOption>) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((o) => {
      const name = (o.name || '').toLowerCase();
      const id = (o.id || '').toLowerCase();
      return name.includes(term) || id.includes(term);
    });
  }, [options, searchTerm]);

  const displayOptions = useMemo(() => {
    if (searchTerm.trim()) return filteredOptions;

    return options.length < 5
      ? [...options, ...Array(5 - options.length).fill(null).map((_, i) => ({
          id: '',
          name: '',
          logo_url: '',
          cost: 0,
          delivery_days: 1,
          max_weight_kg: null,
          is_active: false,
          display_order: options.length + i,
        }))]
      : options.slice(0, 5);
  }, [options, filteredOptions, searchTerm]);

  if (isBooting) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="h-6 w-40 rounded-xl bg-white/70 ring-1 ring-black/5" />
        <div className="mt-6 h-40 rounded-3xl bg-white/70 ring-1 ring-black/5" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || 'No tienes permisos de administrador.'}
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Admin · Opciones de Envío</h1>
          <p className="mt-1 text-sm text-gray-600">Gestiona hasta 5 opciones de envío que aparecerán en el checkout.</p>
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar paquetería..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-gray-300 px-4 py-2 pl-10 text-sm outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {success ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div> : null}

      {searchTerm && displayOptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-900 font-medium">No se encontraron resultados</p>
          <p className="text-sm text-gray-500 mt-1">Intenta con otro término de búsqueda</p>
          <button 
            onClick={() => setSearchTerm('')}
            className="mt-4 text-sm text-brand-emerald hover:underline"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {displayOptions.map((option, index) => {
          const opt = option || {
            id: '',
            name: '',
            logo_url: '',
            cost: 0,
            delivery_days: 1,
            max_weight_kg: null,
            is_active: false,
            display_order: index,
          };
          const fileInputId = `logo_${index}`;

          return (
            <div key={index} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">Opción {index + 1}</h2>
                  {opt.id && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(opt.id, opt.id)}
                      className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-mono text-gray-500 hover:bg-gray-100 hover:text-brand-emerald transition-colors"
                      title="Copiar ID"
                    >
                      <span>{opt.id.slice(0, 8)}...</span>
                      <span>{copiedId === opt.id ? '✅' : '📋'}</span>
                    </button>
                  )}
                </div>
                {opt.id ? (
                  <button
                    type="button"
                    onClick={() => deleteOption(opt.id)}
                    className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre de la paquetería</label>
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) => updateOption(index, { name: e.target.value })}
                    placeholder="Ej: Estafeta, FedEx, DHL"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Costo de envío (MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={opt.cost}
                    onChange={(e) => updateOption(index, { cost: Number(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tiempo de entrega (días)</label>
                  <input
                    type="number"
                    min="1"
                    value={opt.delivery_days}
                    onChange={(e) => updateOption(index, { delivery_days: Math.max(1, Number(e.target.value) || 1) })}
                    placeholder="1"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Peso máximo (KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={opt.max_weight_kg || ''}
                    onChange={(e) => updateOption(index, { max_weight_kg: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Sin límite (dejar vacío)"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                  <div className="mt-1 text-xs text-gray-500">Deja vacío si no hay límite de peso</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Logo (PNG)</label>
                  <div className="mt-1 flex items-center gap-3">
                    {opt.logo_url ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={opt.logo_url} alt={opt.name || 'Logo'} className="h-12 w-12 rounded-lg object-contain ring-1 ring-black/5" />
                        <span className="text-xs text-gray-600">Logo actual</span>
                      </div>
                    ) : null}
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/png"
                      className="hidden"
                      disabled={isUploading[opt.id] || !opt.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && opt.id) {
                          void uploadLogo(opt.id, file);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    <label
                      htmlFor={fileInputId}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm ring-1 ${
                        opt.id && !isUploading[opt.id]
                          ? 'bg-white text-gray-900 ring-black/5 hover:bg-gray-50'
                          : 'cursor-not-allowed bg-gray-100 text-gray-400 ring-gray-200'
                      }`}
                    >
                      {isUploading[opt.id] ? 'Subiendo...' : opt.logo_url ? 'Cambiar logo' : 'Subir logo'}
                    </label>
                    {!opt.id ? <span className="text-xs text-gray-500">(Guarda primero la opción)</span> : null}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={opt.is_active}
                      onChange={(e) => updateOption(index, { is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                    />
                    <span className="text-sm font-medium text-gray-700">Activa (visible en checkout)</span>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => saveOption(index, opt)}
                  disabled={isSaving || !opt.name.trim()}
                  className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : opt.id ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
    </div>
  );
}
