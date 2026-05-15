// API Route refactorizada para mensajes de disputa usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { DisputesRepository } from '@/lib/repositories/disputes.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { DisputeService } from '@/lib/services/disputes/dispute.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  disputeId: string;
  body: string;
  attachments?: any[];
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: senderId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const disputeId = String(body?.disputeId || '').trim();
    const messageBody = String(body?.body || '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : undefined;

    // Inicializar servicios
    const disputesRepo = new DisputesRepository();
    const ordersRepo = new OrdersRepository();
    const notificationsRepo = new NotificationsRepository();
    const disputeService = new DisputeService(disputesRepo, ordersRepo, notificationsRepo);

    // Enviar mensaje
    const message = await disputeService.sendMessage({
      disputeId,
      senderId,
      body: messageBody,
      attachments,
    });

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      message,
    });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Autenticación
    const { userId } = await requireAuth(req);

    // Parse query params
    const disputeId = String(req.nextUrl.searchParams.get('disputeId') || '').trim();
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200)));

    // Inicializar servicios
    const disputesRepo = new DisputesRepository();
    const ordersRepo = new OrdersRepository();
    const disputeService = new DisputeService(disputesRepo, ordersRepo);

    // Obtener mensajes
    const messages = await disputeService.getMessages(disputeId, userId, limit);

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      messages,
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
