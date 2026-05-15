import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.effectiveUserId;
    const admin = auth.admin;

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit') || '500');
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 500;

    const { data, error } = await admin
      .from('orders')
      .select('*')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || 'Error cargando compras' },
        { status: 500 },
      );
    }

    const orders = (data ?? []) as any[];
    const orderIds = orders.map((o) => String(o?.id || '').trim()).filter(Boolean);

    // Maps para imágenes y títulos de listings — se incluyen en la respuesta
    const thumbsByListingId: Record<string, string> = {};
    const titlesByListingId: Record<string, string> = {};

    if (orderIds.length > 0) {
      let itemsRes: any = await admin
        .from('order_items')
        .select('order_id,listing_id,created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true })
        .limit(5000);
      if (!itemsRes?.error && Array.isArray(itemsRes.data)) {
        const firstListingByOrder: Record<string, string> = {};
        const listingIdsByOrder: Record<string, string[]> = {};
        const listingIds: string[] = [];
        for (const it of itemsRes.data as any[]) {
          const oid = String(it?.order_id || '').trim();
          const lid = String(it?.listing_id || '').trim();
          if (!oid || !lid) continue;
          if (!firstListingByOrder[oid]) {
            firstListingByOrder[oid] = lid;
            listingIds.push(lid);
          }
          if (!listingIdsByOrder[oid]) {
            listingIdsByOrder[oid] = [];
          }
          if (!listingIdsByOrder[oid].includes(lid)) {
            listingIdsByOrder[oid].push(lid);
          }
        }

        // Recopilar TODOS los listing_ids únicos de TODAS las órdenes
        const allUniqueLids = Array.from(new Set(
          Object.values(listingIdsByOrder).flat()
        ));

        if (allUniqueLids.length > 0) {
          const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
          const uuids = allUniqueLids.filter(isUuid);
          const publics = allUniqueLids.filter((x) => !isUuid(x));

          const allListings: any[] = [];
          if (uuids.length > 0) {
            const { data: q1 } = await admin
              .from('listings')
              .select('id,public_id,images,title,shipping_by_seller,allow_personal_delivery,free_shipping,shipping_price,sale_type,product_type')
              .in('id', uuids)
              .limit(1000);
            if (Array.isArray(q1)) allListings.push(...q1);
          }
          if (publics.length > 0) {
            const { data: q2 } = await admin
              .from('listings')
              .select('id,public_id,images,title,shipping_by_seller,allow_personal_delivery,free_shipping,shipping_price,sale_type,product_type')
              .in('public_id', publics)
              .limit(1000);
            if (Array.isArray(q2)) allListings.push(...q2);
          }

          const listingMap: Record<string, any> = {};
          for (const l of allListings) {
            const id = String(l?.id || '').trim();
            const pubId = String(l?.public_id || '').trim();

            // Extraer primera imagen
            let firstImg = '';
            const rawImgs = l?.images;
            if (Array.isArray(rawImgs)) {
              firstImg = rawImgs.map((x: any) => String(x || '').trim()).filter(Boolean)[0] || '';
            } else if (typeof rawImgs === 'string') {
              const s = rawImgs.trim();
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) firstImg = parsed.map((x: any) => String(x || '').trim()).filter(Boolean)[0] || '';
              } catch {
                if (s.startsWith('http') || s.startsWith('/')) firstImg = s;
              }
            }

            const tt = String(l?.title || '').trim();

            // Mapear por UUID y public_id
            if (firstImg) {
              if (id) thumbsByListingId[id] = firstImg;
              if (pubId) thumbsByListingId[pubId] = firstImg;
            }
            if (tt) {
              if (id) titlesByListingId[id] = tt;
              if (pubId) titlesByListingId[pubId] = tt;
            }

            const info = {
              shipping_by_seller: Boolean(l?.shipping_by_seller),
              allow_personal_delivery: Boolean(l?.allow_personal_delivery),
              free_shipping: Boolean(l?.free_shipping),
              shipping_price: Number(l?.shipping_price ?? 0),
              sale_type: String(l?.sale_type || '').trim(),
              product_type: String((l as any)?.product_type || 'physical').toLowerCase(),
            };
            if (id) listingMap[id] = info;
            if (pubId) listingMap[pubId] = info;
          }

          for (const o of orders) {
            const oid = String(o?.id || '').trim();
            const lid = firstListingByOrder[oid];
            if (lid && listingMap[lid]) {
              (o as any).shipping_snapshot = listingMap[lid];
            }
            // Check ALL listing IDs for this order (not just the first)
            const lidsForOrder = listingIdsByOrder[oid] || [];
            const hasDigital = lidsForOrder.some((lid2) => {
              const info = listingMap[lid2];
              return info && String(info.product_type || '').toLowerCase() === 'digital';
            });

            if (hasDigital) {
              (o as any).product_type = 'digital';
              (o as any).shipping_method = 'digital';
            }
          }

          // --- SECOND PASS: For any orders where listing wasn't in map, do a direct check ---
          const ordersWithoutDigitalFlag = orders.filter((o: any) => {
            const pt = String(o?.product_type || '').toLowerCase();
            const sm = String(o?.shipping_method || '').toLowerCase();
            return pt !== 'digital' && sm !== 'digital';
          });
          if (ordersWithoutDigitalFlag.length > 0) {
            // Get all unique listing IDs for these orders that we might have missed
            const missedLids: string[] = [];
            for (const o of ordersWithoutDigitalFlag) {
              const oid = String(o?.id || '').trim();
              const lids = listingIdsByOrder[oid] || [];
              for (const lid2 of lids) {
                if (!listingMap[lid2] && !missedLids.includes(lid2)) {
                  missedLids.push(lid2);
                }
              }
            }
            if (missedLids.length > 0) {
              const isUuid2 = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
              const uuids2 = missedLids.filter(isUuid2);
              const publics2 = missedLids.filter((x) => !isUuid2(x));
              const extra: any[] = [];
              if (uuids2.length > 0) {
                const { data: q } = await admin.from('listings').select('id,public_id,product_type').in('id', uuids2).limit(500);
                if (Array.isArray(q)) extra.push(...q);
              }
              if (publics2.length > 0) {
                const { data: q } = await admin.from('listings').select('id,public_id,product_type').in('public_id', publics2).limit(500);
                if (Array.isArray(q)) extra.push(...q);
              }
              const extraMap: Record<string, string> = {};
              for (const l of extra) {
                const id1 = String(l?.id || '').trim();
                const id2 = String(l?.public_id || '').trim();
                const pt = String(l?.product_type || '').toLowerCase();
                if (id1) extraMap[id1] = pt;
                if (id2) extraMap[id2] = pt;
              }
              for (const o of ordersWithoutDigitalFlag) {
                const oid = String(o?.id || '').trim();
                const lids = listingIdsByOrder[oid] || [];
                const isExtraDigital = lids.some((lid2) => extraMap[lid2] === 'digital');
                if (isExtraDigital) {
                  (o as any).product_type = 'digital';
                  (o as any).shipping_method = 'digital';
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, orders, thumbsByListingId, titlesByListingId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error interno cargando compras' },
      { status: 500 },
    );
  }
}
