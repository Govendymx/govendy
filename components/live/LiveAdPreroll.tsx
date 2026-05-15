'use client';

import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { AdCampaign } from './LiveAdOverlay';

// ─── Pre-roll / Mid-roll Video Ad — interrumpe el live con audio ──────────────
export function LiveAdPreroll({
    ad,
    onComplete,
    onImpression,
    onClick,
    isPreroll = true,
}: {
    ad: AdCampaign;
    onComplete: () => void;
    onImpression: (id: string) => void;
    onClick: (id: string) => void;
    isPreroll?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [countdown, setCountdown] = useState(ad.duration_secs);
    const [canSkip, setCanSkip] = useState(false);
    const [muted, setMuted] = useState(false); // ← Audio ON por defecto
    const [started, setStarted] = useState(false);

    useEffect(() => {
        onImpression(ad.id);

        // Enable skip after 5 seconds (or less if ad is short)
        const skipAfter = Math.min(5, ad.duration_secs);
        const skipTimer = setTimeout(() => setCanSkip(true), skipAfter * 1000);

        // Auto-complete after duration
        const autoComplete = setTimeout(onComplete, ad.duration_secs * 1000);

        // Countdown
        const interval = setInterval(() => {
            setCountdown(c => Math.max(0, c - 1));
        }, 1000);

        return () => {
            clearTimeout(skipTimer);
            clearTimeout(autoComplete);
            clearInterval(interval);
        };
    }, [ad.id]);

    // Intentar reproducir con audio, si el navegador lo bloquea, reproducir muted
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !ad.content_url) return;

        // Primer intento: con audio
        video.muted = false;
        video.volume = 1.0;
        video.play()
            .then(() => {
                setStarted(true);
                setMuted(false);
            })
            .catch(() => {
                // Si el navegador bloquea autoplay con audio, intentar muted
                video.muted = true;
                video.play()
                    .then(() => {
                        setStarted(true);
                        setMuted(true);
                    })
                    .catch(() => { });
            });
    }, [ad.content_url]);

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        const newMuted = !muted;
        video.muted = newMuted;
        if (!newMuted) video.volume = 1.0;
        setMuted(newMuted);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
            {/* Video/Image */}
            <div className="relative w-full h-full">
                {ad.content_url?.match(/\.(mp4|webm|mov)/i) ? (
                    <video
                        ref={videoRef}
                        src={ad.content_url}
                        muted={false}
                        playsInline
                        className="w-full h-full object-contain"
                        onClick={() => { if (ad.target_url) { onClick(ad.id); window.open(ad.target_url, '_blank'); } }}
                    />
                ) : ad.content_url ? (
                    <img
                        src={ad.content_url}
                        alt={ad.title}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => { if (ad.target_url) { onClick(ad.id); window.open(ad.target_url, '_blank'); } }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900 to-black">
                        <div className="text-center px-6">
                            <div className="text-2xl font-black text-white mb-2">{ad.title}</div>
                            {ad.subtitle && <div className="text-sm text-gray-300">{ad.subtitle}</div>}
                            {ad.target_url && (
                                <a
                                    href={ad.target_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => onClick(ad.id)}
                                    className="inline-block mt-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 transition-colors"
                                >
                                    {ad.cta_text || 'Ver más'}
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Top bar */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    {/* Ad label */}
                    <div className="flex items-center gap-2">
                        <span className="rounded-md bg-yellow-500/90 text-black text-[10px] font-bold px-2 py-0.5 animate-pulse">
                            ANUNCIO
                        </span>
                        <span className="text-white/80 text-xs font-medium">
                            {ad.advertiser_name} · Volvemos en {countdown}s
                        </span>
                    </div>

                    {/* Mute toggle (for video) */}
                    {ad.content_url?.match(/\.(mp4|webm|mov)/i) && (
                        <button
                            onClick={toggleMute}
                            className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        >
                            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                    )}

                    {/* Tap to unmute hint when forced muted */}
                    {muted && started && ad.content_url?.match(/\.(mp4|webm|mov)/i) && (
                        <button
                            onClick={toggleMute}
                            className="absolute top-12 right-0 flex items-center gap-1.5 bg-white/90 text-black text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg animate-bounce"
                        >
                            <VolumeX className="w-3.5 h-3.5" /> Toca para activar audio
                        </button>
                    )}
                </div>

                {/* Bottom bar — skip & countdown */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    {canSkip ? (
                        <button
                            onClick={onComplete}
                            className="rounded-lg bg-white/90 hover:bg-white text-black text-xs font-bold px-4 py-2 shadow-lg transition-all hover:scale-105"
                        >
                            Omitir ▸
                        </button>
                    ) : (
                        <div className="rounded-lg bg-black/60 text-white/80 text-xs font-semibold px-3 py-1.5">
                            Puedes omitir en {Math.min(5, countdown)}s
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div
                        className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                        style={{ width: `${((ad.duration_secs - countdown) / ad.duration_secs) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
