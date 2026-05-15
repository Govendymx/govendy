'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Volume2, VolumeX } from 'lucide-react';

interface HLSPlayerProps {
    src: string;
    className?: string;
    autoPlay?: boolean;
    muted?: boolean;
    onError?: (error: string) => void;
    onPlaying?: () => void;
    onWaiting?: () => void;
}

interface QualityLevel {
    index: number;
    height: number;
    width: number;
    bitrate: number;
    label: string;
}

/**
 * HLS Player — reproductor estilo YouTube con selector de calidad.
 * Soporta múltiples resoluciones (720p, 480p, 360p) con cambio dinámico.
 */
export default function HLSPlayer({
    src,
    className = '',
    autoPlay = true,
    muted = true,
    onError,
    onPlaying,
    onWaiting,
}: HLSPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [status, setStatus] = useState<'loading' | 'playing' | 'error' | 'waiting'>('loading');
    const [qualities, setQualities] = useState<QualityLevel[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
    const [showControls, setShowControls] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [isMuted, setIsMuted] = useState(muted);
    const [volume, setVolume] = useState(0.8);
    const retryCount = useRef(0);
    const maxRetries = 30;
    const hideTimer = useRef<NodeJS.Timeout | null>(null);

    // Auto-hide controls
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            setShowControls(false);
            setShowQualityMenu(false);
        }, 4000);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        console.log('[HLS] Init effect, src:', src, 'video:', !!video);
        if (!video || !src) return;

        const destroy = () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };

        const startHls = () => {
            destroy();
            console.log('[HLS] Hls.isSupported():', Hls.isSupported());
            if (Hls.isSupported()) {
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 30,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    liveSyncDurationCount: 3,
                    liveMaxLatencyDurationCount: 10,
                    liveDurationInfinity: true,
                    fragLoadingMaxRetry: 10,
                    manifestLoadingMaxRetry: 10,
                    levelLoadingMaxRetry: 10,
                    fragLoadingRetryDelay: 500,
                    manifestLoadingRetryDelay: 500,
                });

                console.log('[HLS] Loading source:', src);
                hls.loadSource(src);
                hls.attachMedia(video);

                // Extract quality levels when manifest is parsed
                hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                    console.log('[HLS] Manifest parsed! Levels:', data.levels.length);
                    setStatus('playing');
                    retryCount.current = 0;

                    // Build quality options
                    const levels: QualityLevel[] = data.levels.map((level, index) => ({
                        index,
                        height: level.height,
                        width: level.width,
                        bitrate: level.bitrate,
                        label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}k`,
                    }));
                    // Sort by resolution descending
                    levels.sort((a, b) => b.height - a.height);
                    setQualities(levels);

                    if (autoPlay) {
                        video.play().catch(() => { });
                    }
                });

                // Track quality changes
                hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                    // Only update if in auto mode
                    if (hls.autoLevelEnabled) {
                        setCurrentQuality(-1);
                    }
                });

                hls.on(Hls.Events.ERROR, (_event, data) => {
                    console.error('[HLS] Error:', data.type, data.details, 'fatal:', data.fatal, 'url:', data.url || '');
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                if (retryCount.current < maxRetries) {
                                    retryCount.current++;
                                    setStatus('waiting');
                                    setTimeout(() => { hls.loadSource(src); }, 3000);
                                } else {
                                    setStatus('error');
                                    onError?.('No se pudo conectar al stream');
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                setStatus('error');
                                onError?.('Error de reproducción');
                                break;
                        }
                    }
                });

                hlsRef.current = hls;
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari — native HLS (no quality selector available)
                video.src = src;
                video.addEventListener('loadedmetadata', () => {
                    setStatus('playing');
                    if (autoPlay) video.play().catch(() => { });
                });
                video.addEventListener('error', () => {
                    if (retryCount.current < maxRetries) {
                        retryCount.current++;
                        setStatus('waiting');
                        setTimeout(() => { video.src = src; }, 3000);
                    } else {
                        setStatus('error');
                        onError?.('Error de reproducción');
                    }
                });
            } else {
                setStatus('error');
                onError?.('Tu navegador no soporta HLS');
            }
        };

        startHls();
        return destroy;
    }, [src, autoPlay]);

    // Playing/waiting events
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const handlePlaying = () => { setStatus('playing'); onPlaying?.(); };
        const handleWaiting = () => { setStatus('waiting'); onWaiting?.(); };
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('waiting', handleWaiting);
        return () => {
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('waiting', handleWaiting);
        };
    }, [onPlaying, onWaiting]);

    // Change quality
    const changeQuality = useCallback((levelIndex: number) => {
        const hls = hlsRef.current;
        if (!hls) return;
        if (levelIndex === -1) {
            hls.currentLevel = -1; // Auto
            hls.nextLevel = -1;
        } else {
            hls.currentLevel = levelIndex;
            hls.nextLevel = levelIndex;
        }
        setCurrentQuality(levelIndex);
        setShowQualityMenu(false);
    }, []);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
            if (!videoRef.current.muted) videoRef.current.volume = volume;
        }
    }, [volume]);

    const handleVolumeChange = useCallback((val: number) => {
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            if (val === 0) { videoRef.current.muted = true; setIsMuted(true); }
            else if (videoRef.current.muted) { videoRef.current.muted = false; setIsMuted(false); }
        }
    }, []);

    // Get current quality label
    const getCurrentLabel = () => {
        if (currentQuality === -1) {
            const hls = hlsRef.current;
            if (hls && hls.currentLevel >= 0 && qualities.length > 0) {
                const level = qualities.find(q => q.index === hls.currentLevel);
                return `Auto (${level?.label || '...'})`;
            }
            return 'Auto';
        }
        return qualities.find(q => q.index === currentQuality)?.label || '';
    };

    return (
        <div
            className={`relative w-full h-full bg-black ${className}`}
            onClick={showControlsTemporarily}
            onMouseMove={showControlsTemporarily}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay={autoPlay}
                muted={isMuted}
                playsInline
                controls={false}
            />

            {/* Buffering spinner */}
            {status === 'waiting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
                </div>
            )}

            {/* Loading state */}
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 pointer-events-none">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-red-400 border-t-transparent" />
                    <p className="text-white/70 text-xs">Conectando al stream...</p>
                </div>
            )}

            {/* ─── GoVendy logo watermark ─── */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none opacity-60">
                <img src="/logo.png" alt="GoVendy" className="w-8 h-8 object-contain drop-shadow-lg" />
            </div>

            {/* ─── ALWAYS-VISIBLE SPEAKER BUTTON (when muted) ─── */}
            {status === 'playing' && isMuted && (
                <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-2 bg-black/70 backdrop-blur-md text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-2xl ring-1 ring-white/20 hover:bg-black/90 active:scale-95 transition-all animate-pulse"
                >
                    <VolumeX className="w-5 h-5" />
                    Toca para escuchar
                </button>
            )}

            {/* ─── BOTTOM CONTROLS BAR ─── */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 transition-opacity duration-300 ${showControls || status !== 'playing' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center justify-end gap-2">
                    {/* Volume control */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                            className="flex items-center text-white p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                        >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={isMuted ? 0 : volume}
                            onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-16 h-1 accent-red-500 cursor-pointer"
                        />
                    </div>

                    {/* Quality selector */}
                    {qualities.length > 1 && (
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowQualityMenu(v => !v); }}
                                className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                            >
                                ⚙️ {getCurrentLabel()}
                            </button>

                            {/* Quality menu */}
                            {showQualityMenu && (
                                <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-xl overflow-hidden shadow-xl ring-1 ring-white/20 min-w-[140px] z-50">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); changeQuality(-1); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${currentQuality === -1
                                            ? 'bg-red-600 text-white'
                                            : 'text-white/80 hover:bg-white/10'
                                            }`}
                                    >
                                        Auto
                                    </button>
                                    {qualities.map((q) => (
                                        <button
                                            key={q.index}
                                            onClick={(e) => { e.stopPropagation(); changeQuality(q.index); }}
                                            className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${currentQuality === q.index
                                                ? 'bg-red-600 text-white'
                                                : 'text-white/80 hover:bg-white/10'
                                                }`}
                                        >
                                            {q.label}
                                            <span className="text-white/40 text-xs ml-2">{Math.round(q.bitrate / 1000)}k</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
