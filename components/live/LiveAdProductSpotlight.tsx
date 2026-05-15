'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import type { AdCampaign } from './LiveAdOverlay';

// ─── Product Spotlight Popup ──────────────────────────────────────────────────
export function LiveAdProductSpotlight({
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
        const t = setTimeout(() => setVisible(true), 100);
        onImpression(ad.id);

        // Auto-close after duration
        const autoClose = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 500);
        }, ad.duration_secs * 1000);

        return () => { clearTimeout(t); clearTimeout(autoClose); };
    }, [ad.id]);

    return (
        <div
            className={`absolute top-4 right-4 z-30 transition-all duration-500 ${visible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-4 opacity-0 scale-95'
                }`}
        >
            <div className="w-56 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
                {/* Image */}
                {ad.content_url && (
                    <div className="relative">
                        <img
                            src={ad.content_url}
                            alt={ad.title}
                            className="w-full h-32 object-cover"
                        />
                        <span className="absolute top-2 left-2 rounded-md bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 flex items-center gap-1">
                            <ShoppingBag className="w-2.5 h-2.5" /> DESTACADO
                        </span>
                    </div>
                )}

                {/* Content */}
                <div className="p-3">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        {ad.advertiser_name}
                    </div>
                    <div className="text-sm font-bold text-gray-900 line-clamp-2">{ad.title}</div>
                    {ad.subtitle && (
                        <div className="text-xs text-gray-500 mt-0.5">{ad.subtitle}</div>
                    )}

                    {ad.target_url ? (
                        <a
                            href={ad.target_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onClick(ad.id)}
                            className="mt-2 w-full block text-center rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 transition-colors"
                        >
                            {ad.cta_text || 'Ver producto →'}
                        </a>
                    ) : null}
                </div>

                {/* Close */}
                <button
                    onClick={() => { setVisible(false); setTimeout(onClose, 400); }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
