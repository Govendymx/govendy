// API Route refactorizada para conversaciones de soporte usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { SupportRepository } from '@/lib/repositories/support.repository';
import { SupportService } from '@/lib/services/support/support.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  subject: string;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { effectiveUserId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const subject = String(body?.subject || '').trim();

    // Inicializar servicios
    const supportRepo = new SupportRepository();
    const supportService = new SupportService(supportRepo);

    // Crear conversación
    const conversation = await supportService.createConversation({
      userId: effectiveUserId,
      subject,
    });

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      conversation,
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
    const { effectiveUserId } = await requireAuth(req);

    // Inicializar servicios
    const supportRepo = new SupportRepository();
    const supportService = new SupportService(supportRepo);

    // Obtener conversaciones
    const conversations = await supportService.getUserConversations(effectiveUserId);

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      conversations,
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
