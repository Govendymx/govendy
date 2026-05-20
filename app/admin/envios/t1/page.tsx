'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface T1FormData {
    enabled: boolean;
    api_url: string;
    auth_url: string;
    shop_id: string;
    username: string;
    password: string;
    test_mode: boolean;
    markup_basic: number;
    markup_pro: number;
    markup_platinum: number;
    access_basic: boolean;
    access_pro: boolean;
    access_platinum: boolean;
    carriers_config?: Record<string, { id: string; active: boolean; logo_url?: string }>;
}

const DEFAULT_FORM: T1FormData = {
    enabled: false,
    api_url: 'https://apiv2.t1envios.com',
    auth_url: 'https://id.t1.com/auth/realms/T1/protocol/openid-connect/token',
    shop_id: '',
    username: '',
    password: '',
    test_mode: true,
    markup_basic: 60,
    markup_pro: 50,
    markup_platinum: 40,
    access_basic: false,
    access_pro: true,
    access_platinum: true,
    carriers_config: {},
};

const CARRIERS_META = [
    { id: 'dhl_express', name: 'DHL Express', desc: 'Envíos rápidos nacionales e internacionales.', logo: '🟡' },
    { id: 'fedex', name: 'FedEx', desc: 'Servicio confiable de cobertura amplia nacional.', logo: '🟣' },
    { id: '99_minutos', name: '99 Minutos', desc: 'Entregas express el mismo día o al día siguiente en zonas metropolitanas.', logo: '⚡' },
    { id: 'paquete_express', name: 'Paquete Express', desc: 'Excelente opción terrestre con gran cobertura nacional.', logo: '🚚' },
    { id: 'estafeta', name: 'Estafeta', desc: 'Servicio tradicional eficiente de entrega nacional.', logo: '🔴' },
    { id: 'am_pm', name: 'AM/PM', desc: 'Envíos locales y nacionales altamente eficientes y económicos.', logo: '⏰' },
];

