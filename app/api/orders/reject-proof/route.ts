import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId } = await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as { orderId?: string };
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('seller_id, id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (String(order.seller_id) !== effectiveUserId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    // 2. Reset order status and clear proof
    const { error: updateError } = await admin
      .from('orders')
      .update({
        delivery_proof_url: null,
        status: 'pending_shipment', // Revert to pending shipment so seller can upload again
        shipped_at: null,
        delivered_at: null
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error rejecting proof:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Notify seller
    try {
      const notificationsRepo = new NotificationsRepository();
      await notificationsRepo.create({
        user_id: order.seller_id,
        title: 'Evidencia rechazada',
        body: 'Tu evidencia de entrega ha sido rechazada por no ser clara. Por favor, sube los archivos nuevamente (Constancia + INE).',
        type: 'order_update',
        link_to: `/ventas?tab=active`,
        data: { order_id: orderId }
      });
    } catch (notifyErr) {
      console.error('Error sending notification:', notifyErr);
      // We don't fail the request if notification fails, but we log it
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in reject-proof:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
