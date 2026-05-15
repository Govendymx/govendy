'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, Calendar, AlertCircle, CheckCircle, Tag, Wallet, Bell, Send, Users } from 'lucide-react';

type FeaturedPlan = '7_days' | '15_days' | '30_days';

interface FeaturedInfo {
  id: string;
  plan_type: FeaturedPlan;
  start_at: string;
  end_at: string;
  status: 'active' | 'expired' | 'cancelled';
}

interface Listing {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: string;
  is_featured: boolean;
  featured_info?: FeaturedInfo | null;
}

const PLANS: Record<FeaturedPlan, { label: string; days: number; price: number }> = {
  '7_days': { label: '7 Días', days: 7, price: 79 },
  '15_days': { label: '15 Días', days: 15, price: 149 },
  '30_days': { label: '30 Días', days: 30, price: 199 },
};

export default function FeaturedListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Selection State
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FeaturedPlan>('7_days');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Notification state
  const [notifMsg, setNotifMsg] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const token = session.access_token;
      const userId = session.user.id;

      // Fetch follower count
      fetch(`/api/follows/status?seller_id=${userId}`)
        .then(r => r.json())
        .then(d => { if (d.ok) setFollowerCount(d.follower_count); })
        .catch(() => { });

      // 1. Fetch Listings (API) and Wallet (Direct Supabase) in parallel
      const listingsPromise = fetch('/api/user/listings-featured', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const walletPromise = supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      const [listingsRes, walletRes] = await Promise.allSettled([
        listingsPromise,
        walletPromise
      ]);

      // Handle Listings
      if (listingsRes.status === 'fulfilled') {
        const res = listingsRes.value;
        const data = await res.json();
        if (res.ok) {
          setListings(data.listings || []);
        } else {
          // If API fails, we show error but keep wallet if available
          throw new Error(data.error || 'Error al cargar publicaciones');
        }
      } else {
        throw new Error('Error de conexión al cargar publicaciones');
      }

      // Handle Wallet (Direct Supabase)
      if (walletRes.status === 'fulfilled') {
        const { data: wallet, error: walletError } = walletRes.value;
        if (walletError) {
          console.warn('Error fetching wallet:', walletError);
        } else if (wallet) {
          setWalletBalance(wallet.balance);
        } else {
          // No wallet found, maybe user never initialized it?
          setWalletBalance(0);
        }
      } else {
        console.warn('Error fetching wallet promise');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!selectedListing) return;

    const plan = PLANS[selectedPlan];
    if ((walletBalance || 0) < plan.price) {
      setError('Saldo insuficiente en PocketCash. Por favor recarga tu monedero.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setSuccessMsg(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No sesión');

      const res = await fetch('/api/featured/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          listingId: selectedListing.id,
          planType: selectedPlan
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el pago');

      setSuccessMsg(`¡Éxito! Tu publicación "${selectedListing.title}" ahora está destacada.`);
      setSelectedListing(null); // Close modal
      fetchData(); // Refresh data

    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Publicaciones Destacadas</h1>
            <p className="text-gray-600">Aumenta la visibilidad de tus productos y vende más rápido.</p>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-white px-4 py-2 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-pink-600" />
              <span className="text-sm font-medium text-gray-600">Saldo PocketCash:</span>
            </div>
            <span className="text-lg font-bold text-gray-900">
              ${(walletBalance ?? 0).toFixed(2)}
            </span>
            <button
              onClick={() => router.push('/dashboard/wallet')}
              className="text-xs font-semibold text-pink-600 hover:text-pink-700 hover:underline"
            >
              Recargar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            {successMsg}
          </div>
        )}

        {/* ─── Notify Followers Section ─── */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
              <Bell className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Notificar Seguidores</h2>
              <p className="text-sm text-gray-500">
                Envía un mensaje promocional a tus seguidores
                {followerCount !== null && (
                  <span className="ml-1 font-semibold text-purple-600">({followerCount} seguidores)</span>
                )}
              </p>
            </div>
          </div>

          {followerCount === 0 ? (
            <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
              <Users className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              Aún no tienes seguidores. Cuando usuarios te sigan, podrás enviarles notificaciones.
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-purple-50 px-4 py-3 text-sm text-purple-800 mb-4">
                <strong>Precio:</strong> Desde $29 MXN (hasta 50 seguidores) · $59 (hasta 200) · $99 (hasta 500) · $149 (hasta 1,000) · $199 (1,000+)
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={notifMsg}
                    onChange={e => setNotifMsg(e.target.value)}
                    placeholder="Escribe tu mensaje promocional..."
                    maxLength={200}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                  />
                  <span className="absolute right-3 top-3.5 text-[10px] text-gray-400">{notifMsg.length}/200</span>
                </div>
                <button
                  onClick={async () => {
                    if (notifMsg.trim().length < 5) { setError('El mensaje debe tener al menos 5 caracteres'); return; }
                    setNotifSending(true);
                    setError(null);
                    setSuccessMsg(null);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) throw new Error('No sesión');
                      const res = await fetch('/api/follows/notify-followers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ message: notifMsg.trim() }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Error al enviar');
                      setSuccessMsg(`✅ Notificación enviada a ${data.sent} seguidores. Se cobró $${data.charged} MXN.`);
                      setNotifMsg('');
                      fetchData();
                    } catch (err: any) {
                      setError(err.message);
                    } finally {
                      setNotifSending(false);
                    }
                  }}
                  disabled={notifSending || notifMsg.trim().length < 5}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {notifSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>

        {/* Listings Grid */}
        {listings.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <Tag className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No tienes publicaciones activas</h3>
            <p className="mt-2 text-gray-500">Crea una publicación para poder destacarla.</p>
            <button
              onClick={() => router.push('/vender')}
              className="mt-6 rounded-lg bg-pink-600 px-4 py-2 text-white hover:bg-pink-700 transition-colors"
            >
              Vender ahora
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const isFeatured = listing.featured_info && listing.featured_info.status === 'active';
              const daysLeft = isFeatured
                ? Math.ceil((new Date(listing.featured_info!.end_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <div key={listing.id} className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-md border border-gray-100">
                  {/* Image */}
                  <div className="aspect-[4/3] w-full bg-gray-100 relative">
                    {listing.images[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400">Sin imagen</div>
                    )}

                    {isFeatured && (
                      <div className="absolute top-3 left-3 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-yellow-900 shadow-sm flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        DESTACADO
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="truncate text-lg font-semibold text-gray-900" title={listing.title}>
                      {listing.title}
                    </h3>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      ${listing.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>

                    <div className="mt-4 border-t pt-4">
                      {isFeatured ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Activo
                          </span>
                          <span className="text-gray-500 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Quedan {daysLeft} días
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedListing(listing)}
                          className="w-full rounded-lg bg-pink-50 py-2.5 text-sm font-semibold text-pink-600 hover:bg-pink-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <TrendingUp className="h-4 w-4" />
                          Destacar Publicación
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Promotion Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-6 text-white">
              <h2 className="text-xl font-bold">Destacar Publicación</h2>
              <p className="mt-1 opacity-90 truncate">{selectedListing.title}</p>
            </div>

            <div className="p-6">
              <p className="mb-4 text-sm text-gray-600">
                Selecciona un plan para que tu publicación aparezca en la página principal y sugerencias.
              </p>

              <div className="space-y-3">
                {(Object.keys(PLANS) as FeaturedPlan[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    className={`relative w-full rounded-xl border p-4 text-left transition-all ${selectedPlan === key
                        ? 'border-pink-600 bg-pink-50 ring-1 ring-pink-600'
                        : 'border-gray-200 hover:border-pink-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${selectedPlan === key ? 'text-pink-900' : 'text-gray-900'}`}>
                        {PLANS[key].label}
                      </span>
                      <span className={`text-lg font-bold ${selectedPlan === key ? 'text-pink-600' : 'text-gray-900'}`}>
                        ${PLANS[key].price}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Saldo disponible:</span>
                  <span className="font-medium">${(walletBalance ?? 0).toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-bold text-gray-900">
                  <span>Total a pagar:</span>
                  <span>${PLANS[selectedPlan].price.toFixed(2)}</span>
                </div>
                {(walletBalance ?? 0) < PLANS[selectedPlan].price && (
                  <p className="mt-2 text-xs text-red-600">
                    Saldo insuficiente. Recarga tu monedero primero.
                  </p>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setSelectedListing(null)}
                  className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  disabled={processing}
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePromote}
                  disabled={processing || (walletBalance ?? 0) < PLANS[selectedPlan].price}
                  className="flex-1 rounded-xl bg-pink-600 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Pagar con PocketCash'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
