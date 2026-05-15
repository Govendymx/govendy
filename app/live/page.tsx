'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Radio, Users, Clock, ShoppingBag } from 'lucide-react';
import dynamic from 'next/dynamic';

const GoVendyTVWidget = dynamic(() => import('@/components/live/GoVendyTVWidget'), { ssr: false });

interface LiveSession {
    id: string;
    title: string;
    description: string | null;
    status: string;
    viewer_count: number;
    product_ids: string[];
    started_at: string;
    host_id: string;
    profiles: {
        id: string;
        full_name: string | null;
        nickname: string | null;
        avatar_url: string | null;
        store_logo_url?: string | null;
    } | null;
    thumbnail_url?: string | null;
}

export default function LiveListPage() {
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'live' | 'ended'>('live');

    useEffect(() => {
        let first = true;
        const load = async () => {
            if (first) setLoading(true);
            try {
                const res = await fetch(`/api/live?status=${filter}`);
                const data = await res.json();
                setSessions(data.sessions || []);
            } catch { }
            if (first) { setLoading(false); first = false; }
        };
        load();
        const interval = setInterval(load, 15_000);
        return () => clearInterval(interval);
    }, [filter]);


    const getElapsed = (startedAt: string) => {
        const ms = Date.now() - new Date(startedAt).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col" style={{ height: '100dvh', paddingTop: '60px', zIndex: 60 }}>
            {/* ═══ GoVendy TV — fills viewport ═══ */}
            <GoVendyTVWidget />

            {/* ═══ Bottom section — tabs + session grid ═══ */}
            <div className="flex-shrink-0 bg-gray-950 border-t border-white/10 overflow-y-auto" style={{ maxHeight: '35vh' }}>
                <div className="px-4 py-3">
                    {/* Filter tabs */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setFilter('live')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs transition-all ${filter === 'live'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-white/10 text-gray-400 hover:bg-white/15'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${filter === 'live' ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
                            En Vivo
                        </button>
                        <button
                            onClick={() => setFilter('ended')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs transition-all ${filter === 'ended'
                                ? 'bg-white/20 text-white'
                                : 'bg-white/10 text-gray-400 hover:bg-white/15'
                                }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Anteriores
                        </button>
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && sessions.length === 0 && (
                        <div className="text-center py-4 opacity-60">
                            <Radio className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">
                                {filter === 'live' ? 'No hay otras transmisiones en vivo' : 'No hay transmisiones anteriores'}
                            </p>
                        </div>
                    )}

                    {/* Horizontal scroll sessions */}
                    {!loading && sessions.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                            {sessions.map((session) => {
                                const host = session.profiles;
                                const hostName = host?.nickname || host?.full_name || 'Vendedor';
                                const hostAvatar = (host as any)?.store_logo_url || host?.avatar_url;

                                return (
                                    <Link
                                        key={session.id}
                                        href={`/live/${session.id}`}
                                        className="group flex-shrink-0 w-56 rounded-xl overflow-hidden bg-gray-900 border border-white/10 hover:border-red-500/50 transition-all hover:scale-[1.02]"
                                    >
                                        {/* Video thumbnail */}
                                        <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden">
                                            {session.thumbnail_url ? (
                                                <img src={session.thumbnail_url} alt={session.title} className="absolute inset-0 w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center z-10">
                                                    {hostAvatar ? (
                                                        <img src={hostAvatar} alt="" className="w-12 h-12 rounded-full ring-2 ring-white/20 object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-lg font-bold ring-2 ring-white/20">
                                                            {hostName.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                                            {/* LIVE badge */}
                                            {session.status === 'live' && (
                                                <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded z-20">
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                    EN VIVO
                                                </div>
                                            )}
                                            {session.status === 'ended' && (
                                                <div className="absolute top-2 left-2 bg-gray-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded z-20">
                                                    FINALIZADA
                                                </div>
                                            )}

                                            {/* Viewers */}
                                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded z-20">
                                                <Users className="w-3 h-3" /> {session.viewer_count || 0}
                                            </div>

                                            {/* Host name */}
                                            <div className="absolute bottom-1.5 left-2 z-20">
                                                <span className="text-white text-[10px] font-semibold drop-shadow">{hostName}</span>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="p-2.5">
                                            <h3 className="font-bold text-white text-xs group-hover:text-red-400 transition-colors line-clamp-1">
                                                {session.title}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                                                {session.started_at && <span>⏱ {getElapsed(session.started_at)}</span>}
                                                {session.product_ids?.length > 0 && (
                                                    <span className="flex items-center gap-0.5">
                                                        <ShoppingBag className="w-3 h-3" />
                                                        {session.product_ids.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
