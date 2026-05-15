'use client';

import { useState, useRef, useEffect } from 'react';
import type { DomainSuggestion, CategoryPathSegment } from '@/lib/hooks/useDomainDiscovery';

interface MLCategorySelectorProps {
    suggestion: DomainSuggestion | null;
    allSuggestions: DomainSuggestion[];
    isLoading: boolean;
    onSelect: (suggestion: DomainSuggestion) => void;
    onManualSearch: (query: string) => void;
    disabled?: boolean;
}

/**
 * Breadcrumb-style category selector inspired by MercadoLibre.
 * Shows auto-detected category path with option to change.
 */
export function MLCategorySelector({
    suggestion,
    allSuggestions,
    isLoading,
    onSelect,
    onManualSearch,
    disabled,
}: MLCategorySelectorProps) {
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSearching && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearching]);

    const path = suggestion?.category_path || [];
    const hasPath = path.length > 0;
    const categoryName = suggestion?.category_name;

    // Handle search submit
    const handleSearch = () => {
        if (searchQuery.trim().length >= 3) {
            onManualSearch(searchQuery.trim());
            setIsSearching(false);
            setSearchQuery('');
        }
    };

    // State 1: Loading
    if (isLoading) {
        return (
            <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-gray-500">Detectando categoría...</span>
                </div>
            </div>
        );
    }

    // State 2: Search mode
    if (isSearching) {
        return (
            <div className="rounded-xl border-2 border-orange-300 bg-orange-50/50 p-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Buscar categoría
                </label>
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                        placeholder="Ej: Proyector, Vestido, iPhone..."
                        className="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-400"
                    />
                    <button
                        type="button"
                        onClick={handleSearch}
                        disabled={searchQuery.trim().length < 3}
                        className="rounded-lg bg-black px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                        Buscar
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsSearching(false); setSearchQuery(''); }}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                </div>

                {/* Show alternative suggestions if available */}
                {allSuggestions.length > 1 && (
                    <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Otras sugerencias</p>
                        {allSuggestions.slice(0, 4).map((s, i) => (
                            <button
                                key={`${s.category_id}-${i}`}
                                type="button"
                                onClick={() => { onSelect(s); setIsSearching(false); setSearchQuery(''); }}
                                className="w-full text-left rounded-lg px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
                            >
                                {s.category_path?.length > 0
                                    ? s.category_path.map(p => p.name).join(' › ')
                                    : s.category_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // State 3: Detected category with path
    if (hasPath || categoryName) {
        return (
            <div className="rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50/60 to-emerald-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-xs">✅</span>
                            <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wider">Categoría detectada</span>
                        </div>
                        {hasPath ? (
                            <div className="flex flex-wrap items-center gap-0.5 text-sm text-gray-700">
                                {path.map((seg, i) => (
                                    <span key={seg.id} className="flex items-center gap-0.5">
                                        <span className={i === path.length - 1 ? 'font-bold text-gray-900' : ''}>
                                            {seg.name}
                                        </span>
                                        {i < path.length - 1 && (
                                            <span className="text-gray-300 mx-0.5">›</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-gray-900">{categoryName}</p>
                        )}
                    </div>
                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => setIsSearching(true)}
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-100 transition-colors"
                        >
                            Cambiar
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // State 4: Empty — no title yet
    return (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                    Escribe un título para detectar la categoría automáticamente
                </p>
                <button
                    type="button"
                    onClick={() => setIsSearching(true)}
                    className="shrink-0 text-[11px] font-bold text-orange-600 hover:text-orange-700 underline"
                >
                    Seleccionar manualmente
                </button>
            </div>
        </div>
    );
}
