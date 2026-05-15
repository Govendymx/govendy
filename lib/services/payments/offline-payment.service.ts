// Servicio de lógica de negocio para pagos offline

import { PaymentsRepository, UpdateCheckoutSessionData } from '@/lib/repositories/payments.repository';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { CheckoutSession, OrderStatus } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyPaymentApprovedBuyer, notifyPaymentApprovedSellers } from '@/lib/email/notify';

export type PaymentAction = 'mark_paid' | 'mark_unpaid' | 'cancel';

export interface MarkPaymentPaidParams {
  checkoutId: string;
  adminId: string;
  adminName: string;
  force?: boolean;
}

export interface MarkPaymentUnpaidParams {
  checkoutId: string;
  adminId: string;
}

export interface CancelPaymentParams {
  checkoutId: string;
  adminId: string;
}

export interface PaymentUpdateResult {
  session: CheckoutSession;
  updatedOrders: number;
  orderIds: string[];
}

export class OfflinePaymentService {
  private notificationService?: NotificationService;

  constructor(
    private paymentsRepo: PaymentsRepository,
    private ordersRepo: OrdersRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Marcar pago como pagado
   */
  async markAsPaid(params: MarkPaymentPaidParams): Promise<PaymentUpdateResult> {
    const { checkoutId, adminId, adminName, force = false } = params;

    // Validaciones
    validateRequired(checkoutId, 'checkoutId');
    validateRequired(adminId, 'adminId');
    validateRequired(adminName, 'adminName');
    if (!validateUUID(checkoutId)) {
      throw new ValidationError('checkoutId debe ser un UUID válido');
    }

    // Buscar sesión
    const session = await this.paymentsRepo.findById(checkoutId);
    if (!session) {
      throw new NotFoundError('Sesión de checkout', checkoutId);
    }

    // Verificar que es un pago offline
    const offlineMethods = ['bank_transfer', 'bank_deposit', 'oxxo'];
    if (!offlineMethods.includes(session.payment_method)) {
      throw new ValidationError('Esta sesión no es un pago offline');
    }

    const orderIds = session.order_ids || [];
    if (orderIds.length > 0) {
      const admin = supabaseAdmin();

      const { data: ordRows, error: ordErr } = await admin.from('orders').select('id,status').in('id', orderIds);
      if (ordErr) throw new Error(ordErr.message);

      const safeToDecrement = ((ordRows as any[]) ?? [])
        .filter((o) => {
          const st = String(o?.status ?? '').toLowerCase();
          return st === 'pending' || st === 'pending_payment';
        })
        .map((o) => String(o?.id ?? '').trim())
        .filter(Boolean);

      if (safeToDecrement.length > 0) {
        const { data: orderItems, error: itemsError } = await admin
          .from('order_items')
          .select('listing_id, quantity, selected_size, title')
          .in('order_id', safeToDecrement);
        if (itemsError) throw new Error(itemsError.message);

        const failed: Array<{ listing_id: string; title?: string | null; quantity: number; selected_size?: string | null; message: string }> = [];

        for (const item of (orderItems as any[]) ?? []) {
          const listingId = String(item?.listing_id ?? '').trim();
          const quantity = Number(item?.quantity ?? 0);
          const selectedSize = typeof item?.selected_size === 'string' ? String(item.selected_size).trim() : null;
          const title = typeof item?.title === 'string' ? String(item.title).trim() : null;

          if (!listingId || !Number.isFinite(quantity) || quantity <= 0) continue;

          let rpc: any = await admin.rpc('decrement_stock', {
            p_listing_id: listingId,
            p_quantity: quantity,
            p_size: selectedSize || null,
          });

          if (rpc?.error) {
            const code = String((rpc.error as any)?.code ?? '');
            const msg = String((rpc.error as any)?.message ?? '').toLowerCase();
            const maybeSignatureMismatch =
              code === '42883' || msg.includes('p_size') || msg.includes('decrement_stock(') || msg.includes('function');
            if (maybeSignatureMismatch) {
              rpc = await admin.rpc('decrement_stock', {
                p_listing_id: listingId,
                p_quantity: quantity,
              });
            }
          }

          if (rpc?.error) {
            failed.push({
              listing_id: listingId,
              title,
              quantity,
              selected_size: selectedSize,
              message: String((rpc.error as any)?.message ?? 'Error actualizando stock'),
            });
            continue;
          }

          const rpcResult = rpc?.data as any;
          if (!rpcResult?.success) {
            failed.push({
              listing_id: listingId,
              title,
              quantity,
              selected_size: selectedSize,
              message: String(rpcResult?.message ?? 'Stock insuficiente'),
            });
          }
        }

        if (failed.length > 0) {
          const first = failed[0];
          const base = first?.title ? `"${first.title}"` : 'un artículo';
          const sizeTxt = first?.selected_size ? ` (Talla: ${first.selected_size})` : '';
          const msg = `Stock insuficiente para ${base}${sizeTxt}.`;
          await this.paymentsRepo.update(checkoutId, { status: 'fulfillment_failed' } as any);
          throw new ValidationError(msg);
        }
      }
    }

    // Actualizar sesión
    const now = new Date().toISOString();
    const updateData: UpdateCheckoutSessionData = {
      status: 'paid',
      paid_confirmed_at: now,
      paid_confirmed_by: adminId,
      paid_confirmed_by_name: adminName,
    };

    const updatedSession = await this.paymentsRepo.update(checkoutId, updateData);

    // Actualizar órdenes asociadas
    let updatedOrders = 0;

    if (orderIds.length > 0) {
      try {
        const orders = await this.ordersRepo.updateMany(orderIds, {
          status: 'paid',
          paid_at: now,
        });
        updatedOrders = orders.length;

        // Notificar por email (best-effort)
        try {
          const admin = supabaseAdmin();
          if (session.buyer_id) {
            void notifyPaymentApprovedBuyer({
              buyerId: session.buyer_id,
              orderIds,
            }).catch((e) => console.warn('[OfflinePaymentService] notifyPaymentApprovedBuyer error:', e));
          }
          void notifyPaymentApprovedSellers({
            admin,
            orderIds,
          }).catch((e) => console.warn('[OfflinePaymentService] notifyPaymentApprovedSellers error:', e));
        } catch (e) {
          console.warn('[OfflinePaymentService] Error orchestrating emails:', e);
        }
      } catch (error) {
        // Si falla actualizar órdenes y no es force, lanzar error
        if (!force) {
          throw new Error(
            `No se pudieron actualizar las órdenes: ${error instanceof Error ? error.message : 'Error desconocido'}`
          );
        }
        // Si es force, continuar aunque las órdenes no se actualicen
      }
    }

    // Notificar al vendedor (best-effort, no crítico)
    if (updatedOrders > 0 && this.notificationService) {
      try {
        const orders = await this.ordersRepo.findByIds(orderIds);
        const sellerIds = Array.from(new Set(orders.map(o => o.seller_id).filter(Boolean)));
        
        for (const sellerId of sellerIds) {
          const order = orders.find(o => o.seller_id === sellerId);
          if (order) {
            await this.notificationService.create({
              user_id: sellerId,
              type: 'sale_paid',
              title: 'Pago confirmado',
              body: `Se confirmó el pago de una compra. Orden: ${order.id.slice(0, 8)}…`,
              link_to: `/dashboard/ventas?order=${order.id}`,
              data: { orderId: order.id, checkoutId },
            });
          }
        }
      } catch (notifyErr) {
        // No crítico, solo loguear
        console.warn('[OfflinePaymentService] Error enviando notificaciones:', notifyErr);
      }
    }

    return {
      session: updatedSession,
      updatedOrders,
      orderIds,
    };
  }

  /**
   * Marcar pago como no pagado (revertir)
   */
  async markAsUnpaid(params: MarkPaymentUnpaidParams): Promise<PaymentUpdateResult> {
    const { checkoutId, adminId } = params;

    validateRequired(checkoutId, 'checkoutId');
    validateRequired(adminId, 'adminId');

    const session = await this.paymentsRepo.findById(checkoutId);
    if (!session) {
      throw new NotFoundError('Sesión de checkout', checkoutId);
    }

    // Actualizar sesión
    const updateData: UpdateCheckoutSessionData = {
      status: 'pending',
      paid_confirmed_at: null,
      paid_confirmed_by: null,
      paid_confirmed_by_name: null,
    };

    const updatedSession = await this.paymentsRepo.update(checkoutId, updateData);

    // Actualizar órdenes
    let updatedOrders = 0;
    const orderIds = session.order_ids || [];

    if (orderIds.length > 0) {
      const orders = await this.ordersRepo.updateMany(orderIds, {
        status: 'pending_payment',
        paid_at: null,
      });
      updatedOrders = orders.length;
    }

    return {
      session: updatedSession,
      updatedOrders,
      orderIds,
    };
  }

  /**
   * Cancelar pago
   */
  async cancel(params: CancelPaymentParams): Promise<PaymentUpdateResult> {
    const { checkoutId, adminId } = params;

    validateRequired(checkoutId, 'checkoutId');
    validateRequired(adminId, 'adminId');

    const session = await this.paymentsRepo.findById(checkoutId);
    if (!session) {
      throw new NotFoundError('Sesión de checkout', checkoutId);
    }

    // Actualizar sesión
    const updateData: UpdateCheckoutSessionData = {
      status: 'cancelled',
      paid_confirmed_at: null,
      paid_confirmed_by: null,
      paid_confirmed_by_name: null,
    };

    const updatedSession = await this.paymentsRepo.update(checkoutId, updateData);

    // Actualizar órdenes
    let updatedOrders = 0;
    const orderIds = session.order_ids || [];

    if (orderIds.length > 0) {
      const orders = await this.ordersRepo.updateMany(orderIds, {
        status: 'cancelled',
      });
      updatedOrders = orders.length;
    }

    return {
      session: updatedSession,
      updatedOrders,
      orderIds,
    };
  }
}
