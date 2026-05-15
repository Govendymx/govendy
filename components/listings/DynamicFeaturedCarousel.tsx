'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ProductCarousel } from './ProductCarousel';

type CarouselItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  images: string[] | null;
  status?: string;
  free_shipping?: boolean;
  discount?: number;
  seller_id: string;
  sale_type?: string | null;
  auction_end_at?: string | null;
  stock?: number | null;
  seller?: any;
};

interface DynamicFeaturedCarouselProps {
  type: 'auction' | 'free_shipping' | 'most_viewed' | 'featured';
  title?: string;
  limit?: number;
  rotateInterval?: number;
}

export function DynamicFeaturedCarousel({
  type,
  title,
  limit = 20,
  rotateInterval = 4000
}: DynamicFeaturedCarouselProps) {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('listings')
          .select('id, title, price, currency, images, status, free_shipping, seller_id, sale_type, auction_end_at, stock')
          .eq('status', 'active')
          // User requested "productos destacados", so we prioritize featured items.
          // However, for specific panels, maybe they want ALL items of that type but SORTED by featured?
          // The prompt says: "Los productos mostrados en estos carruseles deben ser seleccionados automáticamente de los artículos que los usuarios hayan destacado"
          // This implies ONLY featured items should be in the carousel.
          .eq('is_featured', true);

        // Apply type-specific filters
        switch (type) {
          case 'auction':
            query = query.eq('sale_type', 'auction');
            break;
          case 'free_shipping':
            query = query.eq('free_shipping', true);
            break;
          case 'most_viewed':
            // Assuming view_count exists based on previous context
            query = query.order('view_count', { ascending: false });
            break;
          case 'featured':
            // Just featured items, maybe sorted by newest
            query = query.order('created_at', { ascending: false });
            break;
        }

        // Common ordering (prioritize plan/date)
        // Since we filtered by is_featured=true, we are already showing featured.
        // We sort by creation date as a proxy for "fecha de destacado" if featured_at is missing.
        if (type !== 'most_viewed') {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query.limit(limit);

        if (error) {
          console.error('Error fetching featured carousel items:', error);
          return;
        }

        if (data) {
          setItems(data.map(item => ({
            ...item,
            // Ensure currency is set (default to MXN if missing)
            currency: item.currency || 'MXN',
            // Ensure images is array
            images: item.images || []
          })));
        }
      } catch (err) {
        console.error('Unexpected error fetching featured items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`featured-items-${type}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings',
          filter: 'is_featured=eq.true'
        },
        () => {
          // Refresh data on any change to featured items
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [type, limit]);

  if (loading || items.length === 0) {
    return null; // Or a skeleton loader
  }

  const defaultTitles = {
    auction: 'Subastas Destacadas',
    free_shipping: 'Envíos Gratis Destacados',
    most_viewed: 'Más Vistos Destacados',
    featured: 'Productos Destacados'
  };

  return (
    <div className="w-full">
      <ProductCarousel
        title={title || defaultTitles[type]}
        items={items}
        autoRotate={true}
        rotateInterval={rotateInterval}
      />
    </div>
  );
}
