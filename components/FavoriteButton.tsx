'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { redirectToLogin } from '@/lib/auth/redirect';

type Props = {
  listingId: string;
  onLoginRequired?: () => void;
  className?: string;
};

export function FavoriteButton({ listingId, onLoginRequired, className = '' }: Props) {
  const [isFav, setIsFav] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial favorite state on mount
  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) {
          if (!cancelled) setIsFav(false);
          return;
        }
        const { data: row, error } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
          .maybeSingle();
        if (!cancelled && !error) {
          setIsFav(Boolean(row));
        }
      } catch {
        // silencioso
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [listingId]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user) {
        if (onLoginRequired) onLoginRequired();
        else redirectToLogin();
        return;
      }

      // Optimistic update — flip instantly, revert on error
      const newFav = !isFav;
      setIsFav(newFav);

      if (!newFav) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId);
        if (error) setIsFav(true); // revert
      } else {
        const { error } = await supabase
          .from('favorites')
          .upsert(
            { user_id: user.id, listing_id: listingId },
            { onConflict: 'user_id,listing_id' }
          );
        if (error) setIsFav(false); // revert
      }
    } catch {
      setIsFav((prev) => !prev); // revert
    } finally {
      setIsLoading(false);
    }
  }, [isFav, isLoading, listingId, onLoginRequired]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/10 hover:bg-white disabled:opacity-60 transition-all duration-200 ${className}`}
      aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={isFav ? '#FF6600' : 'none'}
        stroke={isFav ? '#FF6600' : '#6B7280'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-all duration-200 ${isFav ? 'scale-110' : 'scale-100'}`}
        aria-hidden
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
