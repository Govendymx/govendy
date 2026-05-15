'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { calculateUnitPrice } from '@/lib/utils/pricing';

type CartItemRow = {
  id: string;
  listing_id: string;
  quantity: number;
  selected_color?: string | null;
  selected_size?: string | null;
};

type ListingRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  price?: number | string | null;
  images?: string[] | string | null;
  user_id?: string | null;
  seller_id?: string | null;
  wholesale_tiers?: { min: number; max: number | null; price: number }[] | null;
  weight_kg?: number | string | null;
  stock?: number | string | null;
  size_stock?: any;
};

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getListingTitle(l: ListingRow) {
  return (l.title ?? l.name ?? 'Publicación').toString();
}

function getListingPrice(l: ListingRow) {
  const raw = l.price;
  const num = typeof raw === 'number' ? raw : Number(raw ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function getEffectivePrice(l: ListingRow, qty: number): number {
  const base = getListingPrice(l);
  const tiers = l.wholesale_tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return base;
  const match = tiers.find(t => qty >= t.min && (t.max === null || qty <= t.max));
  return match ? match.price : base;
}

export default function CartPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<CartItemRow[]>([]);
  const [listingsById, setListingsById] = useState<Record<string, ListingRow>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, ci) => {
      const listing = listingsById[ci.listing_id];
      const unitPrice = listing ? getEffectivePrice(listing, ci.quantity) : 0;
      return sum + unitPrice * ci.quantity;
    }, 0);
  }, [cartItems, listingsById]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        setIsBooting(true);
        setPageError(null);

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userData.user) {
          window.location.href = '/';
          return;
        }
        setUserId(userData.user.id);

        const { data: cartData, error: cartErr } = await supabase
          .from('cart_items')
          .select('id, listing_id, quantity, selected_color, selected_size, created_at')
          .order('created_at', { ascending: true });
        if (cartErr) throw cartErr;

        const items = (cartData as any[]) ?? [];
        if (cancelled) return;
        setCartItems(items.map((item) => ({
          id: item.id,
          listing_id: item.listing_id,
          quantity: item.quantity,
          selected_color: item.selected_color || null,
          selected_size: item.selected_size || null,
        })));

        const listingIds = Array.from(new Set(items.map((i) => i.listing_id)));
        if (listingIds.length === 0) {
          setListingsById({});
          return;
        }

        const { data: listings, error: listingsErr } = await supabase
          .from('listings')
          .select('*')
          .in('id', listingIds);
        if (listingsErr) throw listingsErr;

        const map: Record<string, ListingRow> = {};
        for (const row of (listings as ListingRow[]) ?? []) map[row.id] = row;
        if (!cancelled) setListingsById(map);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setPageError(err instanceof Error ? err.message : 'No se pudo cargar tu carrito.');
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateQuantity = async (cartItemId: string, nextQuantity: number) => {
    if (nextQuantity < 1) return;
    setIsUpdating(true);
    setPageError(null);
    try {
      const { error } = await supabase.from('cart_items').update({ quantity: nextQuantity }).eq('id', cartItemId);
      if (error) throw error;
      setCartItems((prev) => prev.map((ci) => (ci.id === cartItemId ? { ...ci, quantity: nextQuantity } : ci)));
    } catch (err: unknown) {
      console.error(err);
      setPageError(err instanceof Error ? err.message : 'No se pudo actualizar la cantidad.');
    } finally {
      setIsUpdating(false);
    }
  };

  const removeItem = async (cartItemId: string) => {
    setIsUpdating(true);
    setPageError(null);
    try {
      const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
      if (error) throw error;
      setCartItems((prev) => prev.filter((ci) => ci.id !== cartItemId));
    } catch (err: unknown) {
      console.error(err);
      setPageError(err instanceof Error ? err.message : 'No se pudo eliminar del carrito.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="h-12 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          <div className="mt-6 h-72 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo grande de carrito */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-emerald/10 ring-1 ring-brand-emerald/20">
              <svg className="h-12 w-12 text-brand-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                Carrito
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">Tu carrito</h1>
              <p className="mt-2 text-sm text-gray-600">Revisa tus productos antes de pagar.</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
          >
            Volver
          </Link>
        </div>

        {pageError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="border-b border-black/5 px-6 py-4">
                <div className="text-sm font-semibold text-gray-900">Artículos</div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
                  El stock se descuenta hasta que se acredita tu pago.
                </p>
              </div>
              <div className="divide-y divide-black/5">
                {cartItems.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-gray-600">Tu carrito está vacío.</div>
                ) : (
                  cartItems.map((ci) => {
                    const listing = listingsById[ci.listing_id];
                    const title = listing ? getListingTitle(listing) : 'Publicación no encontrada';
                    const basePrice = listing ? getListingPrice(listing) : 0;
                    const effectivePrice = listing ? calculateUnitPrice(listing, ci.quantity) : 0;
                    const hasTierDiscount = effectivePrice < basePrice;

                    let stockAvailable = 0;
                    if (listing) {
                      if (ci.selected_size && listing.size_stock) {
                        stockAvailable = Number(listing.size_stock[ci.selected_size] || 0);
                      } else {
                        stockAvailable = Number(listing.stock || 0);
                      }
                    }
                    return (
                      <div key={ci.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          {/* Product Thumbnail */}
                          {(() => {
                            let imgUrl: string | null = null;
                            if (listing) {
                              const imgs = listing.images;
                              if (typeof imgs === 'string') {
                                try {
                                  const parsed = JSON.parse(imgs);
                                  if (Array.isArray(parsed) && parsed.length > 0) imgUrl = String(parsed[0]);
                                } catch {
                                  if (imgs.startsWith('http')) imgUrl = imgs;
                                }
                              } else if (Array.isArray(imgs) && imgs.length > 0) {
                                imgUrl = String(imgs[0]);
                              }
                            }
                            return imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={title}
                                className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-black/10"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 ring-1 ring-black/5">
                                <svg className="h-6 w-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            );
                          })()}
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{title}</div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              {hasTierDiscount ? (
                                <>
                                  <span className="text-xs text-gray-400 line-through">{formatMoney(basePrice)}</span>
                                  <span className="text-xs font-bold text-blue-600">{formatMoney(effectivePrice)} c/u</span>
                                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                    🏪 Mayoreo
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-500">{formatMoney(basePrice)} c/u</span>
                              )}
                              {ci.selected_color && (
                                <>
                                  <span className="text-xs text-gray-400">·</span>
                                  <span className="text-xs font-medium text-gray-700">Color: {ci.selected_color}</span>
                                </>
                              )}
                              {ci.selected_size && (
                                <>
                                  <span className="text-xs text-gray-400">·</span>
                                  <span className="text-xs font-medium text-gray-700">Talla: {ci.selected_size}</span>
                                </>
                              )}
                              {stockAvailable > 0 ? (
                                <>
                                  <span className="text-xs text-gray-400">·</span>
                                  <span className={`text-xs font-medium ${stockAvailable < ci.quantity ? 'text-red-600' : 'text-gray-500'}`}>
                                    {stockAvailable} disponibles
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs font-medium text-red-600">Agotado</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center overflow-hidden rounded-xl border border-gray-200">
                            <button
                              type="button"
                              disabled={isUpdating || ci.quantity <= 1}
                              onClick={() => updateQuantity(ci.id, ci.quantity - 1)}
                              className="px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              −
                            </button>
                            <div className="px-3 py-2 text-sm font-semibold text-gray-900">{ci.quantity}</div>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => updateQuantity(ci.id, ci.quantity + 1)}
                              className="px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-sm font-bold text-gray-900">{formatMoney(effectivePrice * ci.quantity)}</div>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => removeItem(ci.id)}
                            className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-semibold text-gray-900">Resumen</div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">{formatMoney(subtotal)}</span>
            </div>

            <div className="mt-6">
              {cartItems.some(ci => {
                const l = listingsById[ci.listing_id];
                const sid = l?.seller_id ?? l?.user_id;
                return userId && sid && userId === sid;
              }) ? (
                <div className="mb-3 rounded-xl bg-red-100 p-3 text-center text-xs font-bold text-red-700">
                  Elimina tus propias publicaciones para continuar.
                </div>
              ) : null}

              <Link
                href="/checkout"
                className={`block w-full rounded-xl bg-brand-emerald px-4 py-3 text-center text-sm font-semibold text-white shadow-lg hover:opacity-90 ${cartItems.length === 0 || cartItems.some(ci => {
                  const l = listingsById[ci.listing_id];
                  const sid = l?.seller_id ?? l?.user_id;
                  return userId && sid && userId === sid;
                }) ? 'pointer-events-none opacity-50' : ''
                  }`}
              >
                Ir a pagar
              </Link>
              <p className="mt-3 text-[11px] font-bold text-brand-emerald leading-tight">
                🔥 ¡No te quedes con las ganas! Completa tu pedido ahora y asegura tus productos antes de que se agoten.
              </p>
            </div>
          </aside>
        </div>

        {/* Advertencias de Seguridad */}
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-5 w-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-extrabold text-amber-800 uppercase tracking-wide">Recomendaciones de seguridad</span>
          </div>
          <ol className="space-y-2 text-xs leading-relaxed text-amber-900/90">
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">1.</span>
              <span><strong>No deposites a cuenta directa del vendedor</strong> bajo ninguna circunstancia. Utiliza únicamente pagos seguros como MercadoPago, PocketCash o las formas de pago disponibles en nuestra plataforma.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">2.</span>
              <span>Te recomendamos <strong>no comprar artículos fuera de la plataforma</strong>, ya que solo podemos protegerte por artículos comprados dentro de ella.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">3.</span>
              <span>Solicita al vendedor usar <strong>Envíos GoVendy</strong>, ya que son envíos asegurados. Los envíos por cuenta del vendedor son responsabilidad del vendedor; en caso de cualquier situación, él deberá hacerse cargo.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">4.</span>
              <span>Las operaciones realizadas con <strong>PocketCash están aseguradas</strong> de la misma forma que MercadoPago.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">5.</span>
              <span>Los métodos ofrecidos en la plataforma son los <strong>únicos autorizados</strong> para realizar pagos.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">6.</span>
              <span>Te recomendamos <strong>no compartir datos personales</strong> por los medios de contacto oficiales, ya que puede ser motivo de bloqueo permanente.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-amber-700">7.</span>
              <span>Si tienes alguna duda o necesitas ayuda, contacta a soporte desde el menú <strong>Ayuda</strong>, en horario de 10:00 a.m. a 6:00 p.m., de lunes a viernes.</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

