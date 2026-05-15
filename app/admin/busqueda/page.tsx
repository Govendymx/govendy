'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AdminTopMenu } from '@/components/admin/AdminTopMenu';
import { CopyButton } from '@/components/ui/CopyButton';

// Types for search results
type SearchResult = {
  id: string;
  type: 'user' | 'order' | 'listing' | 'payment' | 'topup' | 'dispute';
  title: string;
  subtitle: string;
  status?: string;
  date?: string;
  url: string;
  score: number; // For sorting relevance
};

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      setSearched(true);
      const q = query.trim();
      const qLower = q.toLowerCase();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
      const found: SearchResult[] = [];

      try {
        // 1. Search Users (profiles)
        // Match: id, email, full_name, username
        let userQuery = supabase
          .from('profiles')
          .select('id, email, full_name, username, created_at')
          .limit(10);
        
        if (isUUID) {
          userQuery = userQuery.eq('id', q);
        } else {
          userQuery = userQuery.or(`email.ilike.%${q}%,username.ilike.%${q}%,full_name.ilike.%${q}%`);
        }
        
        const { data: users } = await userQuery;
        if (users) {
          users.forEach(u => {
            found.push({
              id: u.id,
              type: 'user',
              title: u.full_name || u.username || 'Usuario sin nombre',
              subtitle: u.email || 'Sin email',
              date: u.created_at,
              url: `/admin/usuarios?q=${u.id}`,
              score: u.id === q ? 100 : (u.email === q ? 90 : 50)
            });
          });
        }

        // 2. Search Orders
        // Match: id, friendly_id (if exists), status
        let orderQuery = supabase
          .from('orders')
          .select('id, status, created_at, total_amount, buyer_id')
          .limit(10);

        if (isUUID) {
          orderQuery = orderQuery.eq('id', q);
        } else {
          // If query is strictly numeric, maybe it's an internal ID or amount? 
          // Assuming orders might have text fields or we rely on UUID match mostly.
          // Since we don't have a clear text field like 'friendly_id' in schema context, check known fields.
          // If schema has 'friendly_id' or 'tracking_number', use those.
          // For now, only search by ID if UUID, or maybe strict equality if not.
        }

        const { data: orders } = await orderQuery;
        if (orders) {
          orders.forEach(o => {
            found.push({
              id: o.id,
              type: 'order',
              title: `Orden #${o.id.slice(0, 8)}`,
              subtitle: `Total: $${o.total_amount} - Estado: ${o.status}`,
              status: o.status,
              date: o.created_at,
              url: `/admin/operations?orderId=${o.id}`, // or /admin/logistica
              score: o.id === q ? 100 : 50
            });
          });
        }

        // 3. Search Listings
        // Match: id, title, description
        let listingQuery = supabase
          .from('listings')
          .select('id, title, price, status, created_at')
          .limit(10);
        
        if (isUUID) {
          listingQuery = listingQuery.eq('id', q);
        } else {
          listingQuery = listingQuery.ilike('title', `%${q}%`);
        }

        const { data: listings } = await listingQuery;
        if (listings) {
          listings.forEach(l => {
            found.push({
              id: l.id,
              type: 'listing',
              title: l.title || 'Producto sin título',
              subtitle: `$${l.price} - ${l.status}`,
              status: l.status,
              date: l.created_at,
              url: `/admin/listings?q=${l.id}`,
              score: l.id === q ? 100 : (l.title.toLowerCase().includes(qLower) ? 60 : 40)
            });
          });
        }

        // 4. Search Payments (offline/wallet)
        // This might be tricky as payments might be in 'payments' table or 'wallet_topups'
        // Let's try 'wallet_topups' (PocketCash)
        let topupQuery = supabase
          .from('wallet_topups')
          .select('id, amount, status, created_at, user_id, mercadopago_preference_id')
          .limit(10);

        if (isUUID) {
          topupQuery = topupQuery.eq('id', q);
        } else {
          topupQuery = topupQuery.ilike('mercadopago_preference_id', `%${q}%`);
        }

        const { data: topups } = await topupQuery;
        if (topups) {
          topups.forEach(t => {
            found.push({
              id: t.id,
              type: 'topup',
              title: `Recarga PocketCash $${t.amount}`,
              subtitle: `Ref: ${t.mercadopago_preference_id || '—'}`,
              status: t.status,
              date: t.created_at,
              url: `/admin/pocketcash?id=${t.id}`,
              score: t.id === q ? 100 : 50
            });
          });
        }

        // 5. Search Withdrawals (Retiros)
        // Table: seller_withdrawals
        let withdrawalQuery = supabase
          .from('seller_withdrawals')
          .select('id, amount_cents, status, created_at, seller_id, mp_transfer_id')
          .limit(10);
        
        if (isUUID) {
          withdrawalQuery = withdrawalQuery.eq('id', q);
        } else {
          // Search by MP Transfer ID if text
          withdrawalQuery = withdrawalQuery.ilike('mp_transfer_id', `%${q}%`);
        }

        const { data: withdrawals } = await withdrawalQuery;
        if (withdrawals) {
          withdrawals.forEach(w => {
            found.push({
              id: w.id,
              type: 'payment', // using 'payment' type for icon reuse, or add 'withdrawal'
              title: `Retiro $${(w.amount_cents / 100).toFixed(2)}`,
              subtitle: `Ref: ${w.mp_transfer_id || '—'}`,
              status: w.status,
              date: w.created_at,
              url: `/admin/retiros?q=${w.id}`,
              score: w.id === q ? 100 : 50
            });
          });
        }

        // 6. Search Disputes
        // Table: disputes
        let disputeQuery = supabase
          .from('disputes')
          .select('id, status, created_at, reason, order_id')
          .limit(10);
        
        if (isUUID) {
          disputeQuery = disputeQuery.or(`id.eq.${q},order_id.eq.${q}`);
        } else {
          disputeQuery = disputeQuery.ilike('reason', `%${q}%`);
        }

        const { data: disputes } = await disputeQuery;
        if (disputes) {
          disputes.forEach(d => {
            found.push({
              id: d.id,
              type: 'dispute',
              title: `Disputa: ${d.reason || 'Sin razón'}`,
              subtitle: `Orden: ${d.order_id}`,
              status: d.status,
              date: d.created_at,
              url: `/admin/disputas?id=${d.id}`,
              score: d.id === q ? 100 : 50
            });
          });
        }

      } catch (err) {
        console.error('Search error:', err);
      } finally {
        // Sort by score descending
        setResults(found.sort((a, b) => b.score - a.score));
        setLoading(false);
      }
    };

    performSearch();
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Resultados de búsqueda</h1>
        <p className="mt-2 text-gray-600">
          Mostrando resultados para: <span className="font-semibold text-gray-900">"{query}"</span>
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 w-full animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
            🔍
          </div>
          <h3 className="text-lg font-medium text-gray-900">No se encontraron resultados</h3>
          <p className="mt-1 text-gray-500">Intenta con otro término, ID o correo electrónico.</p>
          {!searched && <p className="mt-4 text-sm text-gray-400">Escribe algo en la barra de búsqueda superior.</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.url}
              className="group relative flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-brand-emerald/30 hover:shadow-md"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl
                ${r.type === 'user' ? 'bg-blue-50 text-blue-600' : ''}
                ${r.type === 'order' ? 'bg-purple-50 text-purple-600' : ''}
                ${r.type === 'listing' ? 'bg-pink-50 text-pink-600' : ''}
                ${r.type === 'payment' ? 'bg-green-50 text-green-600' : ''}
                ${r.type === 'topup' ? 'bg-amber-50 text-amber-600' : ''}
                ${r.type === 'dispute' ? 'bg-red-50 text-red-600' : ''}
              `}>
                {r.type === 'user' && '👤'}
                {r.type === 'order' && '📦'}
                {r.type === 'listing' && '👕'}
                {r.type === 'payment' && '💰'}
                {r.type === 'topup' && '💳'}
                {r.type === 'dispute' && '⚠️'}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    {r.type === 'topup' ? 'Recarga' : r.type === 'user' ? 'Usuario' : r.type === 'listing' ? 'Producto' : r.type === 'order' ? 'Orden' : r.type}
                  </span>
                  {r.status && (
                    <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {r.status}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">· {new Date(r.date || '').toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-gray-900 group-hover:text-brand-emerald">{r.title}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="truncate">{r.subtitle}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="text-xs font-mono text-gray-400">{r.id.slice(0, 8)}...</div>
                <CopyButton text={r.id} className="text-gray-400 hover:text-brand-emerald" />
              </div>
              
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 group-hover:translate-x-1 group-hover:text-brand-emerald transition-all">
                →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GlobalSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <AdminTopMenu />
      <Suspense fallback={<div className="p-10 text-center">Cargando búsqueda...</div>}>
        <SearchContent />
      </Suspense>
    </div>
  );
}
