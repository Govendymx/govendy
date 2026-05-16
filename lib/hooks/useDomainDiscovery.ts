import { useState, useEffect, useRef } from 'react';

export interface CategoryPathSegment {
    id: string;
    name: string;
}

export interface DomainSuggestion {
    domain_id: string | null;
    domain_name: string | null;
    category_id: string | null;
    category_name: string | null;
    category_path: CategoryPathSegment[];
}

interface UseDomainDiscoveryResult {
    suggestions: DomainSuggestion[];
    isLoading: boolean;
    topSuggestion: DomainSuggestion | null;
}

// Client-side cache to avoid duplicate fetches in the same session
const clientCache = new Map<string, DomainSuggestion[]>();

/**
 * Hook that queries the Domain Discovery proxy API with debounced title input.
 * Returns category suggestions with full breadcrumb paths.
 */
export function useDomainDiscovery(title: string, enabled: boolean = true): UseDomainDiscoveryResult {
    const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const trimmed = title.trim();

        // Alineado con /api/meli/domain-discovery (mínimo 3 caracteres)
        if (!enabled || trimmed.length < 3) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        // Check client cache first
        const cacheKey = trimmed.toLowerCase();
        if (clientCache.has(cacheKey)) {
            setSuggestions(clientCache.get(cacheKey)!);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const timer = setTimeout(async () => {
            // Abort previous in-flight request
            if (abortRef.current) {
                abortRef.current.abort();
            }

            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await fetch(
                    `/api/meli/domain-discovery?q=${encodeURIComponent(trimmed)}`,
                    { signal: controller.signal }
                );

                if (!res.ok) {
                    setSuggestions([]);
                    return;
                }

                const json = await res.json();

                if (json.ok && Array.isArray(json.suggestions)) {
                    setSuggestions(json.suggestions);
                    clientCache.set(cacheKey, json.suggestions);
                } else {
                    setSuggestions([]);
                }
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    console.error('[useDomainDiscovery] Error:', err);
                    setSuggestions([]);
                }
            } finally {
                setIsLoading(false);
            }
        }, 800);

        return () => {
            clearTimeout(timer);
            if (abortRef.current) {
                abortRef.current.abort();
                abortRef.current = null;
            }
        };
    }, [title, enabled]);

    return {
        suggestions,
        isLoading,
        topSuggestion: suggestions.length > 0 ? suggestions[0] : null,
    };
}
