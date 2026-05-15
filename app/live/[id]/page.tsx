'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
    Radio, Users, Send, ShoppingBag, ArrowLeft,
    ExternalLink, WifiOff, UserPlus, UserCheck, Smile, X, RefreshCw,
    VolumeX, Ban, UserX
} from 'lucide-react';
import {
    LiveKitRoom,
    useTracks,
    VideoTrack,
    RoomAudioRenderer,
    useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent } from 'livekit-client';
import dynamic from 'next/dynamic';
import { LiveAdManager } from '@/components/live/LiveAdManager';
import ShareLiveButton from '@/components/live/ShareLiveButton';

// HLS Player para streams vía OBS (cargado dinámicamente para evitar SSR issues)
const HLSPlayer = dynamic(() => import('@/components/HLSPlayer'), { ssr: false });

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string; message: string; created_at: string; user_id?: string;
    profiles: { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null; store_logo_url?: string | null } | null;
}
interface LiveSession {
    id: string; title: string; status: string; viewer_count: number;
    product_ids: string[]; host_id: string; started_at?: string;
    broadcast_mode?: 'browser' | 'obs' | null;
    is_free_session?: boolean;
    profiles: { id: string; full_name: string | null; nickname: string | null; avatar_url: string | null; store_logo_url?: string | null } | null;
}
interface Product { id: string; title: string; price: number; images: string[] }
interface FloatEmoji { id: number; emoji: string; x: number }

