'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

// Componente para probar email
function TestEmailSection() {
  const [testEmail, setTestEmail] = useState('arturoalejandro031187@gmail.com');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      setResult({ ok: false, error: 'Ingresa un email válido' });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim() }),
      });

      const data = await response.json();
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Error al enviar' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email de destino</label>
        <div className="mt-1 flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
          />
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={isSending}
            className="rounded-lg bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? 'Enviando...' : 'Enviar prueba'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Se enviará un email de prueba desde <strong>contacto@gopocket.com.mx</strong> a la dirección que ingreses.
        </p>
      </div>

      {result && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${result.ok
            ? 'border-green-200 bg-white text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'
            }`}
        >
          {result.ok ? (
            <div>
              <strong>✅ Éxito:</strong> {result.message || 'Email enviado correctamente'}
              <div className="mt-2 text-xs opacity-80">Revisa tu bandeja de entrada (y spam) en {testEmail}</div>
            </div>
          ) : (
            <div>
              <strong>❌ Error:</strong> {result.error || 'No se pudo enviar el email'}
              <div className="mt-2 text-xs opacity-80">
                Verifica que hayas configurado <code className="rounded bg-white/50 px-1">RESEND_API_KEY</code> en tus variables de entorno.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <strong>💡 Nota:</strong> Si no has configurado Resend aún, sigue la guía en{' '}
        <code className="rounded bg-white/50 px-1">GUIA_PASO_A_PASO_RESEND.md</code>
      </div>
    </div>
  );
}

type PaymentMethodsConfig = {
  mercadopago: { enabled: boolean };
  bank_transfer: {
    enabled: boolean;
    bank_name?: string;
    account_holder?: string;
    clabe?: string;
    instructions?: string;
  };
  bank_deposit: {
    enabled: boolean;
    bank_name?: string;
    account_holder?: string;
    account_number?: string;
    instructions?: string;
  };
  oxxo: { enabled: boolean; instructions?: string };
};

type T1EnviosConfig = {
  enabled: boolean;
  api_key: string;
  api_secret: string;
  endpoint_url: string;
  test_mode: boolean;
};

type AdminMailbox = {
  label: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_user: string;
  imap_pass: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
};

const defaultMailbox = (): AdminMailbox => ({
  label: '',
  email: '',
  imap_host: '',
  imap_port: 993,
  imap_secure: true,
  imap_user: '',
  imap_pass: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: '',
  smtp_pass: '',
});

type EstafetaWeightRange = {
  max_weight_kg: number;
  price: number;
};

type EstafetaConfig = {
  enabled: boolean;
  weight_ranges: EstafetaWeightRange[];
};

type CashbackConfig = {
  enabled: boolean;
  percentage: number;
  welcome_bonus: number;
};

type AppSettingsRow = {
  id: number;
  cancel_penalty_rate: number;
  featured_price: number;
  shipping_base: number;
  shipping_extended: number;
  shipping_markup_percent: number;
  shipping_markup_fixed: number;
  payment_methods: PaymentMethodsConfig;
  favorites_message?: string | null;
  section_messages?: Record<string, SectionMessage> | null;
  t1_envios_config?: T1EnviosConfig | null;
  admin_mailboxes?: AdminMailbox[] | null;
  estafeta_config?: EstafetaConfig | null;
  cashback_config?: CashbackConfig | null;
  commission_basic_percent: number;
  commission_pro_percent: number;
  commission_platinum_percent: number;
  cashback_enabled: boolean;
  cashback_percent: number;
  cashback_start_date?: string | null;
  cashback_end_date?: string | null;
};

type SectionMessage = {
  message: string;
  html?: boolean;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  style?: {
    background_color?: string;
    text_color?: string;
    border_color?: string;
  };
};

const defaultPaymentMethods: PaymentMethodsConfig = {
  mercadopago: { enabled: true },
  bank_transfer: { enabled: true, bank_name: '', account_holder: '', clabe: '', instructions: '' },
  bank_deposit: { enabled: true, bank_name: '', account_holder: '', account_number: '', instructions: '' },
  oxxo: { enabled: true, instructions: '' },
};

type VersionInfo = {
  env?: string | null;
  commitSha?: string | null;
  commitRef?: string | null;
  commitMessage?: string | null;
  deploymentUrl?: string | null;
  deploymentId?: string | null;
  buildId?: string | null;
  timestamp?: string | null;
};

export default function AdminSettingsPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<Array<{ user_id: string; email?: string | null; created_at?: string | null }>>([]);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminUserIdInput, setAdminUserIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [revokePasswordInput, setRevokePasswordInput] = useState('');
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  const [settings, setSettings] = useState<AppSettingsRow & { verification_price?: number }>({
    id: 1,
    cancel_penalty_rate: 0.03,
    featured_price: 25,
    shipping_base: 180,
    shipping_extended: 200,
    shipping_markup_percent: 0,
    shipping_markup_fixed: 0,
    payment_methods: defaultPaymentMethods,
    favorites_message: 'No esperas mas y aprovecha estas ofertas antes de que te las ganen',
    verification_price: 50,
    t1_envios_config: {
      enabled: false,
      api_key: '',
      api_secret: '',
      endpoint_url: '',
      test_mode: true,
    },
    admin_mailboxes: [defaultMailbox(), defaultMailbox(), defaultMailbox()],
    estafeta_config: {
      enabled: true,
      weight_ranges: [
        { max_weight_kg: 1, price: 175 },
        { max_weight_kg: 5, price: 195 },
        { max_weight_kg: 10, price: 235 },
        { max_weight_kg: 15, price: 255 },
        { max_weight_kg: 20, price: 275 },
        { max_weight_kg: 25, price: 300 },
        { max_weight_kg: 30, price: 325 },
        { max_weight_kg: 35, price: 340 },
        { max_weight_kg: 40, price: 355 },
        { max_weight_kg: 45, price: 385 },
        { max_weight_kg: 50, price: 415 },
        { max_weight_kg: 55, price: 435 },
        { max_weight_kg: 60, price: 455 },
      ],
    },
    commission_basic_percent: 23,
    commission_pro_percent: 18,
    commission_platinum_percent: 18,
    cashback_enabled: false,
    cashback_percent: 0,
    cashback_start_date: null,
    cashback_end_date: null,
  });

  const computedPenaltyPct = useMemo(() => Math.round(settings.cancel_penalty_rate * 10000) / 100, [settings]);

  const fetchVersion = async () => {
    try {
      setVersionLoading(true);
      setVersionError(null);
      const res = await fetch('/api/admin/version', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setVersionError(json?.error || 'No se pudo obtener la versión actual.');
        return;
      }
      setVersion(json as VersionInfo);
    } catch (e: unknown) {
      setVersionError(e instanceof Error ? e.message : 'No se pudo obtener la versión actual.');
    } finally {
      setVersionLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      setAdminUsersError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/admin/users', { headers: { authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar la lista de administradores.');
      setAdminUsers((json?.admins ?? []) as any[]);
    } catch (e: unknown) {
      console.error(e);
      setAdminUsersError(e instanceof Error ? e.message : 'No se pudo cargar la lista de administradores.');
    }
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);

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
          if (!cancelled) {
            setIsAdmin(false);
            setError('No tienes permisos de administrador para ver esta página.');
          }
          return;
        }

        if (!cancelled) setIsAdmin(true);
        if (!cancelled) {
          await fetchVersion();
        }
        await loadAdminUsers();

        const { data: settingsRow, error: settingsError } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (settingsError) throw settingsError;

        if (!cancelled && settingsRow) {
          setSettings({
            id: settingsRow.id,
            cancel_penalty_rate: Number(settingsRow.cancel_penalty_rate),
            featured_price: Number(settingsRow.featured_price),
            shipping_base: Number(settingsRow.shipping_base),
            verification_price: Number((settingsRow as any).verification_price || 50),
            shipping_extended: Number(settingsRow.shipping_extended),
            shipping_markup_percent: Number((settingsRow as any).shipping_markup_percent ?? 0),
            shipping_markup_fixed: Number((settingsRow as any).shipping_markup_fixed ?? 0),
            payment_methods: (settingsRow.payment_methods as PaymentMethodsConfig) ?? defaultPaymentMethods,
            favorites_message: (settingsRow as any).favorites_message ?? 'No esperas mas y aprovecha estas ofertas antes de que te las ganen',
            section_messages: ((settingsRow as any).section_messages as Record<string, SectionMessage>) ?? {},
            t1_envios_config: ((settingsRow as any).t1_envios_config as T1EnviosConfig) ?? {
              enabled: false,
              api_key: '',
              api_secret: '',
              endpoint_url: '',
              test_mode: true,
            },
            // Legacy JSON config - keeping it for compatibility if needed, but we use columns now
            cashback_config: ((settingsRow as any).cashback_config as CashbackConfig) ?? {
              enabled: false,
              percentage: 0,
              welcome_bonus: 0,
            },
            // New Columns
            commission_basic_percent: Number(settingsRow.commission_basic_percent ?? 23),
            commission_pro_percent: Number(settingsRow.commission_pro_percent ?? 18),
            commission_platinum_percent: Number((settingsRow as any).commission_platinum_percent ?? 18),
            cashback_enabled: Boolean(settingsRow.cashback_enabled ?? false),
            cashback_percent: Number(settingsRow.cashback_percent ?? 0),
            cashback_start_date: settingsRow.cashback_start_date,
            cashback_end_date: settingsRow.cashback_end_date,

            admin_mailboxes: (() => {
              const raw = (settingsRow as any)?.admin_mailboxes;
              if (!Array.isArray(raw) || raw.length === 0) return [defaultMailbox(), defaultMailbox(), defaultMailbox(), defaultMailbox()];
              const out: AdminMailbox[] = [];
              for (let i = 0; i < 4; i++) {
                const m = raw[i];
                if (m && typeof m === 'object') {
                  out.push({
                    label: String(m?.label ?? '').trim(),
                    email: String(m?.email ?? '').trim(),
                    imap_host: String(m?.imap_host ?? '').trim(),
                    imap_port: Math.max(1, Math.min(65535, Number(m?.imap_port) || 993)),
                    imap_secure: m?.imap_secure !== false,
                    imap_user: String(m?.imap_user ?? '').trim(),
                    imap_pass: String(m?.imap_pass ?? '').trim(),
                    smtp_host: String(m?.smtp_host ?? '').trim(),
                    smtp_port: Math.max(1, Math.min(65535, Number(m?.smtp_port) || 587)),
                    smtp_secure: m?.smtp_secure === true,
                    smtp_user: String(m?.smtp_user ?? '').trim(),
                    smtp_pass: String(m?.smtp_pass ?? '').trim(),
                  });
                } else out.push(defaultMailbox());
              }
              return out;
            })(),
          });
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const grantAdmin = async () => {
    setAdminUsersError(null);
    setSuccess(null);
    try {
      const email = adminEmailInput.trim();
      const user_id = adminUserIdInput.trim();
      if (!email && !user_id) {
        setAdminUsersError('Escribe un email o un user_id.');
        return;
      }
      const password = adminPasswordInput.trim();
      if (!password) {
        setAdminUsersError('Debes ingresar tu contraseña para agregar administradores.');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/settings';
        return;
      }
      console.log('[ADMIN SETTINGS] Agregando administrador:', { email, user_id, hasPassword: !!password });
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: email || undefined,
          user_id: user_id || undefined,
          password: password || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      console.log('[ADMIN SETTINGS] Respuesta del servidor:', { status: res.status, ok: res.ok, json });
      if (!res.ok) {
        const errorMsg = json?.error || `No se pudo agregar administrador (${res.status}).`;
        console.error('[ADMIN SETTINGS] Error agregando administrador:', { status: res.status, json, errorMsg });
        setAdminUsersError(errorMsg);
        return;
      }
      if (!json?.ok) {
        const errorMsg = json?.error || 'El servidor no confirmó la operación.';
        console.error('[ADMIN SETTINGS] Respuesta no OK:', json);
        setAdminUsersError(errorMsg);
        return;
      }
      setAdminEmailInput('');
      setAdminUserIdInput('');
      setAdminPasswordInput('');
      setSuccess('Administrador agregado correctamente.');
      await loadAdminUsers();
    } catch (e: unknown) {
      console.error('[ADMIN SETTINGS] Excepción al agregar administrador:', e);
      setAdminUsersError(e instanceof Error ? e.message : 'No se pudo agregar administrador.');
    }
  };

  const revokeAdmin = async (user_id: string) => {
    // Mostrar modal para pedir contraseña
    setRevokingUserId(user_id);
    setRevokePasswordInput('');
  };

  const confirmRevokeAdmin = async () => {
    if (!revokingUserId) return;
    setAdminUsersError(null);
    setSuccess(null);
    try {
      const password = revokePasswordInput.trim();
      if (!password) {
        setAdminUsersError('Debes ingresar tu contraseña para quitar administradores.');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/settings';
        return;
      }
      console.log('[ADMIN SETTINGS] Quitando administrador:', { user_id: revokingUserId, hasPassword: !!password });
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: revokingUserId,
          password: password,
        }),
      });
      const json = await res.json().catch(() => ({}));
      console.log('[ADMIN SETTINGS] Respuesta del servidor (DELETE):', { status: res.status, ok: res.ok, json });
      if (!res.ok) {
        const errorMsg = json?.error || `No se pudo quitar administrador (${res.status}).`;
        console.error('[ADMIN SETTINGS] Error quitando administrador:', { status: res.status, json, errorMsg });
        setAdminUsersError(errorMsg);
        return;
      }
      if (!json?.ok) {
        const errorMsg = json?.error || 'El servidor no confirmó la operación.';
        console.error('[ADMIN SETTINGS] Respuesta no OK (DELETE):', json);
        setAdminUsersError(errorMsg);
        return;
      }
      setSuccess('Administrador quitado.');
      setRevokingUserId(null);
      setRevokePasswordInput('');
      await loadAdminUsers();
    } catch (e: unknown) {
      console.error('[ADMIN SETTINGS] Excepción al quitar administrador:', e);
      setAdminUsersError(e instanceof Error ? e.message : 'No se pudo quitar administrador.');
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const payload: any = {
        id: 1,
        cancel_penalty_rate: settings.cancel_penalty_rate,
        featured_price: settings.featured_price,
        shipping_base: settings.shipping_base,
        shipping_extended: settings.shipping_extended,
        shipping_markup_percent: settings.shipping_markup_percent,
        shipping_markup_fixed: settings.shipping_markup_fixed,
        payment_methods: settings.payment_methods,
        favorites_message: settings.favorites_message || null,
        t1_envios_config: settings.t1_envios_config || null,
        admin_mailboxes: settings.admin_mailboxes ?? null,
        estafeta_config: settings.estafeta_config || null,
        // New columns
        commission_basic_percent: settings.commission_basic_percent,
        commission_pro_percent: settings.commission_pro_percent,
        cashback_enabled: settings.cashback_enabled,
        cashback_percent: settings.cashback_percent,
        cashback_start_date: settings.cashback_start_date,
        cashback_end_date: settings.cashback_end_date,
        updated_at: new Date().toISOString(),
      };

      // Intentamos agregar commission_platinum_percent solo si no falla, pero por seguridad lo quitamos temporalmente
      // si causa conflicto.
      if ('commission_platinum_percent' in settings) {
         payload.commission_platinum_percent = (settings as any).commission_platinum_percent ?? 18;
      }
      
      const { error: updateError } = await supabase.from('app_settings').update(payload).eq('id', 1);
      
      if (updateError) {
        // Fallback: Si falta una columna, intentamos quitar verification_price o commission_platinum_percent
        if (updateError.message?.includes('verification_price')) delete payload.verification_price;
        if (updateError.message?.includes('commission_platinum_percent')) delete payload.commission_platinum_percent;
        if (updateError.message?.includes('commission_basic_percent')) delete payload.commission_basic_percent;
        if (updateError.message?.includes('commission_pro_percent')) delete payload.commission_pro_percent;
        if (updateError.message?.includes('cashback_enabled')) delete payload.cashback_enabled;
        if (updateError.message?.includes('cashback_percent')) delete payload.cashback_percent;
        if (updateError.message?.includes('cashback_start_date')) delete payload.cashback_start_date;
        if (updateError.message?.includes('cashback_end_date')) delete payload.cashback_end_date;
        
        const { error: retryError } = await supabase.from('app_settings').update(payload).eq('id', 1);
        if (retryError) throw retryError;
      }

      setSuccess('Configuración guardada correctamente.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'No se pudo guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
          <div className="mt-6 h-80 rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
              Admin
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Configuración</h1>
            <p className="mt-2 text-sm text-gray-600">
              Activa/desactiva métodos de pago y ajusta comisiones/envíos. Todo es configurable desde aquí.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/banners"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Banners
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {!isAdmin ? null : (
          <form onSubmit={onSave} className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Versión y despliegue</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Consulta el build actual y dispara un deploy manual a Vercel.
                  </p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <div className="font-mono">
                    {version?.commitSha ? version.commitSha.slice(0, 7) : 'sin commit'}
                  </div>
                  <div>{version?.env || 'local'}</div>
                  {version?.timestamp && (
                    <div className="text-[11px] text-gray-500">
                      {new Date(version.timestamp).toLocaleString('es-MX')}
                    </div>
                  )}
                </div>
              </div>
              {versionError && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  {versionError}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchVersion()}
                  disabled={versionLoading}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-60"
                >
                  {versionLoading ? 'Consultando…' : 'Consultar versión actual'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (deploying) return;
                    setDeployMessage(null);
                    setError(null);
                    setDeploying(true);
                    try {
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData.session?.access_token;
                      if (!token) {
                        setDeployMessage('Sesión expirada, vuelve a iniciar sesión.');
                        setDeploying(false);
                        return;
                      }
                      const res = await fetch('/api/admin/deploy', {
                        method: 'POST',
                        headers: {
                          authorization: `Bearer ${token}`,
                        },
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || !json?.ok) {
                        const msg =
                          json?.error ||
                          'No se pudo disparar el deploy. Verifica el Deploy Hook en Vercel.';
                        setDeployMessage(msg);
                        return;
                      }
                      setDeployMessage(
                        'Deploy disparado correctamente. Revisa Vercel para ver el progreso.',
                      );
                      await fetchVersion();
                    } catch (e: unknown) {
                      setDeployMessage(
                        e instanceof Error ? e.message : 'Error al disparar el deploy.',
                      );
                    } finally {
                      setDeploying(false);
                    }
                  }}
                  disabled={deploying}
                  className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                >
                  {deploying ? 'Desplegando…' : 'Desplegar a producción'}
                </button>
              </div>
              {deployMessage && (
                <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                  {deployMessage}
                </div>
              )}
            </section>
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Administradores</h2>
                  <p className="mt-1 text-sm text-gray-600">Agrega o quita usuarios con permisos de administrador.</p>
                </div>
                <button
                  type="button"
                  onClick={loadAdminUsers}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                >
                  Actualizar
                </button>
              </div>

              {adminUsersError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {adminUsersError}
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email (recomendado)</label>
                  <input
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    placeholder="usuario@correo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">User ID (UUID)</label>
                  <input
                    value={adminUserIdInput}
                    onChange={(e) => setAdminUserIdInput(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Tu contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  placeholder="Ingresa tu contraseña para confirmar"
                  required
                />
                <div className="mt-1 text-xs text-gray-500">Se requiere tu contraseña por seguridad para agregar o quitar administradores.</div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={grantAdmin}
                  className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
                >
                  Agregar administrador
                </button>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">Lista de admins</div>
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Buscar admin..."
                    className="w-64 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {adminUsers.length === 0 ? (
                    <div className="text-sm text-gray-600">No hay admins cargados (o no se pudieron leer).</div>
                  ) : (
                    adminUsers
                      .filter((a) => {
                        if (!adminSearch.trim()) return true;
                        const q = adminSearch.toLowerCase();
                        return (
                          (a.email || '').toLowerCase().includes(q) ||
                          (a.user_id || '').toLowerCase().includes(q)
                        );
                      })
                      .map((a) => (
                        <div key={a.user_id} className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{a.email || '—'}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 break-all">
                              {a.user_id}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(a.user_id, a.user_id)}
                                className="ml-1 hover:text-brand-emerald focus:outline-none"
                                title="Copiar ID"
                              >
                                {copiedId === a.user_id ? '✅' : '📋'}
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => revokeAdmin(a.user_id)}
                            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                          >
                            Quitar admin
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Modal para confirmar quitar admin */}
              {revokingUserId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setRevokingUserId(null);
                    setRevokePasswordInput('');
                    setAdminUsersError(null);
                  }
                }}>
                  <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-gray-900">Confirmar acción</h3>
                    <p className="mt-2 text-sm text-gray-600">Para quitar un administrador, debes ingresar tu contraseña por seguridad.</p>
                    {adminUsersError && (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {adminUsersError}
                      </div>
                    )}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Tu contraseña <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={revokePasswordInput}
                        onChange={(e) => {
                          setRevokePasswordInput(e.target.value);
                          if (adminUsersError) setAdminUsersError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void confirmRevokeAdmin();
                          }
                          if (e.key === 'Escape') {
                            setRevokingUserId(null);
                            setRevokePasswordInput('');
                            setAdminUsersError(null);
                          }
                        }}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                        placeholder="Ingresa tu contraseña"
                        autoFocus
                      />
                    </div>
                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRevokingUserId(null);
                          setRevokePasswordInput('');
                          setAdminUsersError(null);
                        }}
                        className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={confirmRevokeAdmin}
                        className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Sección de Cashback y Monedero */}
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Monedero y Cashback</h2>
                  <p className="mt-1 text-sm text-gray-600">Configura el programa de recompensas para usuarios.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${settings.cashback_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {settings.cashback_enabled ? 'Activado' : 'Desactivado'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettings(p => ({
                      ...p,
                      cashback_enabled: !p.cashback_enabled
                    }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2 ${settings.cashback_enabled ? 'bg-brand-emerald' : 'bg-gray-200'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.cashback_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {settings.cashback_enabled && (
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Porcentaje de Cashback (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.cashback_percent}
                      onChange={(e) => setSettings(p => ({
                        ...p,
                        cashback_percent: Number(e.target.value)
                      }))}
                      className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      Porcentaje del valor de la compra que se devuelve al usuario.
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vigencia (Opcional)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-gray-500">Inicio</span>
                        <input
                          type="datetime-local"
                          value={settings.cashback_start_date ? new Date(settings.cashback_start_date).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setSettings(p => ({
                            ...p,
                            cashback_start_date: e.target.value ? new Date(e.target.value).toISOString() : null
                          }))}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-2 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Fin</span>
                        <input
                          type="datetime-local"
                          value={settings.cashback_end_date ? new Date(settings.cashback_end_date).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setSettings(p => ({
                            ...p,
                            cashback_end_date: e.target.value ? new Date(e.target.value).toISOString() : null
                          }))}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-2 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                        />
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Si se deja vacío, es permanente.
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Comisiones y envíos</h2>
              <p className="mt-1 text-sm text-gray-600">Valores globales para cálculos de checkout.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <label className="block text-sm font-medium text-blue-900">Comisiones por Plan (Fijas)</label>
                  <div className="mt-2 text-sm text-blue-800 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span>Plan Básico:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.commission_basic_percent}
                          onChange={(e) => setSettings(p => ({ ...p, commission_basic_percent: Number(e.target.value) }))}
                          className="w-20 rounded border border-blue-300 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div className="h-1 w-full rounded-full bg-blue-200">
                        <div className="h-1 rounded-full bg-blue-500" style={{ width: `${Math.min(100, settings.commission_basic_percent)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span>Plan Pro:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={settings.commission_pro_percent}
                          onChange={(e) => setSettings(p => ({ ...p, commission_pro_percent: Number(e.target.value) }))}
                          className="w-20 rounded border border-blue-300 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div className="h-1 w-full rounded-full bg-blue-200">
                        <div className="h-1 rounded-full bg-blue-500" style={{ width: `${Math.min(100, settings.commission_pro_percent)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="flex items-center gap-1.5">Plan Platinum: <span className="text-[10px] font-bold rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.5">✦ Platinum</span></span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={(settings as any).commission_platinum_percent ?? 18}
                          onChange={(e) => setSettings(p => ({ ...p, commission_platinum_percent: Number(e.target.value) } as any))}
                          className="w-20 rounded border border-purple-300 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                      <div className="h-1 w-full rounded-full bg-purple-200">
                        <div className="h-1 rounded-full bg-purple-500" style={{ width: `${Math.min(100, (settings as any).commission_platinum_percent ?? 18)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    * Las comisiones se aplican automáticamente según el plan del vendedor al crear la orden.
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Precio de verificación (MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={(settings as any).verification_price || 50}
                    onChange={(e) => setSettings((p) => ({ ...p, verification_price: Number(e.target.value) } as any))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                  <div className="mt-1 text-xs text-gray-500">Precio que los usuarios pagan para obtener verificación</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Penalización cancelación (0 a 1)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={settings.cancel_penalty_rate}
                    onChange={(e) => setSettings((p) => ({ ...p, cancel_penalty_rate: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                  <div className="mt-1 text-xs text-gray-500">Equivale a {computedPenaltyPct}%</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Envío base</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.shipping_base}
                    onChange={(e) => setSettings((p) => ({ ...p, shipping_base: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Zona extendida (+)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.shipping_extended}
                    onChange={(e) => setSettings((p) => ({ ...p, shipping_extended: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Margen % en envíos</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.shipping_markup_percent}
                    onChange={(e) => setSettings((p) => ({ ...p, shipping_markup_percent: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    placeholder="0"
                  />
                  <div className="mt-1 text-xs text-gray-500">Ej. 10 = 10% sobre el costo (T1, Envia, base).</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Margen fijo (MXN) en envíos</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.shipping_markup_fixed}
                    onChange={(e) => setSettings((p) => ({ ...p, shipping_markup_fixed: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                    placeholder="0"
                  />
                  <div className="mt-1 text-xs text-gray-500">Se suma al costo. Ej. 20 → $170 + 20 = $190.</div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Precio destacados</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.featured_price}
                    onChange={(e) => setSettings((p) => ({ ...p, featured_price: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  />
                </div>
              </div>
            </section>

            {/* Sección de prueba de email - Movida aquí para mayor visibilidad */}
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Prueba de Email</h2>
                  <p className="mt-1 text-sm text-gray-600">Prueba que el email con contacto@gopocket.com.mx funciona correctamente</p>
                </div>
              </div>
              <TestEmailSection />
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Mensajes y textos</h2>
              <p className="mt-1 text-sm text-gray-600">Configura mensajes que aparecen en diferentes secciones de la aplicación.</p>

              {/* Mensaje de favoritos (legacy - mantener compatibilidad) */}
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-700">Mensaje de favoritos (legacy)</label>
                <textarea
                  value={settings.favorites_message || ''}
                  onChange={(e) => setSettings((p) => ({ ...p, favorites_message: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                  rows={3}
                  placeholder="No esperas mas y aprovecha estas ofertas antes de que te las ganen"
                />
                <div className="mt-1 text-xs text-gray-500">Este mensaje aparecerá en la página de favoritos para incentivar compras.</div>
              </div>

              {/* Mensajes por sección (nuevo sistema) */}
              <div className="mt-8 border-t border-gray-200 pt-8">
                <h3 className="text-base font-bold text-gray-900">Mensajes por sección (Sistema mejorado)</h3>
                <p className="mt-1 text-sm text-gray-600">Configura mensajes con HTML, vigencia y estilos personalizados.</p>

                {(['favoritos', 'dashboard', 'ventas', 'compras', 'listings', 'cart'] as const).map((section) => {
                  const sectionMsg = settings.section_messages?.[section] || {
                    message: '',
                    html: false,
                    is_active: false,
                    starts_at: null,
                    ends_at: null,
                    style: {
                      background_color: '#fff3cd',
                      text_color: '#856404',
                      border_color: '#ffc107',
                    },
                  };

                  return (
                    <div key={section} className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 capitalize">{section}</label>
                          <div className="mt-1 text-xs text-gray-600">Mensaje para la sección: /dashboard/{section === 'listings' ? 'listings' : section === 'cart' ? 'cart' : section}</div>
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sectionMsg.is_active || false}
                            onChange={(e) => {
                              setSettings((p) => ({
                                ...p,
                                section_messages: {
                                  ...(p.section_messages || {}),
                                  [section]: {
                                    ...sectionMsg,
                                    is_active: e.target.checked,
                                  },
                                },
                              }));
                            }}
                            className="rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                          />
                          <span className="text-sm text-gray-700">Activo</span>
                        </label>
                      </div>

                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Mensaje *</label>
                          {sectionMsg.html ? (
                            <textarea
                              value={sectionMsg.message}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: { ...sectionMsg, message: e.target.value },
                                  },
                                }));
                              }}
                              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                              rows={6}
                              placeholder="<p>Tu mensaje HTML aquí</p>"
                            />
                          ) : (
                            <textarea
                              value={sectionMsg.message}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: { ...sectionMsg, message: e.target.value },
                                  },
                                }));
                              }}
                              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                              rows={3}
                              placeholder="Escribe tu mensaje aquí..."
                            />
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={sectionMsg.html || false}
                                onChange={(e) => {
                                  setSettings((p) => ({
                                    ...p,
                                    section_messages: {
                                      ...(p.section_messages || {}),
                                      [section]: { ...sectionMsg, html: e.target.checked },
                                    },
                                  }));
                                }}
                                className="rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                              />
                              <span className="text-xs text-gray-600">Permitir HTML</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Fecha de inicio (opcional)</label>
                            <input
                              type="datetime-local"
                              value={sectionMsg.starts_at ? new Date(sectionMsg.starts_at).toISOString().slice(0, 16) : ''}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: {
                                      ...sectionMsg,
                                      starts_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                                    },
                                  },
                                }));
                              }}
                              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Fecha de fin (opcional)</label>
                            <input
                              type="datetime-local"
                              value={sectionMsg.ends_at ? new Date(sectionMsg.ends_at).toISOString().slice(0, 16) : ''}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: {
                                      ...sectionMsg,
                                      ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                                    },
                                  },
                                }));
                              }}
                              className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Color de fondo</label>
                            <input
                              type="color"
                              value={sectionMsg.style?.background_color || '#fff3cd'}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: {
                                      ...sectionMsg,
                                      style: {
                                        ...sectionMsg.style,
                                        background_color: e.target.value,
                                      },
                                    },
                                  },
                                }));
                              }}
                              className="mt-1 h-10 w-full rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-brand-emerald"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Color de texto</label>
                            <input
                              type="color"
                              value={sectionMsg.style?.text_color || '#856404'}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: {
                                      ...sectionMsg,
                                      style: {
                                        ...sectionMsg.style,
                                        text_color: e.target.value,
                                      },
                                    },
                                  },
                                }));
                              }}
                              className="mt-1 h-10 w-full rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-brand-emerald"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Color de borde</label>
                            <input
                              type="color"
                              value={sectionMsg.style?.border_color || '#ffc107'}
                              onChange={(e) => {
                                setSettings((p) => ({
                                  ...p,
                                  section_messages: {
                                    ...(p.section_messages || {}),
                                    [section]: {
                                      ...sectionMsg,
                                      style: {
                                        ...sectionMsg.style,
                                        border_color: e.target.value,
                                      },
                                    },
                                  },
                                }));
                              }}
                              className="mt-1 h-10 w-full rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-brand-emerald"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Integración T1 Envíos</h2>
              <p className="mt-1 text-sm text-gray-600">
                Configura las credenciales de T1 Envíos para cotización automática y generación de guías. Contacta a{' '}
                <a href="mailto:soporte@t1envios.com" className="text-brand-emerald hover:underline">
                  soporte@t1envios.com
                </a>{' '}
                para obtener acceso a la API.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-black/5 p-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Habilitar T1 Envíos</div>
                    <div className="mt-1 text-xs text-gray-500">Activa la integración con T1 Envíos para cotización y guías automáticas.</div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.t1_envios_config?.enabled ?? false}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          t1_envios_config: { ...(p.t1_envios_config ?? { enabled: false, api_key: '', api_secret: '', endpoint_url: '', test_mode: true }), enabled: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                    />
                    <span className="text-sm font-medium text-gray-700">{settings.t1_envios_config?.enabled ? 'Activado' : 'Desactivado'}</span>
                  </label>
                </div>

                {settings.t1_envios_config?.enabled ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">URL del Endpoint de T1</label>
                      <input
                        type="text"
                        value={settings.t1_envios_config?.endpoint_url || ''}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            t1_envios_config: { ...(p.t1_envios_config ?? { enabled: true, api_key: '', api_secret: '', endpoint_url: '', test_mode: true }), endpoint_url: e.target.value },
                          }))
                        }
                        placeholder="https://api.t1envios.com/v1"
                        className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      />
                      <div className="mt-1 text-xs text-gray-500">URL base de la API de T1 Envíos (te la proporcionará T1).</div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">API Key</label>
                      <input
                        type="password"
                        value={settings.t1_envios_config?.api_key || ''}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            t1_envios_config: { ...(p.t1_envios_config ?? { enabled: true, api_key: '', api_secret: '', endpoint_url: '', test_mode: true }), api_key: e.target.value },
                          }))
                        }
                        placeholder="Tu API Key de T1"
                        className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      />
                      <div className="mt-1 text-xs text-gray-500">API Key proporcionada por T1 Envíos.</div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">API Secret</label>
                      <input
                        type="password"
                        value={settings.t1_envios_config?.api_secret || ''}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            t1_envios_config: { ...(p.t1_envios_config ?? { enabled: true, api_key: '', api_secret: '', endpoint_url: '', test_mode: true }), api_secret: e.target.value },
                          }))
                        }
                        placeholder="Tu API Secret de T1"
                        className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      />
                      <div className="mt-1 text-xs text-gray-500">API Secret proporcionada por T1 Envíos.</div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-black/5 p-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Modo de Prueba</div>
                        <div className="mt-1 text-xs text-gray-500">Activa para usar el entorno de pruebas de T1 (sandbox).</div>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.t1_envios_config?.test_mode ?? true}
                          onChange={(e) =>
                            setSettings((p) => ({
                              ...p,
                              t1_envios_config: { ...(p.t1_envios_config ?? { enabled: true, api_key: '', api_secret: '', endpoint_url: '', test_mode: true }), test_mode: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                        />
                        <span className="text-sm font-medium text-gray-700">{settings.t1_envios_config?.test_mode ? 'Pruebas' : 'Producción'}</span>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-xs font-semibold text-amber-900">⚠️ Nota importante</div>
                      <div className="mt-1 text-xs text-amber-800">
                        La integración automática con T1 Envíos aún no está implementada. Una vez que tengas las credenciales y se implemente la integración, podrás:
                        <ul className="mt-2 ml-4 list-disc space-y-1">
                          <li>Cotizar envíos automáticamente desde GoVendy</li>
                          <li>Generar guías de envío automáticamente</li>
                          <li>Aplicar el margen configurado sobre los costos de T1</li>
                        </ul>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Buzón de correo</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Hasta 3 cuentas con dominio propio (IMAP + SMTP). Recibe y envía correos desde Admin → Correo.
                  </p>
                </div>
                <Link
                  href="/admin/correo"
                  className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  Abrir buzón →
                </Link>
              </div>
              <div className="mt-6 space-y-6">
                {[0, 1, 2, 3].map((i) => {
                  const mb = settings.admin_mailboxes?.[i] ?? defaultMailbox();
                  const setMb = (fn: (m: AdminMailbox) => AdminMailbox) => {
                    const next = [...(settings.admin_mailboxes ?? [defaultMailbox(), defaultMailbox(), defaultMailbox(), defaultMailbox()])];
                    while (next.length <= i) next.push(defaultMailbox());
                    next[i] = fn(next[i] ?? defaultMailbox());
                    setSettings((p) => ({ ...p, admin_mailboxes: next }));
                  };
                  return (
                    <div key={i} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5">
                      <h3 className="text-sm font-bold text-gray-900">Cuenta {i + 1}</h3>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Etiqueta</label>
                          <input
                            value={mb.label}
                            onChange={(e) => setMb((m) => ({ ...m, label: e.target.value }))}
                            placeholder="Ej. Soporte"
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Email *</label>
                          <input
                            type="email"
                            value={mb.email}
                            onChange={(e) => setMb((m) => ({ ...m, email: e.target.value }))}
                            placeholder="correo@tudominio.com"
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="mb-2 text-xs font-semibold text-gray-600">IMAP (recibir)</div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              value={mb.imap_host}
                              onChange={(e) => setMb((m) => ({ ...m, imap_host: e.target.value }))}
                              placeholder="imap.tudominio.com"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="number"
                              value={mb.imap_port || ''}
                              onChange={(e) => setMb((m) => ({ ...m, imap_port: Number(e.target.value) || 993 }))}
                              placeholder="993"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={mb.imap_secure}
                                onChange={(e) => setMb((m) => ({ ...m, imap_secure: e.target.checked }))}
                                className="rounded border-gray-300 text-brand-emerald"
                              />
                              <span className="text-xs text-gray-600">SSL</span>
                            </label>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="mb-2 text-xs font-semibold text-gray-600">SMTP (enviar)</div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              value={mb.smtp_host}
                              onChange={(e) => setMb((m) => ({ ...m, smtp_host: e.target.value }))}
                              placeholder="smtp.tudominio.com"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <input
                              type="number"
                              value={mb.smtp_port || ''}
                              onChange={(e) => setMb((m) => ({ ...m, smtp_port: Number(e.target.value) || 587 }))}
                              placeholder="587"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            />
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={mb.smtp_secure}
                                onChange={(e) => setMb((m) => ({ ...m, smtp_secure: e.target.checked }))}
                                className="rounded border-gray-300 text-brand-emerald"
                              />
                              <span className="text-xs text-gray-600">SSL</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Usuario (IMAP/SMTP)</label>
                          <input
                            value={mb.imap_user}
                            onChange={(e) => setMb((m) => ({ ...m, imap_user: e.target.value, smtp_user: e.target.value }))}
                            placeholder="correo@tudominio.com"
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600">Contraseña</label>
                          <input
                            type="password"
                            value={mb.imap_pass}
                            onChange={(e) => setMb((m) => ({ ...m, imap_pass: e.target.value, smtp_pass: e.target.value }))}
                            placeholder="••••••••"
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Métodos de pago</h2>
              <p className="mt-1 text-sm text-gray-600">
                Activa MercadoPago o métodos offline (transferencia, depósito, OXXO). Los textos se mostrarán en Checkout.
              </p>

              <div className="mt-6 space-y-6">
                {/* MercadoPago */}
                <div className="rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">MercadoPago</div>
                      <div className="mt-1 text-xs text-gray-500">Pago en línea (preferencia / checkout).</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.payment_methods.mercadopago?.enabled ?? false}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            payment_methods: { ...p.payment_methods, mercadopago: { enabled: e.target.checked } },
                          }))
                        }
                      />
                      Activo
                    </label>
                  </div>
                </div>

                {/* Transferencia */}
                <div className="rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Transferencia bancaria</div>
                      <div className="mt-1 text-xs text-gray-500">Muestra CLABE e instrucciones.</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.payment_methods.bank_transfer?.enabled ?? false}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            payment_methods: {
                              ...p.payment_methods,
                              bank_transfer: { ...p.payment_methods.bank_transfer, enabled: e.target.checked },
                            },
                          }))
                        }
                      />
                      Activo
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input
                      value={settings.payment_methods.bank_transfer.bank_name ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_transfer: { ...p.payment_methods.bank_transfer, bank_name: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      placeholder="Banco (ej. BBVA)"
                    />
                    <input
                      value={settings.payment_methods.bank_transfer.account_holder ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_transfer: { ...p.payment_methods.bank_transfer, account_holder: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      placeholder="Titular"
                    />
                    <input
                      value={settings.payment_methods.bank_transfer.clabe ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_transfer: { ...p.payment_methods.bank_transfer, clabe: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald sm:col-span-2"
                      placeholder="CLABE"
                    />
                    <textarea
                      value={settings.payment_methods.bank_transfer.instructions ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_transfer: { ...p.payment_methods.bank_transfer, instructions: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald sm:col-span-2"
                      rows={3}
                      placeholder="Instrucciones de transferencia"
                    />
                  </div>
                </div>

                {/* Depósito */}
                <div className="rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Depósito bancario</div>
                      <div className="mt-1 text-xs text-gray-500">Muestra número de cuenta e instrucciones.</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.payment_methods.bank_deposit?.enabled ?? false}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            payment_methods: {
                              ...p.payment_methods,
                              bank_deposit: { ...p.payment_methods.bank_deposit, enabled: e.target.checked },
                            },
                          }))
                        }
                      />
                      Activo
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input
                      value={settings.payment_methods.bank_deposit.bank_name ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_deposit: { ...p.payment_methods.bank_deposit, bank_name: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      placeholder="Banco (ej. Banorte)"
                    />
                    <input
                      value={settings.payment_methods.bank_deposit.account_holder ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_deposit: { ...p.payment_methods.bank_deposit, account_holder: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      placeholder="Titular"
                    />
                    <input
                      value={settings.payment_methods.bank_deposit.account_number ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_deposit: { ...p.payment_methods.bank_deposit, account_number: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald sm:col-span-2"
                      placeholder="Número de cuenta"
                    />
                    <textarea
                      value={settings.payment_methods.bank_deposit.instructions ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: {
                            ...p.payment_methods,
                            bank_deposit: { ...p.payment_methods.bank_deposit, instructions: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald sm:col-span-2"
                      rows={3}
                      placeholder="Instrucciones de depósito"
                    />
                  </div>
                </div>

                {/* OXXO */}
                <div className="rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">OXXO</div>
                      <div className="mt-1 text-xs text-gray-500">Instrucciones (o integración con MP más adelante).</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.payment_methods.oxxo?.enabled ?? false}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            payment_methods: { ...p.payment_methods, oxxo: { ...p.payment_methods.oxxo, enabled: e.target.checked } },
                          }))
                        }
                      />
                      Activo
                    </label>
                  </div>
                  <div className="mt-4">
                    <textarea
                      value={settings.payment_methods.oxxo.instructions ?? ''}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          payment_methods: { ...p.payment_methods, oxxo: { ...p.payment_methods.oxxo, instructions: e.target.value } },
                        }))
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                      rows={3}
                      placeholder="Instrucciones para pago en OXXO"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Configuración Estafeta */}
            <section className="mt-8">
              <div className="mb-4">
                <div className="text-lg font-bold text-gray-900">Configuración Estafeta</div>
                <div className="mt-1 text-sm text-gray-600">Precios y configuración para cotización de guías de envío Estafeta.</div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-black/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Habilitar cotización Estafeta</div>
                      <div className="mt-1 text-xs text-gray-500">Permite a los usuarios cotizar y comprar guías de envío.</div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.estafeta_config?.enabled ?? true}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            estafeta_config: {
                              ...(p.estafeta_config || {
                                enabled: true,
                                weight_ranges: [
                                  { max_weight_kg: 1, price: 175 },
                                  { max_weight_kg: 5, price: 195 },
                                  { max_weight_kg: 10, price: 235 },
                                  { max_weight_kg: 15, price: 255 },
                                  { max_weight_kg: 20, price: 275 },
                                  { max_weight_kg: 25, price: 300 },
                                  { max_weight_kg: 30, price: 325 },
                                  { max_weight_kg: 35, price: 340 },
                                  { max_weight_kg: 40, price: 355 },
                                  { max_weight_kg: 45, price: 385 },
                                  { max_weight_kg: 50, price: 415 },
                                  { max_weight_kg: 55, price: 435 },
                                  { max_weight_kg: 60, price: 455 },
                                ],
                              }),
                              enabled: e.target.checked,
                            },
                          }))
                        }
                      />
                      Activo
                    </label>
                  </div>
                </div>

                {settings.estafeta_config?.enabled !== false && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/5 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Rangos de peso y precios fijos</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Configura los precios fijos por rango de peso. Los rangos deben estar ordenados de menor a mayor peso.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const ranges = settings.estafeta_config?.weight_ranges || [];
                            const lastRange = ranges[ranges.length - 1];
                            const newMaxWeight = lastRange ? lastRange.max_weight_kg + 5 : 1;
                            const newPrice = lastRange ? lastRange.price + 10 : 168;
                            setSettings((p) => ({
                              ...p,
                              estafeta_config: {
                                ...(p.estafeta_config || { enabled: true, weight_ranges: [] }),
                                weight_ranges: [
                                  ...(p.estafeta_config?.weight_ranges || []),
                                  { max_weight_kg: newMaxWeight, price: newPrice },
                                ].sort((a, b) => a.max_weight_kg - b.max_weight_kg),
                              },
                            }));
                          }}
                          className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                        >
                          + Agregar rango
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(settings.estafeta_config?.weight_ranges || []).map((range, idx) => {
                          const prevRange = idx > 0 ? settings.estafeta_config?.weight_ranges?.[idx - 1] : null;
                          const minWeight = prevRange ? prevRange.max_weight_kg + 0.01 : 0.01;
                          return (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Peso máximo (kg)</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={String(range.max_weight_kg || '')}
                                    onChange={(e) => {
                                      const inputValue = e.target.value.trim();
                                      // Permitir campo vacío temporalmente para poder borrar todo
                                      if (inputValue === '') {
                                        const newRanges = [...(settings.estafeta_config?.weight_ranges || [])];
                                        newRanges[idx] = { ...newRanges[idx], max_weight_kg: 0 };
                                        setSettings((p) => ({
                                          ...p,
                                          estafeta_config: {
                                            ...(p.estafeta_config || { enabled: true, weight_ranges: [] }),
                                            weight_ranges: newRanges,
                                          },
                                        }));
                                        return;
                                      }
                                      // Solo permitir números y punto decimal
                                      let numericValue = inputValue.replace(/[^\d.]/g, '');
                                      // Evitar múltiples puntos decimales
                                      const parts = numericValue.split('.');
                                      if (parts.length > 2) {
                                        numericValue = parts[0] + '.' + parts.slice(1).join('');
                                      }
                                      // Si el valor es válido numéricamente
                                      if (numericValue !== '' && !isNaN(parseFloat(numericValue))) {
                                        const numValue = parseFloat(numericValue);
                                        // Permitir cualquier valor mientras se escribe, validaremos en onBlur
                                        const newRanges = [...(settings.estafeta_config?.weight_ranges || [])];
                                        newRanges[idx] = { ...newRanges[idx], max_weight_kg: numValue };
                                        setSettings((p) => ({
                                          ...p,
                                          estafeta_config: {
                                            ...(p.estafeta_config || { enabled: true, weight_ranges: [] }),
                                            weight_ranges: newRanges,
                                          },
                                        }));
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Validar y corregir el valor al perder el foco
                                      const inputValue = e.target.value.trim();
                                      const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                                      const finalValue = isNaN(numValue) || numValue < minWeight ? minWeight : numValue;

                                      const newRanges = [...(settings.estafeta_config?.weight_ranges || [])];
                                      newRanges[idx] = { ...newRanges[idx], max_weight_kg: finalValue };
                                      newRanges.sort((a, b) => a.max_weight_kg - b.max_weight_kg);
                                      setSettings((p) => ({
                                        ...p,
                                        estafeta_config: {
                                          ...(p.estafeta_config || { enabled: true, weight_ranges: [] }),
                                          weight_ranges: newRanges,
                                        },
                                      }));
                                    }}
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                                  />
                                  <div className="mt-0.5 text-[10px] text-gray-500">
                                    {prevRange ? `Desde ${prevRange.max_weight_kg + 0.01} kg` : 'Desde 0.01 kg'}
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Precio fijo (MXN)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={range.price}
                                    onChange={(e) => {
                                      const newRanges = [...(settings.estafeta_config?.weight_ranges || [])];
                                      newRanges[idx] = { ...newRanges[idx], price: Number(e.target.value) };
                                      setSettings((p) => ({
                                        ...p,
                                        estafeta_config: {
                                          ...(p.estafeta_config || { enabled: true, weight_ranges: [] }),
                                          weight_ranges: newRanges,
                                        },
                                      }));
                                    }}
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newRanges = [...(settings.estafeta_config?.weight_ranges || [])];
                                  newRanges.splice(idx, 1);
                                  setSettings((p) => ({
                                    ...p,
                                    estafeta_config: {
                                      ...(p.estafeta_config || { enabled: true, weight_ranges: [] }),
                                      weight_ranges: newRanges,
                                    },
                                  }));
                                }}
                                className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                              >
                                Eliminar
                              </button>
                            </div>
                          );
                        })}
                        {(!settings.estafeta_config?.weight_ranges || settings.estafeta_config.weight_ranges.length === 0) && (
                          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                            No hay rangos configurados. Haz clic en &quot;Agregar rango&quot; para comenzar.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>


            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form >
        )
        }
      </div >
    </div >
  );
}

