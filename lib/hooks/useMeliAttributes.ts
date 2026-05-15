import { useState, useEffect, useRef } from 'react';

export interface MeliAttribute {
    id: string;
    name: string;
    value_type: 'string' | 'number' | 'list' | 'boolean' | 'number_unit';
    required: boolean;
    values: { id: string; name: string }[];
    hint: string | null;
    tooltip: string | null;
    default_value: string | null;
}

export interface MeliAttributeGroup {
    group_id: string;
    group_name: string;
    attributes: MeliAttribute[];
}

interface UseMeliAttributesResult {
    groups: MeliAttributeGroup[];
    isLoading: boolean;
}

// Client-side cache
const attrCache = new Map<string, MeliAttributeGroup[]>();

/**
 * Fetches ALL visible ML attributes for a category, grouped.
 */
export function useMeliAttributes(categoryId: string | null, enabled: boolean = true): UseMeliAttributesResult {
    const [groups, setGroups] = useState<MeliAttributeGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!enabled || !categoryId) {
            setGroups([]);
            return;
        }

        // Check cache
        if (attrCache.has(categoryId)) {
            setGroups(attrCache.get(categoryId)!);
            return;
        }

        setIsLoading(true);

        // Abort previous request
        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        (async () => {
            try {
                const res = await fetch(
                    `/api/meli/category-attributes?category_id=${encodeURIComponent(categoryId)}`,
                    { signal: controller.signal }
                );

                if (!res.ok) {
                    setGroups([]);
                    return;
                }

                const json = await res.json();

                if (json.ok && Array.isArray(json.groups)) {
                    setGroups(json.groups);
                    attrCache.set(categoryId, json.groups);
                } else {
                    setGroups([]);
                }
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    console.error('[useMeliAttributes] Error:', err);
                    setGroups([]);
                }
            } finally {
                setIsLoading(false);
            }
        })();

        return () => {
            if (abortRef.current) {
                abortRef.current.abort();
                abortRef.current = null;
            }
        };
    }, [categoryId, enabled]);

    return { groups, isLoading };
}
