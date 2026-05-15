// Repository para acceso a datos de chat (order_messages)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { OrderMessage, CreateOrderMessageData } from '@/lib/types/domain.types';

export class ChatRepository {
  /**
   * Crear mensaje de chat
   */
  async createMessage(data: CreateOrderMessageData): Promise<OrderMessage> {
    const admin = supabaseAdmin();
    
    const payload: any = {
      order_id: data.order_id,
      sender_id: data.sender_id,
      body: data.body || '',
    };

    // Campos opcionales
    if (data.sender_role !== undefined) payload.sender_role = data.sender_role;
    if (data.attachments !== undefined) payload.attachments = data.attachments || [];

    // Intentar insertar con todas las columnas
    let insert = await admin
      .from('order_messages')
      .insert([payload])
      .select('id,order_id,sender_id,sender_role,body,attachments,created_at')
      .single();

    // Fallback si faltan columnas
    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msg = String((insert.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        // Si hay adjuntos o es admin, no podemos degradar
        if ((data.attachments && data.attachments.length > 0) || data.sender_role === 'admin') {
          throw new Error('Faltan columnas para adjuntos/roles. Ejecuta `supabase_order_chat_upgrade.sql` en Supabase.');
        }
        // Fallback: tabla vieja (sin sender_role/attachments)
        const fallback: any = {
          order_id: data.order_id,
          sender_id: data.sender_id,
          body: data.body || '',
        };
        insert = await admin
          .from('order_messages')
          .insert([fallback])
          .select('id,order_id,sender_id,body,created_at')
          .single();
      }
    }

    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msg = String((insert.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        throw new Error('Falta la tabla de chat. Ejecuta `supabase_order_chat.sql` en Supabase.');
      }
      throw new Error(`Error creando mensaje: ${insert.error.message}`);
    }

    // Asegurar valores por defecto
    const message = insert.data as any;
    return {
      ...message,
      sender_role: message.sender_role || null,
      attachments: message.attachments || [],
    } as OrderMessage;
  }

  /**
   * Buscar mensajes por order_id
   */
  async findMessagesByOrderId(orderId: string, limit: number = 80): Promise<OrderMessage[]> {
    const admin = supabaseAdmin();
    
    // Intentar con todas las columnas
    let { data, error } = await admin
      .from('order_messages')
      .select('id,order_id,sender_id,sender_role,body,attachments,created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Fallback si faltan columnas
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();
      if (msg.includes('sender_role') || msg.includes('attachments') || msg.includes('column') || msg.includes('does not exist')) {
        const fallback = await admin
          .from('order_messages')
          .select('id,order_id,sender_id,body,created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .limit(limit);
        if (fallback.error) {
          throw new Error(`Error buscando mensajes: ${fallback.error.message}`);
        }
        // Agregar valores por defecto
        return ((fallback.data || []) as any[]).map((msg: any) => ({
          ...msg,
          sender_role: null,
          attachments: [],
        })) as OrderMessage[];
      }
      throw new Error(`Error buscando mensajes: ${error.message}`);
    }

    return ((data || []) as any[]).map((msg: any) => ({
      ...msg,
      sender_role: msg.sender_role || null,
      attachments: msg.attachments || [],
    })) as OrderMessage[];
  }
}
