import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function numberOrZero(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const listingId = req.nextUrl.searchParams.get('listingId')?.trim() || '';
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

    const admin = supabaseAdmin();

    const [{ data: listingRow, error: lErr }, { data: links, error: linkErr }] = await Promise.all([
      admin.from('listings').select('id,price').eq('id', listingId).maybeSingle(),
      admin.from('coupon_listings').select('coupon_id').eq('listing_id', listingId),
    ]);

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });
    if (!listingRow) return NextResponse.json({ available: false }, { status: 200 });
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    const couponIds = Array.from(new Set(((links as any[]) ?? []).map((x) => x.coupon_id).filter(Boolean)));
    if (couponIds.length === 0) return NextResponse.json({ available: false }, { status: 200 });

    const { data: coupons, error: cErr } = await admin
      .from('coupons')
      .select('id,code,discount_type,discount_value,starts_at,ends_at,is_active')
      .in('id', couponIds)
      .eq('is_active', true);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

    const now = Date.now();
    const price = numberOrZero((listingRow as any).price);

    const valid = ((coupons as any[]) ?? []).filter((c) => {
      const starts = c.starts_at ? Date.parse(c.starts_at) : null;
      const ends = c.ends_at ? Date.parse(c.ends_at) : null;
      if (starts && now < starts) return false;
      if (ends && now > ends) return false;
      return true;
    });

    if (valid.length === 0) return NextResponse.json({ available: false }, { status: 200 });

    let best: any = null;
    let bestDiscount = 0;
    for (const c of valid) {
      const dtype = c.discount_type as 'percent' | 'fixed';
      const dval = numberOrZero(c.discount_value);
      let discount = 0;
      if (dtype === 'percent') discount = price * (Math.max(0, Math.min(100, dval)) / 100);
      else discount = Math.min(price, Math.max(0, dval));

      if (discount > bestDiscount) {
        bestDiscount = discount;
        best = c;
      }
    }

    if (!best) return NextResponse.json({ available: false }, { status: 200 });

    return NextResponse.json({
      available: true,
      best: {
        code: String(best.code || ''),
        discount_type: best.discount_type,
        discount_value: numberOrZero(best.discount_value),
        estimated_discount: bestDiscount,
      },
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

