'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_href: string;
  image_fit?: 'cover' | 'contain';
  image_position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

interface BannerCarouselProps {
  banners: Banner[];
  autoPlayInterval?: number;
}

export function BannerCarousel({ banners, autoPlayInterval = 5000 }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Auto-play logic
  useEffect(() => {
    if (banners.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [banners.length, isHovered, autoPlayInterval]);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => {
      let nextIndex = prev + newDirection;
      if (nextIndex < 0) nextIndex = banners.length - 1;
      if (nextIndex >= banners.length) nextIndex = 0;
      return nextIndex;
    });
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  useEffect(() => {
    setIsImageLoaded(false);
  }, [currentIndex]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <div 
      className="relative w-full overflow-hidden bg-gray-100 shadow-sm aspect-[16/9] sm:aspect-[1200/350]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);

            if (swipe < -swipeConfidenceThreshold) {
              paginate(1);
            } else if (swipe > swipeConfidenceThreshold) {
              paginate(-1);
            }
          }}
          className="absolute inset-0 h-full w-full"
        >
          <Link 
            href={currentBanner.cta_href === '/listings' || !currentBanner.cta_href ? '/explorar' : currentBanner.cta_href} 
            className="block h-full w-full"
            draggable={false}
          >
            <div className="relative h-full w-full bg-gray-200">
              {currentBanner.image_url && !isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-brand-emerald" />
                </div>
              )}
              {currentBanner.image_url ? (
                <Image
                  src={currentBanner.image_url}
                  alt={currentBanner.title}
                  fill
                  className={`object-cover transition-opacity duration-300 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    objectFit: (currentBanner.image_fit ?? 'cover') as any,
                    objectPosition: (currentBanner.image_position ?? 'center') as any,
                  }}
                  draggable={false}
                  onLoad={() => setIsImageLoaded(true)}
                  onError={() => setIsImageLoaded(true)}
                  sizes="(max-width: 768px) 100vw, 80vw"
                  priority={true}
                />
              ) : (
                 <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
                    Sin imagen
                 </div>
              )}
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent opacity-60 sm:opacity-40" />

              {/* Text Content */}
              <div className="absolute bottom-8 left-6 sm:bottom-12 sm:left-12 max-w-lg">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-extrabold text-white drop-shadow-md sm:text-4xl"
                >
                  {currentBanner.title}
                </motion.h2>
                {currentBanner.subtitle && (
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-2 text-sm font-medium text-white/90 drop-shadow sm:text-lg"
                  >
                    {currentBanner.subtitle}
                  </motion.p>
                )}
                {currentBanner.cta_text && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-4 inline-block rounded-full bg-white px-6 py-2 text-sm font-bold text-gray-900 shadow-lg transition-transform hover:scale-105 sm:mt-6 sm:px-8 sm:py-3"
                  >
                    {currentBanner.cta_text}
                  </motion.div>
                )}
              </div>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-white hover:text-gray-900 ${
              isHovered ? 'opacity-100' : 'opacity-0 sm:opacity-0'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              paginate(-1);
            }}
            aria-label="Anterior"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          <button
            className={`absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-white hover:text-gray-900 ${
              isHovered ? 'opacity-100' : 'opacity-0 sm:opacity-0'
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              paginate(1);
            }}
            aria-label="Siguiente"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 space-x-2">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              className={`h-2 w-2 rounded-full transition-all ${
                idx === currentIndex ? 'w-6 bg-white' : 'bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Ir a banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
