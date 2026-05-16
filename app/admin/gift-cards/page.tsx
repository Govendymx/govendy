'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { Pagination, usePagination } from '@/components/ui/Pagination';

export default function AdminGiftCardsPage() {
    const [giftCards, setGiftCards] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true);
        setApiError(null);
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) { setApiError('No hay sesión activa'); return; }

            const res = await fetch('/api/admin/gift-cards', {
                headers: { authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.ok) {
                setGiftCards(json.gift_cards || []);
                setStats(json.stats);
            } else {
                setApiError(json.error || `Error ${res.status}`);
            }
        } catch (err: any) {
            console.error(err);
            setApiError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(giftCardId: string, action: 'approve_payment' | 'cancel') {
        if (!confirm(action === 'approve_payment' ? '¿Aprobar este pago?' : '¿Cancelar esta tarjeta?')) return;
        setActionLoading(giftCardId);
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) return;

            const res = await fetch('/api/admin/gift-cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action, gift_card_id: giftCardId }),
            });
            const json = await res.json();
            if (json.ok) {
                alert(json.message);
                loadData();
            } else {
                alert(json.error || 'Error');
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    }

    const filtered = giftCards.filter(gc => {
        if (filter === 'all') return true;
        if (filter === 'pending') return gc.payment_status === 'pending';
        if (filter === 'active') return gc.status === 'active' && gc.payment_status === 'paid';
        if (filter === 'redeemed') return gc.status === 'redeemed';
        if (filter === 'cancelled') return gc.status === 'cancelled';
        return true;
    });

    const { paginatedItems: paginatedFiltered, paginationProps, setCurrentPage } = usePagination(filtered, 50);
    useEffect(() => { setCurrentPage(1); }, [filter, setCurrentPage]);

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">← Volver al Admin</Link>
                        <h1 className="text-2xl font-black text-gray-900">🎁 Tarjetas de Regalo</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowSettings(!showSettings)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showSettings ? 'bg-orange-500 text-white' : 'bg-orange-50 hover:bg-orange-100 text-orange-700'}`}>
                            ⚙️ Configuración Tienda
                        </button>
                        <button onClick={loadData} className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            🔄 Actualizar
                        </button>
                    </div>
                </div>

                {/* Gift Card Store Settings Panel */}
                {showSettings && (
                    <div className="mb-6 rounded-2xl bg-gradient-to-br from-orange-50 via-emerald-50 to-purple-50 p-6 ring-1 ring-orange-200/50 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            🏪 Configuración de Tienda Gift Cards
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-black/5">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre de la Tienda</div>
                                <div className="text-lg font-black text-gray-900">PocketCash Gift Cards</div>
                                <div className="text-xs text-gray-400 mt-1">Se muestra en el carrusel de tiendas oficiales</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-black/5">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Slogan</div>
                                <div className="text-lg font-black text-gray-900">Regala saldo PocketCash a quien quieras</div>
                                <div className="text-xs text-gray-400 mt-1">Subtítulo en el carrusel</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-black/5">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Denominaciones</div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {[50, 100, 200, 500, 1000].map(amt => (
                                        <span key={amt} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-bold">${amt}</span>
                                    ))}
                                </div>
                                <div className="text-xs text-gray-400 mt-2">Edítalas en <code className="bg-gray-100 px-1 rounded">app/gift-cards/page.tsx</code></div>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm ring-1 ring-black/5">
                                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Enlaces</div>
                                <div className="flex flex-col gap-2 mt-1">
                                    <Link href="/gift-cards" target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-orange-600 hover:underline">
                                        🎁 Ver Tienda Pública →
                                    </Link>
                                    <Link href="/dashboard/monedero" target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-purple-600 hover:underline">
                                        💳 Sección Canjear →
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="text-xs font-bold text-amber-800">💡 Nota: Para editar texto y denominaciones, modifica directamente el archivo <code className="bg-amber-100 px-1 rounded">app/gift-cards/page.tsx</code> y despliega.</div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                        {[
                            { label: 'Total Vendido', value: `$${stats.total_sold?.toLocaleString('es-MX') || 0}`, color: 'bg-white text-green-700', icon: '💰' },
                            { label: 'Activas', value: stats.active, color: 'bg-blue-50 text-blue-700', icon: '✅' },
                            { label: 'Pago Pendiente', value: stats.pending_payment, color: 'bg-yellow-50 text-yellow-700', icon: '⏳' },
                            { label: 'Canjeadas', value: stats.redeemed, color: 'bg-purple-50 text-purple-700', icon: '🎉' },
                            { label: 'Canceladas', value: stats.cancelled, color: 'bg-red-50 text-red-700', icon: '❌' },
                        ].map((s) => (
                            <div key={s.label} className={`${s.color} rounded-xl p-4`}>
                                <div className="text-2xl mb-1">{s.icon}</div>
                                <div className="text-2xl font-black">{s.value}</div>
                                <div className="text-xs font-medium opacity-70">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {[
                        { id: 'all', label: 'Todas' },
                        { id: 'pending', label: '⏳ Pago Pendiente' },
                        { id: 'active', label: '✅ Activas' },
                        { id: 'redeemed', label: '🎉 Canjeadas' },
                        { id: 'cancelled', label: '❌ Canceladas' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Error Display */}
                {apiError && (
                    <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                        <strong>Error:</strong> {apiError}
                        <p className="text-xs mt-1 text-red-500">
                            Si ves &quot;relation gift_cards does not exist&quot;, necesitas ejecutar el script
                            <code className="bg-red-100 px-1 rounded mx-1">scripts/create_gift_cards_table.sql</code>
                            en Supabase SQL Editor.
                        </p>
                    </div>
                )}

                {/* Table */}
                {loading ? (
                    <div className="text-center py-12 text-gray-400">Cargando...</div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">No hay tarjetas de regalo</div>
                ) : (
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-gray-600">Código</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Monto</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Método</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Pago</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Estado</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Tipo</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Fecha</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {paginatedFiltered.map((gc) => (
                                        <tr key={gc.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 font-mono font-bold text-gray-900 text-xs">{gc.code}</td>
                                            <td className="p-3 font-bold">${Number(gc.amount).toLocaleString('es-MX')}</td>
                                            <td className="p-3 text-gray-600 capitalize">{gc.payment_method?.replace('_', ' ')}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${gc.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    gc.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {gc.payment_status === 'paid' ? 'Pagado' : gc.payment_status === 'pending' ? 'Pendiente' : gc.payment_status}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${gc.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                                    gc.status === 'redeemed' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {gc.status === 'active' ? 'Activa' : gc.status === 'redeemed' ? 'Canjeada' : 'Cancelada'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-600 text-xs">{gc.for_self ? '👤 Personal' : '🎁 Regalo'}</td>
                                            <td className="p-3 text-gray-500 text-xs">{new Date(gc.created_at).toLocaleDateString('es-MX')}</td>
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    {gc.payment_status === 'pending' && gc.status !== 'cancelled' && (
                                                        <button
                                                            onClick={() => handleAction(gc.id, 'approve_payment')}
                                                            disabled={actionLoading === gc.id}
                                                            className="bg-white0 hover:bg-green-600 text-white px-2 py-1 rounded text-xs font-medium disabled:opacity-50 transition-colors"
                                                        >
                                                            ✅ Aprobar Pago
                                                        </button>
                                                    )}
                                                    {gc.status !== 'cancelled' && gc.status !== 'redeemed' && (
                                                        <button
                                                            onClick={() => handleAction(gc.id, 'cancel')}
                                                            disabled={actionLoading === gc.id}
                                                            className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium disabled:opacity-50 transition-colors"
                                                        >
                                                            ❌ Cancelar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination {...paginationProps} />
                    </div>
                )}
            </div>
        </div>
    );
}
