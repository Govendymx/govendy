import { NextRequest, NextResponse } from 'next/server';

// Cache in-memory para evitar llamadas repetidas al mismo título
const CACHE = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const MAX_CACHE_SIZE = 200;

// Cache separado para paths de categorías
const PATH_CACHE = new Map<string, { data: any; ts: number }>();

const SITE_ID = 'MLM'; // México

async function fetchCategoryPath(categoryId: string): Promise<{ id: string; name: string }[]> {
    // Check path cache
    const cached = PATH_CACHE.get(categoryId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000),
        });

        if (!res.ok) return [];

        const data = await res.json();
        const path = data.path_from_root || [];

        // Cache the path
        if (PATH_CACHE.size >= MAX_CACHE_SIZE) {
            const firstKey = PATH_CACHE.keys().next().value;
            if (firstKey) PATH_CACHE.delete(firstKey);
        }
        PATH_CACHE.set(categoryId, { data: path, ts: Date.now() });

        return path;
    } catch {
        return [];
    }
}

export async function GET(req: NextRequest) {
    try {
        const q = req.nextUrl.searchParams.get('q')?.trim();

        if (!q || q.length < 3) {
            return NextResponse.json(
                { ok: false, error: 'El título debe tener al menos 3 caracteres.' },
                { status: 400 }
            );
        }

        // Check cache
        const cacheKey = q.toLowerCase();
        const cached = CACHE.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            return NextResponse.json({ ok: true, suggestions: cached.data });
        }

        // Call MercadoLibre Domain Discovery API
        const url = `https://api.mercadolibre.com/sites/${SITE_ID}/domain_discovery/search?q=${encodeURIComponent(q)}`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            console.error(`[DomainDiscovery] API error: ${response.status}`);
            return NextResponse.json(
                { ok: false, error: 'No se pudo consultar el servicio de categorías.' },
                { status: 502 }
            );
        }

        const rawData = await response.json();

        // Process suggestions and fetch category paths
        const topItems = Array.isArray(rawData) ? rawData.slice(0, 5) : [];

        // Fetch path for the first suggestion (most relevant)
        const suggestions = await Promise.all(
            topItems.map(async (item: any, index: number) => {
                const base = {
                    domain_id: item.domain_id || null,
                    domain_name: item.domain_name || null,
                    category_id: item.category_id || null,
                    category_name: item.category_name || null,
                    category_path: [] as { id: string; name: string }[],
                };

                // Only fetch path for top 2 suggestions to save time
                if (index < 2 && item.category_id) {
                    base.category_path = await fetchCategoryPath(item.category_id);
                }

                return base;
            })
        );

        // Update cache
        if (CACHE.size >= MAX_CACHE_SIZE) {
            const firstKey = CACHE.keys().next().value;
            if (firstKey) CACHE.delete(firstKey);
        }
        CACHE.set(cacheKey, { data: suggestions, ts: Date.now() });

        return NextResponse.json({ ok: true, suggestions });
    } catch (err: any) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
            return NextResponse.json(
                { ok: false, error: 'Timeout al consultar categorías.' },
                { status: 504 }
            );
        }

        console.error('[DomainDiscovery] Unexpected error:', err);
        return NextResponse.json(
            { ok: false, error: 'Error interno.' },
            { status: 500 }
        );
    }
}