export default function AdminT1EnviosPage() {
    const [isBooting, setIsBooting] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [form, setForm] = useState<T1FormData>(DEFAULT_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const boot = async () => {
            try {
                setIsBooting(true);
                const { data: userData, error: userErr } = await supabase.auth.getUser();
                if (userErr) throw userErr;
                if (!userData.user) { window.location.href = '/login?returnTo=/admin/envios/t1'; return; }

                const { data: adminRow } = await supabase
                    .from('admin_users')
                    .select('user_id')
                    .eq('user_id', userData.user.id)
                    .maybeSingle();
                if (!cancelled) setIsAdmin(Boolean(adminRow));
                if (!adminRow) { setError('No tienes permisos de administrador.'); return; }

                // Load config
                const res = await fetch('/api/shipping/t1/config');
                const json = await res.json();
                if (json.success && json.config) {
                    if (!cancelled) setForm((prev) => ({ ...prev, ...json.config }));
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message || 'Error cargando configuración.');
            } finally {
                if (!cancelled) setIsBooting(false);
            }
        };
        void boot();
        return () => { cancelled = true; };
    }, []);

    const handleSave = async () => {
        setError(null);
        setSuccess(null);
        setIsSaving(true);
        try {
            const res = await fetch('/api/shipping/t1/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error al guardar');
            setSuccess('✅ Configuración guardada exitosamente.');
            setTimeout(() => setSuccess(null), 4000);
        } catch (e: any) {
            setError(e?.message || 'Error al guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setTestResult(null);
        setIsTesting(true);
        try {
            const res = await fetch('/api/shipping/t1/config', { method: 'PUT' });
            const json = await res.json();
            setTestResult(json);
        } catch (e: any) {
            setTestResult({ success: false, message: e?.message || 'Error de conexión' });
        } finally {
            setIsTesting(false);
        }
    };

    const update = (key: keyof T1FormData, value: any) => setForm((prev) => ({ ...prev, [key]: value }));


    if (isBooting) {
        return (
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <div className="h-6 w-40 rounded-xl bg-white/70 ring-1 ring-black/5 animate-pulse" />
                <div className="mt-6 h-60 rounded-3xl bg-white/70 ring-1 ring-black/5 animate-pulse" />
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">🚀</span>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">GoVendy Premium — T1 Envíos</h1>
                        <p className="text-sm text-gray-600">Configuración de la integración con T1 Envíos para envíos multi-carrier (DHL, FedEx, UPS, Paquete Express).</p>
                    </div>
                </div>
            </div>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            {success && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

            {/* Credentials */}
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    🔐 Credenciales T1 Envíos
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.enabled}
                                onChange={(e) => update('enabled', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Habilitado (visible en checkout)</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">API URL</label>
                        <input
                            type="text"
                            value={form.api_url}
                            onChange={(e) => update('api_url', e.target.value)}
                            placeholder="https://apiv2.t1envios.com"
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Auth URL</label>
                        <input
                            type="text"
                            value={form.auth_url}
                            onChange={(e) => update('auth_url', e.target.value)}
                            placeholder="https://id.t1.com/auth/..."
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Shop ID</label>
                        <input
                            type="text"
                            value={form.shop_id}
                            onChange={(e) => update('shop_id', e.target.value)}
                            placeholder="316909"
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Username / Email</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => update('username', e.target.value)}
                            placeholder="tuenvio.cdmx@gmail.com"
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={(e) => update('password', e.target.value)}
                                placeholder="••••••••"
                                className="w-full rounded-xl border border-gray-300 px-4 py-2 pr-10 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? '🙈' : '👁'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 mt-6">
                            <input
                                type="checkbox"
                                checked={form.test_mode}
                                onChange={(e) => update('test_mode', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Modo de prueba (sandbox)</span>
                        </label>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                        {isSaving ? '💾 Guardando...' : '💾 Guardar credenciales'}
                    </button>
                    <button
                        onClick={handleTest}
                        disabled={isTesting}
                        className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        {isTesting ? '🔄 Probando...' : '🔌 Probar conexión'}
                    </button>
                </div>

                {testResult && (
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${testResult.success
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-red-200 bg-red-50 text-red-800'
                        }`}>
                        {testResult.success ? '✅' : '❌'} {testResult.message}
                    </div>
                )}
            </div>

            {/* Control de Paqueterías */}
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                    🚚 Control de Paqueterías (Activar / Desactivar)
                </h2>
                <p className="text-sm text-gray-500 mb-5">
                    Activa o desactiva de forma individual cada paquetería de T1 Envíos para el checkout de los compradores.
                </p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {CARRIERS_META.map((carrier) => {
                        const configVal = form.carriers_config?.[carrier.id] || { id: carrier.id, active: false, logo_url: '' };
                        const isActive = configVal.active;

                        return (
                            <div
                                key={carrier.id}
                                className={`rounded-2xl border p-4 transition-all duration-200 ${
                                    isActive ? 'border-orange-300 bg-orange-50/50 shadow-sm' : 'border-gray-200 bg-gray-50/30'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {configVal.logo_url ? (
                                            <img
                                                src={configVal.logo_url}
                                                alt={carrier.name}
                                                className="h-8 w-8 rounded-lg object-contain bg-white p-1 ring-1 ring-black/5"
                                            />
                                        ) : (
                                            <span className="text-2xl">{carrier.logo}</span>
                                        )}
                                        <span className="font-bold text-sm text-gray-900">{carrier.name}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updatedCarriers = {
                                                ...(form.carriers_config || {}),
                                                [carrier.id]: {
                                                    ...configVal,
                                                    active: !isActive,
                                                },
                                            };
                                            update('carriers_config', updatedCarriers);
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                            isActive ? 'bg-orange-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                                isActive ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3 min-h-[32px] line-clamp-2">{carrier.desc}</p>
                                <div className="flex items-center justify-between mt-auto pt-1">
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {isActive ? '🟢 Activo' : '⚪ Inactivo'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="mt-5 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                    {isSaving ? '💾 Guardando...' : '💾 Guardar paqueterías'}
                </button>
            </div>

            {/* Markup por Plan */}
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                    💰 Markup de Envío por Plan
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Monto adicional (MXN) que se suma al costo real de T1 por guía. El comprador paga: costo T1 + markup.
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-700">BÁSICO</span>
                        </div>
                        <label className="block text-sm font-medium text-gray-700">+ MXN</label>
                        <input
                            type="number"
                            min="0"
                            step="5"
                            value={form.markup_basic}
                            onChange={(e) => update('markup_basic', Number(e.target.value) || 0)}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Ej: DHL $150 → comprador paga ${150 + form.markup_basic}</p>
                    </div>

                    <div className="rounded-2xl border border-blue-200 p-4 bg-blue-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">PRO</span>
                        </div>
                        <label className="block text-sm font-medium text-gray-700">+ MXN</label>
                        <input
                            type="number"
                            min="0"
                            step="5"
                            value={form.markup_pro}
                            onChange={(e) => update('markup_pro', Number(e.target.value) || 0)}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Ej: DHL $150 → comprador paga ${150 + form.markup_pro}</p>
                    </div>

                    <div className="rounded-2xl border border-amber-200 p-4 bg-amber-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">PLATINUM</span>
                        </div>
                        <label className="block text-sm font-medium text-gray-700">+ MXN</label>
                        <input
                            type="number"
                            min="0"
                            step="5"
                            value={form.markup_platinum}
                            onChange={(e) => update('markup_platinum', Number(e.target.value) || 0)}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-mono outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Ej: DHL $150 → comprador paga ${150 + form.markup_platinum}</p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="mt-4 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                    {isSaving ? '💾 Guardando...' : '💾 Guardar tarifas'}
                </button>
            </div>

            {/* Acceso por Plan — Toggles Globales */}
            <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
                <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                    🔓 Control de Acceso por Plan
                </h2>
                <p className="text-sm text-gray-500 mb-5">
                    Activa o desactiva T1 GoVendy Premium globalmente para cada plan.
                    Los cambios aplican a <strong>todos</strong> los usuarios del plan seleccionado.
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                    {/* Básico */}
                    <div className={`rounded-2xl border p-4 transition-colors ${form.access_basic ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-700">BÁSICO</span>
                            <button
                                onClick={() => update('access_basic', !form.access_basic)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.access_basic ? 'bg-orange-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.access_basic ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            {form.access_basic
                                ? '🚀 T1 activo para todos los usuarios Básico'
                                : '⛔ T1 desactivado para plan Básico (por defecto)'}
                        </p>
                    </div>

                    {/* Pro */}
                    <div className={`rounded-2xl border p-4 transition-colors ${form.access_pro ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">PRO</span>
                            <button
                                onClick={() => update('access_pro', !form.access_pro)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.access_pro ? 'bg-blue-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.access_pro ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            {form.access_pro
                                ? '🚀 T1 activo para todos los usuarios Pro'
                                : '⛔ T1 desactivado para plan Pro'}
                        </p>
                    </div>

                    {/* Platinum */}
                    <div className={`rounded-2xl border p-4 transition-colors ${form.access_platinum ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">PLATINUM</span>
                            <button
                                onClick={() => update('access_platinum', !form.access_platinum)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.access_platinum ? 'bg-amber-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.access_platinum ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            {form.access_platinum
                                ? '🚀 T1 activo para todos los usuarios Platinum'
                                : '⛔ T1 desactivado para plan Platinum'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="mt-5 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                    {isSaving ? '💾 Guardando...' : '💾 Guardar configuración de acceso'}
                </button>
            </div>


            {/* Info Panel */}
            <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm ring-1 ring-orange-200 sm:p-8">
                <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                    📋 Información del Sistema
                </h2>
                <div className="space-y-2 text-sm text-gray-700">
                    <p>• Los envíos GoVendy Premium usan la API de <strong>T1 Envíos</strong> para cotizar y generar guías con DHL, FedEx, UPS y Paquete Express.</p>
                    <p>• Las direcciones de <strong>origen</strong> (vendedor) y <strong>destino</strong> (comprador) se toman de los perfiles registrados.</p>
                    <p>• El <strong>markup</strong> se suma al costo real de T1. El comprador ve el precio final (T1 + markup).</p>
                    <p>• Para cambiar de cuenta T1, actualiza las credenciales y haz clic en &quot;Guardar&quot;. El cambio es inmediato.</p>
                    <p>• Las guías aparecen con el chip <strong className="text-orange-600">🚀 GOPOCKET PREMIUM</strong> en Compras, Ventas y Logística.</p>
                    <p>• Usa la sección &quot;Control de Acceso por Plan&quot; para gestionar qué planes tienen acceso a T1.</p>
                </div>
            </div>
        </div>
    );
}
