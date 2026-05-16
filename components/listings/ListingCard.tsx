'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Star, ShoppingBag, CheckCircle, Timer, Flame, Gavel } from 'lucide-react';
import { FollowButton } from '@/components/FollowButton';

export type ListingPreview = {
    id: string;
    title: string;
    description?: string | null;
    price: number | string;
    images: string[] | null;
    public_id?: string | null;
    sale_type?: 'direct' | 'auction' | null;
    auction_end_at?: string | null;
    auction_highest_bid?: number | null;
    auction_starting_bid?: number | null;
    is_featured?: boolean | null;
    condition?: 'nuevo' | 'usado' | 'casi_nuevo' | null;
    free_shipping?: boolean | null;
    seller_id: string;
    stock?: number | null;
    // Dynamic data to be fetched or passed
    seller_name?: string;
    seller_is_official?: boolean;
    rating_avg?: number;
    rating_count?: number;
    sales_count?: number;
    has_coupon?: boolean;
    product_type?: 'physical' | 'digital' | null;
    is_following?: boolean;
    // Pre-fetched seller data to avoid N+1 queries
    seller?: {
        full_name?: string;
        nickname?: string;
        store_name?: string;
        is_official?: boolean;
        is_verified?: boolean;
        is_wholesaler?: boolean;
        is_manufacturer?: boolean;
    };
};

interface ListingCardProps {
    p: ListingPreview;
    badge?: React.ReactNode;
    mediaOverlay?: React.ReactNode;
    meta?: React.ReactNode;
    showDescription?: boolean;
    size?: 'fixed' | 'fluid';
    onLoginRequired?: () => void;
    className?: string;
    /** Override following status (if provided via props instead of p) */
    isFollowing?: boolean;
    /** Show IVA badge when tax system is active */
    taxEnabled?: boolean;
}

