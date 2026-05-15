'use client';

import { useRef, useState, useEffect } from 'react';
import { ListingCard } from './ListingCard';

type CarouselItem = {
  id: string;
  title: string;
  price: number;
  currency: string;
  images: string[] | null;
  status?: string;
  free_shipping?: boolean;
  discount?: number;
  plan_type?: 'basic' | 'pro';
  seller_id: string; // Required by ListingCard
  sale_type?: string | null;
  auction_end_at?: string | null;
  stock?: number | null;
  seller?: any;
};

interface ProductCarouselProps {
  title: string;
  items: CarouselItem[];
  className?: string;
  autoRotate?: boolean;
  rotateInterval?: number;
}

export function ProductCarousel({ title, items, className = '', autoRotate = false, rotateInterval = 4000 }: ProductCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Auto-rotate logic
  useEffect(() => {
    if (!autoRotate || isHovered || !items || items.length === 0) return;

    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        // If we are near the end, scroll back to start
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scroll('right');
        }
      }
    }, rotateInterval);

    return () => clearInterval(interval);
  }, [autoRotate, rotateInterval, isHovered, items]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      handleScroll();
    }
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <div
      className={`py-6 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h2 className="mb-4 text-xl font-semibold text-gray-900">{title}</h2>

      <div className="group relative">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-4 rounded-full bg-white p-2 shadow-lg ring-1 ring-black/5 transition hover:bg-gray-50 focus:outline-none"
            aria-label="Scroll left"
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Carousel Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="min-w-[200px] max-w-[200px]">
              <ListingCard
                p={item as any}
                className="h-full"
              />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-4 rounded-full bg-white p-2 shadow-lg ring-1 ring-black/5 transition hover:bg-gray-50 focus:outline-none"
            aria-label="Scroll right"
          >
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
