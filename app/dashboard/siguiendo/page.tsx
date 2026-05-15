'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserMinus, Store, ArrowLeft, Loader2 } from 'lucide-react';

interface FollowedSeller {
    seller_id: string;
    created_at: string;
    name: string;
    avatar_url?: string | null;
    is_official?: boolean;
    follower_count: number;
    reputation_percent?: number;
    has_active_auction?: boolean;
    is_live?: boolean;
    live_session_id?: string | null;
}

interface SellerListing {
    id: string;
    title: string;
    price: number;
    currency: string;
    images?: string[] | null;
    sale_type?: 'direct' | 'auction' | null;
    auction_end_at?: string | null;
    auction_highest_bid?: number | null;
    seller_id: string;
    status: string;
}

function formatMoney(value: number) {
    return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatTimeLeft(endAt: string | null | undefined) {
    if (!endAt) return '';
    const end = Date.parse(endAt);
    if (!Number.isFinite(end)) return '';
    const diff = end - Date.now();
    if (diff <= 0) return 'Finalizada';
    const totalMins = Math.floor(diff / 60000);
    const days = Math.floor(totalMins / (60 * 24));
    const hours = Math.floor((totalMins - days * 60 * 24) / 60);
    const mins = totalMins - days * 60 * 24 - hours * 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    return parts.join(' ');
}

export default function SiguiendoPage() {
    const [sellers, setSellers] = useState<FollowedSeller[]>([]);
    const [loading, setLoading] = useState(true);
    const [unfollowing, setUnfollowing] = useState<string | null>(null);
    const [sellerListings, setSellerListings] = useState<Record<string, SellerListing[]>>({});
    const [listingsLoading, setListingsLoading] = useState(false);

    useEffect(() => {
        loadFollowing();
    }, []);

    // After sellers load, fetch their listings
    useEffect(() => {
        if (sellers.length === 0) return;
        let cancelled = false;
        const fetchListings = async () => {
            setListingsLoading(true);
            try {
                const sellerIds = sellers.map((s) => s.seller_id);
                // Fetch active listings for all followed sellers in one query
                const { data, error } = await supabase
                    .from('listings')
                    .select('id,title,price,currency,images,sale_type,auction_end_at,auction_highest_bid,seller_id,status')
                    .in('seller_id', sellerIds)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(200);

                if (!error && data && !cancelled) {
                    const map: Record<string, SellerListing[]> = {};
                    for (const row of data as SellerListing[]) {
                        if (!map[row.seller_id]) map[row.seller_id] = [];
                        if (map[row.seller_id].length < 15) {
                            map[row.seller_id].push(row);
                        }
                    }
                    setSellerListings(map);
                }
            } catch (e) {
                console.error('[Siguiendo] Error loading listings:', e);
            } finally {
                if (!cancelled) setListingsLoading(false);
            }
        };
        void fetchListings();
        return () => { cancelled = true; };
    }, [sellers]);

    const loadFollowing = async () => {
        setLoading(true);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) return;

            const res = await fetch('/api/follows/my-following', {
                headers: { authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.ok) setSellers(json.sellers || []);
        } catch (e) {
            console.error('[Siguiendo] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleUnfollow = async (sellerId: string) => {
        setUnfollowing(sellerId);
        try {
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) return;

            const res = await fetch('/api/follows/toggle', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ seller_id: sellerId }),
            });
            const json = await res.json();
            if (json.ok && !json.following) {
                setSellers((prev) => prev.filter((s) => s.seller_id !== sellerId));
                // Emit sync event for other components
                window.dispatchEvent(new CustomEvent('follow-sync', {
                    detail: { sellerId, following: false, followerCount: json.follower_count ?? 0 }
                }));
            }
        } catch (e) {
            console.error('[Siguiendo] Unfollow error:', e);
        } finally {
            setUnfollowing(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <style jsx global>{`
                @keyframes pulse-red {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(0.95); }
                }
                .animate-pulse-fast {
                    animation: pulse-red 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}
            </style>

            <div className="mx-auto max-w-7xl px-4 py-8">
                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <Link
                        href="/dashboard/favoritos"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900">Vendedores que sigo</h1>
                        <p className="text-sm text-gray-500">
                            {loading ? 'Cargando...' : `${sellers.length} vendedor${sellers.length !== 1 ? 'es' : ''}`}
                        </p>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
                        ))}
                    </div>
                ) : sellers.length === 0 ? (
                    <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
                        <div className="text-4xl mb-3">👥</div>
                        <div className="text-lg font-bold text-gray-900">Aún no sigues a nadie</div>
                        <p className="mt-2 text-sm text-gray-600">
                            Sigue a vendedores para recibir notificaciones cuando hagan un Live o tengan ofertas.
                        </p>
                        <Link
                            href="/listings"
                            className="mt-4 inline-flex rounded-xl bg-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90"
                        >
                            Explorar productos
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sellers.map((s) => {
                            const listings = sellerListings[s.seller_id] || [];
                            return (
                                <div
                                    key={s.seller_id}
                                    className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md overflow-hidden"
                                >
                                    {/* Seller info row */}
                                    <div className="flex items-center gap-4 p-4 border-l-4 border-transparent hover:border-brand-orange transition-colors">
                                        {/* Avatar */}
                                        <Link
                                            href={`/tienda/${s.seller_id}`}
                                            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-orange to-pink-400 text-white font-black text-xl shadow-sm overflow-hidden"
                                        >
                                            {s.avatar_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={s.avatar_url} alt={s.name} className="h-full w-full object-cover" />
                                            ) : (
                                                s.name?.charAt(0)?.toUpperCase() || '?'
                                            )}
                                            {s.is_live && (
                                                <div className="absolute inset-x-0 bottom-0 bg-red-600 text-[8px] font-black text-center py-0.5 animate-pulse">
                                                    LIVE
                                                </div>
                                            )}
                                        </Link>

                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <Link
                                                    href={`/tienda/${s.seller_id}`}
                                                    className="text-base font-bold text-gray-900 hover:text-brand-orange truncate"
                                                >
                                                    {s.name}
                                                </Link>
                                                {s.is_official && (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                                        Oficial
                                                    </span>
                                                )}
                                                {s.is_live && (
                                                    <Link
                                                        href={s.live_session_id ? `/live/${s.live_session_id}` : '/live'}
                                                        className="animate-pulse-fast inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm ring-2 ring-white"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                        LIVE
                                                    </Link>
                                                )}
                                                {s.has_active_auction && !s.is_live && (
                                                    <span className="animate-pulse-fast inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
                                                        SUBASTA
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Store size={12} className="text-gray-400" />
                                                    {s.follower_count} seguidor{s.follower_count !== 1 ? 'es' : ''}
                                                </span>
                                                {typeof s.reputation_percent === 'number' && (
                                                    <span className="flex items-center gap-1 font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-100">
                                                        ⭐ {s.reputation_percent}% positivo
                                                    </span>
                                                )}
                                                {listings.length > 0 && (
                                                    <span className="text-gray-400">
                                                        {listings.length} artículo{listings.length !== 1 ? 's' : ''} activo{listings.length !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {s.is_live && (
                                                <Link
                                                    href={s.live_session_id ? `/live/${s.live_session_id}` : '/live'}
                                                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-black text-white hover:bg-red-500 transition-colors shadow-sm"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                    Ver live
                                                </Link>
                                            )}
                                            <Link
                                                href={`/tienda/${s.seller_id}`}
                                                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-4 text-xs font-bold text-gray-700 ring-1 ring-black/5 hover:bg-gray-100 transition-colors"
                                            >
                                                Ver tienda
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleUnfollow(s.seller_id)}
                                                disabled={unfollowing === s.seller_id}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                                                title="Dejar de seguir"
                                            >
                                                {unfollowing === s.seller_id ? (
                                                    <Loader2 size={16} className="animate-spin" />
                                                ) : (
                                                    <UserMinus size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Product carousel */}
                                    {listingsLoading && listings.length === 0 ? (
                                        <div className="px-4 pb-4">
                                            <div className="flex gap-3 overflow-hidden">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="h-36 w-32 shrink-0 animate-pulse rounded-xl bg-gray-100" />
                                                ))}
                                            </div>
                                        </div>
                                    ) : listings.length > 0 ? (
                                        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                                            <div className="overflow-x-auto scrollbar-hide -mx-1">
                                                <div className="flex gap-3 px-1 pb-1" style={{ minWidth: 'max-content' }}>
                                                    {listings.map((item) => {
                                                        const thumb = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null;
                                                        const isAuction = item.sale_type === 'auction';
                                                        const auctionEndMs = item.auction_end_at ? Date.parse(item.auction_end_at) : NaN;
                                                        const auctionEnded = isAuction && Number.isFinite(auctionEndMs) && Date.now() >= auctionEndMs;
                                                        const highBid = Number(item.auction_highest_bid ?? 0);
                                                        const displayPrice = isAuction && highBid > 0 ? highBid : Number(item.price ?? 0);

                                                        return (
                                                            <Link
                                                                key={item.id}
                                                                href={`/listings/${item.id}`}
                                                                className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                                                            >
                                                                {/* Image */}
                                                                <div className="relative h-28 w-full bg-gray-100">
                                                                    {thumb ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src={thumb} alt="" className="h-full w-full object-contain p-1" />
                                                                    ) : (
                                                                        <div className="flex h-full items-center justify-center text-2xl text-gray-300">📷</div>
                                                                    )}
                                                                    {isAuction && (
                                                                        <div className={[
                                                                            'absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black shadow-sm',
                                                                            auctionEnded
                                                                                ? 'bg-gray-800 text-white'
                                                                                : 'bg-orange-500 text-white animate-pulse',
                                                                        ].join(' ')}>
                                                                            {auctionEnded ? '🏁 Terminada' : `🔨 ${formatTimeLeft(item.auction_end_at)}`}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Info */}
                                                                <div className="flex flex-1 flex-col p-2">
                                                                    <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-800 group-hover:text-brand-orange transition-colors">
                                                                        {item.title}
                                                                    </p>
                                                                    <p className="mt-auto pt-1 text-xs font-extrabold text-gray-900">
                                                                        {formatMoney(displayPrice)}
                                                                    </p>
                                                                </div>
                                                            </Link>
                                                        );
                                                    })}
                                                    {/* "Ver más" card */}
                                                    <Link
                                                        href={`/tienda/${s.seller_id}`}
                                                        className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-pink-50 to-white p-3 text-center ring-1 ring-pink-100 transition-all hover:shadow-md hover:scale-[1.02]"
                                                    >
                                                        <span className="text-2xl">🛍️</span>
                                                        <span className="text-[11px] font-bold text-brand-orange">Ver tienda completa</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ) : !listingsLoading ? (
                                        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                                            <p className="text-center text-xs text-gray-400">Sin artículos activos en este momento</p>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
