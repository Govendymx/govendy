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

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || 'Error cargando ventas' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, orders: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error interno cargando ventas' },
      { status: 500 },
    );
  }
}

