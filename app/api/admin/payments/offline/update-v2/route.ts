// API Route refactorizada usando nueva arquitectura
// Esta es la versión nueva y limpia que reemplazará la antigua

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { PaymentsRepository } from '@/lib/repositories/payments.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { OfflinePaymentService } from '@/lib/services/payments/offline-payment.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  checkoutId: string;
  action: 'mark_paid' | 'mark_unpaid' | 'cancel';
  adminName?: string | null;
  force?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: adminId, admin } = await requireAdmin(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const checkoutId = String(body?.checkoutId || '').trim();
    const action = String(body?.action || '').trim() as Body['action'];
    const adminName = String(body?.adminName || '').trim() || null;
    const force = Boolean(body?.force);

    // Validaciones básicas
    if (!checkoutId) {
      return NextResponse.json({ error: 'checkoutId is required' }, { status: 400 });
    }
    if (!['mark_paid', 'mark_unpaid', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    }
    if (action === 'mark_paid' && !adminName) {
      return NextResponse.json({ error: 'adminName es requerido para marcar como pagado' }, { status: 400 });
    }

    // Inicializar servicios
    const paymentsRepo = new PaymentsRepository();
    const ordersRepo = new OrdersRepository();
    const notificationsRepo = new NotificationsRepository();
    const paymentService = new OfflinePaymentService(paymentsRepo, ordersRepo, notificationsRepo);

    // Ejecutar acción
    let result;
    if (action === 'mark_paid') {
      result = await paymentService.markAsPaid({
        checkoutId,
        adminId,
        adminName: adminName!,
        force,
      });
    } else if (action === 'mark_unpaid') {
      result = await paymentService.markAsUnpaid({
        checkoutId,
        adminId,
      });
    } else {
      result = await paymentService.cancel({
        checkoutId,
        adminId,
      });
    }

    // Las notificaciones ahora se manejan dentro del servicio

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      status: result.session.status,
      updatedOrders: result.updatedOrders,
      session: result.session,
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
