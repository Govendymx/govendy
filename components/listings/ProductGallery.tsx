'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon
} from '@heroicons/react/24/outline';

interface ProductGalleryProps {
  images: string[];
  title: string;
}

export function ProductGallery({ images = [], title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalZoom, setModalZoom] = useState(1);

  const imgContainerRef = useRef<HTMLDivElement>(null);
  const safeImages = images && images.length > 0 ? images : ['/placeholder.png']; // Fallback image if needed

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgContainerRef.current) return;

    const { left, top, width, height } = imgContainerRef.current.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    // Calculate percentage position (0-100)
    const xPerc = (x / width) * 100;
    const yPerc = (y / height) * 100;

    setMagnifierPosition({ x: xPerc, y: yPerc });
  };

  const nextImage = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % safeImages.length);
  }, [safeImages.length]);

  const prevImage = useCallback(() => {
    setSelectedIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
  }, [safeImages.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'Escape') setIsModalOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextImage, prevImage]);

  return (
    <div className="space-y-4">
      {/* Main Image Container */}
      <div
        ref={imgContainerRef}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] bg-white shadow-sm p-6 sm:aspect-square md:aspect-[4/5] xl:aspect-square"
        onMouseEnter={() => setShowMagnifier(true)}
        onMouseLeave={() => setShowMagnifier(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setIsModalOpen(true)}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <Image
              src={safeImages[selectedIndex]}
              alt={`${title} - Imagen ${selectedIndex + 1}`}
              fill
              className="object-contain object-center cursor-zoom-in"
              priority={selectedIndex === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
            />
          </motion.div>
        </AnimatePresence>

        {/* Magnifier Lens (Desktop) */}
        {showMagnifier && (
          <div
            className="pointer-events-none absolute hidden lg:block rounded-full bg-white ring-2 ring-brand-emerald/20 shadow-2xl overflow-hidden z-20"
            style={{
              width: '200px',
              height: '200px',
              left: `calc(${magnifierPosition.x}% - 100px)`,
              top: `calc(${magnifierPosition.y}% - 100px)`,
              backgroundImage: `url(${safeImages[selectedIndex]})`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: `${magnifierPosition.x}% ${magnifierPosition.y}%`,
              backgroundSize: '250%', // 2.5x Zoom
            }}
          />
        )}

        {/* Navigation Arrows */}
        {safeImages.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-800 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-110"
              aria-label="Imagen anterior"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-800 shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-110"
              aria-label="Siguiente imagen"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Mobile Pinch Hint / Zoom Icon */}
        <div className="absolute bottom-4 right-4 pointer-events-none rounded-full bg-black/50 p-2 text-white backdrop-blur-sm lg:hidden">
          <MagnifyingGlassPlusIcon className="h-5 w-5" />
        </div>
      </div>

      {/* Thumbnails Gallery */}
      {safeImages.length > 1 && (
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 scrollbar-hide snap-x px-1">
            {safeImages.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative h-20 w-20 flex-none snap-start overflow-hidden rounded-2xl transition-all duration-300 ease-out ${selectedIndex === idx
                  ? 'shadow-lg scale-105 opacity-100 ring-2 ring-brand-emerald/20'
                  : 'opacity-60 hover:opacity-100 hover:scale-105 grayscale hover:grayscale-0'
                  }`}
              >
                <Image
                  src={img}
                  alt={`Vista previa ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          >
            <button
              className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={() => setIsModalOpen(false)}
            >
              <XMarkIcon className="h-8 w-8" />
            </button>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 z-50">
              <button
                onClick={(e) => { e.stopPropagation(); setModalZoom(z => Math.max(1, z - 0.5)); }}
                className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              >
                <MinusIcon className="h-6 w-6" />
              </button>
              <span className="flex items-center text-white font-mono">{Math.round(modalZoom * 100)}%</span>
              <button
                onClick={(e) => { e.stopPropagation(); setModalZoom(z => Math.min(5, z + 0.5)); }}
                className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
              >
                <PlusIcon className="h-6 w-6" />
              </button>
            </div>

            <div
              className="relative h-full w-full p-4 md:p-10 flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                drag
                dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
                style={{ scale: modalZoom, cursor: modalZoom > 1 ? 'grab' : 'default' }}
                className="relative h-full w-full max-h-[85vh] max-w-[85vw]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={safeImages[selectedIndex]}
                  alt={title}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </motion.div>
            </div>

            {safeImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 text-white hover:bg-white/20"
                >
                  <ChevronLeftIcon className="h-8 w-8" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 text-white hover:bg-white/20"
                >
                  <ChevronRightIcon className="h-8 w-8" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
