'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

interface OverweightLabel {
    id: string;
    order_id: string;
    seller_id: string;
    carrier: string;
    tracking_number: string;
    quoted_weight_kg: number | null;
    actual_weight_kg: number | null;
    quoted_price: number | null;
    overweight_fee: number;
    overweight_status: string;
    created_at: string;
    orders?: { id: string; created_at: string; total_amount: number };
    profiles?: { full_name: string; nickname: string; email: string };
}

interface SellerSummary {
    seller_name: string;
    total_pending: number;
    total_charged: number;
    count: number;
}

interface ImportHistory {
    id: string;
    admin_id: string;
    filename: string;
    records_count: number;
    total_overweight_fees: number;
    created_at: string;
}

export default function SobrepesosPage() {
    const [labels, setLabels] = useState<OverweightLabel[]>([]);
    const [bySeller, setBySeller] = useState<Record<string, SellerSummary>>({});
    const [recentImports, setRecentImports] = useState<ImportHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [tab, setTab] = useState<'dashboard' | 'labels' | 'imports'>('dashboard');

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            const res = await fetch(`/api/admin/shipping/overweight-report?${params.toString()}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const json = await res.json();
            if (json.success) {
                setLabels(json.labels || []);
                setBySeller(json.by_seller || {});
                setRecentImports(json.recent_imports || []);
            }
        } catch (err) {
            console.error('Error loading overweight report:', err);
        } finally {
            setLoading(false);
        }
    }, [supabase, statusFilter]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setUploading(true);
            setUploadResult(null);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/shipping/import-overweights', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });
            const json = await res.json();
            setUploadResult(json);
            if (json.success) {
                await fetchReport(); // Refresh data
            }
        } catch (err) {
            console.error('Error uploading:', err);
            setUploadResult({ error: 'Error al subir archivo' });
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const totalPending = Object.values(bySeller).reduce((s, v) => s + v.total_pending, 0);
    const totalCharged = Object.values(bySeller).reduce((s, v) => s + v.total_charged, 0);
    const totalSellers = Object.keys(bySeller).length;

    const fmt = (d: string) => {
        try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
        catch { return d; }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-extrabold text-gray-900">⚖️ Gestión de Sobrepesos</h1>
                    <p className="mt-1 text-sm text-gray-500">Importa, revisa y cobra sobrepesos de guías T1 Envíos</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Vendedores con Sobrepeso</div>
                        <div className="mt-1 text-2xl font-extrabold text-gray-900">{totalSellers}</div>
                    </div>
                    <div className="rounded-xl bg-orange-50 p-4 shadow-sm ring-1 ring-orange-200">
                        <div className="text-xs font-semibold text-orange-600 uppercase">Pendiente de Cobro</div>
                        <div className="mt-1 text-2xl font-extrabold text-orange-700">${totalPending.toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-green-50 p-4 shadow-sm ring-1 ring-green-200">
                        <div className="text-xs font-semibold text-green-600 uppercase">Ya Cobrado</div>
                        <div className="mt-1 text-2xl font-extrabold text-green-700">${totalCharged.toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-4 shadow-sm ring-1 ring-blue-200">
                        <div className="text-xs font-semibold text-blue-600 uppercase">Guías con Sobrepeso</div>
                        <div className="mt-1 text-2xl font-extrabold text-blue-700">{labels.length}</div>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                    <h2 className="text-sm font-bold text-gray-900 mb-3">📤 Importar Excel de Sobrepesos</h2>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <label className="relative cursor-pointer rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all">
                            {uploading ? '⏳ Procesando...' : '📂 Seleccionar archivo Excel'}
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleUpload}
                                disabled={uploading}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </label>
                        <span className="text-xs text-gray-400">
                            Columnas esperadas: <code className="bg-gray-100 px-1 rounded">tracking_number</code>, <code className="bg-gray-100 px-1 rounded">peso_real</code>, <code className="bg-gray-100 px-1 rounded">cargo_sobrepeso</code>
                        </span>
                    </div>
                    {uploadResult && (
                        <div className={`mt-4 rounded-lg p-4 text-sm ${uploadResult.success ? 'bg-green-50 text-green-800 ring-1 ring-green-200' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}>
                            {uploadResult.success ? (
                                <div>
                                    <div className="font-bold">✅ Importación completada</div>
                                    <div className="mt-1">
                                        Total filas: <strong>{uploadResult.summary.total_rows}</strong> · Procesadas: <strong>{uploadResult.summary.processed}</strong> · No encontradas: <strong>{uploadResult.summary.not_found}</strong>
                                    </div>
                                    <div className="mt-1">
                                        Total sobrepesos: <strong className="text-orange-700">${uploadResult.summary.total_fees.toFixed(2)}</strong>
                                    </div>
                                </div>
                            ) : (
                                <div className="font-bold">❌ {uploadResult.error}</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
                    {(['dashboard', 'labels', 'imports'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t === 'dashboard' ? '📊 Resumen por Vendedor' : t === 'labels' ? '📦 Guías con Sobrepeso' : '📋 Historial de Imports'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
                    </div>
                ) : tab === 'dashboard' ? (
                    /* Dashboard — Resumen por Vendedor */
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 text-left text-gray-500 uppercase">
                                    <th className="px-4 py-3 font-semibold">Vendedor</th>
                                    <th className="px-4 py-3 font-semibold text-center">Guías</th>
                                    <th className="px-4 py-3 font-semibold text-right">Pendiente</th>
                                    <th className="px-4 py-3 font-semibold text-right">Cobrado</th>
                                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(bySeller).map(([sid, info]) => (
                                    <tr key={sid} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-900">{info.seller_name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono">{sid.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold">{info.count}</td>
                                        <td className="px-4 py-3 text-right font-bold text-orange-600">${info.total_pending.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-green-600">${info.total_charged.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-extrabold text-gray-900">${(info.total_pending + info.total_charged).toFixed(2)}</td>
                                    </tr>
                                ))}
                                {Object.keys(bySeller).length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Sin sobrepesos registrados</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : tab === 'labels' ? (
                    /* Guías con Sobrepeso */
                    <div>
                        <div className="mb-3 flex gap-2">
                            {['', 'pending', 'charged'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${statusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {s === '' ? 'Todos' : s === 'pending' ? '⏳ Pendientes' : '✅ Cobrados'}
                                </button>
                            ))}
                        </div>
                        <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50 text-left text-gray-500 uppercase">
                                        <th className="px-3 py-3 font-semibold">Tracking</th>
                                        <th className="px-3 py-3 font-semibold">Carrier</th>
                                        <th className="px-3 py-3 font-semibold">Vendedor</th>
                                        <th className="px-3 py-3 font-semibold text-right">Peso Cotiz.</th>
                                        <th className="px-3 py-3 font-semibold text-right">Peso Real</th>
                                        <th className="px-3 py-3 font-semibold text-right">Sobrepeso</th>
                                        <th className="px-3 py-3 font-semibold text-center">Estado</th>
                                        <th className="px-3 py-3 font-semibold">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {labels.map((lb) => (
                                        <tr key={lb.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2.5 font-mono font-semibold text-gray-900">{lb.tracking_number || '—'}</td>
                                            <td className="px-3 py-2.5 font-semibold text-gray-700">{lb.carrier || '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-semibold text-gray-900">{(lb as any).profiles?.full_name || (lb as any).profiles?.nickname || '—'}</div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-gray-600">{lb.quoted_weight_kg ? `${lb.quoted_weight_kg} kg` : '—'}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-red-600">{lb.actual_weight_kg ? `${lb.actual_weight_kg} kg` : '—'}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-orange-700">${Number(lb.overweight_fee || 0).toFixed(2)}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {lb.overweight_status === 'pending' ? (
                                                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-300">⏳ Pendiente</span>
                                                ) : lb.overweight_status === 'charged' ? (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 ring-1 ring-green-300">✅ Cobrado</span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-gray-500">{lb.created_at ? fmt(lb.created_at) : '—'}</td>
                                        </tr>
                                    ))}
                                    {labels.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Sin guías con sobrepeso</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Historial de Imports */
                    <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 text-left text-gray-500 uppercase">
                                    <th className="px-4 py-3 font-semibold">Archivo</th>
                                    <th className="px-4 py-3 font-semibold text-center">Registros</th>
                                    <th className="px-4 py-3 font-semibold text-right">Total Sobrepesos</th>
                                    <th className="px-4 py-3 font-semibold">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentImports.map((imp) => (
                                    <tr key={imp.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-semibold text-gray-900">{imp.filename}</td>
                                        <td className="px-4 py-3 text-center font-semibold">{imp.records_count}</td>
                                        <td className="px-4 py-3 text-right font-bold text-orange-700">${Number(imp.total_overweight_fees || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-gray-500">{imp.created_at ? fmt(imp.created_at) : '—'}</td>
                                    </tr>
                                ))}
                                {recentImports.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">Sin importaciones</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
