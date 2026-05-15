'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, Gift } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

type OfficialStore = {
    id: string;
    avatar_url: string | null;
    store_logo_url: string | null;
    official_store_name: string | null;
    official_store_brand_color: string | null;
    official_store_banner_url: string | null;
    official_store_slogan: string | null;
};

export function OfficialStoresCarousel() {
    const [stores, setStores] = useState<OfficialStore[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchStores() {
            try {
                const res = await fetch('/api/official-stores');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setStores(data);
                }
            } catch (err) {
                console.error('Error fetching official stores for carousel:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStores();
    }, []);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollTo = direction === 'left' ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2;
            scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    if (loading) return null;

    return (
        <section className="mb-10 overflow-hidden px-1">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold text-gray-900 px-2 flex items-center gap-2">
                    Tiendas Oficiales
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Verificadas
                    </span>
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                    >
                        <ChevronLeft size={16} className="text-gray-600" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                    >
                        <ChevronRight size={16} className="text-gray-600" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* Gift Card Store — siempre aparece primero */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative h-64 w-60 flex-shrink-0 snap-start overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition-all hover:shadow-xl hover:-translate-y-1"
                >
                    <Link href="/gift-cards" className="block h-full">
                        {/* Banner Area — gradient */}
                        <div className="h-28 w-full relative overflow-hidden bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600">
                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                <span className="text-[80px]">🎁</span>
                            </div>
                        </div>

                        {/* Logo — Gift icon */}
                        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
                            <div className="h-20 w-20 overflow-hidden rounded-full bg-white p-1 shadow-lg ring-4 ring-white">
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-pink-600 text-3xl">
                                    🎁
                                </div>
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="flex flex-col items-center justify-center px-4 pt-8 text-center">
                            <div className="flex items-center gap-1.5 mb-1">
                                <h3 className="text-sm font-extrabold text-gray-900 group-hover:text-orange-600 transition-colors truncate max-w-[160px]">
                                    PocketCash Gift Cards
                                </h3>
                                <CheckCircle size={14} className="text-orange-500 fill-orange-500/10" />
                            </div>

                            <p className="text-[11px] font-medium text-gray-500 line-clamp-2 min-h-[32px]">
                                Regala saldo PocketCash a quien quieras
                            </p>

                            <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 group-hover:underline">
                                Comprar Gift Card
                                <ChevronRight size={12} />
                            </div>
                        </div>
                    </Link>
                </motion.div>

                {stores.map((store) => (
                    <motion.div
                        key={store.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="group relative h-64 w-60 flex-shrink-0 snap-start overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition-all hover:shadow-xl hover:-translate-y-1"
                    >
                        <Link href={`/tienda/${store.id}`} className="block h-full">
                            {/* Banner Area */}
                            <div className="h-28 w-full bg-gray-100 relative overflow-hidden">
                                {store.official_store_banner_url ? (
                                    <Image
                                        src={store.official_store_banner_url}
                                        alt={store.official_store_name || ''}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        sizes="240px"
                                        priority={false}
                                    />
                                ) : (
                                    <div
                                        className="h-full w-full opacity-20"
                                        style={{ backgroundColor: store.official_store_brand_color || '#ec4899' }}
                                    />
                                )}
                            </div>

                            {/* Logo (Avatar) */}
                            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
                                <div className="h-20 w-20 overflow-hidden rounded-full bg-white p-1 shadow-lg ring-4 ring-white">
                                    {(store.store_logo_url || store.avatar_url) ? (
                                        <Image
                                            src={store.store_logo_url || store.avatar_url || ''}
                                            alt={store.official_store_name || ''}
                                            width={80}
                                            height={80}
                                            className="rounded-full object-cover"
                                            sizes="80px"
                                        />
                                    ) : (
                                        <div
                                            className="flex h-full w-full items-center justify-center rounded-full text-xl font-black text-white"
                                            style={{ backgroundColor: store.official_store_brand_color || '#ec4899' }}
                                        >
                                            {store.official_store_name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Text Content */}
                            <div className="flex flex-col items-center justify-center px-4 pt-8 text-center">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <h3 className="text-sm font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors truncate max-w-[140px]">
                                        {store.official_store_name}
                                    </h3>
                                    <CheckCircle size={14} className="text-blue-500 fill-blue-500/10" />
                                </div>

                                <p className="text-[11px] font-medium text-gray-500 line-clamp-2 min-h-[32px]">
                                    {store.official_store_slogan || 'Productos oficiales y garantizados'}
                                </p>

                                <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 group-hover:underline">
                                    Ver tienda
                                    <ChevronRight size={12} />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
