'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Tv, MessageCircle, Send, Users, LogIn, X, Smile, Ban, VolumeX, UserX, Volume2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import ShareLiveButton from '@/components/live/ShareLiveButton';

const HLSPlayer = dynamic(() => import('@/components/HLSPlayer'), { ssr: false });

interface PlatformVideo {
    id: string;
    title: string;
    video_url: string;
}

// Extract YouTube video ID from various URL formats
function getYouTubeId(url: string): string | null {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
        if (u.hostname.includes('youtube.com')) {
            if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split('?')[0];
            if (u.pathname.startsWith('/watch')) return u.searchParams.get('v');
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('?')[0];
        }
    } catch { }
    return null;
}

interface ChatMsg {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    profiles?: { full_name: string | null; nickname: string | null; avatar_url: string | null } | null;
}

interface AdCampaign {
    id: string;
    type: 'overlay' | 'video' | 'product_spotlight';
    title: string;
    subtitle: string | null;
    content_url: string | null;
    target_url: string | null;
    cta_text: string | null;
    duration_secs: number;
    frequency_mins: number;
    advertiser_name: string;
    priority: number;
}

const QUICK_EMOJIS = [
    '😊', '😂', '🤣', '❤️', '😍', '🥰', '😘', '😁', '🎉', '🔥',
    '👏', '💯', '🙌', '✅', '💪', '🙏', '😎', '👍', '💰', '🛍️',
    '😮', '🤩', '😱', '💃', '🎁', '✨', '⭐', '💫', '🏆', '📦',
];

const REACTION_EMOJIS = ['❤️', '🔥', '😍', '👏', '💯', '😂', '🎉', '💕', '✨', '🙌'];

interface FloatEmoji { id: number; emoji: string; x: number }

