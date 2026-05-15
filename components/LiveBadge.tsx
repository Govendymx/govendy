'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * LiveBadge — shows a pulsing "LIVE" button if a given sellerId is currently live.
 * If no sellerId provided, shows only if ANY session is live (for nav button usage).
 */
export function LiveBadge({ sellerId, className = '' }: { sellerId?: string; className?: string }) {
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        if (!sellerId) return;
        let cancelled = false;

        fetch(`/api/live?status=live&host_id=${sellerId}`)
            .then(r => r.json())
            .then(d => {
                if (cancelled) return;
                const active = d.sessions?.find((s: any) => s.host_id === sellerId && s.status === 'live');
                if (active) setSessionId(active.id);
            })
            .catch(() => { });

        return () => { cancelled = true; };
    }, [sellerId]);

    if (!sessionId) return null;

    return (
        <Link
            href={`/live/${sessionId}`}
            className={`inline-flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full transition-all hover:scale-105 shadow-sm shadow-red-500/40 ${className}`}
            onClick={e => e.stopPropagation()}
        >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
        </Link>
    );
}

/**
 * NavLiveButton — persistent LIVE button for the top navbar.
 * Shows when at least one session is active.
 */
export function NavLiveButton() {
    const [hasLive, setHasLive] = useState(false);
    const [count, setCount] = useState(0);

    useEffect(() => {
        const check = () => {
            fetch('/api/live?status=live')
                .then(r => r.json())
                .then(d => {
                    const n = d.sessions?.length || 0;
                    setHasLive(n > 0);
                    setCount(n);
                })
                .catch(() => { });
        };
        check();
        const interval = setInterval(check, 30_000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Link
            href="/live"
            className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white transition-all hover:scale-105 hover:shadow-lg ${hasLive
                ? 'bg-red-600 hover:bg-red-500 shadow-md shadow-red-500/30'
                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
        >
            {hasLive && (
                <>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                    </span>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
                </>
            )}
            {!hasLive && <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />}
            LIVE
            {hasLive && count > 0 && (
                <span className="bg-white/20 rounded-full px-1 text-[9px] font-black">{count}</span>
            )}
        </Link>
    );
}
