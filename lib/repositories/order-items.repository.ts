// Repository para acceso a datos de order_items

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface OrderItem {
  id: string;
  order_id: string;
  listing_id: string;
  title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  selected_size?: string | null;
  selected_color?: string | null;
  created_at: string;
}

export interface CreateOrderItemData {
  order_id: string;
  listing_id: string;
  title: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  selected_size?: string | null;
  selected_color?: string | null;
}

export class OrderItemsRepository {
  /**
   * Crear items de orden
   */
  async createMany(items: CreateOrderItemData[]): Promise<OrderItem[]> {
    if (items.length === 0) return [];

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('order_items')
      .insert(items)
      .select();

    if (error) {
      throw new Error(`Error creando items de orden: ${error.message}`);
    }

    return (data || []) as OrderItem[];
  }

  /**
   * Buscar items por order_id
   */
  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error buscando items: ${error.message}`);
    }

    return (data || []) as OrderItem[];
  }

  /**
   * Buscar items por order_ids
   */
  async findByOrderIds(orderIds: string[]): Promise<OrderItem[]> {
    if (orderIds.length === 0) return [];

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
      .order('order_id', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error buscando items: ${error.message}`);
    }

    return (data || []) as OrderItem[];
  }
}
