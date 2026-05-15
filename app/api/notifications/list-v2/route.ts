// API Route refactorizada para listar notificaciones usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Autenticación
    const { effectiveUserId } = await requireAuth(req);

    // Parse query params
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 100)));
    const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true';

    // Inicializar servicios
    const repo = new NotificationsRepository();
    const service = new NotificationService(repo);

    // Obtener notificaciones
    const notifications = await service.getUserNotifications(effectiveUserId, limit, unreadOnly);
    const unreadCount = await service.getUnreadCount(effectiveUserId);

    const resp = NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
      total: notifications.length,
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
