'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { Pagination, usePagination } from '@/components/ui/Pagination';

type UserHoursRow = {
    user_id: string;
    minutes_balance: number;
    full_name?: string | null;
    nickname?: string | null;
    avatar_url?: string | null;
    plan_type?: string | null;
    total_sessions: number;
    total_minutes_streamed: number;
    transactions: { id: string; amount: number; concept: string; created_at: string }[];
};

// ─── Capacidad del servidor (Hetzner CPX41) ───────────────────────────────────
const SERVER_MAX_SIMULTANEOUS = 50;  // lives simultáneos seguros con WebRTC
const SERVER_MAX_DAILY = 500; // lives por día antes de degradación

type LiveSession = {
    id: string;
    host_id: string;
    title: string;
    description?: string | null;
    status: 'live' | 'scheduled' | 'ended';
    started_at?: string | null;
    ended_at?: string | null;
    created_at: string;
    viewer_count?: number | null;
    profiles?: {
        id: string;
        full_name?: string | null;
        nickname?: string | null;
        avatar_url?: string | null;
    } | null;
};

function fmtDate(iso?: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-MX', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function sessionMinutes(s: LiveSession): number {
    const start = s.started_at ? new Date(s.started_at).getTime() : null;
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    if (!start) return 0;
    return Math.max(0, Math.floor((end - start) / 60000));
}

function isToday(iso?: string | null): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
}

function isThisMonth(iso?: string | null): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function fmtMinutes(m: number): string {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
}


const STATUS_BADGE: Record<string, string> = {
    live: 'bg-red-100 text-red-700 ring-1 ring-red-300',
    scheduled: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',
    ended: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
};

const STATUS_LABEL: Record<string, string> = {
    live: '🔴 En vivo',
    scheduled: '⏰ Programado',
    ended: '⚫ Terminado',
};

