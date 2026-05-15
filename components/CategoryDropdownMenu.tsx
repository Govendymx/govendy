'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

import { NEW_CATEGORIES_CONFIG } from '@/lib/categories';

// Helper to map config keys to UI labels if needed
const GENDER_MAP: Record<string, string> = {
  'Mujer': 'Mujeres',
  'Hombre': 'Hombre',
  'Niños, Niñas y Bebés': 'Niños y Bebés'
};

const genderCategories = Object.entries(NEW_CATEGORIES_CONFIG)
  .filter(([key]) => ['Mujer', 'Hombre', 'Niños, Niñas y Bebés'].includes(key))
  .map(([key, categories]) => ({
    label: GENDER_MAP[key] || key,
    originalKey: key,
    // For the dropdown, we show all subcategories for easier navigation
    items: categories.flatMap(cat =>
      cat.subcategories.map(sub => ({
        label: sub.label,
        category: cat.label,
        subcategory: sub.id
      }))
    )
  }));

export function CategoryDropdownMenu() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      for (const [key, ref] of Object.entries(menuRefs.current)) {
        if (ref && !ref.contains(event.target as Node)) {
          setOpenMenu(null);
        }
      }
    };

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenu]);

  return (
    <nav className="relative flex items-center gap-1">
      {genderCategories.map((gender) => (
        <div key={gender.label} className="relative" ref={(el) => { menuRefs.current[gender.label] = el; }}>
          <button
            type="button"
            onMouseEnter={() => setOpenMenu(gender.label)}
            onMouseLeave={() => setOpenMenu(null)}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-100 hover:scale-105 group"
          >
            {gender.label}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-all duration-300 ${openMenu === gender.label ? 'rotate-180' : ''} group-hover:scale-110`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Dropdown menu rosa transparente */}
          {openMenu === gender.label && (
            <div
              className="absolute left-0 top-full z-50 mt-1 min-w-[300px] max-w-md rounded-2xl bg-gradient-to-br from-pink-500/95 to-pink-600/95 backdrop-blur-md shadow-2xl ring-1 ring-pink-300/50 animate-slide-down"
              onMouseEnter={() => setOpenMenu(gender.label)}
              onMouseLeave={() => setOpenMenu(null)}
            >
              {/* Flecha apuntando hacia arriba */}
              <div className="absolute -top-2 left-6 h-4 w-4 rotate-45 bg-pink-500/95 ring-1 ring-pink-300/50" />
              <div className="relative p-4">
                <div className="mb-3 border-b border-white/20 pb-2">
                  <div className="text-sm font-extrabold uppercase tracking-wider text-white">{gender.label}</div>
                </div>
                <div className="max-h-[500px] overflow-y-auto scrollbar-subtle">
                  <div className="grid grid-cols-1 gap-0.5">
                    {gender.items.map((item) => (
                      <Link
                        key={item.label}
                        href={`/listings?gender=${encodeURIComponent(gender.originalKey)}&category=${encodeURIComponent(item.category)}&subcategory=${encodeURIComponent(item.subcategory)}`}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-white/25 hover:shadow-sm hover:scale-[1.02] hover:translate-x-1"
                        onClick={() => setOpenMenu(null)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
