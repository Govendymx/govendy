// API Route refactorizada para obtener balance usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { PayoutsRepository } from '@/lib/repositories/payouts.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { PayoutService } from '@/lib/services/payouts/payout.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Autenticación
    const { userId: sellerId } = await requireAuth(req);

    // Inicializar servicios
    const payoutsRepo = new PayoutsRepository();
    const ordersRepo = new OrdersRepository();
    const payoutService = new PayoutService(payoutsRepo, ordersRepo);

    // Calcular balance
    const balance = await payoutService.calculateBalance({ sellerId });

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      ...balance,
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
