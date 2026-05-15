import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NOTIFICATION_MESSAGES } from '@/lib/config/notification-thresholds';

export async function POST(req: Request) {
  try {
    const { orderId, type } = await req.json(); // type: 'delay'
    if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 });

    const admin = supabaseAdmin();
    
    // 1. Get Order
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, seller_id, buyer_id, status, created_at')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // 2. Determine Message Content & Target
    let title = '';
    let content = '';
    let targetUserId = '';
    let redirectUrl = '';

    if (type === 'delay') {
        title = NOTIFICATION_MESSAGES.SHIPPING_DELAY.title;
        // Use a generic deadline or calculate based on date
        content = NOTIFICATION_MESSAGES.SHIPPING_DELAY.body(order.id, 'Lo antes posible');
        targetUserId = order.seller_id;
        redirectUrl = `/dashboard/ventas?id=${order.id}`;
    } else {
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
    }

    // 3. Create Floating Message
    const { error: msgError } = await admin.from('admin_floating_messages').insert({
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
  } catch (err: any) {
    console.error('Error sending notification:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
