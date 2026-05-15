import type { SupabaseClient } from '@supabase/supabase-js';

export type PaymentValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type PaymentContext = {
  orderIds?: string[];
  buyerId: string;
  amount: number;
  paymentMethod: 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo';
  checkoutId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Valida un pago antes de procesarlo
 * Verifica: órdenes, montos, estados, usuarios, límites
 */
export async function validatePayment(
  admin: SupabaseClient,
  context: PaymentContext,
): Promise<PaymentValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validar usuario
  if (!context.buyerId || typeof context.buyerId !== 'string') {
    errors.push('ID de comprador inválido');
    return { valid: false, errors, warnings };
  }

  // Verificar que el usuario existe y está activo
  const { data: userState } = await admin
    .from('user_admin_states')
    .select('status, suspended_until')
    .eq('user_id', context.buyerId)
    .maybeSingle();

  if (userState) {
    if (userState.status === 'banned') {
      errors.push('Usuario baneado. No puede realizar pagos.');
    } else if (userState.status === 'suspended') {
      const suspendedUntil = userState.suspended_until
        ? new Date(userState.suspended_until)
        : null;
      if (suspendedUntil && suspendedUntil > new Date()) {
        errors.push(
          `Usuario suspendido hasta ${suspendedUntil.toLocaleDateString('es-MX')}`,
        );
      }
    }
  }

  // 2. Validar órdenes (si aplica)
  if (context.orderIds && context.orderIds.length > 0) {
    const { data: orders, error: ordersError } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id, status, total, payment_method, paid_at')
      .in('id', context.orderIds);

    if (ordersError) {
      errors.push(`Error al validar órdenes: ${ordersError.message}`);
      return { valid: false, errors, warnings };
    }

    if (!orders || orders.length !== context.orderIds.length) {
      errors.push('Una o más órdenes no existen');
      return { valid: false, errors, warnings };
    }

    // Validar que todas las órdenes pertenecen al comprador
    const invalidOwnership = orders.some(
      (o) => String(o.buyer_id || '') !== context.buyerId,
    );
    if (invalidOwnership) {
      errors.push('Una o más órdenes no pertenecen al comprador');
    }

    // Validar estados de órdenes
    const blockedStatuses = new Set([
      'paid',
      'completed',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ]);
    const invalidStatuses = orders.filter((o) =>
      blockedStatuses.has(String(o.status || '').trim()),
    );
    if (invalidStatuses.length > 0) {
      errors.push(
        `${invalidStatuses.length} orden(es) ya están pagadas o no pueden ser pagadas (estados: ${Array.from(new Set(invalidStatuses.map((o) => o.status))).join(', ')})`,
      );
    }

    // Validar que no hay órdenes ya pagadas
    const alreadyPaid = orders.filter((o) => o.paid_at !== null);
    if (alreadyPaid.length > 0) {
      errors.push(
        `${alreadyPaid.length} orden(es) ya tienen fecha de pago registrada`,
      );
    }

    // Validar monto total (con margen de error pequeño por redondeo)
    const calculatedTotal = orders.reduce(
      (sum, o) => sum + (Number(o.total || 0) || 0),
      0,
    );
    if (Math.abs(calculatedTotal - context.amount) > 0.05) {
      errors.push(
        `Monto no coincide: esperado ${calculatedTotal.toFixed(2)}, recibido ${context.amount.toFixed(2)}`,
      );
    }

    // Verificar que no hay disputas abiertas
    const { data: disputes } = await admin
      .from('disputes')
      .select('order_id')
      .in('order_id', context.orderIds)
      .eq('status', 'open');

    if (disputes && disputes.length > 0) {
      warnings.push(
        `${disputes.length} orden(es) tienen disputas abiertas. Revisar antes de procesar pago.`,
      );
    }

    // Verificar stock disponible para cada ítem de las órdenes
    const { data: orderItems } = await admin
      .from('order_items')
      .select('listing_id, quantity, selected_size')
      .in('order_id', context.orderIds);

    if (orderItems && orderItems.length > 0) {
      const listingIds = Array.from(new Set(orderItems.map((i) => i.listing_id)));
      const { data: listings } = await admin
        .from('listings')
        .select('id, stock, size_stock, title')
        .in('id', listingIds);

      const listingsMap = new Map(listings?.map((l) => [l.id, l]) || []);

      for (const item of orderItems) {
        const listing = listingsMap.get(item.listing_id);
        if (!listing) {
          errors.push(`Publicación no encontrada para un ítem de la orden`);
          continue;
        }

        let available = 0;
        if (item.selected_size && listing.size_stock) {
          let map: Record<string, number> = {};
          if (typeof listing.size_stock === 'object') {
            map = listing.size_stock;
          } else if (typeof listing.size_stock === 'string') {
             try { map = JSON.parse(listing.size_stock); } catch {}
          }
          available = Number(map[item.selected_size] || 0);
        } else {
          available = Number(listing.stock || 0);
        }

        if (available < item.quantity) {
          errors.push(
            `Stock insuficiente para "${listing.title}" (${available} disponibles, solicitados ${item.quantity})`,
          );
        }
      }
    }
  }

  // 3. Validar monto
  if (!Number.isFinite(context.amount) || context.amount <= 0) {
    errors.push('Monto inválido (debe ser mayor a 0)');
  }

  // Validar límites de pago
  const maxPaymentAmount = 100000; // $100,000 MXN
  if (context.amount > maxPaymentAmount) {
    errors.push(
      `Monto excede el límite máximo de ${maxPaymentAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
    );
  }

  // 4. Validar método de pago
  const validMethods = ['mercadopago', 'bank_transfer', 'bank_deposit', 'oxxo', 'offline'];
  if (!validMethods.includes(context.paymentMethod)) {
    errors.push(`Método de pago inválido: ${context.paymentMethod}`);
  }

  // 5. Validar checkout session (si aplica)
  if (context.checkoutId) {
    const { data: session } = await admin
      .from('checkout_sessions')
      .select('id, status, buyer_id, order_ids')
      .eq('id', context.checkoutId)
      .maybeSingle();

    if (!session) {
      errors.push('Sesión de checkout no encontrada');
    } else {
      if (session.status === 'paid') {
        errors.push('Esta sesión de checkout ya fue pagada');
      }
      if (String(session.buyer_id || '') !== context.buyerId) {
        errors.push('La sesión de checkout no pertenece al comprador');
      }
    }
  }

  // 6. Validar duplicados (prevenir pagos duplicados)
  if (context.checkoutId) {
    const { data: existingPayment } = await admin
      .from('checkout_sessions')
      .select('mp_payment_id, status')
      .eq('id', context.checkoutId)
      .maybeSingle();

    if (existingPayment?.mp_payment_id && existingPayment.status === 'paid') {
      errors.push('Este pago ya fue procesado anteriormente');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
