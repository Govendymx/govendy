'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import {
    Radio, Video, VideoOff, Users, Clock,
    ShoppingBag, Crown, AlertTriangle, Eye, Mic, MicOff,
    Copy, Check, Monitor, Globe, ExternalLink, RotateCcw,
    Store, ChevronLeft, ChevronRight, Zap, Timer
} from 'lucide-react';
import {
    LiveKitRoom,
    useTracks,
    VideoTrack,
    useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

// Paquetes de horas (debe coincidir con /api/live/hours/route.ts)
const LIVE_PACKAGES = [
    { id: 'h1', hours: 1, minutes: 60, price_mxn: 59 },
    { id: 'h2', hours: 2, minutes: 120, price_mxn: 109 },
    { id: 'h3', hours: 3, minutes: 180, price_mxn: 149 },
    { id: 'h4', hours: 4, minutes: 240, price_mxn: 179 },
    { id: 'h5', hours: 5, minutes: 300, price_mxn: 199 },
    { id: 'h10', hours: 10, minutes: 600, price_mxn: 349 },
    { id: 'h15', hours: 15, minutes: 900, price_mxn: 479 },
    { id: 'h20', hours: 20, minutes: 1200, price_mxn: 599 },
    { id: 'h25', hours: 25, minutes: 1500, price_mxn: 729 },
    { id: 'h30', hours: 30, minutes: 1800, price_mxn: 849 },
    { id: 'h35', hours: 35, minutes: 2100, price_mxn: 969 },
    { id: 'h40', hours: 40, minutes: 2400, price_mxn: 1079 },
    { id: 'h50', hours: 50, minutes: 3000, price_mxn: 1299 },
    { id: 'h100', hours: 100, minutes: 6000, price_mxn: 2299 },
];

function fmtMins(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m > 0 ? m + 'm' : ''}`;
}

function fmtDuration(startedAt?: string, endedAt?: string) {
    if (!startedAt) return '—';
    const end = endedAt ? new Date(endedAt) : new Date();
    const mins = Math.round((end.getTime() - new Date(startedAt).getTime()) / 60000);
    return fmtMins(Math.max(0, mins));
}

// ─── Banner component for live dashboard (premium animations) ─────────────────
function LiveDashboardBanner() {
    const [banners, setBanners] = useState<Array<{ id: string; image_url: string; cta_href: string; title: string; subtitle: string; cta_text: string }>>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [prevIndex, setPrevIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        supabase
            .from('home_banners')
            .select('id,image_url,cta_href,title,subtitle,cta_text')
            .eq('placement', 'live_dashboard')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .then(({ data }) => {
                if (data && data.length > 0) setBanners(data);
            });
    }, []);

    useEffect(() => {
        if (banners.length <= 1) return;
        const iv = setInterval(() => {
            setPrevIndex(currentIndex);
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentIndex(i => (i + 1) % banners.length);
                setTimeout(() => setIsTransitioning(false), 50);
            }, 400);
        }, 7000);
        return () => clearInterval(iv);
    }, [banners.length, currentIndex]);

    if (banners.length === 0) return null;
    const b = banners[currentIndex];

    return (
        <div className="mb-6 relative rounded-2xl overflow-hidden group" style={{ height: 220 }}>
            {/* CSS animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes bannerKenBurns {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.06); }
                }
                @keyframes bannerShimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                @keyframes bannerSlideInLeft {
                    0% { opacity: 0; transform: translateX(-30px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                @keyframes bannerSlideInUp {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes bannerPulseGlow {
                    0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.4); }
                    50% { box-shadow: 0 0 16px rgba(249,115,22,0.6); }
                }
                .banner-img-animate {
                    animation: bannerKenBurns 8s ease-in-out alternate infinite;
                }
                .banner-shimmer {
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
                    background-size: 200% 100%;
                    animation: bannerShimmer 3s ease-in-out infinite;
                }
                .banner-title-animate {
                    animation: bannerSlideInLeft 0.6s ease-out both;
                }
                .banner-subtitle-animate {
                    animation: bannerSlideInLeft 0.6s ease-out 0.15s both;
                }
                .banner-cta-animate {
                    animation: bannerSlideInUp 0.5s ease-out 0.3s both, bannerPulseGlow 2s ease-in-out infinite 1s;
                }
                .banner-fade-enter {
                    opacity: 0;
                    transition: opacity 0.5s ease-in-out;
                }
                .banner-fade-active {
                    opacity: 1;
                }
            `}} />
            <a href={b.cta_href || '#'} className="block relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    key={b.id}
                    src={b.image_url}
                    alt={b.title || 'Banner'}
                    className={`w-full h-full object-cover object-bottom banner-img-animate ${isTransitioning ? 'banner-fade-enter' : 'banner-fade-enter banner-fade-active'}`}
                />
                {/* Shimmer overlay */}
                <div className="absolute inset-0 banner-shimmer pointer-events-none" />
                {/* Text overlay with slide animations */}
                {(b.title || b.cta_text) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent flex items-center px-6">
                        <div key={`text-${b.id}`}>
                            {b.title && <p className="text-white font-black text-lg banner-title-animate">{b.title}</p>}
                            {b.subtitle && <p className="text-gray-200 text-sm mt-0.5 banner-subtitle-animate">{b.subtitle}</p>}
                            {b.cta_text && (
                                <span className="inline-block mt-2 text-xs font-bold text-white px-4 py-1.5 rounded-lg banner-cta-animate" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
                                    {b.cta_text}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </a>
            {/* Dots indicator */}
            {banners.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {banners.map((_, i) => (
                        <button key={i} onClick={() => { setPrevIndex(currentIndex); setCurrentIndex(i); }} className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-6' : 'bg-white/50 w-2 hover:bg-white/70'}`} />
                    ))}
                </div>
            )}
        </div>
    );
}


