import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId: userId } = await requireAuth(req);
    const admin = supabaseAdmin();

    const { data: txs, error: txErr } = await admin
      .from('wallet_transactions')
      .select('id, reference_id, created_at')
      .eq('wallet_id', userId)
      .eq('type', 'debit')
      .eq('reference_type', 'order')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (txErr) {
      return NextResponse.json({ error: 'No se pudieron consultar transacciones.' }, { status: 500 });
    }
    const orderIds = Array.from(new Set((txs || []).map((t: any) => String(t.reference_id || '').trim()).filter(Boolean)));
    if (orderIds.length === 0) {
      return NextResponse.json({ ok: true, updated: [] });
    }

    const { data: orders, error: ordErr } = await admin
      .from('orders')
      .select('id, status, buyer_id')
      .in('id', orderIds)
      .eq('buyer_id', userId)
      .limit(500);
    if (ordErr) {
      return NextResponse.json({ error: 'No se pudieron consultar órdenes.' }, { status: 500 });
    }

    const upIds: string[] = [];
    const paidPayload = {
      status: 'paid',
      payment_status: 'paid',
      payment_method: 'pocketcash',
      paid_at: new Date().toISOString(),
    } as const;

    for (const o of orders || []) {
      const st = String(o?.status || '').toLowerCase();
      if (['paid', 'approved', 'completed', 'cancelled', 'canceled', 'refunded'].includes(st)) continue;
      const up = await admin.from('orders').update(paidPayload).eq('id', o.id);
      if (!up.error) upIds.push(o.id);
    }

    if (upIds.length > 0) {
      const { data: sums } = await admin
        .from('orders')
        .select('total')
        .in('id', upIds);
      const total = (sums || []).reduce((s: number, r: any) => s + Number(r?.total || 0), 0);
      await admin.from('notifications').insert({
        user_id: userId,
        type: 'payment_approved',
        title: 'Pago acreditado',
        body: `Se corrigió tu estado de pago en ${upIds.length} compra(s).`,
        data: { kind: 'reconciled_payment', orderIds: upIds, total },
        link_to: '/dashboard/compras'
      });
    }

    return NextResponse.json({ ok: true, updated: upIds });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}
