'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Play, Square, RefreshCw, Trash2, Plus, Copy, Check, Tv, Film, Settings, MessageCircle, VolumeX, Ban, UserX } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

interface PlatformSession {
    id: string;
    title: string;
    description: string | null;
    status: string;
    viewer_count: number;
    started_at: string | null;
}

interface PlatformVideo {
    id: string;
    title: string;
    video_url: string;
    thumbnail_url: string | null;
    duration_seconds: number;
    sort_order: number;
    is_active: boolean;
}

export default function GoVendyTVPage() {
    const [session, setSession] = useState<PlatformSession | null>(null);
    const [obsOnline, setObsOnline] = useState(false);
    const [videos, setVideos] = useState<PlatformVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [rtmpInfo, setRtmpInfo] = useState<{ rtmp_url: string; stream_key: string; hls_url: string } | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    // New video form
    const [newTitle, setNewTitle] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [tab, setTab] = useState<'control' | 'videos' | 'chat'>('control');

    const supabaseRef = useRef(createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ));

    const getToken = useCallback(async () => {
        try {
            const { data: { session: authSession } } = await supabaseRef.current.auth.getSession();
            if (authSession?.access_token) {
                setAccessToken(authSession.access_token);
                return authSession.access_token;
            }
            // Try refreshing
            const { data: { session: refreshed } } = await supabaseRef.current.auth.refreshSession();
            if (refreshed?.access_token) {
                setAccessToken(refreshed.access_token);
                return refreshed.access_token;
            }
        } catch { /* auth not available */ }
        return null;
    }, []);

    const authHeaders = useCallback(async () => {
        const token = await getToken();
        if (!token) throw new Error('Sesión expirada. Recarga la página (Ctrl+F5) para volver a iniciar sesión.');
        return { 'Authorization': `Bearer ${token}` };
    }, [getToken]);

    const load = useCallback(async () => {
        try {
            const token = await getToken();
            const hdrs: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

            const [liveRes, vidRes] = await Promise.all([
                fetch('/api/admin/platform-live', { headers: hdrs }),
                fetch('/api/admin/platform-videos', { headers: hdrs }),
            ]);
            const liveData = await liveRes.json();
            const vidData = await vidRes.json();
            if (liveData.error || vidData.error) {
                // Don't show auth errors from GET — just silently ignore
            } else {
                setSession(liveData.session || null);
                setObsOnline(liveData.obs_online || false);
                setVideos(vidData.videos || []);
                if (liveData.session) {
                    setEditTitle(liveData.session.title || '');
                    setEditDesc(liveData.session.description || '');
                }
            }
        } catch { }
        setLoading(false);
    }, [getToken]);

    useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

    const flash = (type: 'ok' | 'err', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const startLive = async () => {
        setActionLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/admin/platform-live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...hdrs },
                body: JSON.stringify({ title: editTitle || 'GoVendy TV', description: editDesc }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSession(data.session);
            setRtmpInfo({ rtmp_url: data.rtmp_url, stream_key: data.stream_key, hls_url: data.hls_url });
            flash('ok', '✅ Sesión de plataforma activada. Configura OBS con las credenciales.');
        } catch (e: any) { flash('err', e.message); }
        setActionLoading(false);
    };

    const endLive = async () => {
        if (!confirm('¿Finalizar GoVendy TV?')) return;
        setActionLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/admin/platform-live', { method: 'DELETE', headers: hdrs });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSession(null);
            setRtmpInfo(null);
            flash('ok', '⬛ Sesión finalizada.');
        } catch (e: any) { flash('err', e.message); }
        setActionLoading(false);
    };

    const updateInfo = async () => {
        setActionLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/admin/platform-live', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...hdrs },
                body: JSON.stringify({ title: editTitle, description: editDesc }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSession(data.session);
            flash('ok', '✅ Información actualizada.');
        } catch (e: any) { flash('err', e.message); }
        setActionLoading(false);
    };

    const addVideo = async () => {
        if (!newTitle.trim() || !newUrl.trim()) return;
        setActionLoading(true);
        try {
            const hdrs = await authHeaders();
            const res = await fetch('/api/admin/platform-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...hdrs },
                body: JSON.stringify({ title: newTitle, video_url: newUrl }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setNewTitle('');
            setNewUrl('');
            await load();
            flash('ok', '✅ Video agregado.');
        } catch (e: any) { flash('err', e.message); }
        setActionLoading(false);
    };

    const deleteVideo = async (id: string) => {
        if (!confirm('¿Eliminar este video?')) return;
        try {
            const hdrs = await authHeaders();
            await fetch(`/api/admin/platform-videos?id=${id}`, { method: 'DELETE', headers: hdrs });
            await load();
            flash('ok', 'Video eliminado.');
        } catch { }
    };

    const toggleVideo = async (id: string, active: boolean) => {
        try {
            const hdrs = await authHeaders();
            await fetch('/api/admin/platform-videos', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...hdrs },
                body: JSON.stringify({ id, is_active: active }),
            });
            await load();
        } catch { }
    };

    const copyToClipboard = async (text: string, label: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    const getElapsed = (startedAt: string) => {
        const ms = Date.now() - new Date(startedAt).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-900 via-red-800 to-orange-900 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
                            <Tv className="w-6 h-6 text-red-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight">GoVendy TV</h1>
                            <p className="text-red-200 text-sm">Canal oficial de la plataforma — Anuncios y ofertas 24/7</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Message */}
                {message && (
                    <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.type === 'ok' ? 'bg-green-900/50 text-green-300 ring-1 ring-green-700' : 'bg-red-900/50 text-red-300 ring-1 ring-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {/* Status Card */}
                <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 overflow-hidden">
                    <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${session ? (obsOnline ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse') : 'bg-gray-600'}`} />
                            <div>
                                <div className="font-bold text-sm">
                                    {session ? (obsOnline ? '🟢 EN VIVO — OBS Conectado' : '🟡 Sesión Activa — OBS Desconectado (mostrando videos)') : '⬛ Offline'}
                                </div>
                                {session?.started_at && (
                                    <div className="text-xs text-gray-400 mt-0.5">Duración: {getElapsed(session.started_at)}</div>
                                )}
                            </div>
                        </div>
                        <button onClick={load} className="text-gray-500 hover:text-white transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Quick actions */}
                    <div className="border-t border-white/5 p-4 flex gap-3">
                        {!session ? (
                            <button
                                onClick={startLive}
                                disabled={actionLoading}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Play className="w-4 h-4" /> Iniciar GoVendy TV
                            </button>
                        ) : (
                            <button
                                onClick={endLive}
                                disabled={actionLoading}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Square className="w-4 h-4" /> Finalizar
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button onClick={() => setTab('control')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'control' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                        <Settings className="w-4 h-4" /> Control
                    </button>
                    <button onClick={() => setTab('videos')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'videos' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                        <Film className="w-4 h-4" /> Videos ({videos.length})
                    </button>
                    <button onClick={() => setTab('chat')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'chat' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                        <MessageCircle className="w-4 h-4" /> Chat & Moderación
                    </button>
                </div>

                {/* Control Tab */}
                {tab === 'control' && (
                    <div className="space-y-6">
                        {/* RTMP Credentials */}
                        {(session || rtmpInfo) && (
                            <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 p-5 space-y-4">
                                <div className="text-sm font-bold text-red-400">🎥 Credenciales OBS</div>
                                {(() => {
                                    const streamKey = rtmpInfo?.stream_key || session?.id || '';
                                    const rtmpUrl = rtmpInfo?.rtmp_url || 'rtmp://stream.gopocket.com.mx/live';
                                    const hlsUrl = rtmpInfo?.hls_url || `https://livekit.gopocket.com.mx/hls/${streamKey}.m3u8`;
                                    return (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Servidor RTMP</label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="flex-1 bg-black/40 text-green-400 text-xs px-3 py-2 rounded-lg font-mono truncate">{rtmpUrl}</code>
                                                    <button onClick={() => copyToClipboard(rtmpUrl, 'rtmp')} className="text-gray-500 hover:text-white">
                                                        {copied === 'rtmp' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Stream Key</label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="flex-1 bg-black/40 text-yellow-400 text-xs px-3 py-2 rounded-lg font-mono truncate">{streamKey}</code>
                                                    <button onClick={() => copyToClipboard(streamKey, 'key')} className="text-gray-500 hover:text-white">
                                                        {copied === 'key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">URL HLS (viewer)</label>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="flex-1 bg-black/40 text-blue-400 text-xs px-3 py-2 rounded-lg font-mono truncate">{hlsUrl}</code>
                                                    <button onClick={() => copyToClipboard(hlsUrl, 'hls')} className="text-gray-500 hover:text-white">
                                                        {copied === 'hls' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="text-[11px] text-gray-500 bg-black/20 rounded-lg p-3">
                                    <strong>Instrucciones:</strong> En OBS → Ajustes → Emisión → Servicio: Personalizado → pega el servidor y la clave de stream.
                                </div>
                            </div>
                        )}

                        {/* Edit Title/Description */}
                        <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 p-5 space-y-4">
                            <div className="text-sm font-bold text-gray-300">✏️ Información del Live</div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400">Título</label>
                                <input
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    className="w-full mt-1 bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 ring-1 ring-white/10 focus:ring-red-500 outline-none"
                                    placeholder="GoVendy TV — Ofertas Flash"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-400">Descripción</label>
                                <textarea
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                    rows={2}
                                    className="w-full mt-1 bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 ring-1 ring-white/10 focus:ring-red-500 outline-none resize-none"
                                    placeholder="Anuncios y ofertas exclusivas de GoVendy"
                                />
                            </div>
                            {session && (
                                <button
                                    onClick={updateInfo}
                                    disabled={actionLoading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    Actualizar
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Videos Tab */}
                {tab === 'videos' && (
                    <div className="space-y-6">
                        <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 p-5 space-y-4">
                            <div className="text-sm font-bold text-gray-300">
                                📂 Videos para cuando OBS está apagado
                            </div>
                            <p className="text-xs text-gray-500">
                                Estos videos se reproducen automáticamente en loop cuando no estás transmitiendo en OBS. Sube URLs de videos (MP4, webm) alojados en Supabase Storage, YouTube, o cualquier CDN.
                            </p>

                            {/* Add video form */}
                            <div className="flex gap-2">
                                <input
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Título del video"
                                    className="flex-1 bg-black/40 text-white text-sm rounded-xl px-3 py-2 ring-1 ring-white/10 outline-none focus:ring-red-500"
                                />
                                <input
                                    value={newUrl}
                                    onChange={e => setNewUrl(e.target.value)}
                                    placeholder="URL del video (MP4)"
                                    className="flex-[2] bg-black/40 text-white text-sm rounded-xl px-3 py-2 ring-1 ring-white/10 outline-none focus:ring-red-500"
                                />
                                <button
                                    onClick={addVideo}
                                    disabled={!newTitle.trim() || !newUrl.trim() || actionLoading}
                                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
                                >
                                    <Plus className="w-4 h-4" /> Agregar
                                </button>
                            </div>

                            {/* Video list */}
                            {videos.length === 0 ? (
                                <div className="text-center py-8 text-gray-600 text-sm">No hay videos aún. Agrega URLs de videos promocionales.</div>
                            ) : (
                                <div className="space-y-2">
                                    {videos.map((v, i) => (
                                        <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl ${v.is_active ? 'bg-white/5' : 'bg-white/[0.02] opacity-50'} ring-1 ring-white/5`}>
                                            <div className="text-xs text-gray-600 font-bold w-6 text-center">{i + 1}</div>
                                            <Film className="w-4 h-4 text-gray-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-white truncate">{v.title}</div>
                                                <div className="text-[10px] text-gray-500 truncate">{v.video_url}</div>
                                            </div>
                                            <button
                                                onClick={() => toggleVideo(v.id, !v.is_active)}
                                                className={`text-[10px] font-bold px-2 py-1 rounded-lg ${v.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}
                                            >
                                                {v.is_active ? 'ACTIVO' : 'INACTIVO'}
                                            </button>
                                            <button onClick={() => deleteVideo(v.id)} className="text-gray-600 hover:text-red-400">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Chat & Moderación Tab */}
                {tab === 'chat' && <AdminChatPanel sessionId={session?.id || null} accessToken={accessToken} />}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Chat & Moderation Panel
// ═══════════════════════════════════════════════════════════════════════════════
interface AdminChatPanelProps {
    sessionId: string | null;
    accessToken: string | null;
}

interface AdminChatMsg {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    profiles?: { full_name: string | null; nickname: string | null; avatar_url: string | null } | null;
}

interface BanRecord {
    id: string;
    user_id: string;
    action: string;
    is_active: boolean;
    created_at: string;
    expires_at: string | null;
    user_profile?: { full_name: string | null; nickname: string | null } | null;
}

function AdminChatPanel({ sessionId, accessToken }: AdminChatPanelProps) {
    const [messages, setMessages] = useState<AdminChatMsg[]>([]);
    const [bans, setBans] = useState<BanRecord[]>([]);
    const [loadingBans, setLoadingBans] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Load chat messages
    useEffect(() => {
        if (!sessionId) return;
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
    }, [sessionId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load banned/muted users
    const loadBans = useCallback(async () => {
        if (!accessToken) return;
        setLoadingBans(true);
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data } = await supabase
                .from('live_chat_bans')
                .select('id, user_id, action, is_active, created_at, expires_at')
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            if (data) {
                const userIds = [...new Set(data.map((b: any) => b.user_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, nickname')
                    .in('id', userIds);
                const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
                setBans(data.map((b: any) => ({
                    ...b,
                    user_profile: profileMap.get(b.user_id) || null,
                })));
            }
        } catch { }
        setLoadingBans(false);
    }, [accessToken]);

    useEffect(() => { loadBans(); }, [loadBans]);

    const moderateUser = async (userId: string, action: 'mute' | 'ban' | 'kick' | 'unmute' | 'unban') => {
        const labels: Record<string, string> = {
            mute: 'silenciar', ban: 'bloquear', kick: 'expulsar',
            unmute: 'quitar silencio', unban: 'desbloquear',
        };
        if (!confirm(`¿${labels[action]} a este usuario?`)) return;
        try {
            const res = await fetch('/api/live/chat/moderate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ session_id: sessionId, target_user_id: userId, action }),
            });
            const data = await res.json();
            alert(data.message || data.error || 'Hecho');
            loadBans();
        } catch { }
    };

    if (!sessionId) {
        return (
            <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <div className="text-gray-400 font-bold text-sm">No hay sesión activa</div>
                <div className="text-gray-600 text-xs mt-1">Inicia una sesión de GoVendy TV para ver y moderar el chat</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Chat Messages */}
            <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-bold">Chat en Vivo</span>
                        <span className="bg-gray-700 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{messages.length} msgs</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-900/30 text-green-400 text-[10px] font-bold px-2 py-1 rounded-lg">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Actualización automática
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto p-4 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                    {messages.length === 0 && (
                        <div className="text-center text-gray-600 text-xs py-10">💬 No hay mensajes aún</div>
                    )}
                    {messages.map(m => {
                        const name = m.profiles?.nickname || m.profiles?.full_name || 'Anónimo';
                        const time = new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <div key={m.id} className="flex items-start gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5 hover:bg-gray-800 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300 shrink-0">
                                    {name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-red-400">{name}</span>
                                        <span className="text-[9px] text-gray-600">{time}</span>
                                    </div>
                                    <p className="text-white text-sm break-words">{m.message}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => moderateUser(m.user_id, 'mute')} title="Silenciar"
                                        className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                                        <VolumeX className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => moderateUser(m.user_id, 'kick')} title="Expulsar (30 min)"
                                        className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors">
                                        <UserX className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => moderateUser(m.user_id, 'ban')} title="Bloquear permanente"
                                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                                        <Ban className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Banned / Muted Users */}
            <div className="bg-gray-900 rounded-2xl ring-1 ring-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-bold">Usuarios Moderados</span>
                        <span className="bg-gray-700 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{bans.length}</span>
                    </div>
                    <button onClick={loadBans} className="text-gray-500 hover:text-white transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loadingBans ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="p-4">
                    {bans.length === 0 ? (
                        <div className="text-center text-gray-600 text-xs py-6">✅ No hay usuarios bloqueados o silenciados</div>
                    ) : (
                        <div className="space-y-2">
                            {bans.map(b => {
                                const name = b.user_profile?.nickname || b.user_profile?.full_name || b.user_id.slice(0, 8);
                                return (
                                    <div key={b.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${b.action === 'ban' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                                                {b.action === 'ban' ? <Ban className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div className="text-white text-sm font-semibold">{name}</div>
                                                <div className="text-[10px] text-gray-500">
                                                    {b.action === 'ban' ? '🚫 Bloqueado' : '🔇 Silenciado'}
                                                    {b.expires_at && ` · Expira: ${new Date(b.expires_at).toLocaleString('es-MX')}`}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => moderateUser(b.user_id, b.action === 'ban' ? 'unban' : 'unmute')}
                                            className="text-xs font-bold bg-green-900/30 text-green-400 hover:bg-green-900/50 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            {b.action === 'ban' ? 'Desbloquear' : 'Quitar silencio'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
