// API Route refactorizada para mensajes de chat usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { ChatRepository } from '@/lib/repositories/chat.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { ChatService } from '@/lib/services/chat/chat.service';
import { handleError } from '@/lib/utils/errors';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Body = {
  orderId: string;
  message?: string;
  attachments?: any[];
};

export async function POST(req: NextRequest) {
  try {
    const { effectiveUserId: senderId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    const message = String(body?.message || '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : undefined;

    // Inicializar servicios
    const chatRepo = new ChatRepository();
    const ordersRepo = new OrdersRepository();
    const notificationsRepo = new NotificationsRepository();
    const chatService = new ChatService(chatRepo, ordersRepo, notificationsRepo);

    // Enviar mensaje
    const sentMessage = await chatService.sendMessage({
      orderId,
      senderId,
      body: message,
      attachments,
    });

    // Obtener información de la orden para respuesta
    const order = await ordersRepo.findById(orderId);
    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', senderId)
      .maybeSingle();

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      message: sentMessage,
      notified: order ? [order.buyer_id, order.seller_id].filter((id) => id && id !== senderId).length : 0,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    const resp = NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId, effectiveUserId, impersonating } = await requireAuth(req);

    // Parse query params
    const orderId = String(req.nextUrl.searchParams.get('orderId') || '').trim();
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 80)));

    // Inicializar servicios
    const chatRepo = new ChatRepository();
    const ordersRepo = new OrdersRepository();
    const chatService = new ChatService(chatRepo, ordersRepo);

    // Obtener mensajes
    const messages = await chatService.getMessages(orderId, effectiveUserId, limit);

    // Obtener información de la orden
    const order = await ordersRepo.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const admin = supabaseAdmin();
    const { data: adminCheck } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
      },
      messages,
      viewer: {
        user_id: effectiveUserId,
        is_admin: !impersonating && Boolean(adminCheck),
      },
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    const resp = NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
