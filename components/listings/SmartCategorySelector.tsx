'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';

interface SmartCategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  onPropose: (newValue: string) => void;
  disabled?: boolean;
}

export function SmartCategorySelector({ value, onChange, categories, onPropose, disabled }: SmartCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Solo sincronizamos si el valor externo cambia y NO es lo que ya tenemos en el input
  // O si el input está vacío (inicialización)
  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  const filteredCategories = categories.filter((cat) => {
    const normCat = normalizeText(cat);
    const normInput = normalizeText(inputValue.trim());

    if (!normInput) return true; // Show all if empty

    // Split input into words for multi-word matching (MercadoLibre style)
    const inputWords = normInput.split(/\s+/).filter(w => w.length > 0);

    // Match if ALL input words are found in the category
    return inputWords.every(word => normCat.includes(word));

  }).sort((a, b) => {
    const normA = normalizeText(a);
    const normB = normalizeText(b);
    const normInput = normalizeText(inputValue.trim());

    // Priority 1: Exact match
    if (normA === normInput) return -1;
    if (normB === normInput) return 1;

    // Priority 2: Starts with input
    const aStarts = normA.startsWith(normInput);
    const bStarts = normB.startsWith(normInput);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Priority 3: Word boundary match (starts with input after a space)
    const aWordBoundary = normA.split(/\s+/).some(word => word.startsWith(normInput));
    const bWordBoundary = normB.split(/\s+/).some(word => word.startsWith(normInput));
    if (aWordBoundary && !bWordBoundary) return -1;
    if (!aWordBoundary && bWordBoundary) return 1;

    // Priority 4: Shorter names first (more specific)
    return a.length - b.length;
  });

  const showCreateOption = inputValue.trim().length > 0 &&
    !categories.some(c => normalizeText(c) === normalizeText(inputValue.trim()));

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-brand-emerald pr-10 ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
          placeholder={disabled ? 'Detectando automáticamente...' : 'Selecciona o escribe una categoría...'}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => !disabled && setOpen(true)}
        />
        <button
          type="button"
          disabled={disabled}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          onClick={() => !disabled && setOpen(!open)}
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
          {filteredCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-900"
              onClick={() => {
                onChange(cat);
                setInputValue(cat);
                setOpen(false);
              }}
            >
              {cat}
              {value === cat && <Check className="h-4 w-4 text-brand-emerald" />}
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-emerald hover:bg-pink-50 font-medium border-t border-gray-100"
              onClick={() => {
                onPropose(inputValue.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              Crear "{inputValue.trim()}"
            </button>
          )}

          {filteredCategories.length === 0 && !showCreateOption && (
            <div className="px-4 py-2 text-sm text-gray-500">
              No se encontraron resultados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
