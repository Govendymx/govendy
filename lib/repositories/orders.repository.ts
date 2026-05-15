// Repository para acceso a datos de órdenes (abstracción de Supabase)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Order, OrderStatus, CreateOrderData, UpdateOrderData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class OrdersRepository {
  /**
   * Buscar orden por ID
   */
  async findById(id: string): Promise<Order | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando orden: ${error.message}`);
    }

    return data as Order | null;
  }

  /**
   * Buscar órdenes por IDs
   */
  async findByIds(ids: string[]): Promise<Order[]> {
    if (ids.length === 0) return [];

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('*')
      .in('id', ids);

    if (error) {
      throw new Error(`Error buscando órdenes: ${error.message}`);
    }

    return (data || []) as Order[];
  }

  /**
   * Buscar órdenes por buyer_id
   */
  async findByBuyerId(buyerId: string, limit: number = 200): Promise<Order[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando órdenes: ${error.message}`);
    }

    return (data || []) as Order[];
  }

  /**
   * Buscar órdenes por seller_id
   */
  async findBySellerId(sellerId: string, limit: number = 200): Promise<Order[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando órdenes: ${error.message}`);
    }

    return (data || []) as Order[];
  }

  /**
   * Crear nueva orden
   */
  async create(data: CreateOrderData): Promise<Order> {
    const admin = supabaseAdmin();

    // Preparar payload base
    const payload: any = {
      buyer_id: data.buyer_id,
      seller_id: data.seller_id,
      payment_method: data.payment_method,
      status: 'pending_payment',
      subtotal: data.subtotal,
      shipping_fee: data.shipping_fee,
      commission_fee: data.commission_fee,
      total: data.total,
    };

    // Campos opcionales
    if (data.shipping_address !== undefined) payload.shipping_address = data.shipping_address;
    if (data.shipping_full_name !== undefined) payload.shipping_full_name = data.shipping_full_name;
    if (data.shipping_phone !== undefined) payload.shipping_phone = data.shipping_phone;
    if (data.coupon_code !== undefined) payload.coupon_code = data.coupon_code;
    if (data.coupon_discount !== undefined) payload.coupon_discount = data.coupon_discount;
    if (data.shipping_subsidy !== undefined) payload.shipping_subsidy = data.shipping_subsidy;
    if (data.shipping_option_id !== undefined) payload.shipping_option_id = data.shipping_option_id;
    if (data.shipping_carrier !== undefined) payload.shipping_carrier = data.shipping_carrier;
    if (data.shipping_by_seller !== undefined) payload.shipping_by_seller = data.shipping_by_seller;
    if (data.order_source !== undefined) payload.order_source = data.order_source;
    if ((data as any).shipping_method !== undefined) payload.shipping_method = (data as any).shipping_method;
    if ((data as any).t1_quote_token !== undefined) payload.t1_quote_token = (data as any).t1_quote_token;

    // Intentar insertar con todos los campos
    let insert = await admin.from('orders').insert([payload]).select('id').single();

    // Fallback si faltan columnas opcionales
    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msgLower = String((insert.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msgLower.includes('does not exist') || msgLower.includes('column')) {
        const fallback: any = { ...payload };
        // Eliminar campos opcionales que pueden no existir
        if (msgLower.includes('shipping_subsidy')) delete fallback.shipping_subsidy;
        if (msgLower.includes('coupon_code')) delete fallback.coupon_code;
        if (msgLower.includes('coupon_discount')) delete fallback.coupon_discount;
        if (msgLower.includes('shipping_option_id')) delete fallback.shipping_option_id;
        if (msgLower.includes('shipping_carrier')) delete fallback.shipping_carrier;
        if (msgLower.includes('shipping_by_seller')) delete fallback.shipping_by_seller;

        // Intentar extraer nombre de columna del error
        const m1 = msgLower.match(/column\s+"?([a-z0-9_]+)"?\s+of\s+relation\s+"?orders"?\s+does not exist/);
        const m2 = msgLower.match(/column\s+orders\.([a-z0-9_]+)\s+does not exist/);
        const col = (m1?.[1] || m2?.[1] || '').trim();
        if (col) delete fallback[col];

        insert = await admin.from('orders').insert([fallback]).select('id').single();
      }
    }

    if (insert.error) {
      throw new Error(`Error creando orden: ${insert.error.message}`);
    }

    // Obtener la orden completa
    const order = await this.findById((insert.data as any).id);
    if (!order) {
      throw new Error('Error: Orden creada pero no se pudo recuperar');
    }

    return order;
  }

  /**
   * Actualizar orden
   */
  async update(id: string, data: UpdateOrderData): Promise<Order> {
    const admin = supabaseAdmin();
    const { data: order, error } = await admin
      .from('orders')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando orden: ${error.message}`);
    }

    if (!order) {
      throw new NotFoundError('Orden', id);
    }

    return order as Order;
  }

  /**
   * Actualizar múltiples órdenes
   */
  async updateMany(ids: string[], data: UpdateOrderData): Promise<Order[]> {
    if (ids.length === 0) return [];

    const admin = supabaseAdmin();
    const { data: orders, error } = await admin
      .from('orders')
      .update(data)
      .in('id', ids)
      .select();

    if (error) {
      throw new Error(`Error actualizando órdenes: ${error.message}`);
    }

    return (orders || []) as Order[];
  }
}
