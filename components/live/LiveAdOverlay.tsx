'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type AdCampaign = {
    id: string;
    type: 'overlay' | 'video' | 'product_spotlight';
    title: string;
    subtitle?: string | null;
    content_url?: string | null;
    target_url?: string | null;
    cta_text?: string | null;
    duration_secs: number;
    frequency_mins: number;
    advertiser_name: string;
    priority: number;
};

// ─── Overlay Banner (lower third) ─────────────────────────────────────────────
export function LiveAdOverlay({
    ad,
    onClose,
    onImpression,
    onClick,
}: {
    ad: AdCampaign;
    onClose: () => void;
    onImpression: (id: string) => void;
    onClick: (id: string) => void;
}) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Slide in
        const t = setTimeout(() => setVisible(true), 100);
        onImpression(ad.id);

        // Auto-close after duration
        const autoClose = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 500); // wait for animation
        }, ad.duration_secs * 1000);

        return () => { clearTimeout(t); clearTimeout(autoClose); };
    }, [ad.id]);

    return (
        <div
            className={`absolute bottom-16 left-3 right-3 z-30 transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}
        >
            <div className="relative rounded-xl bg-black/80 backdrop-blur-md ring-1 ring-white/10 p-3 flex items-center gap-3 shadow-2xl">
                {/* Ad image */}
                {ad.content_url && (
                    <img
                        src={ad.content_url}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                )}

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        {ad.advertiser_name} · Anuncio
                    </div>
                    <div className="text-sm font-bold text-white truncate">{ad.title}</div>
                    {ad.subtitle && (
                        <div className="text-xs text-gray-300 truncate">{ad.subtitle}</div>
                    )}
                </div>

                {/* CTA */}
                {ad.target_url && (
                    <a
                        href={ad.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.stopPropagation(); onClick(ad.id); }}
                        className="shrink-0 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 transition-colors"
                    >
                        {ad.cta_text || 'Ver más'}
                    </a>
                )}

                {/* Close */}
                <button
                    onClick={(e) => { e.stopPropagation(); setVisible(false); setTimeout(onClose, 400); }}
                    className="shrink-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