// ─── Filtros TikTok para la cámara ────────────────────────────────────────────
const CAM_FILTERS = [
    { id: 'normal', label: 'Normal', css: 'none' },
    { id: 'belleza', label: '✨ Belleza', css: 'brightness(1.08) contrast(0.88) saturate(1.1) blur(0px)' },
    { id: 'vivido', label: '🎨 Vívido', css: 'saturate(1.7) brightness(1.06) contrast(1.06)' },
    { id: 'frio', label: '❄️ Frío', css: 'hue-rotate(10deg) saturate(1.2) brightness(1.05)' },
    { id: 'calido', label: '☀️ Cálido', css: 'sepia(0.25) saturate(1.3) brightness(1.06)' },
    { id: 'bn', label: '⬛ B&N', css: 'grayscale(1) contrast(1.2)' },
];

// ─── LiveKit broadcaster inner component ─────────────────────────────────────
function BroadcastControls({
    onEnd, ending, viewerCount,
}: { onEnd: () => void; ending: boolean; viewerCount: number }) {
    const { localParticipant } = useLocalParticipant();
    const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
    const [cameraOn, setCameraOn] = useState(true);
    const [micOn, setMicOn] = useState(true);
    const [activeFilter, setActiveFilter] = useState('normal');

    const toggleCamera = useCallback(async () => {
        await localParticipant.setCameraEnabled(!cameraOn);
        setCameraOn((v) => !v);
    }, [cameraOn, localParticipant]);

    const switchCamera = useCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoSinks = devices.filter(d => d.kind === 'videoinput');
        if (videoSinks.length <= 1) return;

        // Simple toggle for dual camera phones
        const currentTrack = Array.from(localParticipant.videoTrackPublications.values())
            .find(p => p.source === Track.Source.Camera)?.videoTrack;
        const currentId = currentTrack?.mediaStreamTrack.getSettings().deviceId;
        const nextDevice = videoSinks.find(d => d.deviceId !== currentId) || videoSinks[0];

        if (nextDevice) {
            await localParticipant.setCameraEnabled(true, { deviceId: nextDevice.deviceId });
        }
    }, [localParticipant]);

    const toggleMic = useCallback(async () => {
        await localParticipant.setMicrophoneEnabled(!micOn);
        setMicOn((v) => !v);
    }, [micOn, localParticipant]);

    const localTrack = tracks.find((t) => t.participant.isLocal);
    const filterCss = CAM_FILTERS.find(f => f.id === activeFilter)?.css || 'none';

    return (
        <div>
            <div className="rounded-xl overflow-hidden bg-gray-900 aspect-video mb-4 relative"
                style={{ filter: filterCss !== 'none' ? filterCss : undefined }}>
                {localTrack ? (
                    <VideoTrack trackRef={localTrack} className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <VideoOff className="w-12 h-12 text-gray-600" />
                    </div>
                )}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-sm px-2.5 py-1 rounded-lg">
                    <Users className="w-4 h-4" />{viewerCount}
                </div>
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />EN VIVO
                </div>
                {/* Nombre del filtro activo */}
                {activeFilter !== 'normal' && (
                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {CAM_FILTERS.find(f => f.id === activeFilter)?.label}
                    </div>
                )}
            </div>

            {/* Filtros TikTok-style */}
            <div className="mb-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Filtros de cámara</p>
                <div className="flex gap-1.5 flex-wrap">
                    {CAM_FILTERS.map(f => (
                        <button key={f.id}
                            onClick={() => setActiveFilter(f.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${activeFilter === f.id
                                ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <button onClick={toggleCamera} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-colors ${cameraOn ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                    {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    {cameraOn ? 'Cámara' : 'Cámara off'}
                </button>
                <button onClick={switchCamera} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 transition-colors">
                    <RotateCcw className="w-4 h-4" />
                    Girar
                </button>
                <button onClick={toggleMic} className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-colors ${micOn ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                    {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    {micOn ? 'Micro' : 'Micro off'}
                </button>
                <button onClick={onEnd} disabled={ending} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors ml-auto">
                    {ending ? 'Fin' : '⏹ Finalizar'}
                </button>
            </div>
        </div>
    );
}


// ─── Copy to clipboard button ─────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={handleCopy} className={`p-2 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}

// ─── OBS Active Session Panel ─────────────────────────────────────────────────
function OBSActivePanel({ rtmpUrl, streamKey, onEnd, ending, viewerCount }: {
    rtmpUrl: string; streamKey: string; onEnd: () => void; ending: boolean; viewerCount: number;
}) {
    return (
        <div>
            {/* Status header */}
            <div className="flex items-center gap-3 mb-5 p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                    OBS conectado — esperando señal
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-sm text-gray-600">
                    <Users className="w-4 h-4" />{viewerCount} viendo
                </div>
            </div>

            {/* RTMP Credentials */}
            <div className="space-y-3 mb-5">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">RTMP Server URL</label>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                        <code className="flex-1 text-xs text-gray-800 font-mono break-all">{rtmpUrl}</code>
                        <CopyButton text={rtmpUrl} />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Stream Key (no compartas)</label>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                        <code className="flex-1 text-xs text-gray-800 font-mono break-all select-all">{streamKey}</code>
                        <CopyButton text={streamKey} />
                    </div>
                </div>
            </div>

            {/* OBS Quick Setup */}
            <details className="mb-5">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Cómo configurar en OBS Studio
                </summary>
                <div className="mt-3 space-y-2 text-xs text-gray-600 bg-gray-50 rounded-xl p-4">
                    <p className="font-semibold text-gray-800">Pasos en OBS Studio:</p>
                    <ol className="list-decimal list-inside space-y-1.5">
                        <li>Abre OBS Studio → <strong>Configuración → Emisión</strong></li>
                        <li>Servicio: selecciona <strong>"Personalizado..."</strong></li>
                        <li>Pega la <strong>URL del servidor</strong> de arriba</li>
                        <li>Pega la <strong>Clave de Stream</strong> de arriba</li>
                        <li>Guarda y haz clic en <strong>"Iniciar transmisión"</strong> en OBS</li>
                    </ol>
                    <p className="mt-2 text-amber-700 font-medium">⚠️ Tu señal tarda ~5 segundos en aparecer para los viewers.</p>
                </div>
            </details>

            <button onClick={onEnd} disabled={ending} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors">
                {ending ? 'Finalizando...' : '⏹ Finalizar transmisión'}
            </button>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveDashboard() {
    const [plan, setPlan] = useState<string>('basic');
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [myListings, setMyListings] = useState<any[]>([]);
    const [starting, setStarting] = useState(false);
    const [ending, setEnding] = useState(false);
    const [pastSessions, setPastSessions] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState('');
    const [pocketCash, setPocketCash] = useState(0);

    // Tabs
    const [activeTab, setActiveTab] = useState<'lives' | 'tienda'>('lives');

    // Hours status
    const [hoursStatus, setHoursStatus] = useState<any>(null);

    // Pagination past sessions
    const [histPage, setHistPage] = useState(1);
    const [histTotal, setHistTotal] = useState(0);
    const [histTotalPages, setHistTotalPages] = useState(1);
    const HIST_PER_PAGE = 10;

    // Tienda de Lives
    const [buying, setBuying] = useState<string | null>(null);
    const [buySuccess, setBuySuccess] = useState('');
    const [buyError, setBuyError] = useState('');

    // ── Live countdown timer ──
    const [liveElapsedSecs, setLiveElapsedSecs] = useState(0);
    const broadcastStartRef = useRef<number | null>(null);

    // Broadcast mode
    const [broadcastMode, setBroadcastMode] = useState<'browser' | 'obs'>('browser');

    // Browser LiveKit state
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string>('');

    // OBS ingress state
    const [ingressData, setIngressData] = useState<{ rtmp_url: string; stream_key: string; ingress_id: string } | null>(null);

    // Track when the actual broadcast begins (not session creation)
    // Browser mode: when livekitToken is set (LiveKit room connected)
    // OBS mode: when viewer_count > 0 (OBS is actually streaming, not just credentials ready)
    const [obsStreaming, setObsStreaming] = useState(false);

    // Poll viewer_count for OBS mode to detect when OBS actually starts streaming
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'live' || broadcastMode !== 'obs' || !ingressData) return;
        if (obsStreaming) return; // already detected

        const checkStream = async () => {
            try {
                const { data } = await supabase
                    .from('live_sessions')
                    .select('viewer_count')
                    .eq('id', activeSession.id)
                    .single();
                if (data && (data.viewer_count ?? 0) > 0) {
                    setObsStreaming(true);
                }
            } catch { /* ignore */ }
        };

        checkStream();
        const iv = setInterval(checkStream, 3000);
        return () => clearInterval(iv);
    }, [activeSession?.id, activeSession?.status, broadcastMode, ingressData, obsStreaming]);

    // Reset obsStreaming when session ends
    useEffect(() => {
        if (!activeSession) setObsStreaming(false);
    }, [activeSession]);

    useEffect(() => {
        const isBroadcasting = activeSession && activeSession.status === 'live' && (
            (broadcastMode === 'browser' && livekitToken) ||
            (broadcastMode === 'obs' && obsStreaming)
        );

        if (!isBroadcasting) {
            broadcastStartRef.current = null;
            setLiveElapsedSecs(0);
            return;
        }

        // Set broadcast start time only once per session
        if (!broadcastStartRef.current) {
            // For OBS: use started_at if available so we don't lose time
            if (broadcastMode === 'obs' && activeSession?.started_at) {
                broadcastStartRef.current = new Date(activeSession.started_at).getTime();
            } else {
                broadcastStartRef.current = Date.now();
            }
        }

        const tick = () => {
            if (broadcastStartRef.current) {
                setLiveElapsedSecs(Math.floor((Date.now() - broadcastStartRef.current) / 1000));
            }
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, [activeSession?.id, activeSession?.status, broadcastMode, livekitToken, obsStreaming]);

    // Calculate remaining minutes
    const totalAvailableMins = hoursStatus
        ? (plan === 'platinum' ? (hoursStatus.free_mins_remaining_today || 0) : 0) + (hoursStatus.extra_mins_balance || 0)
        : 0;
    const elapsedMins = liveElapsedSecs / 60;
    const remainingMins = Math.max(0, totalAvailableMins - elapsedMins);
    const remainingSecs = Math.max(0, Math.floor(totalAvailableMins * 60 - liveElapsedSecs));
    const isOutOfTime = hoursStatus && totalAvailableMins <= 0;

    // Format countdown as HH:MM:SS
    const fmtCountdown = (totalSecs: number) => {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Local camera preview (before going live in browser mode)
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

    const getSupabaseToken = async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token;
    };

    const loadPastSessions = async (page: number, token: string, userId: string) => {
        try {
            const res = await fetch(`/api/live?status=ended&host_id=${userId}&page=${page}&per_page=${HIST_PER_PAGE}`, { headers: { authorization: `Bearer ${token}` } });
            const data = await res.json();
            setPastSessions(data.sessions || []);
            setHistTotal(data.total ?? 0);
            setHistTotalPages(data.total_pages ?? 1);
        } catch { }
    };

    useEffect(() => {
        const load = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { setLoading(false); return; }
                setUser(user);

                const token = await getSupabaseToken();

                // ── Todo en paralelo ──
                let detectedPlan = 'basic';

                const loadProfile = async () => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('plan_type, pro_subscription_end')
                        .eq('id', user.id)
                        .maybeSingle();
                    detectedPlan = profile?.plan_type || 'basic';
                    if ((detectedPlan === 'platinum' || detectedPlan === 'pro') && profile?.pro_subscription_end) {
                        if (new Date() > new Date(profile.pro_subscription_end)) {
                            detectedPlan = 'basic';
                        }
                    }
                    setPlan(detectedPlan);
                };

                const loadWallet = async () => {
                    const { data: wallet } = await supabase
                        .from('wallets')
                        .select('balance')
                        .eq('user_id', user.id)
                        .maybeSingle();
                    setPocketCash(wallet?.balance ?? 0);
                };

                const loadHours = async () => {
                    if (!token) return;
                    try {
                        const hRes = await fetch('/api/live/hours', { headers: { authorization: `Bearer ${token}` } });
                        if (hRes.ok) {
                            const hoursData = await hRes.json();
                            setHoursStatus(hoursData);
                            if (hoursData.pocket_cash !== undefined) {
                                setPocketCash(hoursData.pocket_cash);
                            }
                        }
                    } catch (e) {
                        console.error('[Live] Error fetching hours:', e);
                    }
                };

                const loadListings = async () => {
                    if (!token) return;
                    try {
                        const listingsRes = await fetch('/api/user/my-listings', { headers: { authorization: `Bearer ${token}` } });
                        setMyListings((await listingsRes.json()).listings || []);
                    } catch { }
                };

                const loadSessions = async () => {
                    if (!token) return;
                    try {
                        const res = await fetch(`/api/live?status=all&host_id=${user.id}&per_page=50`, { headers: { authorization: `Bearer ${token}` } });
                        const data = await res.json();
                        const active = data.sessions?.find((s: any) => s.status === 'live' || s.status === 'scheduled');
                        if (active) {
                            setActiveSession(active);
                            if (active.broadcast_mode === 'obs') await fetchIngress(active.id);
                            else await fetchLivekitToken(active.id);
                        }
                    } catch { }
                };

                const loadHistory = async () => {
                    if (!token) return;
                    await loadPastSessions(1, token, user.id);
                };

                await Promise.allSettled([
                    loadProfile(),
                    loadWallet(),
                    loadHours(),
                    loadListings(),
                    loadSessions(),
                    loadHistory(),
                ]);

                console.log('[Live] plan:', detectedPlan);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const goHistPage = async (newPage: number) => {
        if (newPage < 1 || newPage > histTotalPages) return;
        setHistPage(newPage);
        const token = await getSupabaseToken();
        if (token && user) await loadPastSessions(newPage, token, user.id);
    };

    const fetchLivekitToken = async (roomId: string) => {
        try {
            const token = await getSupabaseToken();
            const headers: Record<string, string> = {};
            if (token) headers['authorization'] = `Bearer ${token}`;
            const res = await fetch(`/api/live/token?room=${roomId}&host=true`, { headers });
            const data = await res.json();
            if (res.ok && data.token) {
                setLivekitToken(data.token);
                setLivekitUrl(data.url);
            } else {
                setError(data.error || 'Error al obtener token de transmisión');
            }
        } catch (e) {
            console.error('[Token] Error:', e);
            setError('Error de conexión al obtener token');
        }
    };

    const fetchIngress = async (sessionId: string) => {
        try {
            const token = await getSupabaseToken();
            const res = await fetch('/api/live/ingress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId }),
            });
            const data = await res.json();
            if (res.ok && data.rtmp_url) {
                setIngressData({ rtmp_url: data.rtmp_url, stream_key: data.stream_key, ingress_id: data.ingress_id });
            } else {
                console.error('[Ingress] API Error:', data);
                setError(data.error || 'Error al generar credenciales RTMP. Verifica la configuración de LiveKit.');
            }
        } catch (e: any) {
            console.error('[Ingress] Error:', e);
            setError('Error de red al generar credenciales RTMP');
        }
    };

    const startCamera = async () => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });
            if (videoRef.current) videoRef.current.srcObject = stream;
            streamRef.current = stream;
            setCameraActive(true);
        } catch {
            setError('No se pudo acceder a la cámara. Verifica los permisos.');
        }
    };

    const toggleFacingMode = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    };

    // Auto-restart camera when facingMode changes if active
    useEffect(() => {
        if (cameraActive) {
            startCamera();
        }
    }, [facingMode]);

    const stopCamera = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraActive(false);
    };

    const startLive = async () => {
        if (!title.trim()) { setError('Escribe un título para tu live'); return; }
        setStarting(true); setError('');
        try {
            const token = await getSupabaseToken();
            if (!token) throw new Error('No auth');

            const res = await fetch('/api/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ title: title.trim(), description: description.trim() || null, product_ids: selectedProducts }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al iniciar');

            stopCamera();
            setActiveSession(data.session);

            if (broadcastMode === 'browser') {
                await fetchLivekitToken(data.session.id);
            } else {
                // OBS mode: generate RTMP ingress
                await fetchIngress(data.session.id);
            }
        } catch (err: any) { setError(err.message); }
        setStarting(false);
    };

    const endLive = async () => {
        if (!activeSession) return;
        setEnding(true);
        try {
            const token = await getSupabaseToken();
            const res = await fetch('/api/live', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: activeSession.id, action: 'end', broadcast_secs: liveElapsedSecs }),
            });
            if (!res.ok) {
                const d = await res.json();
                setError(d.error || 'Error al finalizar transmisión');
                setEnding(false);
                return;
            }
            // Clean up ingress if OBS mode
            if (ingressData?.ingress_id) {
                await fetch(`/api/live/ingress?ingress_id=${ingressData.ingress_id}`, {
                    method: 'DELETE',
                    headers: { authorization: `Bearer ${token}` },
                }).catch(() => { });
            }
            setLivekitToken(null);
            setIngressData(null);
            setActiveSession(null);
            window.location.reload();
        } catch (e: any) {
            setError('Error al finalizar: ' + e.message);
        }
        setEnding(false);
    };

    // ── Auto-end live when host closes tab / navigates away ──────────────────
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'live') return;

        const handleBeforeUnload = () => {
            // Use sendBeacon for reliable fire-and-forget on page close
            const payload = JSON.stringify({ session_id: activeSession.id, action: 'end', broadcast_secs: liveElapsedSecs });
            navigator.sendBeacon('/api/live/end-beacon', payload);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [activeSession?.id, activeSession?.status]);

    // ── Realtime: instant detection when session ends remotely ──
    useEffect(() => {
        if (!activeSession || activeSession.status !== 'live') return;

        const channel = supabase
            .channel(`session-status-${activeSession.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'live_sessions',
                    filter: `id=eq.${activeSession.id}`,
                },
                (payload: any) => {
                    if (payload.new.status === 'ended') {
                        // Session ended remotely — stop everything immediately
                        setActiveSession(null);
                        setLivekitToken(null);
                        setIngressData(null);
                        broadcastStartRef.current = null;
                        setLiveElapsedSecs(0);
                        window.location.reload();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeSession?.id, activeSession?.status]);


    if (loading) {
        return (
            <div className="p-8 text-center text-gray-500">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent mx-auto mb-3" />
                Cargando...
            </div>
        );
    }

    // Basic plan gate
    if (plan === 'basic') {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center">
                <Radio className="w-16 h-16 text-red-300 mx-auto mb-4 opacity-40" />
                <h1 className="text-2xl font-bold text-gray-900 mb-3">GoVendy Live</h1>
                <p className="text-gray-600 mb-2">Transmite en vivo, muestra productos y vende directamente a tu audiencia.</p>
                <p className="text-gray-400 text-sm mb-8">Esta función está disponible para usuarios <strong>Pro</strong> (comprando horas) y <strong>Platinum</strong> (2h gratis diarias + horas extra).</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/dashboard/pro" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:from-amber-600 hover:to-yellow-600 transition-all">
                        <Crown className="w-5 h-5" /> Plan Platinum
                    </Link>
                    <Link href="/dashboard/pro" className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 font-bold px-6 py-3 rounded-xl hover:border-gray-400 transition-all">
                        Plan Pro
                    </Link>
                </div>
            </div>
        );
    }

    const handleBuyPackage = async (pkgId: string) => {
        setBuying(pkgId); setBuyError(''); setBuySuccess('');
        try {
            const token = await getSupabaseToken();
            const res = await fetch('/api/live/hours', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ package_id: pkgId }),
            });
            const data = await res.json();
            if (!res.ok) { setBuyError(data.error || 'Error al comprar'); return; }
            setPocketCash(data.new_pocket_cash);
            // Notify navbar to update balance immediately
            window.dispatchEvent(new CustomEvent('wallet-balance-updated', { detail: { balance: data.new_pocket_cash } }));
            const hRes = await fetch('/api/live/hours', { headers: { authorization: `Bearer ${token}` } });
            if (hRes.ok) setHoursStatus(await hRes.json());
            setBuySuccess(`✅ +${fmtMins(data.minutes_added)} agregados a tu saldo de horas extra`);
        } catch (e: any) { setBuyError(e.message); }
        setBuying(null);
    };

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* ══ HEADER NEGRO CON LOGO ANIMADO ══ */}
            <div className="relative rounded-2xl overflow-hidden mb-6" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 60%, #111 100%)' }}>
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full opacity-20 animate-pulse" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)' }} />
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.25) 0%, transparent 70%)' }} />
                    {/* Animated scan line */}
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)' }} />
                </div>

                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
                    <div className="flex items-center gap-4">
                        {/* Animated radio icon with glow */}
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: 'rgba(239,68,68,0.4)' }} />
                            <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', boxShadow: '0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.2)' }}>
                                <Radio className="w-6 h-6 text-white" />
                            </div>
                            {activeSession && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">
                                GoVendy <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #ef4444, #f97316)' }}>Live</span>
                            </h1>
                            <p className="text-gray-400 text-sm mt-0.5">Transmite en vivo y vende directamente</p>
                        </div>
                    </div>
                    {activeSession && (
                        <Link href={`/live/${activeSession.id}`} target="_blank"
                            className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', boxShadow: '0 4px 15px rgba(239,68,68,0.3)' }}>
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Ver mi live
                        </Link>
                    )}
                </div>
            </div>

            {/* ══ BANNER CONFIGURABLE (placement: live_dashboard) ══ */}
            <LiveDashboardBanner />

            {/* ── Tabs ── */}
            <div className="flex border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('lives')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${activeTab === 'lives' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Radio className="w-4 h-4" /> Mis Lives
                </button>
                <button
                    onClick={() => setActiveTab('tienda')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${activeTab === 'tienda' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Store className="w-4 h-4" /> Tienda de Lives
                </button>
            </div>

            {/* ── Hours Counters ── */}
            {hoursStatus && activeTab === 'lives' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {/* Horas gratis Platinum */}
                    {plan === 'platinum' && (
                        <div className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                <Timer className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-green-700 mb-0.5">Horas gratuitas hoy</p>
                                <p className="text-xl font-black text-green-800">{fmtMins(hoursStatus.free_mins_remaining_today)}</p>
                                <p className="text-[11px] text-green-600">de {fmtMins(hoursStatus.free_mins_daily)} disponibles · se renueva a medianoche</p>
                            </div>
                            <div className="w-16 h-16 relative">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#dcfce7" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#16a34a" strokeWidth="3"
                                        strokeDasharray={`${Math.round((hoursStatus.free_mins_remaining_today / Math.max(1, hoursStatus.free_mins_daily)) * 100)} 100`}
                                        strokeLinecap="round" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-green-700">
                                    {Math.round((hoursStatus.free_mins_remaining_today / Math.max(1, hoursStatus.free_mins_daily)) * 100)}%
                                </span>
                            </div>
                        </div>
                    )}
                    {/* Horas extra compradas */}
                    <div className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-amber-700 mb-0.5">Horas extra compradas</p>
                            <p className="text-xl font-black text-amber-800">{fmtMins(hoursStatus.extra_mins_balance)}</p>
                            <p className="text-[11px] text-amber-600">No caducan · se usan cuando se agoten las gratuitas</p>
                        </div>
                        <button onClick={() => setActiveTab('tienda')} className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                            + Comprar
                        </button>
                    </div>

                    {/* ── COUNTDOWN TIMER (visible durante sesión activa) ── */}
                    {activeSession && activeSession.status === 'live' && (
                        <div className={`sm:col-span-2 flex items-center gap-4 rounded-2xl border-2 p-4 transition-colors ${remainingSecs <= 0 ? 'border-red-300 bg-red-50' :
                            remainingSecs <= 300 ? 'border-orange-300 bg-orange-50 animate-pulse' :
                                'border-blue-200 bg-blue-50'
                            }`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${remainingSecs <= 0 ? 'bg-red-100' :
                                remainingSecs <= 300 ? 'bg-orange-100' : 'bg-blue-100'
                                }`}>
                                <Timer className={`w-6 h-6 ${remainingSecs <= 0 ? 'text-red-600' :
                                    remainingSecs <= 300 ? 'text-orange-600' : 'text-blue-600'
                                    }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold mb-0.5 ${remainingSecs <= 0 ? 'text-red-700' :
                                    remainingSecs <= 300 ? 'text-orange-700' : 'text-blue-700'
                                    }`}>
                                    {remainingSecs <= 0 ? '⛔ Tiempo agotado' : '⏱️ Tiempo restante de transmisión'}
                                </p>
                                <p className={`text-2xl font-black font-mono tracking-wider ${remainingSecs <= 0 ? 'text-red-800' :
                                    remainingSecs <= 300 ? 'text-orange-800' : 'text-blue-800'
                                    }`}>
                                    {fmtCountdown(remainingSecs)}
                                </p>
                                {remainingSecs <= 0 ? (
                                    <p className="text-[11px] text-red-600 font-medium">Compra más horas para continuar transmitiendo</p>
                                ) : remainingSecs <= 300 ? (
                                    <p className="text-[11px] text-orange-600">⚠️ ¡Menos de 5 minutos restantes!</p>
                                ) : (
                                    <p className="text-[11px] text-blue-600">
                                        {plan === 'platinum' ? 'Usando horas gratuitas primero, luego las compradas' : 'Usando horas compradas'}
                                    </p>
                                )}
                            </div>
                            {remainingSecs <= 300 && (
                                <button onClick={() => setActiveTab('tienda')} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors shrink-0 shadow-sm">
                                    🔥 Comprar Horas
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── BLOQUEO: Sin minutos disponibles (solo cuando no hay sesión activa) ── */}
                    {!activeSession && isOutOfTime && (
                        <div className="sm:col-span-2 rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-center">
                            <div className="text-3xl mb-2">⛔</div>
                            <p className="text-sm font-bold text-red-800 mb-1">No tienes minutos disponibles</p>
                            <p className="text-xs text-red-600 mb-4">
                                {plan === 'platinum'
                                    ? 'Tus horas gratuitas de hoy se agotaron y no tienes horas extra. Compra más o espera a mañana.'
                                    : 'Necesitas comprar horas de transmisión para poder hacer un live.'}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                <button onClick={() => setActiveTab('tienda')} className="bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-red-700 transition-colors shadow-sm">
                                    🔥 Comprar Horas Extra
                                </button>
                                {plan === 'platinum' && (
                                    <span className="text-xs text-red-500 self-center">o espera a que se renueven a medianoche</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                    {error.includes('activa o programada') && (
                        <div className="mt-3 pt-3 border-t border-red-100">
                            <button
                                onClick={async () => {
                                    setEnding(true);
                                    try {
                                        const token = await getSupabaseToken();
                                        // 1. Fetch the active session ID
                                        const res = await fetch(`/api/live?status=all&host_id=${user.id}`, { headers: { authorization: `Bearer ${token}` } });
                                        const data = await res.json();
                                        const active = data.sessions?.find((s: any) => s.status === 'live' || s.status === 'scheduled');

                                        if (active) {
                                            // 2. End it
                                            await fetch('/api/live', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                                                body: JSON.stringify({ session_id: active.id, action: 'end' }),
                                            });
                                            setError('');
                                            window.location.reload();
                                        } else {
                                            setError('No se encontró la sesión para finalizar. Intenta recargar la página.');
                                        }
                                    } catch (err: any) {
                                        setError('Error al finalizar sesión: ' + err.message);
                                    }
                                    setEnding(false);
                                }}
                                disabled={ending}
                                className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {ending ? 'Finalizando...' : '⛔ Finalizar sesión anterior y empezar de nuevo'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Active Session / New Session (only on Mis Lives tab) ── */}
            {activeTab === 'lives' && (activeSession ? (
                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 mb-8">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> EN VIVO
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{activeSession.title}</h2>
                        <div className="ml-auto flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                            {broadcastMode === 'obs' ? <Monitor className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                            {broadcastMode === 'obs' ? 'OBS Studio' : 'Navegador'}
                        </div>
                    </div>

                    {broadcastMode === 'obs' ? (
                        ingressData ? (
                            <OBSActivePanel
                                rtmpUrl={ingressData.rtmp_url}
                                streamKey={ingressData.stream_key}
                                onEnd={endLive}
                                ending={ending}
                                viewerCount={activeSession.viewer_count || 0}
                            />
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                                    Generando credenciales RTMP...
                                </div>
                                <button
                                    onClick={endLive}
                                    disabled={ending}
                                    className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-300 transition-colors w-fit"
                                >
                                    {ending ? 'Finalizando...' : '⏹ Cancelar / Finalizar'}
                                </button>
                            </div>
                        )
                    ) : (
                        livekitToken ? (
                            <LiveKitRoom video={true} audio={true} token={livekitToken} serverUrl={livekitUrl} style={{ height: 'auto', background: 'transparent' }}>
                                <BroadcastControls onEnd={endLive} ending={ending} viewerCount={activeSession.viewer_count || 0} />
                            </LiveKitRoom>
                        ) : (
                            <div className="rounded-xl bg-gray-900 aspect-video flex items-center justify-center mb-4">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
                            </div>
                        )
                    )}
                </div>
            ) : (
                /* ── New Session Form ── */
                <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-8 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-5">Nueva transmisión</h2>

                    {/* Broadcast Mode Selector */}
                    <div className="mb-5">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Modo de transmisión</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setBroadcastMode('browser')}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${broadcastMode === 'browser' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${broadcastMode === 'browser' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${broadcastMode === 'browser' ? 'text-red-700' : 'text-gray-700'}`}>Cámara web</p>
                                    <p className="text-[11px] text-gray-500">Directamente desde el navegador</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBroadcastMode('obs')}
                                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${broadcastMode === 'obs' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${broadcastMode === 'obs' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    <Monitor className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${broadcastMode === 'obs' ? 'text-red-700' : 'text-gray-700'}`}>OBS Studio</p>
                                    <p className="text-[11px] text-gray-500">Calidad profesional con RTMP</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Título *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ej: ¡Ofertas de Viernes! 🔥"
                                maxLength={100}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción (opcional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe de qué tratará tu live..."
                                maxLength={500}
                                rows={2}
                                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                            />
                        </div>

                        {/* Product selection */}
                        {myListings.length > 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    <ShoppingBag className="inline w-4 h-4 mr-1 text-red-400" />
                                    Productos ({selectedProducts.length} seleccionados)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                                    {myListings.map((listing) => (
                                        <button
                                            key={listing.id}
                                            type="button"
                                            onClick={() => setSelectedProducts((prev) => prev.includes(listing.id) ? prev.filter((id) => id !== listing.id) : [...prev, listing.id])}
                                            className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${selectedProducts.includes(listing.id) ? 'border-red-400 bg-red-50 ring-1 ring-red-400' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                                                {listing.images?.[0] && <img src={listing.images[0]} alt="" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 truncate">{listing.title}</p>
                                                <p className="text-red-500 font-bold">${listing.price?.toLocaleString('es-MX')}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview (browser mode only) */}
                    {broadcastMode === 'browser' && (
                        <div className="rounded-xl overflow-hidden bg-gray-900 aspect-video mb-4 relative">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            {!cameraActive ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                    <Video className="w-12 h-12 text-gray-600" />
                                    <button onClick={startCamera} className="bg-white text-gray-900 font-bold px-5 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors">
                                        <Video className="w-4 h-4" /> Vista previa de cámara
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={toggleFacingMode}
                                    className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black/80 transition-all"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Cambiar cámara
                                </button>
                            )}
                        </div>
                    )}

                    {/* OBS info banner */}
                    {broadcastMode === 'obs' && (
                        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            <div className="flex items-start gap-2">
                                <Monitor className="w-5 h-5 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold mb-1">Flujo con OBS Studio</p>
                                    <p className="text-[13px]">Al iniciar se generará un <strong>URL RTMP + Clave de Stream</strong> que copias en OBS Studio. Los viewers verán tu transmisión en tiempo real con calidad profesional.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {broadcastMode === 'browser' && (
                            <button
                                type="button"
                                onClick={() => {
                                    const params = new URLSearchParams();
                                    if (title.trim()) params.set('title', title.trim());
                                    window.open(`/live/preview?${params.toString()}`, '_blank');
                                }}
                                className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 font-bold py-3.5 rounded-xl text-sm hover:border-gray-400 hover:bg-gray-50 transition-all"
                            >
                                <Eye className="w-5 h-5" /> Vista Previa
                            </button>
                        )}
                        <button
                            onClick={startLive}
                            disabled={starting || !title.trim() || !!isOutOfTime}
                            className={`${broadcastMode === 'browser' ? 'flex-[2]' : 'w-full'} bg-gradient-to-r from-red-600 to-red-500 text-white font-bold py-3.5 rounded-xl text-sm hover:from-red-700 hover:to-red-600 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2`}
                        >
                            {starting ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : isOutOfTime ? (
                                <>⛔ Sin horas disponibles</>
                            ) : broadcastMode === 'obs' ? (
                                <><Monitor className="w-5 h-5" /> Iniciar y Obtener Credenciales RTMP</>
                            ) : (
                                <><Radio className="w-5 h-5" /> Iniciar Transmisión en Vivo</>
                            )}
                        </button>
                    </div>
                </div>
            ))}

            {/* ══════════════ TAB: MIS LIVES — Past Sessions ══════════════ */}
            {activeTab === 'lives' && (
                <>
                    {/* Past sessions */}
                    {(pastSessions.length > 0 || histTotal > 0) && (
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-gray-400" /> Transmisiones anteriores
                                    <span className="text-sm font-normal text-gray-400">({histTotal})</span>
                                </h2>
                                {histTotalPages > 1 && (
                                    <div className="flex items-center gap-1 text-sm text-gray-500">
                                        <button onClick={() => goHistPage(histPage - 1)} disabled={histPage <= 1}
                                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="px-2">{histPage} / {histTotalPages}</span>
                                        <button onClick={() => goHistPage(histPage + 1)} disabled={histPage >= histTotalPages}
                                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                {pastSessions.map((s) => {
                                    const startDate = s.started_at ? new Date(s.started_at) : null;
                                    const duration = fmtDuration(s.started_at, s.ended_at);
                                    return (
                                        <div key={s.id} className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 bg-white hover:shadow-sm transition-shadow">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                                <Radio className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                                    {startDate && (
                                                        <span className="text-xs text-gray-500">
                                                            📅 {startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                    {startDate && (
                                                        <span className="text-xs text-gray-500">
                                                            🕐 {startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-500">⏱ {duration}</span>
                                                    <span className="text-xs text-gray-400"><Users className="inline w-3 h-3" /> {s.viewer_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Pagination bottom */}
                            {histTotalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <button onClick={() => goHistPage(histPage - 1)} disabled={histPage <= 1}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                                        <ChevronLeft className="w-4 h-4" /> Anterior
                                    </button>
                                    <span className="text-sm text-gray-500">{histPage} de {histTotalPages}</span>
                                    <button onClick={() => goHistPage(histPage + 1)} disabled={histPage >= histTotalPages}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30">
                                        Siguiente <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ══════════════ TAB: TIENDA DE LIVES ══════════════ */}
            {activeTab === 'tienda' && (
                <div>
                    {/* Header tienda — premium gradient */}
                    <div className="relative rounded-2xl overflow-hidden mb-6" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,107,53,0.2) 0%, transparent 50%)' }} />
                        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
                            <div>
                                <h2 className="text-xl font-black text-white flex items-center gap-2">
                                    🔥 Tienda de Horas Live
                                </h2>
                                <p className="text-sm text-gray-300 mt-1">Compra horas extra con PocketCash — <span className="text-orange-400 font-semibold">no caducan nunca</span></p>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl px-5 py-3 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                                    <span className="text-lg">💰</span>
                                </div>
                                <div>
                                    <p className="text-[11px] text-gray-400 font-medium">Tu Saldo PocketCash</p>
                                    <p className="text-xl font-black text-white">${pocketCash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {buySuccess && (
                        <div className="my-3 rounded-xl bg-green-50 border border-green-200 p-3 text-green-800 text-sm flex items-center gap-2">
                            ✅ {buySuccess}
                            <button onClick={() => setBuySuccess('')} className="ml-auto text-green-400 hover:text-green-600">✕</button>
                        </div>
                    )}
                    {buyError && (
                        <div className="my-3 rounded-xl bg-red-50 border border-red-200 p-3 text-red-700 text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {buyError}
                            <button onClick={() => setBuyError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                        </div>
                    )}

                    {/* Packages grid — premium cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
                        {LIVE_PACKAGES.map((pkg, idx) => {
                            const pricePerHour = (pkg.price_mxn / pkg.hours).toFixed(2);
                            const canAfford = pocketCash >= pkg.price_mxn;
                            const isBest = pkg.id === 'h10' || pkg.id === 'h50';
                            const savings = pkg.hours >= 10 ? Math.round((1 - (pkg.price_mxn / pkg.hours) / 59) * 100) : 0;
                            return (
                                <div
                                    key={pkg.id}
                                    className="group relative flex flex-col rounded-2xl p-[2px] transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
                                    style={{
                                        animationDelay: `${idx * 60}ms`,
                                        background: isBest
                                            ? 'linear-gradient(135deg, #f97316, #ef4444, #f97316)'
                                            : 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                                    }}
                                >
                                    {/* Inner card */}
                                    <div className="flex flex-col flex-1 rounded-[14px] bg-white p-4 relative overflow-hidden">
                                        {/* Background glow for best packages */}
                                        {isBest && (
                                            <div className="absolute inset-0 opacity-[0.04]" style={{ background: 'radial-gradient(circle at 50% 0%, #f97316 0%, transparent 70%)' }} />
                                        )}

                                        {/* Badge */}
                                        {isBest && (
                                            <div className="absolute -top-0 -right-0">
                                                <div className="text-[9px] font-black text-white px-3 py-1 rounded-bl-xl" style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)' }}>
                                                    ⭐ MEJOR PRECIO
                                                </div>
                                            </div>
                                        )}

                                        {/* Hours */}
                                        <div className="text-center mb-3 relative">
                                            <p className="text-4xl font-black" style={{ color: isBest ? '#ea580c' : '#111827' }}>
                                                {pkg.hours}<span className="text-lg font-bold text-gray-400">h</span>
                                            </p>
                                            <p className="text-[11px] text-gray-400 font-medium">${pricePerHour}/hora</p>
                                            {savings > 0 && (
                                                <span className="inline-block mt-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                                    Ahorra {savings}%
                                                </span>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div className="mt-auto">
                                            <p className="text-center text-2xl font-black text-gray-900 mb-3">
                                                ${pkg.price_mxn.toLocaleString('es-MX')}
                                            </p>
                                            <button
                                                onClick={() => handleBuyPackage(pkg.id)}
                                                disabled={buying === pkg.id || !canAfford}
                                                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden"
                                                style={
                                                    !canAfford
                                                        ? { background: '#f3f4f6', color: '#9ca3af' }
                                                        : isBest
                                                            ? { background: 'linear-gradient(135deg, #f97316, #ef4444)', color: 'white', boxShadow: '0 4px 15px rgba(249,115,22,0.3)' }
                                                            : { background: 'linear-gradient(135deg, #111827, #374151)', color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
                                                }
                                            >
                                                {buying === pkg.id ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        Comprando...
                                                    </span>
                                                ) : !canAfford ? 'Sin saldo' : '🔥 Comprar'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-5">Las horas extra no caducan · 1 PocketCash = $1 MXN · Se descuentan después de las gratuitas</p>
                </div>
            )}
        </div>
    );
}
