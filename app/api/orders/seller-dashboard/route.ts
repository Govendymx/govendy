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
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const orders = data ?? [];

    if (orders.length > 0) {
      const buyerIds = Array.from(new Set(orders.map((o: any) => o.buyer_id).filter(Boolean)));
      if (buyerIds.length > 0) {
        const { data: buyersData } = await admin
          .from('profiles')
          .select('id, full_name, nickname, zip_code')
          .in('id', buyerIds);

        const buyersMap: Record<string, any> = {};
        buyersData?.forEach((b: any) => {
          buyersMap[b.id] = b;
        });

        orders.forEach((o: any) => {
          o.buyer = buyersMap[o.buyer_id] || null;
        });
      }
    }

    return NextResponse.json({ ok: true, orders });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error interno cargando ventas' },
      { status: 500 },
    );
  }
}

