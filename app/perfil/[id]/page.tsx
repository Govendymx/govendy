import Link from 'next/link';
import { headers } from 'next/headers';
import { ReputationThermometer } from '@/components/reputation/ReputationThermometer';
import { ReviewsList, type PublicReview } from '@/components/reputation/ReviewsList';
import { SellerStats } from '@/components/reputation/SellerStats';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { FollowButton } from '@/components/FollowButton';

export const dynamic = 'force-dynamic';

async function getOrigin() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') || 'http';
  const host = h.get('x-forwarded-host') || h.get('host') || '';
  return host ? `${proto}://${host}` : '';
}

export default async function PerfilPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = String(id || '').trim();
  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-bold text-gray-900">Perfil inválido</div>
            <div className="mt-6">
              <Link href="/" className="inline-flex rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
                Ir al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reputación pública (incluye comentarios si corriste `supabase_user_reviews_public.sql`)
  const origin = await getOrigin();
  const res = origin ? await fetch(`${origin}/api/reputation/${userId}`, { cache: 'no-store', next: { revalidate: 0 } }).catch(() => null as any) : (null as any);
  const json = res ? await res.json().catch(() => ({})) : {};
  const state = String((json as any)?.state || '').trim() || null;
  const city = String((json as any)?.city || '').trim() || null;
  const isVerified = Boolean((json as any)?.isVerified ?? (json as any)?.is_verified ?? false);
  const isOfficial = Boolean((json as any)?.is_official_store ?? false);
  const isWholesaler = Boolean((json as any)?.is_wholesaler ?? false);
  const isManufacturer = Boolean((json as any)?.is_manufacturer ?? false);
  const officialName = (json as any)?.official_store_name || null;
  const officialBanner = (json as any)?.official_store_banner_url || null;
  const officialColor = (json as any)?.official_store_brand_color || null;

  const name = officialName || String((json as any)?.name || 'Usuario');

  const operationsCount = typeof (json as any)?.operations_count === 'number' ? (json as any).operations_count : null;
  const overallPct = Number((json as any)?.overall?.percent ?? 0) || 0;
  const sellerPct = Number((json as any)?.seller?.percent ?? 0) || 0;
  const buyerPct = Number((json as any)?.buyer?.percent ?? 0) || 0;
  const sellerReviews = (((json as any)?.reviews?.seller ?? []) as PublicReview[]) || [];
  const buyerReviews = (((json as any)?.reviews?.buyer ?? []) as PublicReview[]) || [];
  const sellerStats = (json as any)?.stats || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Perfil</div>
              <div className="text-xs text-gray-500">{name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link
              href="/dashboard/listings"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Volver
            </Link>
            <Link
              href={`/tienda/${userId}`}
              className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Ver tienda
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          {isOfficial && officialBanner && (
            <div className="mb-6 h-32 w-full overflow-hidden rounded-2xl bg-gray-100 sm:h-48">
              <img src={officialBanner} alt={name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-extrabold text-gray-900">{name}</div>
                {isVerified && <VerifiedBadge size="md" />}
                {isOfficial && <VerifiedBadge size="md" isOfficial={true} />}
                {operationsCount !== null && operationsCount >= 0 && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                    {operationsCount} {operationsCount === 1 ? 'operación' : 'operaciones'} en el sitio
                  </span>
                )}
              </div>
              {/* Insignias Mayorista / Fabricante */}
              {(isWholesaler || isManufacturer) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {isManufacturer && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-rose-500 to-emerald-600 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-emerald-500/30">
                      🏭 Fabricante Verificado
                    </span>
                  )}
                  {isWholesaler && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 px-4 py-1.5 text-xs font-black text-white shadow-lg shadow-blue-500/30">
                      🏪 Mayorista Verificado
                    </span>
                  )}
                </div>
              )}
              {(state || city) && (
                <div className="mt-1 text-sm text-gray-600">
                  <span className="text-gray-600">Ubicado en </span>
                  <span className="font-semibold text-brand-emerald">
                    {[state, city].filter(Boolean).join(', ').toUpperCase()}
                  </span>
                </div>
              )}
              <div className="mt-1 text-sm text-gray-600">ID: {userId}</div>
              <div className="mt-3">
                <FollowButton sellerId={userId} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ReputationThermometer percent={overallPct} label="Reputación general" subtitle="Visión global de confianza." />
            <ReputationThermometer percent={sellerPct} label="Como vendedor" subtitle="Opiniones de compradores." />
            <ReputationThermometer percent={buyerPct} label="Como comprador" subtitle="Opiniones de vendedores." />
          </div>

          {/* Estadísticas como vendedor */}
          {sellerStats && (
            <div className="mt-6">
              <SellerStats stats={sellerStats} />
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ReviewsList title="Comentarios como vendedor" subtitle="Los compradores opinan sobre este usuario." reviews={sellerReviews} tone="pink" />
            <ReviewsList title="Comentarios como comprador" subtitle="Los vendedores opinan sobre este usuario." reviews={buyerReviews} tone="neutral" />
          </div>

          <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-emerald-100">
            Perfil público: la reputación y comentarios ayudan a generar confianza entre usuarios.
          </div>
        </div>
      </main>
    </div>
  );
}

