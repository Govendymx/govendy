// Repository para acceso a datos de logística

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Order, UpdateOrderData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export interface LogisticsOrder extends Order {
  shipping_label_url?: string | null;
  shipping_label_uploaded_at?: string | null;
  shipping_label_uploaded_by?: string | null;
  label_downloaded_at?: string | null;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
}

export class LogisticsRepository {
  /**
   * Buscar órdenes relevantes para logística
   */
  async findLogisticsOrders(status?: string, limit: number = 200): Promise<LogisticsOrder[]> {
    const admin = supabaseAdmin();
    const fullSelect =
      'id,buyer_id,seller_id,status,payment_method,subtotal,shipping_fee,commission_fee,total,created_at,paid_at,shipping_full_name,shipping_phone,shipping_address,shipping_label_url,shipping_label_uploaded_at,shipping_label_uploaded_by,label_downloaded_at,tracking_number,shipped_at,delivered_at,shipping_carrier';

    let query = admin
      .from('orders')
      .select(fullSelect)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    } else {
      // Por defecto, mostrar órdenes que requieren atención logística
      query = query.in('status', ['pending_payment', 'paid', 'shipped']);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error buscando órdenes de logística: ${error.message}`);
    }

    return (data || []) as LogisticsOrder[];
  }

  /**
   * Buscar orden por ID con campos de logística
   */
  async findById(id: string): Promise<LogisticsOrder | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('id,buyer_id,seller_id,status,shipping_label_url,shipping_label_uploaded_at,shipping_label_uploaded_by,label_downloaded_at,tracking_number,shipping_carrier')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando orden: ${error.message}`);
    }

    return data as LogisticsOrder | null;
  }

  /**
   * Actualizar URL de guía de envío
   */
  async updateShippingLabel(
    orderId: string,
    labelUrl: string,
    uploadedBy: string
  ): Promise<LogisticsOrder> {
    const admin = supabaseAdmin();
    const updateData: UpdateOrderData = {
      shipping_label_url: labelUrl,
      shipping_label_uploaded_at: new Date().toISOString(),
      label_downloaded_at: null, // Resetear descarga al re-subir
    };

    const { data, error } = await admin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('id,shipping_label_url,shipping_label_uploaded_at,shipping_label_uploaded_by')
      .single();

    if (error) {
      throw new Error(`Error actualizando guía: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundError('Orden', orderId);
    }

    // Verificar que se guardó correctamente
    if (String(data.shipping_label_url || '').trim() !== labelUrl) {
      throw new Error('La URL de la guía no se guardó correctamente');
    }

    return data as LogisticsOrder;
  }

  /**
   * Actualizar tracking y carrier
   */
  async updateTracking(
    orderId: string,
    trackingNumber: string,
    carrier: string
  ): Promise<Order> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .update({
        tracking_number: trackingNumber,
        shipping_carrier: carrier,
        shipped_at: new Date().toISOString(),
        status: 'shipped',
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando tracking: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundError('Orden', orderId);
    }

    return data as Order;
  }
}
