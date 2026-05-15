'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserPlus, UserCheck } from 'lucide-react';

interface FollowButtonProps {
    sellerId: string;
    /** Compact mode for listing cards — shows small button */
    compact?: boolean;
    /** className override */
    className?: string;
    /** Callback when login is required */
    onLoginRequired?: () => void;
    /** Initial state from parent (avoids N+1 fetches) */
    initialFollowing?: boolean;
}

export function FollowButton({ sellerId, compact = false, className = '', onLoginRequired, initialFollowing }: FollowButtonProps) {
    const [following, setFollowing] = useState(initialFollowing || false);
    const [followerCount, setFollowerCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(typeof initialFollowing === 'boolean');

    // Sync initialFollowing prop to state if it updates (e.g. after bulk load in parent)
    useEffect(() => {
        if (typeof initialFollowing === 'boolean') {
            setFollowing(initialFollowing);
            setInitialized(true);
        }
    }, [initialFollowing]);

    useEffect(() => {
        if (!sellerId) return;
        let cancelled = false;

        const fetchStatus = async (userId: string | null) => {
            try {
                if (userId === sellerId) {
                    setInitialized(true);
                    return;
                }

                // If we have initialFollowing and we just want to verify current user, we might skip full fetch
                // BUT we need follower count for non-compact mode.
                // For compact mode (listing cards), we can trust initialFollowing and skip fetch to save N+1 calls.
                if (compact && typeof initialFollowing === 'boolean') {
                    setInitialized(true);
                    return;
                }

                let url = `/api/follows/status?seller_id=${sellerId}`;
                if (userId) url += `&user_id=${userId}`;

                const res = await fetch(url);
                const data = await res.json();

                if (!cancelled && data.ok) {
                    setFollowerCount(data.follower_count || 0);
                    setFollowing(!!data.following);
                }
            } catch (e) {
                console.error('[FollowButton] Error en inicialización:', e);
            } finally {
                if (!cancelled) {
                    setInitialized(true);
                }
            }
        };

        // 1. Initial check (skip if compact & initialFollowing provided)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return;
            const userId = session?.user?.id ?? null;
            setCurrentUserId(userId);

            // Only fetch if we don't have initial state (or if we need count for full mode)
            if (!compact || typeof initialFollowing !== 'boolean') {
                fetchStatus(userId);
            }
        });

        // 2. Listen for future auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                const userId = session?.user?.id ?? null;
                setCurrentUserId(userId);
                // Always re-fetch on auth change to be safe
                fetchStatus(userId);
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [sellerId, compact, initialFollowing]);

    useEffect(() => {
        if (!sellerId) return;
        const handleSync = (e: any) => {
            if (e.detail?.sellerId === sellerId) {
                setFollowing(e.detail.following);
                setFollowerCount(e.detail.followerCount);
            }
        };
        window.addEventListener('follow-sync', handleSync);
        return () => window.removeEventListener('follow-sync', handleSync);
    }, [sellerId]);

    const handleToggle = useCallback(
        async (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (loading) return;

            // Check auth quickly
            if (!currentUserId) {
                // Fallback if state is not ready (rare)
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    onLoginRequired?.();
                    return;
                }
            }

            setLoading(true);

            // --- OPTIMISTIC UPDATE ---
            const prevFollowing = following;
            const prevCount = followerCount;

            const newFollowing = !prevFollowing;
            const newCount = newFollowing ? prevCount + 1 : Math.max(0, prevCount - 1);

            // 1. Apply visual change IMMEDIATELY
            setFollowing(newFollowing);
            setFollowerCount(newCount);

            // 2. Sync other buttons IMMEDIATELY
            window.dispatchEvent(new CustomEvent('follow-sync', {
                detail: { sellerId, following: newFollowing, followerCount: newCount }
            }));

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                if (!token) throw new Error('No token');

                const res = await fetch('/api/follows/toggle', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ seller_id: sellerId }),
                });

                const data = await res.json();

                if (!data.ok) {
                    throw new Error(data.error || 'Server error');
                }

                // Server validation (optional correction)
                if (data.following !== newFollowing || data.follower_count !== newCount) {
                    setFollowing(data.following);
                    setFollowerCount(data.follower_count);
                    window.dispatchEvent(new CustomEvent('follow-sync', {
                        detail: { sellerId, following: data.following, followerCount: data.follower_count }
                    }));
                }

            } catch (e) {
                console.error('[FollowButton] Reverting optimistic update due to error:', e);
                // Revert on error
                setFollowing(prevFollowing);
                setFollowerCount(prevCount);
                window.dispatchEvent(new CustomEvent('follow-sync', {
                    detail: { sellerId, following: prevFollowing, followerCount: prevCount }
                }));
            } finally {
                setLoading(false);
            }
        },
        [currentUserId, sellerId, loading, following, followerCount, onLoginRequired],
    );

    if (currentUserId && currentUserId === sellerId) return null;
    if (!initialized) return null; // wait for status before rendering (avoids green→pink flash)

    // ─── Compact mode (for listing cards) ───
    if (compact) {
        return (
            <button
                type="button"
                onClick={handleToggle}
                disabled={loading} // Prevent double clicks
                className={`group/follow relative z-30 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 shadow-sm ${following
                    ? 'bg-pink-50 text-pink-600 ring-1 ring-pink-200 hover:bg-pink-100'
                    : 'bg-green-50 text-green-700 ring-1 ring-green-200 hover:bg-green-100 hover:text-green-800 hover:ring-green-300'
                    } ${
                    // Removing opacity/cursor-wait to make it feel instant.
                    // We rely on 'loading' state preventing logic execution.
                    'hover:shadow-md active:scale-95'
                    } ${className}`}
                title={following ? 'Siguiendo' : 'Seguir vendedor'}
            >
                {following ? (
                    <>
                        <UserCheck size={14} />
                        <span>Siguiendo</span>
                    </>
                ) : (
                    <>
                        <UserPlus size={14} />
                        <span>+ Seguir</span>
                    </>
                )}
            </button>
        );
    }

    // ─── Full mode (for store pages, product detail) ───
    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            {/* Seguidores pill — always visible */}
            {followerCount >= 0 && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-pink-50 px-3 py-2 text-sm font-bold text-pink-700 ring-1 ring-pink-200 shadow-sm">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" className="opacity-80">
                        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0H3z" />
                    </svg>
                    <span>
                        {followerCount > 999 ? `${(followerCount / 1000).toFixed(1)}k` : followerCount}
                    </span>
                    <span className="text-xs font-semibold text-pink-500">seguidores</span>
                </span>
            )}

            {/* Follow / Siguiendo button */}
            <button
                type="button"
                onClick={handleToggle}
                disabled={loading}
                className={`group/follow relative z-30 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300 ${following
                    ? 'bg-pink-50 text-pink-600 ring-1 ring-pink-200 shadow-sm hover:bg-pink-100 hover:shadow-md'
                    : 'bg-gray-900 text-white shadow-lg shadow-gray-900/25 hover:bg-brand-orange hover:shadow-brand-orange/25'
                    } ${'hover:scale-105 active:scale-95'}`}
            >
                {following ? (
                    <>
                        <UserCheck size={16} />
                        <span>Siguiendo</span>
                    </>
                ) : (
                    <>
                        <UserPlus size={16} />
                        <span>+ Seguir</span>
                    </>
                )}
            </button>
        </div>
    );
}
