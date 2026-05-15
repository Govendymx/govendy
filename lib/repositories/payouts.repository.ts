// Repository para acceso a datos de payouts

import { supabaseAdmin } from '@/lib/supabase/admin';
import { SellerWithdrawal, CreateWithdrawalData, Order } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class PayoutsRepository {
  /**
   * Buscar órdenes por seller_id con paid_to_seller_at
   */
  async findOrdersWithPaidToSeller(sellerId: string, limit: number = 500): Promise<Order[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('id,status,subtotal,total,shipping_fee,commission_fee,coupon_discount,shipping_subsidy,paid_to_seller_at,isr_withheld,iva_withheld')
      .eq('seller_id', sellerId)
      .not('paid_to_seller_at', 'is', null)
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando órdenes: ${error.message}`);
    }

    return (data || []) as Order[];
  }

  /**
   * Buscar todas las órdenes de un vendedor
   */
  async findAllOrdersBySeller(sellerId: string, limit: number = 2000): Promise<Order[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('id,status,subtotal,total,shipping_fee,commission_fee,coupon_discount,shipping_subsidy,paid_to_seller_at,created_at,paid_at,shipped_at,delivered_at,isr_withheld,iva_withheld')
      .eq('seller_id', sellerId)
      .limit(limit);

    if (error) {
      // Fallback si faltan columnas
      const code = String((error as any)?.code ?? '');
      const msg = String((error as any)?.message ?? '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        const fallback = await admin
          .from('orders')
          .select('id,status,subtotal,total,shipping_fee,commission_fee')
          .eq('seller_id', sellerId)
          .limit(limit);
        if (fallback.error) {
          throw new Error(`Error buscando órdenes: ${fallback.error.message}`);
        }
        return (fallback.data || []) as Order[];
      }
      throw new Error(`Error buscando órdenes: ${error.message}`);
    }

    return (data || []) as Order[];
  }

  /**
   * Obtener órdenes en disputa abierta
   */
  async findDisputedOrderIds(sellerId: string): Promise<string[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('disputes')
      .select('order_id')
      .eq('seller_id', sellerId)
      .eq('status', 'open');

    if (error) {
      console.warn('[PayoutsRepository] Error buscando disputas:', error);
      return [];
    }

    return (data || [])
      .map((d: any) => String(d?.order_id ?? '').trim())
      .filter(Boolean);
  }

  /**
   * Obtener IDs de órdenes ya retiradas
   */
  async findWithdrawnOrderIds(sellerId: string): Promise<string[]> {
    const admin = supabaseAdmin();
    try {
      const { data, error } = await admin
        .from('seller_withdrawals')
        .select('order_ids')
        .eq('seller_id', sellerId)
        .eq('status', 'completed');

      if (error) {
        console.warn('[PayoutsRepository] Error buscando retiros:', error);
        return [];
      }

      const orderIds: string[] = [];
      if (Array.isArray(data)) {
        for (const w of data) {
          const arr = Array.isArray((w as any)?.order_ids) ? (w as any).order_ids : [];
          orderIds.push(...arr.map((x: unknown) => String(x ?? '').trim()).filter(Boolean));
        }
      }
      return orderIds;
    } catch {
      return [];
    }
  }

  /**
   * Obtener deducción por guías de retorno
   */
  async getGuideDeduction(sellerId: string): Promise<number> {
    const admin = supabaseAdmin();
    try {
      const { data, error } = await admin
        .from('disputes')
        .select('return_guide_cost')
        .eq('seller_id', sellerId)
        .eq('status', 'resolved')
        .eq('admin_decision', 'assign_guide_charged_seller');

      if (error || !Array.isArray(data)) {
        return 0;
      }

      let total = 0;
      for (const r of data) {
        const cost = Number((r as any)?.return_guide_cost ?? 0);
        if (cost > 0) total += cost;
      }
      return total;
    } catch {
      return 0;
    }
  }

  /**
   * Crear retiro
   */
  async createWithdrawal(data: CreateWithdrawalData): Promise<SellerWithdrawal> {
    const admin = supabaseAdmin();
    const { data: withdrawal, error } = await admin
      .from('seller_withdrawals')
      .insert([{
        seller_id: data.seller_id,
        amount_cents: data.amount_cents,
        order_ids: data.order_ids,
        status: data.status,
        mp_transfer_id: data.mp_transfer_id || null,
        error_message: data.error_message || null,
        account_details: data.account_details || null,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando retiro: ${error.message}`);
    }

    return withdrawal as SellerWithdrawal;
  }

  /**
   * Actualizar retiro
   */
  async updateWithdrawal(id: string, data: Partial<CreateWithdrawalData>): Promise<SellerWithdrawal> {
    const admin = supabaseAdmin();
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.mp_transfer_id !== undefined) updateData.mp_transfer_id = data.mp_transfer_id || null;
    if (data.error_message !== undefined) updateData.error_message = data.error_message || null;
    updateData.updated_at = new Date().toISOString();

    const { data: withdrawal, error } = await admin
      .from('seller_withdrawals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando retiro: ${error.message}`);
    }

    if (!withdrawal) {
      throw new NotFoundError('Retiro', id);
    }

    return withdrawal as SellerWithdrawal;
  }

  /**
   * Verificar si el vendedor tiene cuenta de MercadoPago configurada
   */
  async hasMercadoPagoAccount(sellerId: string): Promise<boolean> {
    const admin = supabaseAdmin();
    try {
      const { data } = await admin
        .from('profiles')
        .select('mercadopago_account')
        .eq('id', sellerId)
        .maybeSingle();

      return Boolean((data as any)?.mercadopago_account);
    } catch {
      return false;
    }
  }

  /**
   * Obtener cuenta de MercadoPago del vendedor
   */
  async getMercadoPagoAccount(sellerId: string): Promise<string | null> {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('profiles')
      .select('mercadopago_account')
      .eq('id', sellerId)
      .maybeSingle();

    return (data as any)?.mercadopago_account || null;
  }
}
