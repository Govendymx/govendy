'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import ListingForm, { ListingFormData } from '@/components/listings/ListingForm';
import { normalizeListingFormInitialData } from '@/lib/listings/normalizeListingFormData';
import Link from 'next/link';

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const listingId = params?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<Partial<ListingFormData>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;

    async function load() {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) throw new Error('No iniciaste sesión');

        const { data, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', listingId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Publicación no encontrada');
        if (data.seller_id !== sessionData.session.user.id) throw new Error('No tienes permiso para editar esta publicación');

        const mappedData = normalizeListingFormInitialData({
          ...data,
          id: data.id,
          status: data.status,
          sale_type: data.sale_type || 'direct',
          condition: data.condition || null,
          product_type: data.product_type || 'physical',
          digital_delivery_type: data.digital_delivery_type || null,
          auction_start_at: data.auction_start_at || undefined,
          auction_end_at: data.auction_end_at || undefined,
          auction_starting_bid: String(data.auction_starting_bid || ''),
          auction_bid_increment: String(data.auction_bid_increment || ''),
          free_shipping: data.free_shipping || false,
          shipping_subsidy: String(data.shipping_subsidy || ''),
          weight_kg: String(data.weight_kg || '1'),
          length_cm: String(data.length_cm || '20'),
          width_cm: String(data.width_cm || '20'),
          height_cm: String(data.height_cm || '10'),
          shipping_by_seller: data.shipping_by_seller || false,
          allow_personal_delivery: data.allow_personal_delivery || false,
          handling_days: String(data.handling_days || '0'),
          custom_shipping_price: String(data.shipping_price || ''),
          shipping_carrier: data.shipping_carrier || '',
          is_featured: data.is_featured || false,
          youtube_url: data.youtube_url || '',
        }) as Partial<ListingFormData>;

        setInitialData(mappedData);
      } catch (err: any) {
        setError(err.message || 'Error al cargar');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [listingId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-emerald border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-4">
        <div className="rounded-xl bg-red-50 p-6 text-center text-red-800">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-900 hover:bg-red-200">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ListingForm
      key={listingId}
      mode="edit"
      listingId={listingId}
      initialData={initialData}
    />
  );
}
