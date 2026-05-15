import { NextRequest, NextResponse } from 'next/server';

// Cache in-memory para atributos por categoría
const ATTR_CACHE = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const MAX_CACHE_SIZE = 100;

export async function GET(req: NextRequest) {
    try {
        const categoryId = req.nextUrl.searchParams.get('category_id')?.trim();

        if (!categoryId) {
            return NextResponse.json(
                { ok: false, error: 'Se requiere category_id.' },
                { status: 400 }
            );
        }

        // Check cache
        const cached = ATTR_CACHE.get(categoryId);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            return NextResponse.json({ ok: true, groups: cached.data });
        }

        // Fetch from MercadoLibre
        const url = `https://api.mercadolibre.com/categories/${encodeURIComponent(categoryId)}/attributes`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            console.error(`[CategoryAttributes] API error: ${response.status}`);
            return NextResponse.json(
                { ok: false, error: 'No se pudieron obtener los atributos.' },
                { status: 502 }
            );
        }

        const rawData = await response.json();

        // Filter: remove hidden, read_only, and inferred attributes
        const visible = (Array.isArray(rawData) ? rawData : []).filter((attr: any) => {
            const isHidden = attr.tags?.hidden === true;
            const isReadOnly = attr.tags?.read_only === true;
            const isInferred = attr.tags?.inferred === true;
            return !isHidden && !isReadOnly && !isInferred;
        });

        // Group by attribute_group_name (or attribute_group_id)
        const groupMap: Record<string, { group_id: string; group_name: string; attributes: any[] }> = {};

        for (const attr of visible) {
            const groupName = attr.attribute_group_name || 'Otros';
            const groupId = attr.attribute_group_id || 'OTHERS';

            if (!groupMap[groupId]) {
                groupMap[groupId] = {
                    group_id: groupId,
                    group_name: groupName,
                    attributes: [],
                };
            }

            groupMap[groupId].attributes.push({
                id: attr.id,
                name: attr.name,
                value_type: attr.value_type, // string, number, list, boolean, number_unit
                required: attr.tags?.required || false,
                values: attr.values?.slice(0, 100)?.map((v: any) => ({
                    id: v.id,
                    name: v.name,
                })) || [],
                hint: attr.hint || null,
                tooltip: attr.tooltip || null,
                default_value: attr.default_value || null,
            });
        }

        // Convert to sorted array: required groups first, then by size
        const groups = Object.values(groupMap).sort((a, b) => {
            const aHasRequired = a.attributes.some(attr => attr.required);
            const bHasRequired = b.attributes.some(attr => attr.required);
            if (aHasRequired && !bHasRequired) return -1;
            if (!aHasRequired && bHasRequired) return 1;
            return b.attributes.length - a.attributes.length;
        });

        // Within each group, sort: required first
        for (const g of groups) {
            g.attributes.sort((a: any, b: any) => {
                if (a.required && !b.required) return -1;
                if (!a.required && b.required) return 1;
                return 0;
            });
        }

        // Update cache
        if (ATTR_CACHE.size >= MAX_CACHE_SIZE) {
            const firstKey = ATTR_CACHE.keys().next().value;
            if (firstKey) ATTR_CACHE.delete(firstKey);
        }
        ATTR_CACHE.set(categoryId, { data: groups, ts: Date.now() });

        return NextResponse.json({ ok: true, groups });
    } catch (err: any) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
            return NextResponse.json(
                { ok: false, error: 'Timeout al consultar atributos.' },
                { status: 504 }
            );
        }

        console.error('[CategoryAttributes] Unexpected error:', err);
        return NextResponse.json(
            { ok: false, error: 'Error interno.' },
            { status: 500 }
        );
    }
}
