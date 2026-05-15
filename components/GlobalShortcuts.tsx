'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, User, GripVertical } from 'lucide-react';

const DEFAULT_LEFT = 16;
const DEFAULT_BOTTOM = 24;

// Botones globales flotantes y arrastrables para navegar rápido.
export function GlobalShortcuts() {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ left: DEFAULT_LEFT, bottom: DEFAULT_BOTTOM });
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, left: 0, bottom: 0 });
  const dragMoved = useRef(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragMoved.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      left: pos.left,
      bottom: pos.bottom,
    };
  }, [pos.left, pos.bottom]);

  // Touch support for mobile dragging
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragMoved.current = false;
    dragStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      left: pos.left,
      bottom: pos.bottom,
    };
  }, [pos.left, pos.bottom]);

  useEffect(() => {
    if (!mounted) return;
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = dragStart.current.y - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
      let left = dragStart.current.left + dx;
      let bottom = dragStart.current.bottom + dy;
      const pad = 8;
      left = Math.max(pad, Math.min(window.innerWidth - 80, left));
      bottom = Math.max(pad, Math.min(window.innerHeight - 140, bottom));
      setPos({ left, bottom });
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = dragStart.current.y - touch.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
      let left = dragStart.current.left + dx;
      let bottom = dragStart.current.bottom + dy;
      const pad = 8;
      left = Math.max(pad, Math.min(window.innerWidth - 80, left));
      bottom = Math.max(pad, Math.min(window.innerHeight - 140, bottom));
      setPos({ left, bottom });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [mounted, isDragging]);

  if (!mounted) return null;

  return (
    <div
      className="fixed z-[90] pointer-events-auto select-none"
      style={{ left: pos.left, bottom: pos.bottom }}
    >
      {/* Expanded menu */}
      <div
        className={`mb-2 flex flex-col gap-2 transition-all duration-300 origin-bottom ${isExpanded
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
          }`}
      >
        <Link href="/dashboard" className="sr-only">
          Ir a mi cuenta
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!dragMoved.current) router.push('/dashboard');
          }}
          className="group relative flex items-center gap-2.5 rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-gray-800 shadow-lg ring-1 ring-black/[0.08] backdrop-blur-xl hover:bg-white hover:shadow-xl hover:ring-brand-emerald/30 transition-all duration-300"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 group-hover:bg-brand-emerald/10 transition-colors">
            <User className="h-4 w-4 text-gray-600 group-hover:text-brand-emerald transition-colors" />
          </div>
          <span>Mi cuenta</span>
        </button>

        <Link href="/" className="sr-only">
          Ir a inicio
        </Link>
        <button
          type="button"
          onClick={() => {
            if (!dragMoved.current) router.push('/');
          }}
          className="group relative flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-emerald to-pink-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-brand-emerald/25 hover:shadow-xl hover:shadow-brand-emerald/40 hover:scale-[1.02] transition-all duration-300"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Home className="h-4 w-4 text-white" />
          </div>
          <span>GoVendy</span>
        </button>
      </div>

      {/* Main FAB button */}
      <div
        role="button"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={() => {
          if (!dragMoved.current) setIsExpanded((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((v) => !v);
          }
        }}
        className={`relative flex h-14 w-14 cursor-grab active:cursor-grabbing items-center justify-center rounded-2xl shadow-xl ring-1 ring-black/[0.08] transition-all duration-300 ${isExpanded
            ? 'bg-gray-800 text-white shadow-gray-800/25 rotate-45'
            : 'bg-gradient-to-br from-brand-emerald to-pink-500 text-white shadow-brand-emerald/30 hover:shadow-brand-emerald/50 hover:scale-105'
          }`}
        aria-label="Menú rápido"
      >
        {isExpanded ? (
          <svg className="h-6 w-6 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <GripVertical className="h-4 w-4 opacity-60" />
            <span className="text-[8px] font-black tracking-wider uppercase leading-none">GP</span>
          </div>
        )}

        {/* Pulsing ring when collapsed */}
        {!isExpanded && (
          <span className="absolute inset-0 rounded-2xl animate-ping bg-brand-emerald/20 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
