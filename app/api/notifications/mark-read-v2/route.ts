// API Route refactorizada para marcar notificaciones como leídas usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  notificationId?: string;
  markAll?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const notificationId = body?.notificationId?.trim();
    const markAll = Boolean(body?.markAll);

    // Inicializar servicios
    const repo = new NotificationsRepository();
    const service = new NotificationService(repo);

    if (markAll) {
      // Marcar todas como leídas
      const count = await service.markAllAsRead(userId);
      return NextResponse.json({
        ok: true,
        markedCount: count,
        message: `${count} notificaciones marcadas como leídas`,
      });
    } else {
      // Marcar una específica
      if (!notificationId) {
        return NextResponse.json({ error: 'notificationId es requerido' }, { status: 400 });
      }

      const notification = await service.markAsRead(notificationId, userId);
      return NextResponse.json({
        ok: true,
        notification,
      });
    }

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
