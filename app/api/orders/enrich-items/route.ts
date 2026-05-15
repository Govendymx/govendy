import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Payload = {
  orderIds?: string[];
  listingIds?: string[];
};

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id || null;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Payload;
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(String).filter(Boolean) : [];
    const listingIdsInput = Array.isArray(body.listingIds) ? body.listingIds.map(String).filter(Boolean) : [];

    // Verificar propiedad de órdenes (si vienen)
    let allowedOrderIds = new Set<string>();
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id,seller_id,buyer_id')
        .in('id', orderIds)
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`);
      for (const o of orders ?? []) {
        const id = String((o as any)?.id || '').trim();
        if (id) allowedOrderIds.add(id);
      }
    }

    // Reunir listing_ids (de entrada o desde order_items)
    const listingIdsSet = new Set<string>(listingIdsInput);
    if (allowedOrderIds.size > 0) {
      const admin = supabaseAdmin();
      const { data: items } = await admin
        .from('order_items')
        .select('order_id,listing_id')
        .in('order_id', Array.from(allowedOrderIds));
      for (const it of items ?? []) {
        const lid = String((it as any)?.listing_id || '').trim();
        if (lid) listingIdsSet.add(lid);
      }
    }

    const listingIds = Array.from(listingIdsSet);
    if (listingIds.length === 0) {
      return NextResponse.json({ titles: {}, thumbs: {}, handlingDays: {}, shippingBySeller: {} });
    }

    // Traer listings con service_role para evitar bloqueos de RLS
    const admin = supabaseAdmin();
    const uuids = listingIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    const publics = listingIds.filter((x) => !/^[0-9a-f-]{36}$/i.test(x));
    const selectCols = 'id,public_id,images,title,handling_days,shipping_by_seller';
    const results: any[] = [];
    if (uuids.length > 0) {
      const r1: any = await admin.from('listings').select(selectCols).in('id', uuids).limit(500);
      if (!r1.error && Array.isArray(r1.data)) results.push(...r1.data);
    }
    if (publics.length > 0) {
      const r2: any = await admin.from('listings').select(selectCols).in('public_id', publics).limit(500);
      if (!r2.error && Array.isArray(r2.data)) results.push(...r2.data);
    }

    const titles: Record<string, string> = {};
    const thumbs: Record<string, string> = {};
    const handlingDays: Record<string, number> = {};
    const shippingBySeller: Record<string, boolean> = {};

    for (const r of results) {
      const idKey1 = String(r?.id || '').trim();
      const idKey2 = String(r?.public_id || '').trim();

      let imgs: string[] = [];
      const rawImgs = (r as any)?.images;
      if (Array.isArray(rawImgs)) {
        imgs = rawImgs.map((x: any) => String(x || '').trim()).filter(Boolean);
      } else if (typeof rawImgs === 'string') {
        const sraw = rawImgs.trim();
        try {
          const parsed = JSON.parse(sraw);
          if (Array.isArray(parsed)) imgs = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
        } catch {
          if (sraw.startsWith('http') || sraw.startsWith('/')) imgs = [sraw];
        }
      }
      const first = imgs[0] || '';
      const tt = String((r as any)?.title || '').trim();
      const hd = typeof (r as any)?.handling_days === 'number' ? (r as any).handling_days : undefined;
      const sbs = typeof (r as any)?.shipping_by_seller !== 'undefined' ? Boolean((r as any).shipping_by_seller) : undefined;

      if (first) {
        if (idKey1) thumbs[idKey1] = first;
        if (idKey2) thumbs[idKey2] = first;
      }
      if (tt) {
        if (idKey1) titles[idKey1] = tt;
        if (idKey2) titles[idKey2] = tt;
      }
      if (typeof hd === 'number') {
        if (idKey1) handlingDays[idKey1] = hd;
        if (idKey2) handlingDays[idKey2] = hd;
      }
      if (typeof sbs === 'boolean') {
        if (idKey1) shippingBySeller[idKey1] = sbs;
        if (idKey2) shippingBySeller[idKey2] = sbs;
      }
    }

    return NextResponse.json({ titles, thumbs, handlingDays, shippingBySeller });
  } catch (e: any) {
    console.error('[orders/enrich-items] Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