function getViewerId(sid: string): string {
    const key = `live_viewer_id_${sid}`;
    let id = sessionStorage.getItem(key);
    if (!id) { id = `${Date.now()}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem(key, id); }
    return id;
}

const QUICK_EMOJIS = [
    '😊', '😂', '🤣', '❤️', '😍', '🥰', '😘', '😁', '🎉', '🔥',
    '👏', '💯', '🙌', '✅', '💪', '🙏', '😎', '👍', '💰', '🛍️',
    '😮', '🤩', '😱', '💃', '🎁', '✨', '⭐', '💫', '🏆', '📦',
    '🤔', '👀', '💬', '🎶', '💜', '💕', '💖', '😢', '😅', '🤑',
];

// Reacciones TikTok — al presionar el botón sale un emoji aleatorio de esta lista
const TIKTOK_EMOJIS = ['❤️', '🔥', '😍', '👏', '💯', '😂', '🎉', '💕', '✨', '🙌'];

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
    return (
        <div className="absolute bottom-full mb-2 left-0 z-50 bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-white/10 p-3 w-64">
            <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs font-semibold">Emojis</span>
                <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-8 gap-1">
                {QUICK_EMOJIS.map(e => (
                    <button key={e} onClick={() => { onPick(e); }}
                        className="text-xl p-1 rounded-lg hover:bg-gray-700 active:scale-110 transition-transform touch-manipulation">{e}</button>
                ))}
            </div>
        </div>
    );
}

// ─── Botón de desbloqueo de audio (política autoplay del navegador) ───────────
function AudioUnlockOverlay() {
    const room = useRoomContext();
    const [needsUnlock, setNeedsUnlock] = useState(!room.canPlaybackAudio);

    useEffect(() => {
        const onStatus = () => setNeedsUnlock(!room.canPlaybackAudio);
        room.on(RoomEvent.AudioPlaybackStatusChanged, onStatus);
        return () => { room.off(RoomEvent.AudioPlaybackStatusChanged, onStatus); };
    }, [room]);

    if (!needsUnlock) return null;

    return (
        <button
            onClick={() => room.startAudio()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/80 backdrop-blur-sm text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-xl animate-bounce hover:bg-black active:scale-95 transition-all"
        >
            🔊 Toca para escuchar
        </button>
    );
}

// ─── Video LiveKit (DENTRO del único LiveKitRoom) ─────────────────────────────
function LiveVideo({ hostAvatar, hostName, sessionTitle, isLive, className }: {
    hostAvatar?: string | null; hostName: string; sessionTitle: string;
    isLive: boolean; className?: string;
}) {
    const tracks = useTracks(
        [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
        { onlySubscribed: true }
    );
    const remoteTrack = tracks.find(t => !t.participant.isLocal && t.publication?.kind === Track.Kind.Video);
    const [secs, setSecs] = useState(0);

    useEffect(() => {
        if (remoteTrack) { setSecs(0); return; }
        const t = setInterval(() => setSecs(s => s + 1), 1000);
        return () => clearInterval(t);
    }, [!!remoteTrack]);

    return (
        <div className={`w-full h-full overflow-hidden relative ${className ?? ''}`}>
            {remoteTrack ? (
                <VideoTrack trackRef={remoteTrack} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4 text-center">
                    {hostAvatar
                        ? <img src={hostAvatar} alt="" className="w-20 h-20 rounded-full ring-4 ring-red-500/40 object-cover mb-3" />
                        : <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-red-500/40 mb-3">{hostName.charAt(0)}</div>
                    }
                    <h2 className="text-white font-bold text-base">{hostName}</h2>
                    <p className="text-gray-400 text-sm mt-1">{sessionTitle}</p>
                    {isLive && (secs < 20
                        ? <p className="text-gray-500 text-xs mt-3 animate-pulse">Conectando al live...</p>
                        : <div className="mt-3 flex flex-col items-center gap-2">
                            <p className="text-gray-500 text-xs">Sin video por el momento</p>
                            <button onClick={() => window.location.reload()}
                                className="flex items-center gap-1.5 bg-red-500/20 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-500/30 active:scale-95">
                                <RefreshCw className="w-3 h-3" /> Reintentar
                            </button>
                        </div>
                    )}
                </div>
            )}
            {/* Botón de desbloqueo de audio cuando el navegador lo bloquea */}
            <AudioUnlockOverlay />
            <RoomAudioRenderer />
        </div>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function LiveViewerPage() {
    const params = useParams();
    const sessionId = params.id as string;

    const [session, setSession] = useState<LiveSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [floatEmojis, setFloatEmojis] = useState<FloatEmoji[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState('');
    // HLS URL para streams OBS
    const [hlsUrl, setHlsUrl] = useState<string | null>(null);
    // HLS URL from egress (auto-activated at 30+ viewers)
    const [egressHlsUrl, setEgressHlsUrl] = useState<string | null>(null);
    // JS-based screen detection — evita dos LiveKitRoom en el DOM
    const [isMobile, setIsMobile] = useState<boolean | null>(null);
    const [elapsedSecs, setElapsedSecs] = useState(0);
    const [endingLive, setEndingLive] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const floatId = useRef(0);
    const viewerIdRef = useRef('');
    const tokenFetchedRef = useRef(false);
    const lastTapRef = useRef(0); // control de velocidad de reacciones TikTok

    // Detectar tamaño de pantalla con JS (no CSS display:none)
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => { viewerIdRef.current = getViewerId(sessionId); }, [sessionId]);
    const getAuthToken = async () => (await supabase.auth.getSession()).data.session?.access_token;
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id ?? null);
            if (data.user) {
                supabase.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle()
                    .then(({ data: p }) => setIsAdmin(!!p?.is_admin));
            }
        });
    }, []);

    // ── Contador de tiempo del live ───────────────────────────────────────────
    useEffect(() => {
        if (!session?.started_at || session.status !== 'live') return;
        const base = new Date(session.started_at).getTime();
        const tick = () => setElapsedSecs(Math.floor((Date.now() - base) / 1000));
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [session?.started_at, session?.status]);

    const formatElapsed = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    // ── Terminar live ─────────────────────────────────────────────────────────
    const endLive = async () => {
        if (!session || endingLive) return;
        if (!confirm('¿Seguro que quieres terminar el live?')) return;
        setEndingLive(true);
        try {
            const token = await getAuthToken();
            await fetch('/api/live', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ session_id: session.id, action: 'end' }),
            });
            window.location.href = '/live';
        } catch { setEndingLive(false); }
    };

    // ── Cargar sesión ──────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), 8000);
                const res = await fetch('/api/live?status=all', { signal: ctrl.signal });
                clearTimeout(tid);
                const data = await res.json();
                if (!cancelled) {
                    const found = data.sessions?.find((s: any) => s.id === sessionId);
                    if (found) setSession(prev => {
                        // Conservar el viewer_count más alto (no resetear con valor viejo de DB)
                        if (!prev) return found;
                        return { ...found, viewer_count: Math.max(found.viewer_count ?? 0, prev.viewer_count ?? 0) };
                    });
                }
            } catch { if (!cancelled) setLoadError(true); }
            if (!cancelled) setLoading(false);
        };
        load();
        const interval = setInterval(load, 15_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [sessionId]);

    // ── Verificar seguimiento ──────────────────────────────────────────────────
    useEffect(() => {
        if (!session?.host_id || !currentUserId) return;
        (async () => {
            try {
                const { data } = await supabase.from('follows')
                    .select('follower_id').eq('follower_id', currentUserId).eq('seller_id', session.host_id).maybeSingle();
                setIsFollowing(!!data);
            } catch { }
        })();
    }, [session?.host_id, currentUserId]);

    // ── Conexión al stream — detecta modo (HLS para OBS, WebRTC para browser) ──
    useEffect(() => {
        if (!session || session.status !== 'live') return;
        if (tokenFetchedRef.current) return;
        tokenFetchedRef.current = true;

        if (session.broadcast_mode === 'obs') {
            // OBS → MediaMTX → HLS — estable, con buffer como YouTube
            setHlsUrl(`https://livekit.gopocket.com.mx/hls/${sessionId}.m3u8`);
        } else {
            // Browser mode → LiveKit WebRTC
            (async () => {
                try {
                    const authToken = await getAuthToken();
                    const headers: Record<string, string> = {};
                    if (authToken) headers['authorization'] = `Bearer ${authToken}`;
                    const res = await fetch(`/api/live/token?room=${sessionId}&host=false`, { headers });
                    const data = await res.json();
                    if (data.token) { setLivekitToken(data.token); setLivekitUrl(data.url); }
                } catch { tokenFetchedRef.current = false; }
            })();
        }
    }, [session?.status, sessionId]);

    // ── Vistas en tiempo real con Supabase Realtime Presence ──────────────────
    // No necesita tabla extra — usa WebSockets que Supabase ya tiene habilitados
    useEffect(() => {
        if (!session || session.status !== 'live') return;
        const vid = viewerIdRef.current;

        const channel = supabase.channel(`live_presence:${sessionId}`, {
            config: { presence: { key: vid } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                // Contar todos los espectadores activos
                const state = channel.presenceState();
                const count = Object.keys(state).length;
                setSession(prev => prev ? { ...prev, viewer_count: count } : prev);
                // Guardar en DB en segundo plano (no bloqueante)
                // Also check for egress HLS URL in response
                fetch('/api/live/viewers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId, action: 'sync', viewer_count: count }),
                }).then(r => r.json()).then(data => {
                    if (data.egress_hls_url && !egressHlsUrl) {
                        console.log('[Egress] HLS available, switching from WebRTC to CDN:', data.egress_hls_url);
                        setEgressHlsUrl(data.egress_hls_url);
                    }
                }).catch(() => { });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Registrar presencia de este espectador
                    await channel.track({ viewer_id: vid, ts: Date.now() });
                }
            });

        return () => {
            channel.untrack();
            supabase.removeChannel(channel);
        };
    }, [session?.status, sessionId]);

    // ── Chat — Supabase Realtime + initial fetch ──────────────────────────────
    const loadMessages = useCallback(async () => {
        try {
            const res = await fetch(`/api/live/chat?session_id=${sessionId}`);
            const data = await res.json();
            if (data.messages) setMessages(data.messages);
        } catch { }
    }, [sessionId]);

    useEffect(() => {
        loadMessages();
        // Realtime subscription for instant chat updates
        const channel = supabase
            .channel(`live_chat:${sessionId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${sessionId}` },
                async (payload) => {
                    const msg = payload.new as any;
                    // Fetch profile for the new message
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, full_name, nickname, avatar_url')
                        .eq('id', msg.user_id)
                        .maybeSingle();
                    const newMsg: ChatMessage = {
                        id: msg.id,
                        message: msg.message,
                        created_at: msg.created_at,
                        user_id: msg.user_id,
                        profiles: profile || null,
                    };
                    setMessages(prev => {
                        // Don't duplicate if already exists (optimistic)
                        if (prev.some(m => m.id === msg.id)) return prev;
                        // Replace temp message from same user with same text
                        const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.message === msg.message && m.user_id === msg.user_id));
                        return [...filtered, newMsg];
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [loadMessages, sessionId]);

    // ── Productos ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!session?.product_ids?.length) return;
        // Fetch via API to bypass RLS — ensures all products added by host are visible
        fetch(`/api/live/products?ids=${session.product_ids.join(',')}`)
            .then(r => r.json())
            .then(data => { if (data.products) setProducts(data.products); })
            .catch(() => {
                // Fallback to client query
                supabase.from('listings').select('id, title, price, images').in('id', session.product_ids)
                    .then(({ data }) => { if (data) setProducts(data); });
            });
    }, [session?.product_ids]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ── Enviar mensaje ─────────────────────────────────────────────────────────
    const sendMessage = async () => {
        const text = newMessage.trim();
        if (!text || sending) return;
        setSending(true); setNewMessage(''); setShowEmojiPicker(false);

        // Force session refresh: getUser() validates with server, then getSession() returns fresh token
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
            alert('Inicia sesión para chatear');
            setSending(false);
            return;
        }

        const tempId = `temp-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: tempId, message: text, created_at: new Date().toISOString(), user_id: user.id,
            profiles: { id: user.id, full_name: user.user_metadata?.full_name ?? null, nickname: user.user_metadata?.username ?? null, avatar_url: user.user_metadata?.avatar_url ?? null },
        }]);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) { alert('Tu sesión expiró, recarga la página'); setMessages(prev => prev.filter(m => m.id !== tempId)); setSending(false); return; }
            const res = await fetch('/api/live/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId, message: text }),
            });
            const data = await res.json();
            if (data.ok && data.message) setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
            else { setMessages(prev => prev.filter(m => m.id !== tempId)); if (data.error) { console.error('[Chat] Error:', data.error); alert(data.error); } }
        } catch (err) {
            console.error('[Chat] Send failed:', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
        setSending(false);
    };

    // ── Moderar usuario ─────────────────────────────────────────────────────
    const moderateUser = async (userId: string, action: 'mute' | 'ban' | 'kick') => {
        const labels = { mute: 'silenciar', ban: 'bloquear', kick: 'expulsar' };
        if (!confirm(`¿${labels[action]} a este usuario?`)) return;
        try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch('/api/live/chat/moderate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: sessionId, target_user_id: userId, action }),
            });
            const data = await res.json();
            alert(data.message || data.error || 'Hecho');
        } catch { }
    };

    // ── Reacción estilo TikTok — seleccionable ─────────────────────────────────
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    const launchEmoji = (emoji: string) => {
        const id = floatId.current++;
        const x = 10 + Math.random() * 75;
        setFloatEmojis(prev => [...prev, { id, emoji, x }]);
        setTimeout(() => setFloatEmojis(prev => prev.filter(r => r.id !== id)), 2500);
    };

    // Lanzar un emoji específico (seleccionado por el usuario)
    const handleReaction = (emoji: string) => {
        const now = Date.now();
        if (now - lastTapRef.current < 160) return;
        lastTapRef.current = now;
        launchEmoji(emoji);
    };

    // ── Seguir ─────────────────────────────────────────────────────────────────
    const toggleFollow = async () => {
        if (!session?.host_id || followLoading || currentUserId === session.host_id) return;
        setFollowLoading(true);
        try {
            const token = await getAuthToken();
            if (!token) { alert('Inicia sesión para seguir'); setFollowLoading(false); return; }
            const res = await fetch('/api/follows/toggle', {
                method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ seller_id: session.host_id }),
            });
            const data = await res.json();
            if (data.ok) setIsFollowing(data.following ?? !isFollowing);
        } catch { }
        setFollowLoading(false);
    };

    // ── Loading / Error ────────────────────────────────────────────────────────
    if (loading || isMobile === null) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
            <p className="text-gray-400 text-sm">Cargando transmisión...</p>
        </div>
    );

    if (loadError || !session) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 text-white gap-4 p-4">
            {loadError ? <WifiOff className="w-14 h-14 text-gray-600" /> : <Radio className="w-14 h-14 text-gray-600" />}
            <h2 className="text-xl font-bold">{loadError ? 'Sin conexión' : 'Transmisión no encontrada'}</h2>
            <p className="text-gray-400 text-sm text-center">{loadError ? 'Revisa tu conexión.' : 'Esta transmisión ya finalizó.'}</p>
            <div className="flex gap-3">
                {loadError && <button onClick={() => { setLoadError(false); setLoading(true); }} className="bg-red-500 text-white px-4 py-2 rounded-xl font-semibold text-sm">Reintentar</button>}
                <Link href="/live" className="bg-gray-700 text-white px-4 py-2 rounded-xl font-semibold text-sm">← Volver</Link>
            </div>
        </div>
    );

    const host = session.profiles;
    const hostName = host?.nickname || host?.full_name || 'Vendedor';
    const isLive = session.status === 'live';
    const isOwnStream = currentUserId === session.host_id;

    // ── Sub-componentes ────────────────────────────────────────────────────────
    const followBtn = !isOwnStream && (
        <button onClick={toggleFollow} disabled={followLoading}
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-60 ${isFollowing ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
            {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {followLoading ? '...' : isFollowing ? 'Siguiendo' : 'Seguir'}
        </button>
    );

    const chatInput = isLive ? (
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800">
            {/* Reaction picker — emojis seleccionables */}
            {showReactionPicker && (
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-900/80 border-b border-gray-700 overflow-x-auto scrollbar-none">
                    {TIKTOK_EMOJIS.map(e => (
                        <button key={e} onClick={() => handleReaction(e)}
                            className="text-2xl p-1 rounded-lg hover:bg-gray-700 active:scale-125 transition-transform flex-shrink-0 touch-manipulation">{e}</button>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-2 p-2">
                {/* Botón de reacciones — abre picker */}
                <button
                    onClick={() => setShowReactionPicker(v => !v)}
                    className={`flex-shrink-0 text-2xl select-none active:scale-110 transition-transform touch-manipulation ${showReactionPicker ? 'bg-gray-700 rounded-lg' : ''}`}
                    title="Reaccionar">❤️</button>
                <div className="relative flex-1 flex items-center">
                    {showEmojiPicker && <EmojiPicker onPick={e => setNewMessage(prev => prev + e)} onClose={() => setShowEmojiPicker(false)} />}
                    <button onClick={() => setShowEmojiPicker(v => !v)} className="absolute left-3 text-yellow-400 hover:text-yellow-300 z-10 touch-manipulation" title="Emojis">
                        <Smile className="w-5 h-5" />
                    </button>
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
                        placeholder="Escribe un mensaje..." maxLength={500}
                        className="w-full bg-gray-700 text-white text-sm rounded-xl pl-10 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500" />
                </div>
                <button type="button" onClick={sendMessage} disabled={!newMessage.trim() || sending}
                    className="flex-shrink-0 bg-red-500 text-white rounded-xl p-2.5 hover:bg-red-600 disabled:opacity-40 active:scale-95 transition-all touch-manipulation">
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    ) : (
        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800 text-center text-gray-500 text-sm">Esta transmisión ha finalizado</div>
    );

    const canModerate = isOwnStream || isAdmin;

    const renderMessages = () => messages.map(msg => {
        const sender = msg.profiles;
        const senderName = sender?.nickname || sender?.full_name || 'Anónimo';
        const isHost = sender?.id === session.host_id || msg.user_id === session.host_id;
        const showModTools = canModerate && msg.user_id && msg.user_id !== currentUserId;
        return (
            <div key={msg.id} className={`group flex items-start gap-2 ${msg.id.startsWith('temp-') ? 'opacity-60' : ''}`}>
                {(sender?.store_logo_url || sender?.avatar_url)
                    ? <img src={sender.store_logo_url || sender.avatar_url || ''} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                    : <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5 ${isHost ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}`}>{senderName.charAt(0).toUpperCase()}</div>
                }
                <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-semibold ${isHost ? 'text-red-400' : 'text-gray-400'}`}>
                        {senderName}{isHost && <span className="ml-1 bg-red-500/20 text-red-300 px-1 rounded text-[8px]">Vendedor</span>}
                    </span>
                    <p className="text-white text-sm break-words">{msg.message}</p>
                </div>
                {showModTools && (
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                        <button onClick={() => moderateUser(msg.user_id!, 'mute')} title="Silenciar"
                            className="p-1 rounded text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                            <VolumeX className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moderateUser(msg.user_id!, 'kick')} title="Expulsar"
                            className="p-1 rounded text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors">
                            <UserX className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moderateUser(msg.user_id!, 'ban')} title="Bloquear"
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <Ban className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        );
    });

    const floatEmojisEl = floatEmojis.map(r => (
        <div key={r.id} className="absolute pointer-events-none select-none text-3xl z-30"
            style={{ left: `${r.x}%`, bottom: '80px', animation: 'float-up-emoji 2.5s ease-out forwards' }}>{r.emoji}</div>
    ));

    // ── VIDEO — HLS para OBS streams, WebRTC para browser streams ──────────────
    const liveVideo = isLive && hlsUrl ? (
        // HLS Player — estilo YouTube, con buffer y sin freezes
        <div className="absolute inset-0">
            <HLSPlayer
                src={hlsUrl}
                className="w-full h-full"
                autoPlay={true}
                muted={true}
            />
        </div>
    ) : isLive && egressHlsUrl ? (
        // Egress HLS — auto-activated at 30+ viewers, served via Cloudflare CDN
        <div className="absolute inset-0">
            <HLSPlayer
                src={egressHlsUrl}
                className="w-full h-full"
                autoPlay={true}
                muted={true}
            />
            <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-sm text-green-400 text-[10px] font-mono px-2 py-0.5 rounded-full">
                CDN
            </div>
        </div>
    ) : isLive && livekitToken ? (
        // WebRTC LiveKit — para streams desde el browser
        <LiveKitRoom
            video={false} audio={false}
            token={livekitToken} serverUrl={livekitUrl}
            style={{ position: 'absolute', inset: 0, background: 'transparent' }}
            options={{
                adaptiveStream: true,
                dynacast: true,
                stopLocalTrackOnUnpublish: false,
            }}
        >
            <LiveVideo
                hostAvatar={host?.avatar_url} hostName={hostName}
                sessionTitle={session.title} isLive={isLive}
            />
        </LiveKitRoom>
    ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mb-3 animate-pulse">
                <Radio className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-white font-bold text-base">{hostName}</h2>
            <p className="text-gray-400 text-sm mt-1">{session.title}</p>
            {isLive && <p className="text-gray-500 text-xs mt-2 animate-pulse">Conectando...</p>}
            {!isLive && <div className="mt-3 bg-gray-700 text-gray-300 text-sm font-bold px-3 py-1.5 rounded-lg">FINALIZADA</div>}
        </div>
    );

    return (
        <>
            <style>{`
                @keyframes float-up-emoji {
                    0%   { opacity:1; transform:translateY(0) scale(1); }
                    70%  { opacity:1; }
                    100% { opacity:0; transform:translateY(-220px) scale(1.8); }
                }
                /* Scrollbar discreta */
                .live-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
                .live-scroll::-webkit-scrollbar { width: 3px; }
                .live-scroll::-webkit-scrollbar-track { background: transparent; }
                .live-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
                .live-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
            `}</style>

            {/* ══ MÓVIL — solo renderizado si isMobile === true ══ */}
            {isMobile && (
                <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ height: '100dvh' }}>
                    {/* ══ BARRA DE MARCA — visible para todos ══ */}
                    {session && (
                        <div className="flex-shrink-0 flex items-center justify-between bg-black px-3 py-2 z-30" style={{ borderBottom: '1px solid #222' }}>
                            {/* Logo GoVendy Live */}
                            <div className="flex items-center gap-1.5">
                                <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                                <span className="text-white text-sm font-bold tracking-wide">GoVendy <span className="text-red-500">Live</span></span>
                            </div>
                            {/* Timer + botón — solo host */}
                            {currentUserId && currentUserId === session.host_id ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
                                        {formatElapsed(elapsedSecs)}
                                    </div>
                                    <button
                                        onClick={endLive}
                                        disabled={endingLive}
                                        className="flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
                                    >
                                        {endingLive ? '...' : '⏹ Terminar'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-xs">{session.status === 'live' ? '🔴 En vivo' : ''}</div>
                            )}
                        </div>
                    )}
                    {/* Video 60% */}
                    <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 'calc(60% - 44px)' }}>
                        {liveVideo}
                        {/* Ad Manager — solo en sesiones gratuitas */}
                        <LiveAdManager sessionId={sessionId} isFreeSession={session.is_free_session !== false} />
                        <Link href="/live" className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg">
                            <ArrowLeft className="w-3.5 h-3.5" /> Lives
                        </Link>
                        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                            <ShareLiveButton sessionId={sessionId} title={session.title} hostName={hostName} size="sm" />
                            {followBtn}
                            {isLive
                                ? <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-2.5 py-1.5 rounded-lg animate-pulse"><div className="w-2 h-2 bg-white rounded-full" /> EN VIVO</div>
                                : <div className="bg-gray-700 text-gray-300 text-xs font-bold px-2.5 py-1.5 rounded-lg">FINALIZADA</div>
                            }
                        </div>
                        {/* Viewer count + GoVendy Live badge — bottom left */}
                        <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-1.5">
                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg">
                                <Users className="w-3.5 h-3.5" /> {session.viewer_count || 0} viendo
                            </div>
                            {isLive && (
                                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-lg">
                                    <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                                    <span className="font-bold">GoVendy <span className="text-red-400">Live</span></span>
                                </div>
                            )}
                        </div>
                        {floatEmojisEl}
                    </div>

                    {/* Productos — TikTok Shop style */}
                    {products.length > 0 && (
                        <div className="flex-shrink-0 bg-gray-950 border-b border-white/10 px-3 pt-2 pb-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white text-[11px] font-bold flex items-center gap-1"><ShoppingBag className="w-3 h-3 text-red-400" /> Tienda en vivo</span>
                                <span className="text-gray-400 text-[10px]">{products.length} productos · desliza →</span>
                            </div>
                            <div className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                {products.map(p => (
                                    <Link key={p.id} href={`/listings/${p.id}`} target="_blank"
                                        className="flex-shrink-0 w-[88px] rounded-xl overflow-hidden bg-gray-800 hover:ring-2 hover:ring-red-500 transition-all active:scale-95">
                                        <div className="relative">
                                            {p.images?.[0] ? (
                                                <img src={p.images[0]} alt="" className="w-full h-[88px] object-cover" />
                                            ) : (
                                                <div className="w-full h-[88px] bg-gray-700 flex items-center justify-center">
                                                    <ShoppingBag className="w-6 h-6 text-gray-500" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1">
                                                <p className="text-red-400 text-[11px] font-black">${p.price?.toLocaleString('es-MX')}</p>
                                            </div>
                                        </div>
                                        <div className="px-1.5 py-1.5">
                                            <p className="text-white text-[9px] font-medium line-clamp-2 leading-tight mb-1.5">{p.title}</p>
                                            <div className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded text-center">Comprar →</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chat */}
                    <div className="flex flex-col flex-1 min-h-0 bg-gray-900">
                        <div className="live-scroll flex-1 overflow-y-auto px-3 py-2 space-y-2">
                            {messages.length === 0 && <div className="text-center py-6 text-gray-500 text-xs">Sé el primero en chatear 💬</div>}
                            {renderMessages()}
                            <div ref={chatEndRef} />
                        </div>
                        {chatInput}
                    </div>
                </div>
            )}

            {/* ══ DESKTOP — Fullscreen YouTube-style ══ */}
            {!isMobile && (
                <div className="fixed inset-0 z-[9999] bg-black flex">

                    {/* ── Izquierda: Video + productos (llena todo el alto) ── */}
                    <div className="flex-1 flex flex-col min-w-0 h-full">
                        {/* Barra superior — GoVendy Live + controles */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-black border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <Link href="/live" className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                </Link>
                                <div className="flex items-center gap-2">
                                    <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                                    <span className="text-white font-bold tracking-wide">GoVendy <span className="text-red-500">TV</span></span>
                                </div>
                                {host && (
                                    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
                                        <span className="text-white/80 text-sm font-medium">{hostName}</span>
                                        {followBtn}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {isLive && (
                                    <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-lg">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> EN VIVO
                                    </div>
                                )}
                                {!isLive && (
                                    <div className="bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg">FINALIZADA</div>
                                )}
                                <div className="flex items-center gap-1.5 bg-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg">
                                    <Users className="w-3.5 h-3.5" /> {session.viewer_count || 0}
                                </div>
                                {isLive && elapsedSecs > 0 && (
                                    <div className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        {formatElapsed(elapsedSecs)}
                                    </div>
                                )}
                                <ShareLiveButton sessionId={sessionId} title={session.title} hostName={hostName} size="md" />
                                {currentUserId && currentUserId === session.host_id && (
                                    <button
                                        onClick={endLive}
                                        disabled={endingLive}
                                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
                                    >
                                        {endingLive ? '...' : '⏹ Terminar'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Video — llena todo el espacio restante */}
                        <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
                            {liveVideo}
                            <LiveAdManager sessionId={sessionId} isFreeSession={session.is_free_session !== false} />
                            {floatEmojisEl}
                        </div>

                        {/* Productos — TikTok Shop style, debajo del video */}
                        {products.length > 0 && (
                            <div className="flex-shrink-0 bg-gray-950 border-t border-white/10 px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="flex items-center gap-1.5 text-white text-xs font-bold">
                                        <ShoppingBag className="w-3.5 h-3.5 text-red-400" /> 🛍️ Tienda en vivo
                                    </span>
                                    <span className="text-gray-400 text-[10px]">{products.length} productos</span>
                                </div>
                                <div className="flex items-end gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                    {products.map(product => (
                                        <Link key={product.id} href={`/listings/${product.id}`} target="_blank"
                                            className="flex-shrink-0 w-[100px] rounded-xl overflow-hidden bg-gray-800 hover:ring-2 hover:ring-red-500 transition-all group active:scale-95">
                                            <div className="relative">
                                                {product.images?.[0] ? (
                                                    <img src={product.images[0]} alt="" className="w-full h-[100px] object-cover" />
                                                ) : (
                                                    <div className="w-full h-[100px] bg-gray-700 flex items-center justify-center">
                                                        <ShoppingBag className="w-8 h-8 text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5">
                                                    <p className="text-red-400 text-xs font-black">${product.price?.toLocaleString('es-MX')}</p>
                                                </div>
                                            </div>
                                            <div className="px-2 py-2">
                                                <p className="text-white text-[10px] font-medium line-clamp-2 leading-tight mb-2">{product.title}</p>
                                                <div className="bg-red-600 group-hover:bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg text-center transition-colors">Comprar →</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Derecha: Chat panel (ancho fijo, como YouTube) ── */}
                    <div className="w-[400px] flex-shrink-0 flex flex-col bg-gray-900 border-l border-white/10 h-full">
                        {/* Header del chat */}
                        <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-sm">💬 Chat en vivo</span>
                                <span className="bg-white/10 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{messages.length}</span>
                            </div>
                            <button className="text-gray-500 hover:text-white transition-colors" title="Cerrar chat">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Mensajes */}
                        <div className="live-scroll flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
                            {messages.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">Sé el primero en escribir</div>}
                            {renderMessages()}
                            <div ref={chatEndRef} />
                        </div>
                        {/* Input */}
                        {chatInput}
                    </div>
                </div>
            )}
        </>
    );
}
