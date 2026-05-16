import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';
import { NOTIFICATION_MESSAGES } from '@/lib/config/notification-thresholds';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();
    const type = String(body?.type || 'delay').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const { data: order, error: orderError } = await auth.admin
      .from('orders')
      .select('id, seller_id, buyer_id, status, created_at')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isDelay = type === 'delay' || type === 'shipping_delay';
    if (!isDelay) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    const title = NOTIFICATION_MESSAGES.SHIPPING_DELAY.title;
    const content = NOTIFICATION_MESSAGES.SHIPPING_DELAY.body(order.id, 'Lo antes posible');
    const targetUserId = order.seller_id;
    const redirectUrl = `/dashboard/ventas?id=${order.id}`;

    const { error: msgError } = await auth.admin.from('admin_floating_messages').insert({
      title,
      content_html: content,
      target_user_ids: [targetUserId],
      section: 'all',
      is_closable: true,
      message_type: 'html',
      redirect_url: redirectUrl,
    });

    if (msgError) throw msgError;

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
