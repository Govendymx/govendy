'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils/format';

import { ListingCard } from '@/components/listings/ListingCard';

type RelatedListing = {
  id: string;
  title: string;
  price: number;
  images: string[];
  sale_type: string;
  free_shipping: boolean;
  seller_id: string;
  seller?: any;
};

interface RelatedProductsProps {
  currentListingId: string;
  category?: string | null;
  tags?: string[] | null;
  sellerId: string;
  className?: string;
  gridCols?: string;
  carousel?: boolean;
}

export function RelatedProducts({ currentListingId, category, tags, sellerId, className = '', gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' }: RelatedProductsProps) {
  const [products, setProducts] = useState<RelatedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchRelated() {
      try {
        setLoading(true);
        
        // Base query: active listings, not current one
        let query = supabase
          .from('listings')
          .select('id, title, price, images, sale_type, free_shipping, seller_id, seller:seller_id(full_name, nickname, store_name, is_official, is_verified, is_wholesaler, is_manufacturer)')
          .eq('status', 'active')
          .neq('id', currentListingId)
          .limit(10); // Start with small limit to check if exists, then expand logic if needed. Actually let's fetch 8.


        // Priority 1: Same category
        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (!error && data) {
           setProducts(data.map(item => ({
             ...item,
             price: Number(item.price),
             images: item.images || []
           })));
        }
      } catch (err) {
        console.error('Error fetching related products:', err);
      } finally {
        setLoading(false);
      }
    }

    if (currentListingId) {
      fetchRelated();
    }
  }, [currentListingId, category, tags]);

  if (loading) return null;
  if (products.length === 0) return null;

  return (
    <div className={`col-span-full space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Productos relacionados</h2>
        <span className="text-xs text-gray-500">Ad</span>
      </div>
      
      {/* Horizontal Scroll / Carousel */}
      <div className="relative group">
        <div 
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {products.map((product) => (
            <div key={product.id} className="min-w-[160px] max-w-[160px] sm:min-w-[180px] sm:max-w-[180px] snap-start">
              <ListingCard
                p={product as any}
                size="fixed"
              />
            </div>
          ))}
        </div>
        
        {/* Gradient overlays for scroll indication */}
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none sm:hidden" />
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" />
      </div>
    </div>
  );
}
