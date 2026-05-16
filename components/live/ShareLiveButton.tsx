'use client';

import { useState, useRef, useEffect } from 'react';
import { Share2, X, Check, Link as LinkIcon } from 'lucide-react';

interface ShareLiveButtonProps {
    sessionId: string;
    title: string;
    hostName: string;
    className?: string;
    /** 'sm' for mobile, 'md' for desktop */
    size?: 'sm' | 'md';
}

const SHARE_TARGETS = [
    {
        key: 'whatsapp',
        label: 'WhatsApp',
        color: '#25D366',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
        ),
        getUrl: (text: string, url: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    },
    {
        key: 'facebook',
        label: 'Facebook',
        color: '#1877F2',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        ),
        getUrl: (_text: string, url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
        key: 'twitter',
        label: 'X',
        color: '#000000',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
        getUrl: (text: string, url: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
        key: 'telegram',
        label: 'Telegram',
        color: '#0088CC',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
        ),
        getUrl: (text: string, url: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    },
    {
        key: 'threads',
        label: 'Threads',
        color: '#000000',
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.799-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.583-1.279-.878-2.29-.882h-.01c-.845 0-1.576.245-2.108.707-.22.19-.364.4-.432.606l-1.97-.476c.165-.572.528-1.12 1.068-1.59.802-.694 1.882-1.086 3.128-1.131l.096-.002c1.526.018 2.76.457 3.67 1.305 1.011.941 1.567 2.347 1.653 4.18a8.548 8.548 0 01.028.763 6.14 6.14 0 01-.176 1.473c.413.388.744.83.985 1.318.942 1.955.95 4.768-1.369 7.032C17.554 23.262 15.27 23.98 12.186 24zm.007-8.556c-.086 0-.172.002-.257.007-1.099.063-1.974.39-2.537.949-.385.381-.578.852-.547 1.33.068 1.19 1.529 1.904 2.956 1.832 1.095-.059 1.912-.478 2.43-1.245.38-.564.601-1.36.657-2.37a11.909 11.909 0 00-2.702-.503z" />
            </svg>
        ),
        getUrl: (text: string, url: string) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`,
    },
    {
        key: 'tiktok',
        label: 'TikTok',
        color: '#010101',
        copyOnly: true,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.85 4.85 0 01-1.01-.08z" />
            </svg>
        ),
        getUrl: (_text: string, url: string) => url,
    },
    {
        key: 'instagram',
        label: 'Instagram',
        color: '#E1306C',
        copyOnly: true,
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
        ),
        getUrl: (_text: string, url: string) => url,
    },
];


export default function ShareLiveButton({ sessionId, title, hostName, className = '', size = 'sm' }: ShareLiveButtonProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedFor, setCopiedFor] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/live/${sessionId}` : `https://www.gopocket.com.mx/live/${sessionId}`;
    const shareText = `🔴 ¡${hostName} está EN VIVO en GoVendy!\n${title}\n¡Entra a ver la transmisión! 👇`;

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const copyToClipboard = async (text: string, key?: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        if (key) { setCopiedFor(key); setTimeout(() => setCopiedFor(null), 2000); }
        else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const handleCopy = () => copyToClipboard(liveUrl);

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: `🔴 ${hostName} EN VIVO`, text: shareText, url: liveUrl });
            } catch { /* user cancelled */ }
        } else {
            setOpen(true);
        }
    };

    const btnSize = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm';

    return (
        <div className="relative" ref={panelRef}>
            {/* Main share button */}
            <button
                onClick={handleNativeShare}
                className={`${btnSize} flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 active:scale-90 transition-all ${className}`}
                title="Compartir"
            >
                <Share2 className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
            </button>

            {/* Share Panel */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 z-50 bg-gray-900 rounded-2xl shadow-2xl ring-1 ring-white/10 p-3 w-72"
                    style={{ animation: 'shareIn 0.2s ease-out' }}
                >
                    <style>{`@keyframes shareIn { from { opacity:0; transform:translateY(-8px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>

                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white text-xs font-bold">📤 Compartir Live</span>
                        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Social buttons — 4 cols, 7 items = 4+3 */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {SHARE_TARGETS.map((t) => {
                            const isCopyOnly = (t as any).copyOnly;
                            const wasCopied = copiedFor === t.key;
                            if (isCopyOnly) {
                                return (
                                    <button
                                        key={t.key}
                                        onClick={() => copyToClipboard(liveUrl, t.key)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 transition-colors group relative"
                                        title={`Copia el enlace para compartir en ${t.label}`}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110 group-active:scale-95 relative"
                                            style={{ backgroundColor: (t as any).color }}
                                        >
                                            {wasCopied ? <Check className="w-5 h-5" /> : t.icon}
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-medium">{wasCopied ? '¡Copiado!' : t.label}</span>
                                    </button>
                                );
                            }
                            return (
                                <a
                                    key={t.key}
                                    href={t.getUrl(shareText, liveUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 transition-colors group"
                                    onClick={() => setOpen(false)}
                                >
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-110 group-active:scale-95"
                                        style={{ backgroundColor: (t as any).color }}
                                    >
                                        {t.icon}
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-medium">{t.label}</span>
                                </a>
                            );
                        })}
                    </div>

                    {/* Copy link */}
                    <button
                        onClick={handleCopy}
                        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-95 ${copied
                            ? 'bg-white0/20 text-green-400 ring-1 ring-green-500/30'
                            : 'bg-white/10 text-white hover:bg-white/15 ring-1 ring-white/10'
                            }`}
                    >
                        {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                        {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
                    </button>

                    {/* URL preview */}
                    <p className="text-[9px] text-gray-600 mt-2 text-center truncate">{liveUrl}</p>
                </div>
            )}
        </div>
    );
}
