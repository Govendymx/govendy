'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

// ─── Helpers ───
function fmt$(v: number) { return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }); }
function fmtN(v: number) { return v.toLocaleString('es-MX'); }
function pctBadge(v: number) {
    if (v > 0) return <span className="text-green-600 text-xs font-bold">▲ {v}%</span>;
    if (v < 0) return <span className="text-red-500 text-xs font-bold">▼ {Math.abs(v)}%</span>;
    return <span className="text-gray-400 text-xs">— 0%</span>;
}

const COLORS = ['#FF4081', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#E91E63', '#3F51B5'];
const TABS = [
    { key: 'atencion', label: '🚨 Atención', color: 'red' },
    { key: 'resumen', label: '📊 Resumen', color: 'pink' },
    { key: 'ventas', label: '💰 Ventas', color: 'green' },
    { key: 'usuarios', label: '👥 Usuarios', color: 'blue' },
    { key: 'productos', label: '📦 Productos', color: 'orange' },
    { key: 'envios', label: '🚚 Envíos', color: 'purple' },
    { key: 'disputas', label: '⚖️ Disputas', color: 'red' },
    { key: 'pocketcash', label: '💳 PocketCash', color: 'teal' },
    { key: 'soporte', label: '🔔 Soporte', color: 'indigo' },
];

export default function AdminEstadisticasPage() {
    const [activeTab, setActiveTab] = useState('atencion');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cache, setCache] = useState<Record<string, any>>({});

    const fetchSection = useCallback(async (section: string) => {
        if (cache[section]) return;
        setLoading(true);
        setError(null);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) { window.location.href = '/login?returnTo=/admin/estadisticas'; return; }
            const res = await fetch(`/api/admin/estadisticas?section=${section}&t=${Date.now()}`, {
                headers: { authorization: `Bearer ${token}` },
                cache: 'no-store',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error cargando datos');
            setCache(prev => ({ ...prev, [section]: json.data }));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [cache]);

    useEffect(() => { fetchSection(activeTab); }, [activeTab, fetchSection]);

    const d = cache[activeTab];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900">📊 Estadísticas</h1>
                        <p className="mt-1 text-sm text-gray-500">Panel integral de métricas y análisis de la plataforma</p>
                    </div>
                    <button
                        onClick={() => { setCache({}); fetchSection(activeTab); }}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black transition-colors"
                    >
                        🔄 Actualizar todo
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${activeTab === t.key
                            ? 'bg-gray-900 text-white shadow-lg scale-105'
                            : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50 hover:scale-102'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            {loading && <div className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm ring-1 ring-black/5">Cargando datos…</div>}

            {/* ═══ ATENCIÓN REQUERIDA ═══ */}
            {activeTab === 'atencion' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Summary banner */}
                    <div className={`rounded-2xl px-5 py-4 flex items-center justify-between ${d.criticalCount > 0
                            ? 'bg-red-50 border-2 border-red-200'
                            : d.totalAlerts > 0
                                ? 'bg-orange-50 border-2 border-orange-200'
                                : 'bg-white border-2 border-green-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{d.criticalCount > 0 ? '🔴' : d.totalAlerts > 0 ? '🟡' : '🟢'}</span>
                            <div>
                                <div className="font-extrabold text-gray-900">
                                    {d.totalAlerts === 0 ? '¡Todo en orden!' : `${d.totalAlerts} elemento${d.totalAlerts === 1 ? '' : 's'} que necesita${d.totalAlerts === 1 ? '' : 'n'} atención`}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {d.criticalCount > 0 && <span className="text-red-600 font-bold">{d.criticalCount} crítico{d.criticalCount === 1 ? '' : 's'} · </span>}
                                    Última actualización: ahora
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => { setCache(prev => { const c = { ...prev }; delete c.atencion; return c; }); fetchSection('atencion'); }}
                            className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black transition-colors"
                        >🔄 Actualizar</button>
                    </div>

                    {/* Slow sellers */}
                    {d.slowSellers && d.slowSellers.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">🚚</span>
                                <h3 className="text-sm font-bold text-gray-900">Vendedores sin enviar ({d.slowSellers.length})</h3>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">Órdenes pagadas pendientes de generar guía de envío. Haz clic para ver el perfil del vendedor.</p>
                            <div className="space-y-2">
                                {d.slowSellers.map((s: any) => (
                                    <Link key={s.id} href={`/admin/usuarios?q=${s.id}`}
                                        className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 transition-colors cursor-pointer group ${s.severity === 'critical' ? 'bg-red-50 ring-red-200 hover:bg-red-100'
                                                : s.severity === 'warning' ? 'bg-orange-50 ring-orange-200 hover:bg-orange-100'
                                                    : 'bg-yellow-50 ring-yellow-200 hover:bg-yellow-100'
                                            }`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-lg">{s.severity === 'critical' ? '🔴' : s.severity === 'warning' ? '🟡' : '🟢'}</span>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 truncate">{s.name}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">{s.id.slice(0, 12)}…</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-red-700">{s.pendingOrders} orden{s.pendingOrders === 1 ? '' : 'es'}</div>
                                            <div className="text-[10px] text-gray-500">Esperando {s.hoursWaiting}h · {fmt$(s.totalAmount)}</div>
                                            <div className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver vendedor →</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stale tickets */}
                    {d.staleTickets && d.staleTickets.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">🎫</span>
                                <h3 className="text-sm font-bold text-gray-900">Tickets sin respuesta ({d.staleTickets.length})</h3>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">Tickets de soporte abiertos sin respuesta por más de 24 horas. Haz clic para ir al perfil del usuario.</p>
                            <div className="space-y-2">
                                {d.staleTickets.map((t: any) => (
                                    <Link key={t.id} href={`/admin/soporte`}
                                        className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 transition-colors cursor-pointer group ${t.severity === 'critical' ? 'bg-red-50 ring-red-200 hover:bg-red-100'
                                                : t.severity === 'warning' ? 'bg-orange-50 ring-orange-200 hover:bg-orange-100'
                                                    : 'bg-yellow-50 ring-yellow-200 hover:bg-yellow-100'
                                            }`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-lg">{t.severity === 'critical' ? '🔴' : t.severity === 'warning' ? '🟡' : '🟢'}</span>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 truncate">{t.subject}</div>
                                                <div className="text-xs text-gray-500">{t.userName}</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-orange-700">{t.hoursOpen}h sin respuesta</div>
                                            <div className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ir a soporte →</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Open disputes */}
                    {d.disputes && d.disputes.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">⚖️</span>
                                <h3 className="text-sm font-bold text-gray-900">Disputas abiertas ({d.disputes.length})</h3>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">Disputas pendientes de resolución. Las escaladas aparecen primero. Haz clic para ver los detalles.</p>
                            <div className="space-y-2">
                                {d.disputes.map((dp: any) => (
                                    <Link key={dp.id} href={`/admin/disputas?id=${dp.id}`}
                                        className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 transition-colors cursor-pointer group ${dp.severity === 'critical' ? 'bg-red-50 ring-red-200 hover:bg-red-100'
                                                : dp.severity === 'warning' ? 'bg-orange-50 ring-orange-200 hover:bg-orange-100'
                                                    : 'bg-yellow-50 ring-yellow-200 hover:bg-yellow-100'
                                            }`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-lg">{dp.severity === 'critical' ? '🔴' : dp.severity === 'warning' ? '🟡' : '🟢'}</span>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 truncate">{dp.reason}</div>
                                                <div className="text-xs text-gray-500">
                                                    <span className="text-gray-400">Comprador:</span> {dp.buyerName} · <span className="text-gray-400">Vendedor:</span> {dp.sellerName}
                                                </div>
                                                {dp.status === 'escalated' && (
                                                    <span className="inline-block mt-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">⚡ ESCALADA</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-red-700">{dp.hoursOpen}h abierta</div>
                                            <div className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver disputa →</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Unusual wallets */}
                    {d.unusualWallets && d.unusualWallets.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">💰</span>
                                <h3 className="text-sm font-bold text-gray-900">Wallets con saldo alto ({d.unusualWallets.length})</h3>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">Usuarios con más de $5,000 en PocketCash. Verifica que no haya actividad sospechosa.</p>
                            <div className="space-y-2">
                                {d.unusualWallets.map((w: any) => (
                                    <Link key={w.userId} href={`/admin/usuarios?q=${w.userId}`}
                                        className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-lg">⚠️</span>
                                            <div className="min-w-0">
                                                <div className="font-bold text-gray-900 truncate">{w.userName}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">{w.userId.slice(0, 12)}…</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-bold text-red-600">{fmt$(w.balance)}</div>
                                            <div className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver usuario →</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All clear message */}
                    {d.totalAlerts === 0 && (
                        <div className="rounded-3xl bg-white border-2 border-green-200 p-12 text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <h2 className="text-xl font-extrabold text-green-800">¡Todo en orden!</h2>
                            <p className="text-sm text-green-600 mt-2">No hay elementos que requieran atención inmediata.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ RESUMEN EJECUTIVO ═══ */}
            {activeTab === 'resumen' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Vista general del rendimiento de la plataforma este mes. Los porcentajes muestran la variación respecto al mes anterior." />
                    {/* KPI Cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KPICard title="Ventas brutas (mes)" value={fmt$(d.ventasBrutasMes)} change={d.ventasBrutasCambio} accent="pink" help="Suma total de todas las órdenes del mes actual" />
                        <KPICard title="Órdenes (mes)" value={fmtN(d.ordenesMes)} change={d.ordenesCambio} accent="blue" help="Cantidad total de órdenes creadas este mes" />
                        <KPICard title="Ticket promedio" value={fmt$(d.ticketPromedio)} change={d.ticketCambio} accent="green" help="Monto promedio por orden (ventas ÷ órdenes)" />
                        <KPICard title="Tasa conversión" value={`${d.conversionRate}%`} change={d.conversionCambio} accent="purple" help="% de checkout sessions que se convierten en órdenes pagadas" />
                        <KPICard title="Ventas hoy" value={fmt$(d.ventasHoy)} subtitle={`${d.ordenesHoy} órdenes`} accent="orange" help="Ingresos acumulados en el día de hoy" />
                        <KPICard title="Abandono carrito" value={`${d.abandonRate}%`} accent="red" help="% de sesiones de checkout que NO terminan en pago" />
                        <KPICard title="PocketCash circulante" value={fmt$(d.pocketcashLiability)} accent="teal" help="Saldo total sumando todas las wallets de los usuarios" />
                        <KPICard title="Disputas abiertas" value={String(d.disputasAbiertas)} accent="red" help="Disputas activas sin resolver actualmente" />
                    </div>

                    {/* Sparkline */}
                    {d.dailySales && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Ventas últimos 7 días</h3>
                            <p className="text-xs text-gray-400 mb-3">Evolución diaria del monto de ventas en la última semana</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={d.dailySales}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v: number) => fmt$(v)} />
                                        <Area type="monotone" dataKey="total" stroke="#FF4081" fill="#FF4081" fillOpacity={0.1} strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Payment methods */}
                    {d.paymentMethods && Object.keys(d.paymentMethods).length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Métodos de pago (mes)</h3>
                            <p className="text-xs text-gray-400 mb-3">Distribución de las formas de pago utilizadas este mes</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(d.paymentMethods).map(([name, value]) => ({ name, value }))}
                                            cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {Object.keys(d.paymentMethods).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Quick stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard label="Usuarios totales" value={fmtN(d.perfilesTotales)} icon="👥" desc="Perfiles registrados en la plataforma" />
                        <StatCard label="Listings activos" value={fmtN(d.listingsActivos)} icon="📦" desc="Publicaciones actualmente disponibles" />
                        <StatCard label="Disputas abiertas" value={String(d.disputasAbiertas)} icon="⚖️" desc="Casos pendientes de resolución" />
                    </div>
                </div>
            )}

            {/* ═══ VENTAS & CONVERSIÓN ═══ */}
            {activeTab === 'ventas' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Análisis detallado del flujo de ventas, tasas de conversión y métodos de pago más utilizados en los últimos 30 días." />
                    {/* Daily chart */}
                    {d.dailyData && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Ventas diarias (últimos 30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Monto total facturado por día. Identifica tendencias y días pico de ventas.</p>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={d.dailyData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v: number, name: string) => name === 'ventas' ? fmt$(v) : v} />
                                        <Legend />
                                        <Area type="monotone" dataKey="ventas" name="Monto" stroke="#FF4081" fill="#FF4081" fillOpacity={0.1} strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Orders count chart */}
                    {d.dailyData && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Órdenes vs Sessions (conversión)</h3>
                            <p className="text-xs text-gray-400 mb-3">Compara sesiones de checkout iniciadas vs completadas. Verde = pagadas, rosa = totales.</p>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={d.dailyData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="sessions" name="Checkout Sessions" fill="#E0E0E0" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="pagadas" name="Pagadas" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="ordenes" name="Órdenes" fill="#FF4081" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Payment breakdown */}
                    {d.methodBreakdown && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Desglose por método de pago</h3>
                            <p className="text-xs text-gray-400 mb-3">Cuántas órdenes y qué monto se procesó por cada medio de pago (tarjeta, transferencia, PocketCash, etc.)</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b">
                                        <tr>
                                            <th className="text-left py-2 px-3">Método</th>
                                            <th className="text-right py-2 px-3">Órdenes</th>
                                            <th className="text-right py-2 px-3">Monto total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(d.methodBreakdown).sort((a: any, b: any) => b[1].total - a[1].total).map(([method, info]: [string, any]) => (
                                            <tr key={method} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2 px-3 font-medium capitalize">{method.replace(/_/g, ' ')}</td>
                                                <td className="py-2 px-3 text-right">{info.count}</td>
                                                <td className="py-2 px-3 text-right font-bold text-green-600">{fmt$(info.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Top buyers */}
                    {d.topBuyers && d.topBuyers.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Top 10 compradores (30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Los usuarios que más han gastado en la plataforma en el último mes</p>
                            <div className="space-y-2">
                                {d.topBuyers.map((b: any, i: number) => (
                                    <Link key={b.id} href={`/admin/usuarios?q=${b.id}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 ring-1 ring-black/5 hover:bg-blue-50 hover:ring-blue-200 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                                            <span className="text-xs text-gray-600 font-mono group-hover:text-blue-600">{b.id.slice(0, 8)}…</span>
                                            <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver usuario →</span>
                                        </div>
                                        <span className="font-bold text-green-600">{fmt$(b.total)}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ USUARIOS ═══ */}
            {activeTab === 'usuarios' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Estado y comportamiento de la base de usuarios: crecimiento, segmentación por actividad, retención y perfiles incompletos." />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KPICard title="Total usuarios" value={fmtN(d.totalUsers)} accent="blue" help="Usuarios registrados en la plataforma" />
                        <KPICard title="Nuevos este mes" value={fmtN(d.newThisMonth)} accent="green" help="Nuevos registros durante el mes actual" />
                        <KPICard title="Perfiles incompletos" value={fmtN(d.incomplete)} accent="orange" help="Usuarios sin nombre, avatar o datos básicos" />
                        <KPICard title="Compradores recurrentes" value={fmtN(d.retention?.recurring || 0)} subtitle={`de ${d.retention?.total || 0} activos`} accent="purple" help="Usuarios con 2 o más compras en los últimos 90 días" />
                    </div>

                    {/* Segmentation pie */}
                    {d.segmentation && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Segmentación de usuarios (últimos 30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Clasifica a los usuarios por su rol activo: solo compra, solo vende, ambos, o inactivos (sin actividad en 30 días)</p>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Solo compradores', value: d.segmentation.onlyBuyers },
                                                    { name: 'Solo vendedores', value: d.segmentation.onlySellers },
                                                    { name: 'Ambos', value: d.segmentation.both },
                                                    { name: 'Inactivos', value: d.segmentation.inactive },
                                                ]}
                                                cx="50%" cy="50%" outerRadius={80} dataKey="value"
                                                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {[0, 1, 2, 3].map(i => <Cell key={i} fill={COLORS[i]} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-3">
                                    <SegRow label="Solo compradores" value={d.segmentation.onlyBuyers} color="#FF4081" />
                                    <SegRow label="Solo vendedores" value={d.segmentation.onlySellers} color="#2196F3" />
                                    <SegRow label="Compradores y vendedores" value={d.segmentation.both} color="#4CAF50" />
                                    <SegRow label="Sin actividad (30 días)" value={d.segmentation.inactive} color="#FF9800" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Registration trend */}
                    {d.regTrend && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Registros nuevos por día (30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Cuántas cuentas nuevas se crearon cada día. Sirve para evaluar campañas de adquisición.</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={d.regTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={3} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Registros" fill="#2196F3" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Retention */}
                    {d.retention && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Retención de compradores</h3>
                            <p className="text-xs text-gray-400 mb-3">Proporción de compradores que regresan a comprar vs los que solo compran una vez (últimos 90 días)</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Recurrentes (2+ compras)', value: d.retention.recurring },
                                                { name: 'Una sola compra', value: d.retention.oneTime },
                                            ]}
                                            cx="50%" cy="50%" outerRadius={70} dataKey="value" label
                                        >
                                            <Cell fill="#4CAF50" />
                                            <Cell fill="#FF9800" />
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ PRODUCTOS ═══ */}
            {activeTab === 'productos' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Salud del catálogo: productos publicados, categorías más vendidas, productos sin rotación y los más vistos que no convierten." />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard label="Listings totales" value={fmtN(d.totalActive)} icon="📦" desc="Total de publicaciones en la plataforma" />
                        <StatCard label="Sin ventas (30+ días)" value={String(d.noSales?.length || 0)} icon="🚫" desc="Publicados hace +30 días sin ninguna venta" />
                        <StatCard label="Vistas sin conversión" value={String(d.viewedNoConversion?.length || 0)} icon="👀" desc="+5 vistas pero 0 ventas: les falta algo" />
                    </div>

                    {/* Categories by orders */}
                    {d.topCategories && d.topCategories.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Categorías por ventas (30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Qué categorías generan más órdenes. Útil para decidir dónde enfocar promociones.</p>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={d.topCategories} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="orders" name="Órdenes" fill="#FF4081" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Avg price by category */}
                    {d.avgByCategory && d.avgByCategory.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Precio promedio y listings por categoría</h3>
                            <p className="text-xs text-gray-400 mb-3">Compara la oferta y nivel de precios entre categorías para detectar oportunidades</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b">
                                        <tr>
                                            <th className="text-left py-2 px-3">Categoría</th>
                                            <th className="text-right py-2 px-3">Listings</th>
                                            <th className="text-right py-2 px-3">Precio promedio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.avgByCategory.map((c: any) => (
                                            <tr key={c.category} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2 px-3 font-medium">{c.category}</td>
                                                <td className="py-2 px-3 text-right">{c.count}</td>
                                                <td className="py-2 px-3 text-right font-bold">{fmt$(c.avgPrice)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Most viewed no conversion */}
                    {d.viewedNoConversion && d.viewedNoConversion.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Más vistos sin conversión</h3>
                            <p className="text-xs text-gray-400 mb-3">Productos con muchas vistas pero 0 ventas. Puede indicar precio alto, fotos malas o descripción pobre.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b">
                                        <tr>
                                            <th className="text-left py-2 px-3">Producto</th>
                                            <th className="text-right py-2 px-3">Vistas</th>
                                            <th className="text-right py-2 px-3">Precio</th>
                                            <th className="text-left py-2 px-3">Categoría</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.viewedNoConversion.map((p: any) => (
                                            <tr key={p.id} className="border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => window.open(`/admin/listings?q=${p.id}`, '_blank')}>
                                                <td className="py-2 px-3">
                                                    <div className="font-medium truncate max-w-[200px]">{p.title}</div>
                                                    <div className="text-[10px] text-blue-400 font-mono hover:underline">{p.id.slice(0, 8)}… ↗</div>
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold">{fmtN(p.views)}</td>
                                                <td className="py-2 px-3 text-right">{fmt$(p.price)}</td>
                                                <td className="py-2 px-3 text-xs text-gray-600">{p.category}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* No sales */}
                    {d.noSales && d.noSales.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Sin ventas (publicados hace 30+ días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Productos que llevan más de un mes publicados sin generar ninguna venta</p>
                            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                                        <tr>
                                            <th className="text-left py-2 px-3">Producto</th>
                                            <th className="text-right py-2 px-3">Vistas</th>
                                            <th className="text-right py-2 px-3">Precio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.noSales.map((p: any) => (
                                            <tr key={p.id} className="border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => window.open(`/admin/listings?q=${p.id}`, '_blank')}>
                                                <td className="py-2 px-3 font-medium truncate max-w-[200px]">{p.title} <span className="text-[10px] text-blue-400">↗</span></td>
                                                <td className="py-2 px-3 text-right">{p.views}</td>
                                                <td className="py-2 px-3 text-right">{fmt$(p.price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ ENVÍOS & SLA ═══ */}
            {activeTab === 'envios' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Monitoreo de la cadena de envío: órdenes pendientes de guía, tiempos de preparación y vendedores que más tardan en enviar." />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KPICard title="Órdenes (30d)" value={fmtN(d.totalOrders)} accent="blue" help="Total de órdenes de los últimos 30 días" />
                        <KPICard title="Sin guía" value={fmtN(d.paidNoLabel)} accent="red" help="Órdenes pagadas que aún no tienen guía de envío generada" />
                        <KPICard title="Promedio envío" value={fmt$(d.avgShippingCost)} accent="green" help="Costo promedio de envío por orden" />
                        <KPICard title="SLA promedio" value={`${d.sla?.avgHours || 0}h`} accent="purple" help="Horas promedio entre pago y generación de guía" />
                    </div>

                    {/* Aging */}
                    {d.aging && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Órdenes pagadas sin guía (aging)</h3>
                            <p className="text-xs text-gray-400 mb-3">Cuánto tiempo llevan las órdenes pagadas sin guía. Más de 3 días = alerta roja.</p>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl bg-white p-4 ring-1 ring-green-200 text-center">
                                    <div className="text-2xl font-extrabold text-green-700">{d.aging.d1}</div>
                                    <div className="text-xs font-semibold text-green-600 mt-1">≤ 1 día</div>
                                </div>
                                <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 text-center">
                                    <div className="text-2xl font-extrabold text-amber-700">{d.aging.d2}</div>
                                    <div className="text-xs font-semibold text-amber-600 mt-1">2 días</div>
                                </div>
                                <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200 text-center">
                                    <div className="text-2xl font-extrabold text-red-700">{d.aging.d3plus}</div>
                                    <div className="text-xs font-semibold text-red-600 mt-1">3+ días 🚨</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SLA breakdown */}
                    {d.sla && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Tiempo de generación de guía (SLA)</h3>
                            <p className="text-xs text-gray-400 mb-3">Distribución del tiempo que tardan los vendedores en generar guía después del pago</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { range: '< 24h', count: d.sla.h24 },
                                        { range: '24-48h', count: d.sla.h48 },
                                        { range: '48-72h', count: d.sla.h72 },
                                        { range: '> 72h', count: d.sla.h72plus },
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="range" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Órdenes" radius={[4, 4, 0, 0]}>
                                            <Cell fill="#4CAF50" />
                                            <Cell fill="#FF9800" />
                                            <Cell fill="#f44336" />
                                            <Cell fill="#b71c1c" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Slow sellers */}
                    {d.slowSellers && d.slowSellers.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Vendedores más lentos (órdenes sin guía)</h3>
                            <p className="text-xs text-gray-400 mb-3">Vendedores con más órdenes pagadas pendientes de envío. Considera contactarlos.</p>
                            <div className="space-y-2">
                                {d.slowSellers.map((s: any, i: number) => (
                                    <Link key={s.id} href={`/admin/usuarios?q=${s.id}`} className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-2 ring-1 ring-red-200 hover:bg-red-100 hover:ring-red-300 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-red-400">#{i + 1}</span>
                                            <span className="text-xs font-mono text-gray-600 group-hover:text-red-600">{s.id.slice(0, 8)}…</span>
                                            <span className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver vendedor →</span>
                                        </div>
                                        <span className="font-bold text-red-700">{s.pendingOrders} pendientes</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ DISPUTAS & CALIDAD ═══ */}
            {activeTab === 'disputas' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Indicadores de calidad del servicio: tasa de disputas, tiempo de resolución y vendedores con más problemas reportados." />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KPICard title="Total disputas" value={String(d.total)} accent="red" help="Disputas registradas en todo el historial" />
                        <KPICard title="Abiertas" value={String(d.open)} accent="orange" help="Disputas activas sin resolver" />
                        <KPICard title="Tasa de disputas" value={`${d.rate}%`} subtitle="vs total órdenes" accent="purple" help="% de órdenes que terminan en disputa" />
                        <KPICard title="Resolución promedio" value={`${d.avgResolutionHours}h`} accent="blue" help="Horas promedio que tarda resolverse una disputa" />
                    </div>

                    {/* Trend */}
                    {d.monthlyTrend && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Disputas por día (30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Tendencia de disputas abiertas. Un pico puede indicar un problema sistémico.</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={d.monthlyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={3} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="count" stroke="#f44336" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Reviews */}
                    {d.reviews && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Reseñas del mes</h3>
                            <p className="text-xs text-gray-400 mb-3">Cantidad de reseñas recibidas y calificación promedio de este mes</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <StatCard label="Total reseñas" value={String(d.reviews.count)} icon="⭐" />
                                <StatCard label="Rating promedio" value={`${d.reviews.avgRating} / 5`} icon="📊" />
                            </div>
                        </div>
                    )}

                    {/* Top dispute sellers */}
                    {d.topDisputeSellers && d.topDisputeSellers.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Vendedores con más disputas</h3>
                            <p className="text-xs text-gray-400 mb-3">Vendedores problemáticos. Si reinciden, considera medidas disciplinarias.</p>
                            <div className="space-y-2">
                                {d.topDisputeSellers.map((s: any, i: number) => (
                                    <Link key={s.id} href={`/admin/usuarios?q=${s.id}`} className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-2 ring-1 ring-red-200 hover:bg-red-100 hover:ring-red-300 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-red-400">#{i + 1}</span>
                                            <span className="text-xs font-mono text-gray-600 group-hover:text-red-600">{s.id.slice(0, 8)}…</span>
                                            <span className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver vendedor →</span>
                                        </div>
                                        <span className="font-bold text-red-700">{s.disputes} disputas</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ POCKETCASH ═══ */}
            {activeTab === 'pocketcash' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Estado del sistema de billetera digital PocketCash: saldo total circulante, movimientos del mes y alertas de saldos inusuales." />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KPICard title="Saldo circulante" value={fmt$(d.globalLiability)} accent="teal" help="Suma de todos los saldos de PocketCash de todos los usuarios" />
                        <KPICard title="Wallets activas" value={fmtN(d.walletsActive)} accent="blue" help="Wallets con saldo mayor a $0" />
                        <KPICard title="Créditos (mes)" value={fmt$(d.month?.totalCredited || 0)} accent="green" help="Total de dinero añadido a wallets este mes (reembolsos, promociones, etc.)" />
                        <KPICard title="Débitos (mes)" value={fmt$(d.month?.totalDebited || 0)} accent="red" help="Total de dinero usado/retirado de wallets este mes" />
                    </div>

                    {d.unusualCount > 0 && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-semibold">
                            ⚠️ {d.unusualCount} wallet(s) con saldo mayor a $5,000 MXN — verificar
                        </div>
                    )}

                    {/* Credit breakdown */}
                    {d.month?.creditBreakdown && Object.keys(d.month.creditBreakdown).length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Desglose créditos (mes)</h3>
                            <p className="text-xs text-gray-400 mb-3">De dónde viene el dinero que entra a las wallets: reembolsos, bonificaciones, recargas, etc.</p>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={Object.entries(d.month.creditBreakdown).map(([name, info]: [string, any]) => ({ name, value: info.total }))}
                                                cx="50%" cy="50%" outerRadius={70} dataKey="value" label
                                            >
                                                {Object.keys(d.month.creditBreakdown).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: number) => fmt$(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-xs text-gray-500 border-b">
                                            <tr>
                                                <th className="text-left py-2">Tipo</th>
                                                <th className="text-right py-2">Ops</th>
                                                <th className="text-right py-2">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(d.month.creditBreakdown).sort((a: any, b: any) => b[1].total - a[1].total).map(([type, info]: [string, any]) => (
                                                <tr key={type} className="border-b last:border-0">
                                                    <td className="py-2 capitalize">{type.replace(/_/g, ' ')}</td>
                                                    <td className="py-2 text-right">{info.count}</td>
                                                    <td className="py-2 text-right font-bold text-green-600">{fmt$(info.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Debit breakdown */}
                    {d.month?.debitBreakdown && Object.keys(d.month.debitBreakdown).length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Desglose débitos (mes)</h3>
                            <p className="text-xs text-gray-400 mb-3">En qué se gasta el PocketCash: compras, retiros, comisiones, etc.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b">
                                        <tr>
                                            <th className="text-left py-2 px-3">Tipo</th>
                                            <th className="text-right py-2 px-3">Operaciones</th>
                                            <th className="text-right py-2 px-3">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(d.month.debitBreakdown).sort((a: any, b: any) => b[1].total - a[1].total).map(([type, info]: [string, any]) => (
                                            <tr key={type} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2 px-3 capitalize">{type.replace(/_/g, ' ')}</td>
                                                <td className="py-2 px-3 text-right">{info.count}</td>
                                                <td className="py-2 px-3 text-right font-bold text-red-600">{fmt$(info.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Top wallets */}
                    {d.topWallets && d.topWallets.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Top wallets por saldo</h3>
                            <p className="text-xs text-gray-400 mb-3">Usuarios con más saldo acumulado. Los marcados en rojo superan $5,000 y requieren verificación.</p>
                            <div className="space-y-2">
                                {d.topWallets.map((w: any, i: number) => (
                                    <Link key={w.userId} href={`/admin/usuarios?q=${w.userId}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2 ring-1 ring-black/5 hover:bg-blue-50 hover:ring-blue-200 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                                            <span className="text-xs font-mono text-gray-600 group-hover:text-blue-600">{w.userId.slice(0, 8)}…</span>
                                            <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Ver usuario →</span>
                                        </div>
                                        <span className={`font-bold ${w.balance > 5000 ? 'text-red-600' : 'text-green-600'}`}>{fmt$(w.balance)}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ SOPORTE ═══ */}
            {activeTab === 'soporte' && d && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <SectionDesc text="Panel de soporte al cliente: tickets abiertos, tiempos de respuesta y actividad del equipo administrativo." />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <KPICard title="Total tickets" value={fmtN(d.totalTickets)} accent="blue" help="Total de conversaciones de soporte registradas" />
                        <KPICard title="Abiertos" value={fmtN(d.openTickets)} accent="orange" help="Tickets que aún no se han cerrado o resuelto" />
                        <KPICard title="Respuesta promedio" value={`${d.avgResponseHours}h`} accent="purple" help="Tiempo promedio desde que se abre un ticket hasta la primera respuesta" />
                        <KPICard title="Sin respuesta > 24h" value={String(d.staleTickets)} accent="red" help="Tickets abiertos sin ninguna respuesta por más de 24h. ¡Urgente!" />
                    </div>

                    {d.staleTickets > 0 && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-semibold">
                            ⚠️ {d.staleTickets} ticket(s) llevan más de 24 horas sin respuesta
                        </div>
                    )}

                    {/* Ticket trend */}
                    {d.ticketTrend && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Tickets abiertos vs cerrados (30 días)</h3>
                            <p className="text-xs text-gray-400 mb-3">Comparación entre tickets nuevos y resueltos por día. Lo ideal es que celeste supere al naranja.</p>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={d.ticketTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={3} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="opened" name="Abiertos" fill="#FF9800" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="closed" name="Cerrados" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Recent admin activity */}
                    {d.recentActivity && d.recentActivity.length > 0 && (
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">Actividad administrativa reciente</h3>
                            <p className="text-xs text-gray-400 mb-3">Últimas acciones realizadas por administradores: aprobaciones, bloqueos, cambios, etc.</p>
                            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                                        <tr>
                                            <th className="text-left py-2 px-3">Tipo</th>
                                            <th className="text-left py-2 px-3">Estado</th>
                                            <th className="text-left py-2 px-3">Fecha</th>
                                            <th className="text-left py-2 px-3">Admin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.recentActivity.map((e: any) => (
                                            <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-2 px-3 capitalize">{String(e.type || '—').replace(/_/g, ' ')}</td>
                                                <td className="py-2 px-3">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${e.status === 'completed' ? 'bg-white text-green-700' :
                                                        e.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'
                                                        }`}>{e.status}</span>
                                                </td>
                                                <td className="py-2 px-3 text-xs text-gray-500">{new Date(e.createdAt).toLocaleString('es-MX')}</td>
                                                <td className="py-2 px-3 text-xs font-mono text-gray-500">{(e.adminId || '').slice(0, 8)}…</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <StatCard label="Eventos admin hoy" value={String(d.todayEvents || 0)} icon="📋" />
                </div>
            )}
        </div>
    );
}

// ─── Reusable Components ───
function KPICard({ title, value, change, subtitle, accent = 'gray', help }: {
    title: string; value: string; change?: number; subtitle?: string; accent?: string; help?: string;
}) {
    const accentMap: Record<string, string> = {
        pink: 'border-emerald-300 bg-white/50',
        blue: 'border-blue-300 bg-blue-50/50',
        green: 'border-green-300 bg-white/50',
        orange: 'border-orange-300 bg-orange-50/50',
        red: 'border-red-300 bg-red-50/50',
        purple: 'border-purple-300 bg-purple-50/50',
        teal: 'border-teal-300 bg-teal-50/50',
        gray: 'border-black/5 bg-white',
    };
    return (
        <div className={`rounded-3xl p-5 shadow-sm ring-1 ring-black/5 border-2 ${accentMap[accent] || accentMap.gray}`}>
            <div className="text-xs font-semibold text-gray-500">{title}</div>
            <div className="mt-1 flex items-end gap-2">
                <span className="text-2xl font-extrabold text-gray-900">{value}</span>
                {change !== undefined && pctBadge(change)}
            </div>
            {subtitle && <div className="mt-1 text-[11px] text-gray-400">{subtitle}</div>}
            {help && <div className="mt-1.5 text-[10px] text-gray-400 leading-tight">{help}</div>}
        </div>
    );
}

function StatCard({ label, value, icon, desc }: { label: string; value: string; icon: string; desc?: string }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
                <div className="text-xs font-semibold text-gray-500">{label}</div>
                <div className="text-lg font-extrabold text-gray-900">{value}</div>
                {desc && <div className="text-[10px] text-gray-400 leading-tight">{desc}</div>}
            </div>
        </div>
    );
}

function SectionDesc({ text }: { text: string }) {
    return (
        <div className="rounded-2xl bg-blue-50/60 border border-blue-100 px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
            <span className="text-sm">ℹ️</span>
            <span>{text}</span>
        </div>
    );
}

function SegRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="flex-1 text-sm text-gray-700">{label}</span>
            <span className="font-bold text-gray-900">{fmtN(value)}</span>
        </div>
    );
}
