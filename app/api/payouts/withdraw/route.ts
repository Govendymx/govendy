import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { PayoutsRepository } from '@/lib/repositories/payouts.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { PayoutService } from '@/lib/services/payouts/payout.service';
import { handleError, ValidationError } from '@/lib/utils/errors';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: sellerId, admin } = await requireAuth(req);
    
    // Leer body para detalles de cuenta (opcional)
    const body = await req.json().catch(() => ({}));
    const accountDetails = body.accountDetails || body.account_details || null;
    const source = body.source;

    // Obtener plan del usuario
    const { data: prof } = await admin
      .from('profiles')
      .select('plan_type')
      .eq('id', sellerId)
      .single();
    const planType = prof?.plan_type === 'pro' ? 'pro' : 'basic';

    // Verificar token de MercadoPago (se usa como variable de entorno, aunque ya no sea obligatorio para el retiro manual, el servicio lo pide o lo usaba)
    // En la nueva logica, el servicio lo hizo opcional.
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';

    // Inicializar servicios
    const payoutsRepo = new PayoutsRepository();
    const ordersRepo = new OrdersRepository();
    const payoutService = new PayoutService(payoutsRepo, ordersRepo);

    if (source === 'wallet') {
      // Retiro de PocketCash
      const wallet = await WalletService.getOrCreateWallet(sellerId);
      const balance = wallet.balance || 0;

      if (balance < 0.01) {
        throw new ValidationError('No tienes saldo suficiente en PocketCash para retirar.');
      }

      // Verificar cuenta destino
      let destination = accountDetails;
      if (!destination) {
        const mpAccount = await payoutsRepo.getMercadoPagoAccount(sellerId);
        if (mpAccount) {
          destination = `MercadoPago: ${mpAccount}`;
        }
      }
      if (!destination) {
        throw new ValidationError('Proporciona datos de cuenta o configura tu Mercado Pago en Perfil.');
      }

      // Deducir fondos (esto valida saldo suficiente también)
      // Se retira TODO el saldo disponible
      const amountToWithdraw = balance;
      await WalletService.deductFunds(
        sellerId,
        amountToWithdraw,
        'Retiro de fondos',
        'withdrawal'
      );

      // Crear registro de retiro
      const withdrawal = await payoutsRepo.createWithdrawal({
        seller_id: sellerId,
        amount_cents: Math.round(amountToWithdraw * 100),
        order_ids: [], // No hay órdenes específicas asociadas
        status: 'pending',
        account_details: `${destination} (Origen: PocketCash)`,
      });

      const resp = NextResponse.json({
        ok: true,
        withdrawalId: withdrawal.id,
        amountMxn: amountToWithdraw,
        message: 'Solicitud de retiro de PocketCash recibida exitosamente.',
      });
      resp.headers.set('Cache-Control', 'no-store, max-age=0');
      return resp;
    }

    // Procesar retiro de Ventas (Sales)
    const result = await payoutService.withdraw({
      sellerId,
      accessToken, // Opcional ahora
      accountDetails,
      planType,
    });

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      ...result,
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
