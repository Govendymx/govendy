'use client';

import { useEffect, useState } from 'react';
import { ProductCarousel } from './ProductCarousel';

export function RecommendationSection({ listingId }: { listingId: string }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch(`/api/listings/${listingId}/recommendations`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.recommendations || []);
        }
      } catch (err) {
        console.error('Error loading recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    if (listingId) {
      fetchRecommendations();
    }
  }, [listingId]);

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />;
  if (items.length === 0) return null;

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <ProductCarousel title="Quienes vieron este producto también compraron" items={items} />
    </div>
  );
}
