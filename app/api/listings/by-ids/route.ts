import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

/**
 * POST /api/listings/by-ids
 * Fetches listing data for given IDs using the admin client (bypasses RLS).
 * Used by the Compras page where the buyer needs to read seller's listings
 * that may be sold/paused (and blocked by RLS).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = auth.admin;

        const body = await req.json().catch(() => ({}));
        const ids: string[] = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x || '').trim()).filter(Boolean) : [];

        if (ids.length === 0) {
            return NextResponse.json({ ok: true, listings: [] });
        }

        // Limit to 500 IDs
        const limited = ids.slice(0, 500);

        const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        const uuids = limited.filter(isUuid);
        const publics = limited.filter((x) => !isUuid(x));

        const results: any[] = [];

        if (uuids.length > 0) {
            const { data } = await admin
                .from('listings')
                .select('id,public_id,images,title,weight_kg,length_cm,width_cm,height_cm,product_type,sale_type,shipping_by_seller,free_shipping,allow_personal_delivery,shipping_price,shipping_option_id')
                .in('id', uuids)
                .limit(500);
            if (Array.isArray(data)) results.push(...data);
        }

        if (publics.length > 0) {
            const { data } = await admin
                .from('listings')
                .select('id,public_id,images,title,weight_kg,length_cm,width_cm,height_cm,product_type,sale_type,shipping_by_seller,free_shipping,allow_personal_delivery,shipping_price,shipping_option_id')
                .in('public_id', publics)
                .limit(500);
            if (Array.isArray(data)) results.push(...data);
        }

        return NextResponse.json({ ok: true, listings: results });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || 'Error fetching listings' },
            { status: e?.statusCode || 500 },
        );
    }
}
