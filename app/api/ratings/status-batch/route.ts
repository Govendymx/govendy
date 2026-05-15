import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

type Mode = 'buyer' | 'seller';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.effectiveUserId;
    const admin = auth.admin;

    const body = (await req.json().catch(() => ({}))) as { orderIds?: unknown; mode?: Mode };
    const rawIds = Array.isArray(body?.orderIds) ? body.orderIds : [];
    const orderIds = Array.from(
      new Set(
        rawIds
          .map((v) => String(v || '').trim())
          .filter((v) => v),
      ),
    );

    const mode: Mode = body?.mode === 'buyer' || body?.mode === 'seller' ? body.mode : 'buyer';

    if (orderIds.length === 0) {
      return NextResponse.json({ ok: true, rated: {}, bothRated: {} });
    }

    const { data: orders, error: oErr } = await admin
      .from('orders')
      .select('id,buyer_id,seller_id')
      .in('id', orderIds)
      .limit(2000);

    if (oErr) {
      return NextResponse.json({ ok: false, error: oErr.message }, { status: 500 });
    }

    const allowedIds = new Set(
      (orders ?? [])
        .filter((o: any) => {
          const id = String(o?.id || '').trim();
          if (!id) return false;
          const b = String(o?.buyer_id || '').trim();
          const s = String(o?.seller_id || '').trim();
          return b === userId || s === userId;
        })
        .map((o: any) => String(o.id).trim()),
    );

    if (allowedIds.size === 0) {
      return NextResponse.json({ ok: true, rated: {}, bothRated: {} });
    }

    const allowed = Array.from(allowedIds);

    const ratingsRes: any = await admin
      .from('user_ratings')
      .select('order_id,direction,rater_id')
      .in('order_id', allowed)
      .limit(10000);

    if (ratingsRes?.error) {
      return NextResponse.json({ ok: false, error: ratingsRes.error.message }, { status: 500 });
    }

    const rated: Record<string, boolean> = {};
    const bothRated: Record<string, boolean> = {};
    const dirsByOrder: Record<string, Set<string>> = {};

    if (Array.isArray(ratingsRes.data)) {
      for (const r of ratingsRes.data as any[]) {
        const oid = String(r?.order_id || '').trim();
        const dir = String(r?.direction || '').trim();
        const raterId = String(r?.rater_id || '').trim();
        if (!oid || !allowedIds.has(oid) || !dir) continue;

        if (!dirsByOrder[oid]) dirsByOrder[oid] = new Set();
        dirsByOrder[oid].add(dir);

        if (mode === 'seller') {
          if (dir === 'seller_to_buyer' && raterId === userId) {
            rated[oid] = true;
          }
        } else {
          if (dir === 'buyer_to_seller' && raterId === userId) {
            rated[oid] = true;
          }
        }
      }
    }

    for (const [oid, dirs] of Object.entries(dirsByOrder)) {
      if (dirs.has('buyer_to_seller') && dirs.has('seller_to_buyer')) {
        bothRated[oid] = true;
      }
    }

    return NextResponse.json({ ok: true, rated, bothRated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