export default function GoVendyTVWidget() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [title, setTitle] = useState('GoVendy TV');
    const [obsOnline, setObsOnline] = useState(false);
    const [videos, setVideos] = useState<PlatformVideo[]>([]);
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [noContent, setNoContent] = useState(false);
    const [hlsError, setHlsError] = useState(false);

    // Chat
    const [chatOpen, setChatOpen] = useState(true);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [newMsg, setNewMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Volume control for YouTube
    const [isMuted, setIsMuted] = useState(true);
    const ytIframeRef = useRef<HTMLIFrameElement>(null);

    // Emojis
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showReactionBar, setShowReactionBar] = useState(false);
    const [floatEmojis, setFloatEmojis] = useState<FloatEmoji[]>([]);
    const floatIdRef = useRef(0);
    const lastReactionRef = useRef(0);

    // Ads — fullscreen YouTube-style
    const [ads, setAds] = useState<AdCampaign[]>([]);
    const [currentAd, setCurrentAd] = useState<AdCampaign | null>(null);
    const [adVisible, setAdVisible] = useState(false);
    const [adSkipCountdown, setAdSkipCountdown] = useState(0);
    const adTimerRef = useRef<NodeJS.Timeout | null>(null);
    const adIdxRef = useRef(0);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/platform-live');
            const data = await res.json();
            if (data.session) {
                setSessionId(data.session.id);
                setTitle(data.session.title || 'GoVendy TV');
                setObsOnline(data.obs_online || false);
                setVideos(data.videos || []);
                setNoContent(!data.obs_online && (!data.videos || data.videos.length === 0));
            } else {
                setSessionId(null);
                setVideos(data.videos || []);
                setNoContent(!data.videos || data.videos.length === 0);
            }
        } catch {
            setNoContent(true);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const i = setInterval(load, 20000);
        return () => clearInterval(i);
    }, [load]);

    // Reset HLS error when session changes
    useEffect(() => { setHlsError(false); }, [sessionId]);

    // Check login status + admin
    useEffect(() => {
        (async () => {
            try {
                const { supabase } = await import('@/lib/supabase/client');
                const { data } = await supabase.auth.getUser();
                setIsLoggedIn(!!data.user);
                setCurrentUserId(data.user?.id ?? null);
                if (data.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('is_admin')
                        .eq('id', data.user.id)
                        .maybeSingle();
                    setIsAdmin(!!profile?.is_admin);
                }
            } catch { setIsLoggedIn(false); }
        })();
    }, []);

    // Load chat messages
    useEffect(() => {
        if (!sessionId || !chatOpen) return;
        let cancelled = false;
        const loadChat = async () => {
            try {
                const res = await fetch(`/api/live/chat?session_id=${sessionId}`);
                const data = await res.json();
                if (!cancelled) setMessages(data.messages || []);
            } catch { }
        };
        loadChat();
        const i = setInterval(loadChat, 3000);
        return () => { cancelled = true; clearInterval(i); };
    }, [sessionId, chatOpen]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleVideoEnded = () => {
        if (videos.length > 0) {
            setCurrentVideoIdx(prev => (prev + 1) % videos.length);
        }
    };

    // Auto-advance for YouTube videos
    useEffect(() => {
        if (obsOnline || !videos.length) return;
        const currentVideo = videos[currentVideoIdx % videos.length];
        if (!currentVideo) return;
        const ytId = getYouTubeId(currentVideo.video_url);
        if (!ytId) return;
        const timer = setTimeout(() => {
            setCurrentVideoIdx(prev => (prev + 1) % videos.length);
        }, 5 * 60 * 1000);
        return () => clearTimeout(timer);
    }, [currentVideoIdx, obsOnline, videos]);

    // YouTube postMessage helper
    const ytCommand = (func: string, args: any[] = []) => {
        const iframe = ytIframeRef.current;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func, args }),
                '*'
            );
        }
    };

    // YouTube volume: postMessage API (no iframe recreation)
    const toggleMute = () => {
        ytCommand(isMuted ? 'unMute' : 'mute');
        setIsMuted(prev => !prev);
    };

    const sendMessage = async () => {
        if (!sessionId || !newMsg.trim() || sending) return;
        setSending(true);
        try {
            const { supabase } = await import('@/lib/supabase/client');
            // Force session refresh: getUser() validates with server
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) { setIsLoggedIn(false); setSending(false); return; }
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) { setIsLoggedIn(false); setSending(false); return; }
            const res = await fetch('/api/live/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId, message: newMsg.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.message) setMessages(prev => [...prev, data.message]);
                setNewMsg('');
            } else {
                alert(data.error || 'Error al enviar mensaje');
            }
        } catch (err) { console.error('[TV Chat] Send failed:', err); }
        setSending(false);
    };

    // Moderation actions
    const moderateUser = async (userId: string, action: 'mute' | 'ban' | 'kick') => {
        const labels = { mute: 'silenciar', ban: 'bloquear', kick: 'expulsar' };
        if (!confirm(`¿${labels[action]} a este usuario?`)) return;
        try {
            const { supabase } = await import('@/lib/supabase/client');
            const { data: sess } = await supabase.auth.getSession();
            const token = sess.session?.access_token;
            if (!token) return;
            const res = await fetch('/api/live/chat/moderate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId, target_user_id: userId, action }),
            });
            const data = await res.json();
            alert(data.message || data.error || 'Hecho');
        } catch { }
    };

    // Emoji reaction
    const launchEmoji = (emoji: string) => {
        const now = Date.now();
        if (now - lastReactionRef.current < 160) return;
        lastReactionRef.current = now;
        const id = floatIdRef.current++;
        const x = 10 + Math.random() * 75;
        setFloatEmojis(prev => [...prev, { id, emoji, x }]);
        setTimeout(() => setFloatEmojis(prev => prev.filter(r => r.id !== id)), 2500);
    };

    // Fetch ad campaigns — refetch every 60s to pick up new campaigns
    const adsRef = useRef<AdCampaign[]>([]);
    adsRef.current = ads;

    useEffect(() => {
        const fetchAds = async () => {
            try {
                const url = sessionId
                    ? `/api/live/ads?session_id=${sessionId}`
                    : `/api/live/ads`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.ads?.length > 0) setAds(data.ads);
            } catch { }
        };
        fetchAds();
        const interval = setInterval(fetchAds, 60_000);
        return () => clearInterval(interval);
    }, [sessionId]);

    // Ad rotation timer
    useEffect(() => {
        if (ads.length === 0) return;
        const initialDelay = setTimeout(() => showNextAd(), 15_000);
        return () => clearTimeout(initialDelay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ads.length]);

    const showNextAd = () => {
        const currentAds = adsRef.current;
        if (currentAds.length === 0) return;
        const ad = currentAds[adIdxRef.current % currentAds.length];
        setCurrentAd(ad);
        setAdVisible(true);
        ytCommand('pauseVideo'); // Pause YouTube during ad
        adIdxRef.current++;

        // Skip countdown (5 seconds before user can skip)
        const skipDelay = Math.min(5, ad.duration_secs || 5);
        setAdSkipCountdown(skipDelay);
        let countdown = skipDelay;
        const countdownInterval = setInterval(() => {
            countdown--;
            setAdSkipCountdown(countdown);
            if (countdown <= 0) clearInterval(countdownInterval);
        }, 1000);

        // Track impression
        fetch('/api/live/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: ad.id, session_id: sessionId, type: 'impression' }),
        }).catch(() => { });

        // Auto-dismiss after duration — uniform 2min rotation between ALL ads
        if (adTimerRef.current) clearTimeout(adTimerRef.current);
        adTimerRef.current = setTimeout(() => {
            setAdVisible(false);
            ytCommand('playVideo'); // Resume YouTube after ad
            clearInterval(countdownInterval);
            adTimerRef.current = setTimeout(() => showNextAd(), 2 * 60 * 1000);
        }, (ad.duration_secs || 15) * 1000);
    };

    const skipAd = () => {
        setAdVisible(false);
        ytCommand('playVideo'); // Resume YouTube after skip
        if (adTimerRef.current) clearTimeout(adTimerRef.current);
        adTimerRef.current = setTimeout(() => showNextAd(), 2 * 60 * 1000);
    };

    const handleAdClick = (ad: AdCampaign) => {
        fetch('/api/live/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: ad.id, session_id: sessionId, type: 'click' }),
        }).catch(() => { });
        if (ad.target_url) window.open(ad.target_url, '_blank');
    };

    if (loading) return null;
    if (noContent && !sessionId) return null;

    const hlsUrl = sessionId && obsOnline ? `https://livekit.gopocket.com.mx/hls/${sessionId}.m3u8` : null;
    const currentVideo = videos.length > 0 ? videos[currentVideoIdx % videos.length] : null;

    return (
        <>
            <style>{`
                @keyframes float-up-emoji {
                    0%   { opacity:1; transform:translateY(0) scale(1); }
                    70%  { opacity:1; }
                    100% { opacity:0; transform:translateY(-200px) scale(1.6); }
                }
                .tv-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
                .tv-scroll::-webkit-scrollbar { width: 3px; }
                .tv-scroll::-webkit-scrollbar-track { background: transparent; }
                .tv-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
            `}</style>

            {/* YouTube Live-style layout: full-width video + chat panel on right */}
            <div className="flex-1 flex flex-col bg-black overflow-hidden min-h-0">
                {/* Header bar */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-black border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                                <Tv className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">{title}</div>
                                <div className="text-[9px] text-gray-500">Canal Oficial GoVendy</div>
                            </div>
                        </Link>
                    </div>
                    <div className="flex items-center gap-2">
                        {sessionId && (
                            <div className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                EN VIVO
                            </div>
                        )}
                        {sessionId && (
                            <ShareLiveButton
                                sessionId={sessionId}
                                title={title}
                                hostName="GoVendy TV"
                                size="sm"
                            />
                        )}
                        <button
                            onClick={() => setChatOpen(v => !v)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${chatOpen ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Chat
                        </button>
                    </div>
                </div>

                {/* Main content: Video + Chat side by side — fills remaining height */}
                <div className="flex flex-1 min-h-0">
                    {/* Video area — fills all available space */}
                    <div className="flex-1 relative bg-black overflow-hidden">
                        {/* Floating emoji reactions */}
                        {floatEmojis.map(r => (
                            <div key={r.id} className="absolute pointer-events-none select-none text-3xl z-30"
                                style={{ left: `${r.x}%`, bottom: '80px', animation: 'float-up-emoji 2.5s ease-out forwards' }}>{r.emoji}</div>
                        ))}

                        {/* ═══ FULLSCREEN AD — YouTube-style, covers entire video ═══ */}
                        {adVisible && currentAd && (
                            <div className="absolute inset-0 z-40 bg-black flex flex-col">
                                {/* Ad content — fills entire area */}
                                <div className="flex-1 relative overflow-hidden">
                                    {currentAd.content_url?.match(/\.(mp4|webm|mov)/i) ? (
                                        <video
                                            src={currentAd.content_url}
                                            autoPlay
                                            playsInline
                                            className="w-full h-full object-contain"
                                            onClick={() => handleAdClick(currentAd)}
                                        />
                                    ) : currentAd.content_url ? (
                                        <img
                                            src={currentAd.content_url}
                                            alt=""
                                            className="w-full h-full object-contain cursor-pointer"
                                            onClick={() => handleAdClick(currentAd)}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-red-900 to-orange-900 flex flex-col items-center justify-center text-center px-8 cursor-pointer"
                                            onClick={() => handleAdClick(currentAd)}>
                                            <div className="text-white text-2xl font-extrabold mb-2">{currentAd.title}</div>
                                            {currentAd.subtitle && <div className="text-red-200 text-base">{currentAd.subtitle}</div>}
                                        </div>
                                    )}
                                </div>
                                {/* Bottom bar — ad info + skip button */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-black/90 border-t border-white/10">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Anuncio</div>
                                        <div className="text-white text-xs font-semibold truncate">{currentAd.title}</div>
                                        {currentAd.target_url && (
                                            <button
                                                onClick={() => handleAdClick(currentAd)}
                                                className="bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-3 py-1 rounded-md transition-colors whitespace-nowrap"
                                            >
                                                {currentAd.cta_text || 'Ver más →'}
                                            </button>
                                        )}
                                    </div>
                                    {/* Skip button with countdown */}
                                    <div className="shrink-0 ml-3">
                                        {adSkipCountdown > 0 ? (
                                            <div className="text-gray-400 text-xs font-semibold border border-gray-600 px-3 py-1.5 rounded-md">
                                                Omitir en {adSkipCountdown}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={skipAd}
                                                className="text-white text-xs font-bold border border-white/40 hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors"
                                            >
                                                Omitir anuncio ▶
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Video content — rendered FIRST (base layer) */}
                        {hlsUrl && !hlsError ? (
                            <HLSPlayer
                                src={hlsUrl}
                                autoPlay
                                muted
                                className="w-full h-full object-contain"
                                onError={() => setHlsError(true)}
                            />
                        ) : currentVideo ? (
                            (() => {
                                const ytId = getYouTubeId(currentVideo.video_url);
                                if (ytId) {
                                    return (
                                        <div className="relative w-full h-full">
                                            <iframe
                                                ref={ytIframeRef}
                                                key={currentVideo.id}
                                                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&modestbranding=1&rel=0&showinfo=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; playsinline"
                                                allowFullScreen={false}
                                                className="w-full h-full border-0"
                                                title={currentVideo.title}
                                                style={{ pointerEvents: 'auto' }}
                                            />
                                            {/* Transparent overlay: pointer-events none so mobile can still interact with iframe if needed; UI buttons at z-30+ are above */}
                                            <div className="absolute inset-0" style={{ zIndex: 2, pointerEvents: 'none' }} />
                                        </div>
                                    );
                                }
                                return (
                                    <video
                                        ref={videoRef}
                                        key={currentVideo.id}
                                        src={currentVideo.video_url}
                                        autoPlay
                                        muted
                                        playsInline
                                        onEnded={handleVideoEnded}
                                        className="w-full h-full object-contain"
                                    />
                                );
                            })()
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                <div className="relative mb-3">
                                    <Tv className="w-16 h-16 text-gray-600" />
                                    {sessionId && <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse" />}
                                </div>
                                <div className="text-base font-bold text-gray-400">{sessionId ? 'Esperando transmisión...' : 'GoVendy TV'}</div>
                                <div className="text-xs text-gray-600 mt-0.5">{sessionId ? 'La transmisión comenzará en breve' : 'Próximamente'}</div>
                            </div>
                        )}

                        {/* ═══ CONTROLS OVERLAY — rendered AFTER video for proper z-stacking ═══ */}

                        {/* Reaction bar — bottom-center floating, above heart button, hidden during ads */}
                        {showReactionBar && !adVisible && (
                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1">
                                {REACTION_EMOJIS.map(e => (
                                    <button key={e} onClick={() => launchEmoji(e)}
                                        className="text-xl p-1 rounded-full hover:bg-white/10 active:scale-125 transition-transform">{e}</button>
                                ))}
                            </div>
                        )}

                        {/* Bottom-center controls: hidden during ads */}
                        {!adVisible && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2" style={{ zIndex: 50 }}>
                                <button
                                    onClick={() => setShowReactionBar(v => !v)}
                                    className="bg-black/60 backdrop-blur-sm text-xl w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/80 active:scale-110 transition-all select-none"
                                    style={{ pointerEvents: 'all' }}
                                >❤️</button>
                                {/* Volume button — only for YouTube/video mode (HLSPlayer has its own control) */}
                                {(!hlsUrl || hlsError) && (
                                    <button
                                        onClick={toggleMute}
                                        className={`flex items-center gap-1.5 backdrop-blur-sm rounded-full px-3 py-2 transition-all ${isMuted
                                            ? 'bg-white text-black hover:bg-gray-100 shadow-lg'
                                            : 'bg-black/60 text-white hover:bg-black/80'
                                            }`}
                                        style={{ pointerEvents: 'all' }}
                                    >
                                        {isMuted
                                            ? <><VolumeX className="w-4 h-4" /> <span className="text-[11px] font-bold">🔊 Audio</span></>
                                            : <Volume2 className="w-4 h-4" />
                                        }
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Chat Panel — YouTube Live style, right side */}
                    {chatOpen && (
                        <div className="w-[400px] flex flex-col bg-gray-900 border-l border-white/10 shrink-0">
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="text-white text-xs font-bold">💬 Chat en vivo</span>
                                    <span className="bg-gray-700 text-gray-400 text-[9px] px-1.5 py-0.5 rounded-full">{messages.length}</span>
                                </div>
                                <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-white p-1">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="tv-scroll flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
                                {messages.length === 0 && (
                                    <div className="text-center text-gray-600 text-xs py-8">
                                        💬 Sé el primero en escribir
                                    </div>
                                )}
                                {messages.map(m => {
                                    const name = m.profiles?.nickname || m.profiles?.full_name || 'Anónimo';
                                    return (
                                        <div key={m.id} className="group flex items-start gap-2">
                                            <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-300 shrink-0 mt-0.5">
                                                {name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[10px] font-semibold text-red-400">{name}</span>
                                                <p className="text-white text-[11px] break-words leading-tight">{m.message}</p>
                                            </div>
                                            {/* Admin moderation buttons */}
                                            {isAdmin && m.user_id && m.user_id !== currentUserId && (
                                                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                                    <button onClick={() => moderateUser(m.user_id, 'mute')} title="Silenciar"
                                                        className="p-0.5 rounded text-gray-500 hover:text-yellow-400 transition-colors">
                                                        <VolumeX className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => moderateUser(m.user_id, 'kick')} title="Expulsar"
                                                        className="p-0.5 rounded text-gray-500 hover:text-orange-400 transition-colors">
                                                        <UserX className="w-3 h-3" />
                                                    </button>
                                                    <button onClick={() => moderateUser(m.user_id, 'ban')} title="Bloquear"
                                                        className="p-0.5 rounded text-gray-500 hover:text-red-400 transition-colors">
                                                        <Ban className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input area */}
                            <div className="border-t border-white/5 p-2">
                                {isLoggedIn && sessionId ? (
                                    <>
                                        {showEmojiPicker && (
                                            <div className="mb-2 bg-gray-800 rounded-xl p-2" onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-gray-400 text-[9px] font-bold">Emojis</span>
                                                    <button onClick={() => setShowEmojiPicker(false)} className="touch-manipulation"><X className="w-3 h-3 text-gray-500" /></button>
                                                </div>
                                                <div className="grid grid-cols-10 gap-0.5">
                                                    {QUICK_EMOJIS.map(e => (
                                                        <button key={e}
                                                            onTouchEnd={(ev) => { ev.preventDefault(); ev.stopPropagation(); setNewMsg(prev => prev + e); }}
                                                            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setNewMsg(prev => prev + e); }}
                                                            className="text-base p-0.5 rounded hover:bg-gray-700 active:scale-110 transition-transform touch-manipulation select-none">{e}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-1 items-center">
                                            <button onClick={() => setShowEmojiPicker(v => !v)}
                                                className="text-yellow-400 hover:text-yellow-300 p-1 shrink-0">
                                                <Smile className="w-4 h-4" />
                                            </button>
                                            <input
                                                value={newMsg}
                                                onChange={e => setNewMsg(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                                                placeholder="Escribe un mensaje..."
                                                maxLength={500}
                                                className="flex-1 bg-white/5 text-white text-[11px] rounded-lg px-2.5 py-2 outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600"
                                            />
                                            <button
                                                type="button"
                                                onClick={sendMessage}
                                                disabled={!newMsg.trim() || sending}
                                                className="bg-red-600 text-white rounded-lg p-1.5 hover:bg-red-700 disabled:opacity-40 shrink-0 touch-manipulation"
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </>
                                ) : isLoggedIn && !sessionId ? (
                                    <div className="text-center text-gray-500 text-[10px] py-2">
                                        💬 Chat disponible cuando haya una transmisión en vivo
                                    </div>
                                ) : (
                                    <Link
                                        href="/login"
                                        className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 text-gray-300 hover:text-white rounded-lg text-[11px] font-semibold transition-colors"
                                    >
                                        <LogIn className="w-3 h-3" /> Inicia sesión para chatear
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
