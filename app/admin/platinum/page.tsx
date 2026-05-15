'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Crown, Search, Radio, Users, ShoppingBag, Calendar, Ban, CheckCircle } from 'lucide-react';

interface PlatinumUser {
    id: string;
    full_name: string | null;
    nickname: string | null;
    email: string | null;
    avatar_url: string | null;
    plan_type: string;
    pro_subscription_start: string | null;
    pro_subscription_end: string | null;
    created_at: string;
}

export default function AdminPlatinumPage() {
    const [users, setUsers] = useState<PlatinumUser[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<'users' | 'lives'>('users');

    useEffect(() => {
        const load = async () => {
            // Load platinum users via admin API (bypasses RLS)
            try {
                const res = await fetch('/api/admin/pro-users', {
                    cache: 'no-store',
                    headers: { 'Authorization': 'Bearer ADMIN_SECRET_KEY' }
                });
                const data = await res.json();
                const platinumOnly = (data || []).filter((u: any) =>
                    (u.plan_type || '').toLowerCase() === 'platinum'
                );
                setUsers(platinumOnly);
            } catch (err) {
                console.error('Error loading platinum users:', err);
            }

            // Load all live sessions
            try {
                const res = await fetch('/api/live?status=all');
                const data = await res.json();
                setSessions(data.sessions || []);
            } catch { }

            setLoading(false);
        };
        load();
    }, []);

    const togglePlan = async (userId: string, currentPlan: string) => {
        const newPlan = currentPlan === 'platinum' ? 'basic' : 'platinum';
        if (!confirm(`¿${newPlan === 'basic' ? 'Revocar' : 'Otorgar'} Plan Platinum a este usuario?`)) return;

        const { error } = await supabase
            .from('profiles')
            .update({
                plan_type: newPlan,
                ...(newPlan === 'platinum' ? {
                    pro_subscription_start: new Date().toISOString(),
                    pro_subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
                } : {
                    pro_subscription_start: null,
                    pro_subscription_end: null,
                })
            })
            .eq('id', userId);

        if (!error) {
            setUsers((prev) => prev.filter((u) => newPlan === 'platinum' || u.id !== userId));
            window.location.reload();
        }
    };

    const filteredUsers = users.filter((u) => {
        const q = search.toLowerCase();
        return !q ||
            (u.full_name?.toLowerCase().includes(q)) ||
            (u.nickname?.toLowerCase().includes(q)) ||
            (u.email?.toLowerCase().includes(q)) ||
            u.id.includes(q);
    });

    const activeLives = sessions.filter((s) => s.status === 'live');
    const totalViewers = sessions.reduce((sum, s) => sum + (s.viewer_count || 0), 0);

    if (loading) {
        return (
            <div className="p-8 text-center text-gray-500">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto mb-3" />
                Cargando usuarios Platinum...
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Crown className="w-8 h-8 text-amber-500" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Usuarios Platinum</h1>
                    <p className="text-gray-500 text-sm">Gestión de suscripciones Platinum y transmisiones en vivo</p>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
                    <div className="flex items-center gap-2 text-amber-600 text-sm font-semibold mb-1">
                        <Crown className="w-4 h-4" /> Platinum Activos
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{users.length}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 text-red-600 text-sm font-semibold mb-1">
                        <Radio className="w-4 h-4" /> Lives Activos
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{activeLives.length}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold mb-1">
                        <Users className="w-4 h-4" /> Viewers Totales
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{totalViewers}</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                    <div className="flex items-center gap-2 text-purple-600 text-sm font-semibold mb-1">
                        <Calendar className="w-4 h-4" /> Total Sesiones
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{sessions.length}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setTab('users')}
                    className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${tab === 'users' ? 'bg-amber-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    <Crown className="inline w-4 h-4 mr-1.5" />
                    Usuarios ({users.length})
                </button>
                <button
                    onClick={() => setTab('lives')}
                    className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${tab === 'lives' ? 'bg-red-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    <Radio className="inline w-4 h-4 mr-1.5" />
                    Transmisiones ({sessions.length})
                </button>
            </div>

            {/* Users tab */}
            {tab === 'users' && (
                <>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nombre, email o ID..."
                            className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        />
                    </div>

                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Crown className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="font-semibold">No hay usuarios Platinum</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredUsers.map((user) => {
                                const daysLeft = user.pro_subscription_end
                                    ? Math.ceil((new Date(user.pro_subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                    : 0;
                                const isExpired = daysLeft <= 0;

                                return (
                                    <div key={user.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                                        {/* Avatar */}
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-300" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-400 flex items-center justify-center text-white font-bold ring-2 ring-amber-300">
                                                {(user.full_name || user.nickname || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-900 truncate">
                                                    {user.full_name || user.nickname || 'Sin nombre'}
                                                </p>
                                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    <Crown className="w-3 h-3" /> PLATINUM
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{user.email || user.id}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                                {user.pro_subscription_end && (
                                                    <span className={`${isExpired ? 'text-red-500' : daysLeft <= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                        {isExpired ? '⚠️ Vencido' : `${daysLeft} días restantes`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <button
                                            onClick={() => togglePlan(user.id, 'platinum')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                                        >
                                            <Ban className="w-3.5 h-3.5" /> Revocar
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Lives tab */}
            {tab === 'lives' && (
                <div className="space-y-3">
                    {sessions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Radio className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="font-semibold">No hay transmisiones registradas</p>
                        </div>
                    ) : (
                        sessions.map((s) => {
                            const host = s.profiles;
                            const hostName = host?.full_name || host?.nickname || 'Desconocido';

                            return (
                                <div key={s.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${s.status === 'live' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        <Radio className="w-3 h-3" />
                                        {s.status === 'live' ? 'VIVO' : 'FIN'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                            <span>👤 {hostName}</span>
                                            <span><Users className="inline w-3 h-3" /> {s.viewer_count || 0}</span>
                                            {s.product_ids?.length > 0 && (
                                                <span><ShoppingBag className="inline w-3 h-3" /> {s.product_ids.length}</span>
                                            )}
                                            <span>{new Date(s.started_at || s.created_at).toLocaleDateString('es-MX')}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
