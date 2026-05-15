'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type Banner = {
    id: string;
    image_url: string;
    cta_href: string;
    cta_text: string;
    title: string;
    image_fit?: string;
    image_position?: string;
};

export function SidebarBanner() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBanners() {
            try {
                const { data, error } = await supabase
                    .from('home_banners')
                    .select('id, image_url, cta_href, cta_text, title, image_fit, image_position')
                    .eq('placement', 'listing_sidebar')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (!error && data) {
                    setBanners(data);
                }
            } catch (err) {
                console.error('Error fetching sidebar banners:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchBanners();
    }, []);

    if (loading || banners.length === 0) return null;

    return (
        <div className="space-y-4">
            {banners.map((banner) => (
                <Link
                    key={banner.id}
                    href={banner.cta_href}
                    className="group block overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm ring-1 ring-black/5 transition-transform hover:scale-[1.01]"
                >
                    <div className="relative aspect-[4/5] bg-gray-100">
                        <Image
                            src={banner.image_url}
                            alt={banner.title || 'Publicidad'}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 300px"
                            style={{
                                objectFit: (banner.image_fit as any) || 'cover',
                                objectPosition: (banner.image_position as any) || 'center',
                            }}
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
                        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-500 shadow-sm backdrop-blur-sm z-10">
                            Ad
                        </div>
                    </div>
                    {banner.cta_text && (
                        <div className="p-4 border-t border-black/5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-gray-900 line-clamp-1">{banner.title || 'Promo especial'}</span>
                                <span className="text-xs font-bold text-brand-orange shrink-0">{banner.cta_text} →</span>
                            </div>
                        </div>
                    )}
                </Link>
            ))}
        </div>
    );
}
