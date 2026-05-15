// API Route refactorizada para abrir disputa usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { DisputesRepository } from '@/lib/repositories/disputes.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { DisputeService } from '@/lib/services/disputes/dispute.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  orderId: string;
  reason_code: 'not_received' | 'damaged' | 'not_as_described' | 'missing_items' | 'other';
  reason_text?: string;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: buyerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderId = String(body?.orderId || '').trim();
    const reasonCode = String(body?.reason_code || '').trim() as Body['reason_code'];
    const reasonText = String(body?.reason_text || '').trim() || undefined;

    // Inicializar servicios
    const disputesRepo = new DisputesRepository();
    const ordersRepo = new OrdersRepository();
    const notificationsRepo = new NotificationsRepository();
    const disputeService = new DisputeService(disputesRepo, ordersRepo, notificationsRepo);

    // Abrir disputa
    const dispute = await disputeService.openDispute({
      orderId,
      buyerId,
      reasonCode,
      reasonText,
    });

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      disputeId: dispute.id,
      already: false,
    });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