export default function AdminLivesPage() {
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [filter, setFilter] = useState<'all' | 'live' | 'ended'>('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [ending, setEnding] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'sessions' | 'hours'>('sessions');
    const [userHours, setUserHours] = useState<UserHoursRow[]>([]);
    const [hoursLoading, setHoursLoading] = useState(false);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const status = filter === 'all' ? 'all' : filter;
            const { data: { session: sess } } = await supabase.auth.getSession();
            const res = await fetch(`/api/live?status=${status}&limit=100`, {
                headers: sess?.access_token ? { authorization: `Bearer ${sess.access_token}` } : {},
                cache: 'no-store',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Error cargando sesiones');
            setSessions((json.sessions ?? []) as LiveSession[]);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { void load(); }, [load]);

    const loadUserHours = useCallback(async () => {
        setHoursLoading(true);
        try {
            // 1. Get all users with extra hours
            const { data: extraRows } = await supabase
                .from('live_extra_hours')
                .select('user_id, minutes_balance')
                .order('minutes_balance', { ascending: false });

            if (!extraRows || extraRows.length === 0) { setUserHours([]); return; }

            const userIds = extraRows.map(r => r.user_id);

            // 2. Get profiles
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, nickname, avatar_url, plan_type')
                .in('id', userIds);

            // 3. Get session counts & total minutes per user
            const { data: allSessions } = await supabase
                .from('live_sessions')
                .select('host_id, started_at, ended_at, status')
                .in('host_id', userIds);

            const sessionMap: Record<string, { count: number; totalMins: number }> = {};
            (allSessions || []).forEach(s => {
                if (!sessionMap[s.host_id]) sessionMap[s.host_id] = { count: 0, totalMins: 0 };
                sessionMap[s.host_id].count++;
                if (s.started_at) {
                    const end = s.ended_at ? new Date(s.ended_at).getTime() : (s.status === 'live' ? Date.now() : new Date(s.started_at).getTime());
                    sessionMap[s.host_id].totalMins += Math.max(0, Math.floor((end - new Date(s.started_at).getTime()) / 60000));
                }
            });

            // 4. Get wallet transactions (purchases)
            const { data: txRows } = await supabase
                .from('wallet_transactions')
                .select('id, wallet_id, amount, concept, created_at')
                .eq('reference_type', 'live_hours')
                .in('wallet_id', userIds)
                .order('created_at', { ascending: false });

            const txMap: Record<string, UserHoursRow['transactions']> = {};
            (txRows || []).forEach(tx => {
                if (!txMap[tx.wallet_id]) txMap[tx.wallet_id] = [];
                txMap[tx.wallet_id].push({ id: tx.id, amount: tx.amount, concept: tx.concept, created_at: tx.created_at });
            });

            // 5. Combine
            const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
            const combined: UserHoursRow[] = extraRows.map(r => ({
                user_id: r.user_id,
                minutes_balance: r.minutes_balance,
                full_name: profileMap[r.user_id]?.full_name,
                nickname: profileMap[r.user_id]?.nickname,
                avatar_url: profileMap[r.user_id]?.avatar_url,
                plan_type: profileMap[r.user_id]?.plan_type,
                total_sessions: sessionMap[r.user_id]?.count ?? 0,
                total_minutes_streamed: sessionMap[r.user_id]?.totalMins ?? 0,
                transactions: txMap[r.user_id] ?? [],
            }));

            setUserHours(combined);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setHoursLoading(false);
        }
    }, []);

    useEffect(() => { if (activeTab === 'hours') void loadUserHours(); }, [activeTab, loadUserHours]);

    const forceEnd = async (sessionId: string) => {
        if (!confirm('¿Terminar forzosamente este live?')) return;
        setEnding(sessionId);
        setError(null);
        setSuccess(null);
        try {
            // Use admin supabase to force-end (bypass host check)
            const { data: { session: sess } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/lives/force-end', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${sess?.access_token}`,
                },
                body: JSON.stringify({ session_id: sessionId }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || 'No se pudo terminar el live');
            setSuccess('Live terminado correctamente.');
            void load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setEnding(null);
        }
    };

    const live = sessions.filter(s => s.status === 'live');
    const ended = sessions.filter(s => s.status === 'ended');
    const scheduled = sessions.filter(s => s.status === 'scheduled');

    const { paginatedItems: paginatedSessions, paginationProps: sessionsPagination, setCurrentPage: setSessionsPage } = usePagination(sessions, 50);
    useEffect(() => { setSessionsPage(1); }, [filter, setSessionsPage]);

    // ── Métricas calculadas desde los datos cargados ────────────────────────
    const todaySessions = sessions.filter(s => isToday(s.started_at || s.created_at));
    const monthSessions = sessions.filter(s => isThisMonth(s.started_at || s.created_at));
    const minsToday = todaySessions.reduce((acc, s) => acc + sessionMinutes(s), 0);
    const minsMonth = monthSessions.reduce((acc, s) => acc + sessionMinutes(s), 0);
    const livesToday = todaySessions.length;
    const simultaneousPct = Math.min(100, Math.round((live.length / SERVER_MAX_SIMULTANEOUS) * 100));
    const simultaneousColor = live.length >= SERVER_MAX_SIMULTANEOUS * 0.9 ? 'bg-red-500'
        : live.length >= SERVER_MAX_SIMULTANEOUS * 0.6 ? 'bg-yellow-400'
            : 'bg-green-500';
    const avgDuration = ended.length > 0
        ? Math.round(ended.reduce((a, s) => a + sessionMinutes(s), 0) / ended.length)
        : 0;

    return (
        <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                    <div className="text-lg font-bold text-gray-900">Admin · Lives</div>
                    <div className="mt-1 text-sm text-gray-500">
                        Monitoreo de transmisiones en vivo (exclusivo Plan Platinum).
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => void load()}
                        disabled={loading}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {loading ? '⏳ Cargando…' : '🔄 Actualizar'}
                    </button>
                    <Link
                        href="/admin"
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                    >
                        ← Admin
                    </Link>
                </div>
            </div>

            {/* Stats Row — resumen rápido */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-2xl bg-red-50 ring-1 ring-red-100 p-4 text-center">
                    <div className="text-2xl font-black text-red-600">{live.length}</div>
                    <div className="text-xs font-semibold text-red-500 mt-0.5">🔴 En vivo ahora</div>
                </div>
                <div className="rounded-2xl bg-yellow-50 ring-1 ring-yellow-100 p-4 text-center">
                    <div className="text-2xl font-black text-yellow-600">{scheduled.length}</div>
                    <div className="text-xs font-semibold text-yellow-600 mt-0.5">⏰ Programados</div>
                </div>
                <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-100 p-4 text-center">
                    <div className="text-2xl font-black text-gray-600">{ended.length}</div>
                    <div className="text-xs font-semibold text-gray-500 mt-0.5">⚫ Terminados</div>
                </div>
            </div>

            {/* ── MÉTRICAS AVANZADAS ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {/* Minutos hoy */}
                <div className="rounded-2xl bg-blue-50 ring-1 ring-blue-100 p-4">
                    <div className="text-xl font-black text-blue-700">{fmtMinutes(minsToday)}</div>
                    <div className="text-[11px] font-semibold text-blue-500 mt-0.5">📅 Min transmitidos hoy</div>
                    <div className="text-[10px] text-blue-400 mt-1">{livesToday} lives hoy</div>
                </div>
                {/* Minutos este mes */}
                <div className="rounded-2xl bg-indigo-50 ring-1 ring-indigo-100 p-4">
                    <div className="text-xl font-black text-indigo-700">{fmtMinutes(minsMonth)}</div>
                    <div className="text-[11px] font-semibold text-indigo-500 mt-0.5">📆 Min transmitidos mes</div>
                    <div className="text-[10px] text-indigo-400 mt-1">{monthSessions.length} lives este mes</div>
                </div>
                {/* Duración promedio */}
                <div className="rounded-2xl bg-purple-50 ring-1 ring-purple-100 p-4">
                    <div className="text-xl font-black text-purple-700">{fmtMinutes(avgDuration)}</div>
                    <div className="text-[11px] font-semibold text-purple-500 mt-0.5">⏱ Duración promedio</div>
                    <div className="text-[10px] text-purple-400 mt-1">por sesión terminada</div>
                </div>
                {/* Lives hoy */}
                <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 p-4">
                    <div className="text-xl font-black text-emerald-700">{livesToday}</div>
                    <div className="text-[11px] font-semibold text-emerald-500 mt-0.5">🎬 Lives hoy</div>
                    <div className="text-[10px] text-emerald-400 mt-1">de {SERVER_MAX_DAILY} diarios seguros</div>
                </div>
            </div>

            {/* ── CAPACIDAD DEL SERVIDOR ─────────────────────────────────── */}
            <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <span className="text-sm font-bold text-gray-800">🖥️ Capacidad del servidor (Hetzner CPX41)</span>
                        <span className="ml-2 text-xs text-gray-500">8 vCPU · 16GB RAM · 20TB/mes</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${live.length >= SERVER_MAX_SIMULTANEOUS * 0.9 ? 'bg-red-100 text-red-700' :
                        live.length >= SERVER_MAX_SIMULTANEOUS * 0.6 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                        {live.length >= SERVER_MAX_SIMULTANEOUS * 0.9 ? '🔴 Límite' :
                            live.length >= SERVER_MAX_SIMULTANEOUS * 0.6 ? '🟡 Alerta' : '🟢 Normal'}
                    </span>
                </div>
                {/* Barra de capacidad simultánea */}
                <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Lives simultáneos: <strong className="text-gray-700">{live.length}</strong> / {SERVER_MAX_SIMULTANEOUS}</span>
                        <span>{simultaneousPct}% usado</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${simultaneousColor}`}
                            style={{ width: `${Math.max(2, simultaneousPct)}%` }}
                        />
                    </div>
                </div>
                {/* Info de capacidad */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="text-center">
                        <div className="text-lg font-black text-gray-700">{SERVER_MAX_SIMULTANEOUS}</div>
                        <div className="text-[10px] text-gray-500">simultáneos seguros</div>
                    </div>
                    <div className="text-center border-x border-gray-200">
                        <div className="text-lg font-black text-gray-700">{SERVER_MAX_DAILY}</div>
                        <div className="text-[10px] text-gray-500">lives/día seguros</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-black text-gray-700">∞</div>
                        <div className="text-[10px] text-gray-500">viewers por live</div>
                    </div>
                </div>
                {live.length >= SERVER_MAX_SIMULTANEOUS * 0.8 && (
                    <div className="mt-3 rounded-xl bg-yellow-50 ring-1 ring-yellow-200 px-3 py-2 text-xs text-yellow-700">
                        ⚠️ <strong>Cerca del límite.</strong> Considera hacer upgrade a CPX51 (16 vCPU · ~$50/mes) para soportar hasta 100 lives simultáneos.
                    </div>
                )}
            </div>

            {/* ── TABS: Sesiones / Horas de usuarios ─────────────────── */}
            <div className="flex gap-2 mb-5 border-b border-gray-200 pb-3">
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'sessions' ? 'bg-gray-900 text-white shadow-lg' : 'bg-white text-gray-600 ring-1 ring-black/5 hover:bg-gray-50'}`}
                >📡 Sesiones</button>
                <button
                    onClick={() => setActiveTab('hours')}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeTab === 'hours' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white text-gray-600 ring-1 ring-black/5 hover:bg-gray-50'}`}
                >⏰ Horas de Usuarios</button>
            </div>

            {activeTab === 'sessions' && (<>
                {/* Filters */}
                <div className="flex gap-2 mb-5">
                    {(['all', 'live', 'ended'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${filter === f
                                ? 'bg-gray-900 text-white shadow'
                                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {f === 'all' ? 'Todos' : f === 'live' ? '🔴 Activos' : '⚫ Terminados'}
                        </button>
                    ))}
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                        ⚠️ {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
                        ✅ {success}
                    </div>
                )}

                {/* Sessions list */}
                {loading && sessions.length === 0 ? (
                    <div className="py-16 text-center text-gray-400 text-sm">Cargando sesiones…</div>
                ) : sessions.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-4xl mb-2">📡</div>
                        <div className="text-gray-500 text-sm font-medium">No hay sesiones para mostrar.</div>
                        <div className="text-gray-400 text-xs mt-1">Los lives de usuarios Platinum aparecerán aquí.</div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3">
                            {paginatedSessions.map(s => {
                                const name =
                                    s.profiles?.full_name ||
                                    s.profiles?.nickname ||
                                    s.host_id.slice(0, 8) + '…';

                                const isLive = s.status === 'live';

                                return (
                                    <div
                                        key={s.id}
                                        className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl p-4 ring-1 transition-all ${isLive
                                            ? 'bg-red-50/60 ring-red-200'
                                            : 'bg-white ring-gray-100'
                                            }`}
                                    >
                                        {/* Avatar + Name */}
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="relative shrink-0">
                                                {s.profiles?.avatar_url ? (
                                                    <img
                                                        src={s.profiles.avatar_url}
                                                        alt={name}
                                                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-purple-100 ring-2 ring-white flex items-center justify-center text-purple-600 font-bold text-sm">
                                                        {name[0]?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                {isLive && (
                                                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm text-gray-900 truncate">{name}</div>
                                                <div className="text-xs text-gray-500 truncate" title={s.title}>
                                                    📣 {s.title}
                                                </div>
                                                {s.description && (
                                                    <div className="text-xs text-gray-400 truncate">{s.description}</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Meta */}
                                        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                                            <span className={`rounded-full px-2 py-0.5 font-semibold text-[11px] ${STATUS_BADGE[s.status] || STATUS_BADGE.ended}`}>
                                                {STATUS_LABEL[s.status] || s.status}
                                            </span>
                                            <span className="text-gray-400">
                                                ⏱ {isLive ? `Inicio: ${fmtDate(s.started_at)}` : `Duración: ${fmtMinutes(sessionMinutes(s))}`}
                                            </span>
                                            {!isLive && s.ended_at && (
                                                <span className="text-gray-400">· Fin: {fmtDate(s.ended_at)}</span>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {isLive && (
                                            <button
                                                onClick={() => void forceEnd(s.id)}
                                                disabled={ending === s.id}
                                                className="shrink-0 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 transition-colors disabled:opacity-50"
                                            >
                                                {ending === s.id ? '⏳ Terminando…' : '⛔ Forzar Fin'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <Pagination {...sessionsPagination} />
                    </>
                )}
            </>)}

            {/* ══ HORAS DE USUARIOS TAB ═══════════════════════════════════ */}
            {activeTab === 'hours' && (
                <div>
                    {hoursLoading ? (
                        <div className="py-16 text-center text-gray-400 text-sm">Cargando horas de usuarios…</div>
                    ) : userHours.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="text-4xl mb-2">⏰</div>
                            <div className="text-gray-500 text-sm font-medium">Ningún usuario ha comprado horas extra aún.</div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Header */}
                            <div className="hidden sm:grid grid-cols-6 gap-3 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <div className="col-span-2">Usuario</div>
                                <div className="text-center">Plan</div>
                                <div className="text-center">Saldo Horas</div>
                                <div className="text-center">Sesiones</div>
                                <div className="text-center">Min. Transmitidos</div>
                            </div>
                            {userHours.map(u => {
                                const name = u.full_name || u.nickname || u.user_id.slice(0, 8) + '…';
                                const planColors: Record<string, string> = {
                                    platinum: 'bg-amber-100 text-amber-800',
                                    pro: 'bg-purple-100 text-purple-700',
                                    basic: 'bg-gray-100 text-gray-600',
                                };
                                const isExpanded = expandedUser === u.user_id;
                                return (
                                    <div key={u.user_id}>
                                        <div
                                            onClick={() => setExpandedUser(isExpanded ? null : u.user_id)}
                                            className={`grid grid-cols-2 sm:grid-cols-6 gap-3 items-center rounded-2xl p-4 ring-1 cursor-pointer transition-all hover:shadow-md ${isExpanded ? 'bg-purple-50/60 ring-purple-200' : 'bg-white ring-gray-100'
                                                }`}
                                        >
                                            {/* User */}
                                            <div className="col-span-2 flex items-center gap-3 min-w-0">
                                                {u.avatar_url ? (
                                                    <img src={u.avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-white shrink-0" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-purple-100 ring-2 ring-white flex items-center justify-center text-purple-600 font-bold text-sm shrink-0">
                                                        {name[0]?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-sm text-gray-900 truncate">{name}</div>
                                                    <div className="text-[10px] text-gray-400 truncate">{u.user_id.slice(0, 12)}…</div>
                                                </div>
                                            </div>
                                            {/* Plan */}
                                            <div className="text-center">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planColors[u.plan_type || 'basic'] || planColors.basic}`}>
                                                    {(u.plan_type || 'basic').toUpperCase()}
                                                </span>
                                            </div>
                                            {/* Saldo */}
                                            <div className="text-center">
                                                <span className={`text-lg font-black ${u.minutes_balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {fmtMinutes(u.minutes_balance)}
                                                </span>
                                            </div>
                                            {/* Sesiones */}
                                            <div className="text-center">
                                                <span className="text-sm font-bold text-gray-700">{u.total_sessions}</span>
                                            </div>
                                            {/* Min transmitidos */}
                                            <div className="text-center">
                                                <span className="text-sm font-bold text-gray-700">{fmtMinutes(u.total_minutes_streamed)}</span>
                                            </div>
                                        </div>

                                        {/* Expandable transactions */}
                                        {isExpanded && (
                                            <div className="mt-1 ml-4 mr-2 rounded-xl bg-white ring-1 ring-gray-100 p-4">
                                                <div className="text-xs font-bold text-gray-700 mb-3">💳 Historial de compras de horas</div>
                                                {u.transactions.length === 0 ? (
                                                    <div className="text-xs text-gray-400">Sin transacciones de compra de horas.</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {u.transactions.map(tx => (
                                                            <div key={tx.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                                                                <div>
                                                                    <div className="text-xs font-semibold text-gray-800">{tx.concept}</div>
                                                                    <div className="text-[10px] text-gray-400">
                                                                        {new Date(tx.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm font-black text-red-600">-${tx.amount.toFixed(2)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
