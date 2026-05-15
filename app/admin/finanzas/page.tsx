'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

/* ─── Types ─── */
interface Metric {
    key: string;
    label: string;
    icon: string;
    hoy: number;
    semana: number;
    mes: number;
    reserved: boolean;
}

interface PeriodTotal {
    usable: number;
    reserved: number;
    total: number;
}

interface FinanzasData {
    metrics: Metric[];
    totals: { hoy: PeriodTotal; semana: PeriodTotal; mes: PeriodTotal };
}

type Period = 'hoy' | 'semana' | 'mes';

/* ─── Helpers ─── */
const fmt$ = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PERIOD_LABELS: Record<Period, string> = { hoy: 'Hoy', semana: 'Semana', mes: 'Mes' };

/* ─── Component ─── */
export default function AdminFinanzasPage() {
    const [data, setData] = useState<FinanzasData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<Period>('mes');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) throw new Error('No autenticado');
            const res = await fetch(`/api/admin/estadisticas?section=finanzas&t=${Date.now()}`, {
                headers: { authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error al cargar datos');
            setData(json.data);
        } catch (e: any) {
            setError(e?.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /* ─── Loading ─── */
    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-brand-orange animate-spin" />
                </div>
                <p className="text-sm text-gray-500 animate-pulse">Cargando métricas financieras…</p>
            </div>
        );
    }

    /* ─── Error ─── */
    if (error || !data) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="rounded-2xl bg-red-50 border border-red-200 px-6 py-4 text-center max-w-md">
                    <p className="text-red-700 font-semibold text-sm">⚠️ Error</p>
                    <p className="text-red-600 text-xs mt-1">{error || 'No se pudieron cargar los datos'}</p>
                    <button onClick={() => void fetchData()} className="mt-3 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors">Reintentar</button>
                </div>
            </div>
        );
    }

    const totals = data.totals[period];

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">💰 Finanzas</h1>
                    <p className="text-sm text-gray-500 mt-1">Ingresos generados por cada fuente, desglosados por período</p>
                </div>
                <button
                    onClick={() => void fetchData()}
                    className="self-start sm:self-auto rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 ring-1 ring-black/5 hover:bg-gray-200 transition-all"
                >
                    🔄 Actualizar
                </button>
            </div>

            {/* ── Period Tabs ── */}
            <div className="flex gap-2">
                {(['hoy', 'semana', 'mes'] as Period[]).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all duration-300 ${period === p
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200/50 scale-105'
                            : 'bg-white text-gray-600 ring-1 ring-black/5 hover:bg-gray-50 hover:scale-[1.02]'
                            }`}
                    >
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    label="Ingresos Usables"
                    value={fmt$(totals.usable)}
                    sublabel="Puedes utilizar"
                    accent="green"
                    icon="✅"
                />
                <SummaryCard
                    label="Reservados (NO TOCAR)"
                    value={fmt$(totals.reserved)}
                    sublabel="Gift Cards + Cashback"
                    accent="amber"
                    icon="🔒"
                />
                <SummaryCard
                    label="Total General"
                    value={fmt$(totals.total)}
                    sublabel={`Período: ${PERIOD_LABELS[period]}`}
                    accent="pink"
                    icon="💎"
                />
            </div>

            {/* ── Metric Cards Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.metrics.map((m, idx) => (
                    <MetricCard key={m.key} metric={m} period={period} delay={idx * 50} />
                ))}
            </div>

            {/* ── Detailed Table ── */}
            <div className="rounded-3xl bg-white shadow-lg ring-1 ring-black/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-sm font-bold text-gray-900">📊 Desglose Completo</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Comparación por período para todas las fuentes de ingreso</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">#</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Fuente</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Hoy</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Semana</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Mes</th>
                                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.metrics.map((m, i) => (
                                <tr
                                    key={m.key}
                                    className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <td className="px-6 py-3 text-xs text-gray-400 font-medium">{i + 1}</td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{m.icon}</span>
                                            <span className="font-semibold text-gray-900 text-xs">{m.label}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right font-bold text-xs text-gray-900">{fmt$(m.hoy)}</td>
                                    <td className="px-6 py-3 text-right font-bold text-xs text-gray-900">{fmt$(m.semana)}</td>
                                    <td className="px-6 py-3 text-right font-bold text-xs text-gray-900">{fmt$(m.mes)}</td>
                                    <td className="px-6 py-3 text-center">
                                        {m.reserved ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                                                🔒 NO TOCAR
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold text-green-700 ring-1 ring-green-200">
                                                ✅ Usable
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {/* Totals Row */}
                            <tr className="bg-gray-50 border-t-2 border-gray-200 font-extrabold">
                                <td className="px-6 py-3" />
                                <td className="px-6 py-3 text-sm text-gray-900">TOTAL</td>
                                <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt$(data.totals.hoy.total)}</td>
                                <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt$(data.totals.semana.total)}</td>
                                <td className="px-6 py-3 text-right text-sm text-gray-900">{fmt$(data.totals.mes.total)}</td>
                                <td className="px-6 py-3 text-center">
                                    <span className="text-[10px] text-gray-500">—</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Contador Privado ── */}
            <ContadorPrivado />
        </div>
    );
}

/* ─── Contador Privado ─── */
function ContadorPrivado() {
    const [taxData, setTaxData] = useState<{
        enabled: boolean;
        totalSales: number;
        totalCommissions: number;
        totalIsrWithheld: number;
        totalIvaWithheld: number;
        orderCount: number;
        newItemOrders: number;
        usedItemOrders: number;
        sellersWithRfc: number;
        sellersWithoutRfc: number;
    } | null>(null);
    const [loadingTax, setLoadingTax] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchTaxData = async () => {
            try {
                const { data: sess } = await supabase.auth.getSession();
                const token = sess.session?.access_token;
                if (!token) return;

                // Fetch app_settings to check if tax is enabled
                const settingsRes = await fetch('/api/admin/settings?fields=tax_withholding_enabled', {
                    headers: { authorization: `Bearer ${token}` },
                }).then(r => r.json()).catch(() => ({}));

                const enabled = Boolean(settingsRes?.data?.tax_withholding_enabled ?? settingsRes?.tax_withholding_enabled);
                if (!enabled) {
                    if (!cancelled) setTaxData({ enabled: false, totalSales: 0, totalCommissions: 0, totalIsrWithheld: 0, totalIvaWithheld: 0, orderCount: 0, newItemOrders: 0, usedItemOrders: 0, sellersWithRfc: 0, sellersWithoutRfc: 0 });
                    return;
                }

                // Fetch tax summary from finanzas endpoint
                const res = await fetch(`/api/admin/estadisticas?section=tax_summary&t=${Date.now()}`, {
                    headers: { authorization: `Bearer ${token}` },
                    cache: 'no-store',
                });
                const json = await res.json();
                if (!cancelled && json?.data) {
                    setTaxData({ enabled: true, ...json.data });
                } else if (!cancelled) {
                    setTaxData({ enabled: true, totalSales: 0, totalCommissions: 0, totalIsrWithheld: 0, totalIvaWithheld: 0, orderCount: 0, newItemOrders: 0, usedItemOrders: 0, sellersWithRfc: 0, sellersWithoutRfc: 0 });
                }
            } catch (e) {
                console.error('[ContadorPrivado] Error:', e);
                if (!cancelled) setTaxData(null);
            } finally {
                if (!cancelled) setLoadingTax(false);
            }
        };
        void fetchTaxData();
        return () => { cancelled = true; };
    }, []);

    if (loadingTax) return null;
    if (!taxData?.enabled) return null;

    const commBase = taxData.totalCommissions / 1.16;
    const commIva = taxData.totalCommissions - commBase;
    const platformIsr = commBase * 0.30;
    const netProfit = commBase - platformIsr;

    return (
        <div className="rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shadow-xl ring-1 ring-white/10">
            <div className="flex items-center gap-2 mb-6">
                <span className="text-xl">🧾</span>
                <div>
                    <h2 className="text-sm font-bold">Contador Privado</h2>
                    <p className="text-[10px] text-gray-400">Solo visible para administradores · Mes actual</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Ganancias GoVendy */}
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <div className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-3">💰 Tus Ganancias (GoVendy)</div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-300">Comisiones cobradas</span>
                            <span className="font-bold text-white">{fmt$(taxData.totalCommissions)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">(-) IVA que debes pagar</span>
                            <span className="text-red-400">-{fmt$(commIva)}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-1">
                            <span className="text-gray-300">= Ingreso neto</span>
                            <span className="font-bold text-white">{fmt$(commBase)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">(-) ISR estimado (~30%)</span>
                            <span className="text-red-400">-{fmt$(platformIsr)}</span>
                        </div>
                        <div className="flex justify-between border-t border-green-500/30 pt-2">
                            <span className="font-bold text-green-400">= GANANCIA NETA</span>
                            <span className="font-extrabold text-green-400 text-sm">{fmt$(netProfit)}</span>
                        </div>
                    </div>
                </div>

                {/* Retenciones a Vendedores */}
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-3">📋 Retenciones a Vendedores</div>
                    <p className="text-[10px] text-gray-500 mb-3">Transmitir al SAT</p>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-300">ISR retenido total</span>
                            <span className="font-bold text-amber-300">{fmt$(taxData.totalIsrWithheld)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">IVA retenido total</span>
                            <span className="font-bold text-amber-300">{fmt$(taxData.totalIvaWithheld)}</span>
                        </div>
                        <div className="flex justify-between border-t border-amber-500/30 pt-2">
                            <span className="font-bold text-amber-400">TOTAL a transmitir</span>
                            <span className="font-extrabold text-amber-400 text-sm">{fmt$(taxData.totalIsrWithheld + taxData.totalIvaWithheld)}</span>
                        </div>
                    </div>
                    <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300">
                        ⚠️ Fecha límite: 17 del mes siguiente
                    </div>
                </div>

                {/* Resumen de Operaciones */}
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-3">📊 Resumen de Operaciones</div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-300">Ventas totales</span>
                            <span className="font-bold text-white">{fmt$(taxData.totalSales)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">Total de órdenes</span>
                            <span className="font-bold text-white">{taxData.orderCount}</span>
                        </div>
                        <div className="my-1.5 border-t border-white/10" />
                        <div className="flex justify-between">
                            <span className="text-gray-400">Artículos nuevos (con IVA)</span>
                            <span className="text-blue-300">{taxData.newItemOrders}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Artículos usados (sin IVA)</span>
                            <span className="text-emerald-300">{taxData.usedItemOrders}</span>
                        </div>
                        <div className="my-1.5 border-t border-white/10" />
                        <div className="flex justify-between">
                            <span className="text-gray-400">Vendedores con RFC</span>
                            <span className="text-green-300">{taxData.sellersWithRfc}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Vendedores sin RFC</span>
                            <span className="text-red-300">{taxData.sellersWithoutRfc}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Metric Card ─── */
function MetricCard({ metric, period, delay }: { metric: Metric; period: Period; delay: number }) {
    const value = metric[period];
    return (
        <div
            className={`group relative rounded-3xl border p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${metric.reserved
                ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50'
                : 'border-gray-100 bg-white hover:border-green-200'
                }`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Reserved Badge */}
            {metric.reserved && (
                <div className="absolute -top-2 -right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-extrabold text-white shadow-lg animate-pulse">
                    🔒 NO TOCAR
                </div>
            )}

            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-lg ${metric.reserved
                        ? 'bg-amber-100 shadow-inner'
                        : 'bg-green-50 shadow-inner group-hover:bg-green-100'
                        } transition-colors`}>
                        {metric.icon}
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold text-gray-500 leading-tight">{metric.label}</p>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <p className={`text-2xl font-black tracking-tight ${metric.reserved ? 'text-amber-700' : 'text-gray-900'
                    }`}>
                    {fmt$(value)}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{PERIOD_LABELS[period]}</p>
            </div>

            {/* Mini sparkline: show all 3 periods */}
            <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
                <span className={period === 'hoy' ? 'font-bold text-gray-700' : ''}>H: {fmt$(metric.hoy)}</span>
                <span className={period === 'semana' ? 'font-bold text-gray-700' : ''}>S: {fmt$(metric.semana)}</span>
                <span className={period === 'mes' ? 'font-bold text-gray-700' : ''}>M: {fmt$(metric.mes)}</span>
            </div>
        </div>
    );
}

/* ─── Summary Card ─── */
function SummaryCard({
    label, value, sublabel, accent, icon,
}: { label: string; value: string; sublabel: string; accent: string; icon: string }) {
    const colors: Record<string, string> = {
        green: 'from-emerald-500 to-green-600 shadow-emerald-200/50',
        amber: 'from-amber-500 to-orange-500 shadow-amber-200/50',
        pink: 'from-pink-500 to-rose-500 shadow-pink-200/50',
    };
    return (
        <div className={`rounded-3xl bg-gradient-to-br ${colors[accent] || colors.pink} p-5 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
            <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <p className="text-xs font-semibold opacity-90">{label}</p>
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
            <p className="mt-1 text-[10px] opacity-75">{sublabel}</p>
        </div>
    );
}