function formatMoney(value: number) {
    return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getPrice(value: number | string) {
    const n = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

export function ListingCard({ p, badge, mediaOverlay, meta, showDescription = false, size = 'fixed', onLoginRequired, className = '', isFollowing, taxEnabled }: ListingCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [sellerData, setSellerData] = useState<{
        name: string;
        isOfficial: boolean;
        isVerified: boolean;
        isWholesaler: boolean;
        isManufacturer: boolean;
        ratingAvg: number;
        ratingCount: number;
        salesCount: number;
        hasCoupon: boolean;
        discount?: number;
        originalPrice?: number;
    }>(() => {
        // 1. Prefer pre-fetched seller object (from Supabase join)
        if (p.seller) {
            const s = p.seller;
            const displayName =
                (s.store_name && s.store_name.trim()) ||
                (s.nickname && s.nickname.trim()) ||
                (s.full_name && s.full_name.trim()) ||
                'Vendedor';

            return {
                name: displayName,
                isOfficial: !!s.is_official,
                isVerified: !!s.is_verified,
                isWholesaler: !!s.is_wholesaler,
                isManufacturer: !!s.is_manufacturer,
                ratingAvg: p.rating_avg || 5,
                ratingCount: p.rating_count || 0,
                salesCount: p.sales_count || 0,
                hasCoupon: !!p.has_coupon,
                discount: 0,
                originalPrice: undefined
            };
        }

        // 2. Fallback to flat properties (legacy or partial data)
        return {
            name: p.seller_name || 'Vendedor',
            isOfficial: !!p.seller_is_official,
            isVerified: !!p.seller_is_official,
            isWholesaler: false,
            isManufacturer: false,
            ratingAvg: p.rating_avg || 5,
            ratingCount: p.rating_count || 0,
            salesCount: p.sales_count || 0,
            hasCoupon: !!p.has_coupon,
            discount: 0,
            originalPrice: undefined
        };
    });
    const [isAdding, setIsAdding] = useState(false);
    const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; expired: boolean } | null>(null);

    // Auction countdown timer
    useEffect(() => {
        if (p.sale_type !== 'auction' || !p.auction_end_at) return;
        const tick = () => {
            const now = Date.now();
            const end = new Date(p.auction_end_at!).getTime();
            const diff = end - now;
            if (diff <= 0) {
                setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
                return;
            }
            setCountdown({
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000),
                expired: false,
            });
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [p.sale_type, p.auction_end_at]);

    // Dynamic Seller Fetch if missing or generic
    useEffect(() => {
        // If we have pre-fetched seller data, we don't need to fetch again
        if (p.seller) return;

        const isGenericName = !p.seller_name ||
            p.seller_name.toLowerCase() === 'vendedor' ||
            p.seller_name.toUpperCase() === 'VENDEDOR' ||
            p.seller_name.trim() === '';

        if (isGenericName && p.seller_id) {
            // Fetch profile with progressive fallback for missing columns
            const fetchProfile = async () => {
                try {
                    // Try full query first (with store_name for official stores)
                    let res: any = await supabase.from('profiles')
                        .select('full_name, nickname, username, store_name, is_official, is_verified, is_wholesaler, is_manufacturer')
                        .eq('id', p.seller_id)
                        .single();

                    // Fallback: try without store_name / is_official / is_verified
                    if (res.error) {
                        const code = String(res.error?.code || '');
                        const msg = String(res.error?.message || '').toLowerCase();
                        if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
                            res = await supabase.from('profiles')
                                .select('full_name, nickname, username')
                                .eq('id', p.seller_id)
                                .single();
                        }
                    }

                    // Fallback: try with only full_name
                    if (res.error) {
                        const code = String(res.error?.code || '');
                        const msg = String(res.error?.message || '').toLowerCase();
                        if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
                            res = await supabase.from('profiles')
                                .select('full_name')
                                .eq('id', p.seller_id)
                                .single();
                        }
                    }

                    if (res.data) {
                        const data = res.data as any;
                        // Prefer store_name for official stores, then nickname, full_name, username
                        const displayName =
                            (data.store_name && String(data.store_name).trim()) ||
                            (data.nickname && String(data.nickname).trim()) ||
                            (data.full_name && String(data.full_name).trim()) ||
                            (data.username && String(data.username).trim()) ||
                            'Vendedor';
                        setSellerData(prev => ({
                            ...prev,
                            name: displayName,
                            isOfficial: !!(data.is_official),
                            isVerified: !!(data.is_verified),
                            isWholesaler: !!(data.is_wholesaler),
                            isManufacturer: !!(data.is_manufacturer)
                        }));
                    }
                } catch (err) {
                    console.error('[ListingCard] Error fetching seller profile:', err);
                }
            };
            fetchProfile();
        }
    }, [p.seller_id, p.seller_name]);

    const img = (p.images ?? []).filter(Boolean)[0] ?? null;
    const isAuction = p.sale_type === 'auction';
    const highestBid = typeof p.auction_highest_bid === 'number' ? p.auction_highest_bid : Number(p.auction_highest_bid ?? 0);
    const startingBid = typeof p.auction_starting_bid === 'number' ? p.auction_starting_bid : Number(p.auction_starting_bid ?? 0);
    const currentBid = highestBid > 0 ? highestBid : startingBid > 0 ? startingBid : getPrice(p.price);
    const price = isAuction ? currentBid : getPrice(p.price);

    const addToCart = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isAdding) return;
        setIsAdding(true);

        try {
            let token: string | undefined;
            const { data: { session } } = await supabase.auth.getSession();
            token = session?.access_token;
            if (!token) {
                const { data: refreshed } = await supabase.auth.refreshSession();
                token = refreshed.session?.access_token;
            }
            if (!token) {
                if (onLoginRequired) {
                    onLoginRequired();
                } else {
                    window.location.href = '/login';
                }
                return;
            }

            const res = await fetch('/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ listingId: p.id, quantity: 1 })
            });

            if (res.ok) {
                window.dispatchEvent(new CustomEvent('cart-updated'));
                alert('Agregado al carrito');
            } else {
                const err = await res.json();
                alert(err.error || 'Error al agregar');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsAdding(false);
        }
    };

    const hasDiscount = !!(sellerData?.discount && sellerData.discount > 0);

    const sizeClass = size === 'fluid' ? 'w-full' : 'w-[224px]';

    return (
        <div
            className={`group relative flex ${sizeClass} flex-shrink-0 flex-col rounded-2xl bg-white shadow-soft transition-all duration-500 overflow-hidden hover:shadow-2xl ring-1 ring-black/[0.03] ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Favorite heart — outside the Link so it doesn't navigate on click */}
            <FavoriteButton
                listingId={p.id}
                onLoginRequired={onLoginRequired}
                className={`absolute z-30 ${badge ? 'top-10 left-2' : 'top-2 left-2'}`}
            />
            {/* Click area for the product */}
            <Link href={`/listings/${p.id}`} className="flex h-full flex-col">
                {/* Image Section */}
                <div className="relative aspect-square overflow-hidden bg-gray-50 flex items-center justify-center p-2">
                    {img ? (
                        <div className="relative h-full w-full">
                            <Image
                                src={img}
                                alt={p.title}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-110"
                                draggable={false}
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">Sin imagen</div>
                    )}

                    {badge ? (
                        <div className="absolute left-2 top-2 z-20">
                            {badge}
                        </div>
                    ) : null}
                    {mediaOverlay ? mediaOverlay : null}

                    {/* Top Right Badges (Nuevo/Usado + IVA) */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                        {p.condition && (
                            <div className="rounded-full bg-[#E6F7ED] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#00A650] shadow-sm">
                                {p.condition === 'nuevo' ? 'Nuevo' : p.condition === 'usado' ? 'Usado' : 'Casi Nuevo'}
                            </div>
                        )}
                        {taxEnabled && p.condition && (
                            (p.condition === 'usado' || p.condition === 'casi_nuevo') ? (
                                <div className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200">
                                    Sin IVA
                                </div>
                            ) : (
                                <div className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 shadow-sm ring-1 ring-blue-200">
                                    IVA incluido
                                </div>
                            )
                        )}
                    </div>


                    {/* Auction Countdown Overlay — Premium */}
                    {isAuction && countdown && (
                        <div className="absolute bottom-0 inset-x-0 z-10">
                            {/* Gradient accent bar */}
                            <div className={`h-[3px] w-full ${countdown.expired ? 'bg-gray-500'
                                : countdown.days === 0 && countdown.hours < 1 ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse'
                                    : 'bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500'
                                }`} />
                            <div className="bg-gray-950/85 backdrop-blur-lg px-2 py-2">
                                {countdown.expired ? (
                                    <div className="flex items-center justify-center gap-1.5 text-gray-400">
                                        <Gavel size={12} />
                                        <span className="text-[11px] font-black uppercase tracking-widest">Subasta finalizada</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Flame size={13} className={`shrink-0 ${countdown.days === 0 && countdown.hours < 1 ? 'text-red-400 animate-pulse' : 'text-orange-400'
                                            }`} />
                                        <div className="flex items-center gap-[3px]">
                                            {countdown.days > 0 && (
                                                <>
                                                    <div className="flex flex-col items-center">
                                                        <span className="bg-orange-500/20 rounded px-1.5 py-0.5 text-[12px] font-black text-orange-300 tabular-nums leading-none">
                                                            {String(countdown.days).padStart(2, '0')}
                                                        </span>
                                                        <span className="text-[7px] text-gray-400 font-bold uppercase mt-0.5">Días</span>
                                                    </div>
                                                    <span className="text-orange-400/40 text-[10px] font-black pb-2.5">:</span>
                                                </>
                                            )}
                                            <div className="flex flex-col items-center">
                                                <span className="bg-orange-500/20 rounded px-1.5 py-0.5 text-[12px] font-black text-orange-300 tabular-nums leading-none">
                                                    {String(countdown.hours).padStart(2, '0')}
                                                </span>
                                                <span className="text-[7px] text-gray-400 font-bold uppercase mt-0.5">Hrs</span>
                                            </div>
                                            <span className="text-orange-400/40 text-[10px] font-black pb-2.5">:</span>
                                            <div className="flex flex-col items-center">
                                                <span className="bg-orange-500/20 rounded px-1.5 py-0.5 text-[12px] font-black text-orange-300 tabular-nums leading-none">
                                                    {String(countdown.minutes).padStart(2, '0')}
                                                </span>
                                                <span className="text-[7px] text-gray-400 font-bold uppercase mt-0.5">Min</span>
                                            </div>
                                            <span className="text-orange-400/40 text-[10px] font-black pb-2.5">:</span>
                                            <div className="flex flex-col items-center">
                                                <span className={`rounded px-1.5 py-0.5 text-[12px] font-black tabular-nums leading-none ${countdown.days === 0 && countdown.hours < 1
                                                    ? 'bg-red-500/30 text-red-300'
                                                    : 'bg-orange-500/20 text-orange-300'
                                                    }`}>
                                                    {String(countdown.seconds).padStart(2, '0')}
                                                </span>
                                                <span className="text-[7px] text-gray-400 font-bold uppercase mt-0.5">Seg</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Cart Button Overlay */}
                    <div className={`absolute inset-x-0 bottom-0 p-3 z-20 translate-y-full transition-transform duration-500 ease-out ${isHovered ? 'translate-y-0' : 'translate-y-full'}`}>
                        <button
                            onClick={addToCart}
                            disabled={isAdding}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-emerald py-2.5 text-xs font-black text-white shadow-xl hover:bg-brand-emerald/90 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isAdding ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <ShoppingBag size={14} />
                                    Agregar al carrito
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-1 flex-col p-4 pt-3">
                    {/* Oferta Imperdible Banner */}
                    {hasDiscount && (
                        <div className="mb-2 inline-flex items-center gap-1.5 overflow-hidden rounded bg-[#3483FA] px-2 py-1 text-white shadow-sm self-start">
                            <Star size={10} className="fill-white text-white" />
                            <span className="text-[10px] font-black uppercase tracking-tight">Oferta Imperdible</span>
                        </div>
                    )}

                    {/* Product Title */}
                    <h3 className="line-clamp-2 text-[15px] font-normal leading-[#1.25] text-[#333333] mb-1">
                        {p.title}
                    </h3>
                    {showDescription && p.description ? (
                        <div className="mt-1 line-clamp-2 text-xs text-gray-600">{p.description}</div>
                    ) : null}
                    {meta ? (
                        <div className="mt-2">{meta}</div>
                    ) : null}

                    {/* Stock + Sold Count */}
                    <div className="flex items-center gap-2 mb-2">
                        {typeof (p as any).stock === 'number' ? (
                            <span className={`text-[12px] font-semibold ${(p as any).stock > 5 ? 'text-[#00A650]' :
                                (p as any).stock > 0 ? 'text-orange-600' :
                                    'text-red-500'
                                }`}>
                                {(p as any).stock > 0 ? `Stock: ${(p as any).stock}` : 'Agotado'}
                            </span>
                        ) : (
                            <span className="text-[12px] font-semibold text-[#00A650]">Disponible</span>
                        )}
                        <span className="text-[11px] text-gray-400">·</span>
                        <span className="text-[12px] font-normal text-gray-500">
                            {sellerData?.salesCount || p.sales_count || 0} vendidos
                        </span>
                    </div>

                    {/* Seller Badges: Mayorista / Fabricante */}
                    {(sellerData?.isWholesaler || sellerData?.isManufacturer) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {sellerData.isManufacturer && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-pink-600 to-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                                    🏭 Fabricante
                                </span>
                            )}
                            {sellerData.isWholesaler && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                                    🏪 Mayorista
                                </span>
                            )}
                        </div>
                    )}

                    {/* Follow Seller Button */}
                    {p.seller_id && (
                        <div className="mb-2">
                            <FollowButton
                                sellerId={p.seller_id}
                                compact
                                onLoginRequired={onLoginRequired}
                                initialFollowing={isFollowing ?? p.is_following}
                            />
                        </div>
                    )}

                    {/* Price Section */}
                    <div className="flex flex-col mb-2">
                        {/* Original Price */}
                        {hasDiscount && sellerData?.originalPrice && (
                            <span className="text-[12px] text-gray-400 line-through">
                                $ {Math.floor(sellerData.originalPrice).toLocaleString('es-MX')}
                            </span>
                        )}

                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-start gap-2">
                                <div className="flex items-start">
                                    <span className="text-[24px] font-normal text-[#333333] leading-none">$ </span>
                                    <span className="text-[24px] font-normal text-[#333333] leading-none">
                                        {Math.floor(price).toLocaleString('es-MX')}
                                    </span>
                                    <span className="text-[12px] font-normal text-[#333333] pt-0.5 ml-0.5 leading-none">
                                        {(price % 1).toFixed(2).split('.')[1]}
                                    </span>
                                </div>

                                {hasDiscount && (
                                    <span className="text-[14px] font-normal text-[#00A650] pt-1">
                                        {sellerData.discount}% OFF
                                    </span>
                                )}
                            </div>

                            {/* Orange Add-to-Cart Button (Temu style) */}
                            {!isAuction && (
                                <button
                                    type="button"
                                    onClick={addToCart}
                                    disabled={isAdding || (typeof (p as any).stock === 'number' && (p as any).stock <= 0)}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-mango text-white shadow-md shadow-brand-mango/30 transition-all hover:opacity-90 hover:scale-110 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed relative z-30"
                                    aria-label="Agregar al carrito"
                                    title="Agregar al carrito"
                                >
                                    <ShoppingBag size={16} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Auction badge below price */}
                    {isAuction && (
                        <div className="mb-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-md shadow-amber-500/25 tracking-wide">
                                <Gavel size={11} />
                                Subasta activa
                            </span>
                        </div>
                    )}

                    {/* Tags Section */}
                    <div className="flex flex-col gap-1">
                        {(p as any).product_type === 'digital' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200 self-start">
                                💎 PRODUCTO DIGITAL
                            </span>
                        ) : (
                            <>
                                {p.free_shipping && (
                                    <span className="text-[14px] font-bold text-[#00A650]">
                                        Envío gratis
                                    </span>
                                )}
                            </>
                        )}
                        {(sellerData?.hasCoupon || p.has_coupon) && (
                            <div className="text-[11px] font-black uppercase text-brand-emerald">
                                <span className="bg-brand-emerald/10 px-1 py-0.5 rounded">Cupón disponible</span>
                            </div>
                        )}
                    </div>

                    {/* Footer / Ratings */}
                    <div className="mt-auto pt-3 flex items-center gap-1.5 opacity-60">
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                    key={s}
                                    size={10}
                                    className={`${s <= Math.round(sellerData?.ratingAvg || 5)
                                        ? "text-[#3483FA] fill-[#3483FA]"
                                        : "text-gray-200"
                                        }`}
                                />
                            ))}
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400">
                            {sellerData?.ratingCount || 0}
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    );
}
