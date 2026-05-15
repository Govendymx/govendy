// API Route refactorizada para mensajes de soporte usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { SupportRepository } from '@/lib/repositories/support.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { SupportService } from '@/lib/services/support/support.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: senderId } = await requireAuth(req);

    // Parse body
    const raw = (await req.json().catch(() => ({}))) as any;
    const conversationId = String(raw?.conversationId || '').trim();
    const messageBody = String(raw?.body ?? raw?.message ?? '').trim();
    const attachmentUrl = (raw?.attachment_url ?? raw?.attachmentUrl) || null;
    const attachmentName = (raw?.attachment_name ?? raw?.attachmentName) || null;
    const attachmentMime = (raw?.attachment_mime ?? raw?.attachmentMime) || null;
    const attachmentSizeRaw = raw?.attachment_size ?? raw?.attachmentSize;
    const attachmentSize = typeof attachmentSizeRaw === 'number' ? attachmentSizeRaw : attachmentSizeRaw ? Number(attachmentSizeRaw) : null;

    // Inicializar servicios
    const supportRepo = new SupportRepository();
    const notificationsRepo = new NotificationsRepository();
    const supportService = new SupportService(supportRepo, notificationsRepo);

    // Enviar mensaje
    const message = await supportService.sendMessage({
      conversationId,
      senderId,
      body: messageBody,
      attachmentUrl,
      attachmentName,
      attachmentMime,
      attachmentSize,
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
    const { effectiveUserId } = await requireAuth(req);

    // Parse query params
    const conversationId = String(req.nextUrl.searchParams.get('conversationId') || '').trim();
    const limit = Math.max(1, Math.min(400, Number(req.nextUrl.searchParams.get('limit') || 200)));

    // Inicializar servicios
    const supportRepo = new SupportRepository();
    const supportService = new SupportService(supportRepo);

    // Obtener mensajes
    const messages = await supportService.getMessages(conversationId, effectiveUserId, limit);

    // Obtener conversación
    const conversation = await supportRepo.findConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      conversation,
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
