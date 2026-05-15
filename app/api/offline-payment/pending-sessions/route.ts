import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const admin = auth.admin;
    const userId = auth.effectiveUserId;

    const { data, error } = await admin
      .from('checkout_sessions')
      .select('id,order_ids,payment_method,status,amount,reference_code,created_at')
      .eq('buyer_id', userId)
      .eq('status', 'pending')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || 'Error cargando sesiones pendientes' },
        { status: 500 },
      );
    }

    const sessions = Array.isArray(data) ? data : [];
    const byOrderId: Record<string, string> = {};
    for (const sess of sessions as any[]) {
      const sid = String(sess?.id || '').trim();
      const ids = Array.isArray(sess?.order_ids) ? sess.order_ids : [];
      for (const oid of ids) {
        const k = String(oid || '').trim();
        if (!k) continue;
        byOrderId[k] = sid;
      }
    }

    return NextResponse.json({ ok: true, sessions, byOrderId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error interno cargando sesiones pendientes' },
      { status: 500 },
    );
  }
}

