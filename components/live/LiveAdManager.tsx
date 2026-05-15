'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveAdOverlay, type AdCampaign } from './LiveAdOverlay';
import { LiveAdPreroll } from './LiveAdPreroll';
import { LiveAdProductSpotlight } from './LiveAdProductSpotlight';

type AdSlot = {
    campaign: AdCampaign;
    component: 'overlay' | 'preroll' | 'product';
};

// ─── Ad Manager: orquesta todos los tipos de ads ──────────────────────────────
export function LiveAdManager({
    sessionId,
    isFreeSession,
}: {
    sessionId: string;
    isFreeSession: boolean;
}) {
    const [ads, setAds] = useState<AdCampaign[]>([]);
    const [currentAd, setCurrentAd] = useState<AdSlot | null>(null);
    const lastAdTimeRef = useRef<Record<string, number>>({});
    const mountTimeRef = useRef<number>(Date.now());
    const currentAdRef = useRef<AdSlot | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        currentAdRef.current = currentAd;
    }, [currentAd]);

    // Fetch ads on mount
    useEffect(() => {
        if (!isFreeSession) return;

        console.log('[AdManager] Fetching ads for session', sessionId, 'isFreeSession:', isFreeSession);

        fetch(`/api/live/ads?session_id=${sessionId}`)
            .then(r => r.json())
            .then(data => {
                console.log('[AdManager] API response:', JSON.stringify(data));
                if (data.ad_free) {
                    console.log('[AdManager] Session is ad-free, skipping ads');
                    return;
                }
                if (!data.ads?.length) {
                    console.log('[AdManager] No ads returned from API');
                    return;
                }
                console.log('[AdManager] Loaded', data.ads.length, 'ads');
                setAds(data.ads);
            })
            .catch(err => console.error('[AdManager] Fetch error:', err));
    }, [sessionId, isFreeSession]);

    // Schedule ads based on frequency_mins — NO pre-roll al inicio
    useEffect(() => {
        if (!isFreeSession || ads.length === 0) return;

        console.log('[AdManager] Starting ad scheduler with', ads.length, 'ads');

        const scheduleNext = () => {
            // Don't show if another ad is already visible
            if (currentAdRef.current) {
                console.log('[AdManager] Ad already showing, skipping check');
                return;
            }

            const now = Date.now();
            const elapsedSinceMount = now - mountTimeRef.current;
            const candidates: AdSlot[] = [];

            console.log('[AdManager] Checking ads, elapsed since mount:', Math.round(elapsedSinceMount / 1000), 's');

            ads.forEach(ad => {
                const frequencyMs = ad.frequency_mins * 60000;

                // No mostrar antes de frequency_mins desde que se montó
                if (elapsedSinceMount < frequencyMs) {
                    console.log('[AdManager]', ad.title, '- waiting', Math.round((frequencyMs - elapsedSinceMount) / 1000), 's more');
                    return;
                }

                const lastShown = lastAdTimeRef.current[ad.id] || 0;
                const timeSinceLastShown = lastShown === 0
                    ? elapsedSinceMount  // nunca mostrado, usar tiempo desde mount
                    : now - lastShown;

                if (timeSinceLastShown >= frequencyMs) {
                    const component: AdSlot['component'] =
                        ad.type === 'video' ? 'preroll' :
                            ad.type === 'product_spotlight' ? 'product' :
                                'overlay';
                    candidates.push({ campaign: ad, component });
                    console.log('[AdManager]', ad.title, '- READY to show as', component);
                } else {
                    console.log('[AdManager]', ad.title, '- next in', Math.round((frequencyMs - timeSinceLastShown) / 1000), 's');
                }
            });

            if (candidates.length > 0) {
                // Sort by priority (highest first)
                candidates.sort((a, b) => b.campaign.priority - a.campaign.priority);
                const selected = candidates[0];
                lastAdTimeRef.current[selected.campaign.id] = now;
                console.log('[AdManager] 🎬 SHOWING AD:', selected.campaign.title, 'as', selected.component);
                setCurrentAd(selected);
            }
        };

        // First check after 10 seconds (to give ads time to load and settle)
        const firstCheck = setTimeout(scheduleNext, 10000);

        // Then check every 10 seconds
        const interval = setInterval(scheduleNext, 10000);

        return () => { clearTimeout(firstCheck); clearInterval(interval); };
    }, [ads, isFreeSession]);

    // ── Tracking helpers ──────────────────────────────────────────────────────
    const trackImpression = useCallback((campaignId: string) => {
        fetch('/api/live/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: campaignId, session_id: sessionId, type: 'impression' }),
        }).catch(() => { });
    }, [sessionId]);

    const trackClick = useCallback((campaignId: string) => {
        fetch('/api/live/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: campaignId, session_id: sessionId, type: 'click' }),
        }).catch(() => { });
    }, [sessionId]);

    const handleClose = useCallback(() => {
        console.log('[AdManager] Ad closed by user');
        setCurrentAd(null);
    }, []);

    const handlePrerollComplete = useCallback(() => {
        console.log('[AdManager] Preroll completed');
        setCurrentAd(null);
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    if (!isFreeSession || !currentAd) return null;

    return (
        <>
            {currentAd.component === 'overlay' && (
                <LiveAdOverlay
                    ad={currentAd.campaign}
                    onClose={handleClose}
                    onImpression={trackImpression}
                    onClick={trackClick}
                />
            )}

            {currentAd.component === 'preroll' && (
                <LiveAdPreroll
                    ad={currentAd.campaign}
                    onComplete={handlePrerollComplete}
                    onImpression={trackImpression}
                    onClick={trackClick}
                    isPreroll={false}
                />
            )}

            {currentAd.component === 'product' && (
                <LiveAdProductSpotlight
                    ad={currentAd.campaign}
                    onClose={handleClose}
                    onImpression={trackImpression}
                    onClick={trackClick}
                />
            )}
        </>
    );
}
