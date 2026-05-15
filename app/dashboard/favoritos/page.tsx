'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { SectionMessage } from '@/components/SectionMessage';
import { ListingCard } from '@/components/listings/ListingCard';

type FavoriteRow = { id: string; listing_id: string; created_at?: string | null };

export default function DashboardFavoritosPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [listingsById, setListingsById] = useState<Record<string, any>>({});
  const [favoritesMessage, setFavoritesMessage] = useState<string>('No esperas mas y aprovecha estas ofertas antes de que te las ganen');

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          window.location.href = '/login';
          return;
        }

        const favRes: any = await supabase
          .from('favorites')
          .select('id,listing_id,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200);
        if (favRes.error) throw favRes.error;
        const favs = ((favRes.data as any[]) ?? []) as FavoriteRow[];
        if (cancelled) return;
        setFavorites(favs);

        const ids = Array.from(new Set(favs.map((f) => f.listing_id).filter(Boolean)));
        if (ids.length > 0) {
          const listRes: any = await supabase
            .from('listings')
            .select('id,title,price,images,public_id,seller_id')
            .in('id', ids);
          if (!listRes.error && Array.isArray(listRes.data)) {
            const map: Record<string, any> = {};
            for (const row of listRes.data as any[]) map[String(row.id)] = row;
            setListingsById(map);
          }
        }

        // Cargar mensaje de favoritos desde app_settings
        const settingsRes: any = await supabase.from('app_settings').select('favorites_message').eq('id', 1).maybeSingle();
        if (!settingsRes.error && settingsRes.data?.favorites_message) {
          if (!cancelled) setFavoritesMessage(String(settingsRes.data.favorites_message));
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus favoritos.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-gray-900">Favoritos</div>
                {favoritesMessage && (
                  <div className="text-xs font-semibold text-brand-emerald">
                    {favoritesMessage}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500">Artículos guardados</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <SectionMessage section="favoritos" />

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="text-lg font-bold text-gray-900">Mis favoritos</div>
          {isBooting ? (
            <div className="mt-6 text-sm text-gray-600">Cargando…</div>
          ) : favorites.length === 0 ? (
            <div className="mt-6 text-sm text-gray-600">Aún no has agregado favoritos.</div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((f) => {
                const l = listingsById[f.listing_id];
                if (!l) return null;
                return (
                  <ListingCard
                    key={f.id}
                    p={l as any}
                    size="fluid"
                    meta={
                      l?.public_id ? (
                        <div className="text-xs text-gray-500">ID: {String(l.public_id)}</div>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

