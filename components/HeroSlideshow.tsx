'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface Banner {
    id: string;
    image_url: string;
    title: string | null;
    subtitle: string | null;
    cta_text: string | null;
    cta_href: string | null;
    sort_order: number;
}

export default function HeroSlideshow() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        const fetchBanners = async () => {
            // Usar la tabla existente home_banners con placement='hero'
            const { data, error } = await supabase
                .from('home_banners')
                .select('id, image_url, title, subtitle, cta_text, cta_href, sort_order')
                .eq('is_active', true)
                .eq('placement', 'hero')
                .order('sort_order', { ascending: true });

            if (!error && data) {
                setBanners(data as Banner[]);
            }
            setIsLoading(false);
        };

        fetchBanners();
    }, []);

    // Auto-advance slideshow
    useEffect(() => {
        if (banners.length <= 1 || isHovered) return;

        const interval = setInterval(() => {
            goToNext();
        }, 5000);

        return () => clearInterval(interval);
    }, [banners.length, isHovered, currentIndex]);

    const goToSlide = (index: number) => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex(index);
        setTimeout(() => setIsTransitioning(false), 500);
    };

    const goToPrevious = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
        setTimeout(() => setIsTransitioning(false), 500);
    };

    const goToNext = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex((prev) => (prev + 1) % banners.length);
        setTimeout(() => setIsTransitioning(false), 500);
    };

    if (isLoading) {
        return (
            <div className="relative h-[400px] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-pink-100 to-white shadow-sm ring-1 ring-black/5 animate-pulse" />
        );
    }

    if (banners.length === 0) {
        return null;
    }

    return (
        <div
            className="relative h-[400px] w-full overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/5"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Slides Container - Estilo MercadoLibre */}
            <div
                className="flex h-full transition-transform duration-500 ease-out"
                style={{
                    transform: `translateX(-${currentIndex * 100}%)`,
                }}
            >
                {banners.map((banner) => (
                    <div
                        key={banner.id}
                        className="relative h-full w-full flex-shrink-0"
                    >
                        {/* Background Image */}
                        <div className="absolute inset-0">
                            <img
                                src={banner.image_url}
                                alt={banner.title || 'Banner'}
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 flex h-full items-center">
                            <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
                                <div className="max-w-2xl space-y-4">
                                    {banner.title && (
                                        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl drop-shadow-lg animate-fade-in">
                                            {banner.title}
                                        </h2>
                                    )}
                                    {banner.subtitle && (
                                        <p className="text-base font-medium text-white/90 sm:text-lg drop-shadow-md animate-fade-in-delay">
                                            {banner.subtitle}
                                        </p>
                                    )}
                                    {banner.cta_text && banner.cta_href && (
                                        <div className="pt-2 animate-fade-in-delay-2">
                                            <Link
                                                href={banner.cta_href}
                                                className="inline-flex items-center gap-2 rounded-xl bg-brand-emerald px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:opacity-90"
                                            >
                                                {banner.cta_text}
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Arrows - Estilo MercadoLibre */}
            {banners.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={goToPrevious}
                        disabled={isTransitioning}
                        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-gray-900 shadow-xl backdrop-blur transition-all hover:bg-white hover:scale-110 disabled:opacity-50"
                        aria-label="Anterior"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={goToNext}
                        disabled={isTransitioning}
                        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-2.5 text-gray-900 shadow-xl backdrop-blur transition-all hover:bg-white hover:scale-110 disabled:opacity-50"
                        aria-label="Siguiente"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Dots Indicators - Estilo MercadoLibre */}
            {banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-3 py-2 backdrop-blur-sm">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => goToSlide(index)}
                            disabled={isTransitioning}
                            className={`h-2 rounded-full transition-all ${index === currentIndex
                                    ? 'w-6 bg-white'
                                    : 'w-2 bg-white/60 hover:bg-white/80'
                                }`}
                            aria-label={`Ir al slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
