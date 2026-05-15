'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AdCampaign = {
  id: string;
  title: string;
  description?: string | null;
  ad_type: string;
  placement: string;
  image_url?: string | null;
  link_url?: string | null;
  priority: number;
};

/**
 * Componente para mostrar publicidad
 */
export function AdBanner({ placement = 'all' }: { placement?: string }) {
  const [ads, setAds] = useState<AdCampaign[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    const loadAds = async () => {
      try {
        const res = await fetch(`/api/ads/active?placement=${encodeURIComponent(placement)}&limit=5`);
        const json = await res.json().catch(() => ({}));
        if (json?.ok && Array.isArray(json.campaigns)) {
          setAds(json.campaigns);
        }
      } catch (e) {
        console.error('[AD BANNER] Error:', e);
      }
    };
    void loadAds();
  }, [placement]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, 5000); // Cambiar cada 5 segundos
    return () => clearInterval(interval);
  }, [ads.length]);

  const trackView = async (adId: string) => {
    try {
      await fetch('/api/ads/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaign_id: adId, event_type: 'view' }),
      });
    } catch {
      // noop
    }
  };

  const trackClick = async (adId: string) => {
    try {
      await fetch('/api/ads/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaign_id: adId, event_type: 'click' }),
      });
    } catch {
      // noop
    }
  };

  const currentAd = ads[currentAdIndex];

  // Track view cuando cambia el anuncio actual
  useEffect(() => {
    if (currentAd?.id) {
      void trackView(currentAd.id);
    }
  }, [currentAd?.id]);

  if (ads.length === 0) return null;
  if (!currentAd) return null;

  const content = (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-100 to-purple-100 p-4">
      {currentAd.image_url ? (
        <img src={currentAd.image_url} alt={currentAd.title} className="h-full w-full object-cover" />
      ) : (
        <div className="p-4">
          <div className="text-sm font-bold text-gray-900">{currentAd.title}</div>
          {currentAd.description && <div className="mt-1 text-xs text-gray-700">{currentAd.description}</div>}
        </div>
      )}
      {ads.length > 1 && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {ads.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentAdIndex(idx)}
              className={`h-1.5 w-1.5 rounded-full ${
                idx === currentAdIndex ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Anuncio ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (currentAd.link_url) {
    return (
      <Link
        href={currentAd.link_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackClick(currentAd.id)}
        className="block"
      >
        {content}
      </Link>
    );
  }

  return <div>{content}</div>;
}
