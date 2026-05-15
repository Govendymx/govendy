'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_REGISTRY,
  mergeFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlagsState,
} from '@/lib/admin/feature-flags';

function Switch({
  checked,
  disabled,
  onChange,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand-emerald' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function AdminInterruptoresPage() {
  const [booting, setBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rawFlags, setRawFlags] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<FeatureFlagsState>(DEFAULT_FEATURE_FLAGS);

  const mergedFromDraft = useMemo(() => mergeFeatureFlags({ ...rawFlags, ...draft }), [rawFlags, draft]);

  const load = useCallback(async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
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
      setIsAdmin(false);
      setError('No tienes permisos de administrador.');
      return;
    }
    setIsAdmin(true);

    const { data: row, error: rowErr } = await supabase.from('app_settings').select('feature_flags').eq('id', 1).maybeSingle();
    if (rowErr) throw rowErr;
    const raw = (row as { feature_flags?: unknown } | null)?.feature_flags;
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    setRawFlags(obj);
    setDraft(mergeFeatureFlags(obj));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBooting(true);
        setError(null);
        await load();
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar.');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const setFlag = (key: FeatureFlagKey, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const nextJson = { ...rawFlags, ...draft };
      const { error: upErr } = await supabase
        .from('app_settings')
        .update({ feature_flags: nextJson, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (upErr) throw upErr;
      setRawFlags(nextJson as Record<string, unknown>);
      setSuccess('Interruptores guardados.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-10">
        <div className="mx-auto max-w-2xl h-40 animate-pulse rounded-2xl bg-white/80 ring-1 ring-black/5" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
              Admin
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Interruptores</h1>
            <p className="mt-2 text-sm text-gray-600">
              Activa o desactiva funciones de toda la app. Los nuevos interruptores se añaden en código para que siempre aparezcan aquí.
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
          >
            Configuración
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>
        )}

        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
          {FEATURE_FLAG_REGISTRY.map((def) => (
            <div
              key={def.key}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 pr-2">
                <p className="text-sm font-bold text-gray-900">{def.label}</p>
                <p className="mt-1 text-xs text-gray-600 leading-snug">{def.description}</p>
                <p className="mt-2 font-mono text-[10px] text-gray-400">clave: {def.key}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                <Switch
                  id={`flag-${def.key}`}
                  checked={mergedFromDraft[def.key]}
                  disabled={saving}
                  onChange={(v) => setFlag(def.key, v)}
                />
                <span className="text-xs font-semibold text-gray-500">{mergedFromDraft[def.key] ? 'Activado' : 'Desactivado'}</span>
              </div>
            </div>
          ))}

          <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDraft(mergeFeatureFlags(rawFlags))}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              Deshacer
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="rounded-xl bg-brand-emerald px-5 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Para añadir más interruptores, amplía <code className="rounded bg-gray-100 px-1">lib/admin/feature-flags.ts</code> y vuelve a desplegar.
        </p>
      </div>
    </div>
  );
}
