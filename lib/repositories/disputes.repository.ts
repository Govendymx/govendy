// Repository para acceso a datos de disputas

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Dispute, DisputeMessage, CreateDisputeData, CreateDisputeMessageData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class DisputesRepository {
  /**
   * Crear disputa
   */
  async create(data: CreateDisputeData): Promise<Dispute> {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const { data: dispute, error } = await admin
      .from('disputes')
      .insert([{
        order_id: data.order_id,
        buyer_id: data.buyer_id,
        seller_id: data.seller_id,
        opened_by: data.opened_by,
        reason_code: data.reason_code,
        reason_text: data.reason_text || '',
        status: 'open',
        last_message_at: now,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando disputa: ${error.message}`);
    }

    return dispute as Dispute;
  }

  /**
   * Buscar disputa por ID
   */
  async findById(id: string): Promise<Dispute | null> {
    const admin = supabaseAdmin();
    
    // Intentar con todas las columnas primero
    let { data, error } = await admin
      .from('disputes')
      .select('id,order_id,buyer_id,seller_id,status,admin_decision,admin_note,return_guide_url,return_tracking,return_guide_charged_to,return_guide_cost,opened_by,reason_code,reason_text,last_message_at,created_at,updated_at')
      .eq('id', id)
      .maybeSingle();

    // Fallback si faltan columnas de return_guide
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();
      if (msg.includes('return_guide') || msg.includes('does not exist') || msg.includes('column')) {
        const fallback = await admin
          .from('disputes')
          .select('id,order_id,buyer_id,seller_id,status,admin_decision,admin_note,opened_by,reason_code,reason_text,last_message_at,created_at,updated_at')
          .eq('id', id)
          .maybeSingle();
        if (fallback.error) {
          throw new Error(`Error buscando disputa: ${fallback.error.message}`);
        }
        return fallback.data as Dispute | null;
      }
      throw new Error(`Error buscando disputa: ${error.message}`);
    }

    return data as Dispute | null;
  }

  /**
   * Buscar disputa por order_id
   */
  async findByOrderId(orderId: string): Promise<Dispute | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('disputes')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando disputa: ${error.message}`);
    }

    return data as Dispute | null;
  }

  /**
   * Buscar disputas por buyer_id
   */
  async findByBuyerId(buyerId: string, limit: number = 100): Promise<Dispute[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('disputes')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando disputas: ${error.message}`);
    }

    return (data || []) as Dispute[];
  }

  /**
   * Buscar disputas por seller_id
   */
  async findBySellerId(sellerId: string, limit: number = 100): Promise<Dispute[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('disputes')
      .select('*')
      .eq('seller_id', sellerId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando disputas: ${error.message}`);
    }

    return (data || []) as Dispute[];
  }

  /**
   * Actualizar disputa
   */
  async update(id: string, data: Partial<Dispute>): Promise<Dispute> {
    const admin = supabaseAdmin();
    const { data: dispute, error } = await admin
      .from('disputes')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando disputa: ${error.message}`);
    }

    if (!dispute) {
      throw new NotFoundError('Disputa', id);
    }

    return dispute as Dispute;
  }

  /**
   * Crear mensaje en disputa
   */
  async createMessage(data: CreateDisputeMessageData): Promise<DisputeMessage> {
    const admin = supabaseAdmin();
    const { data: message, error } = await admin
      .from('dispute_messages')
      .insert([{
        dispute_id: data.dispute_id,
        sender_id: data.sender_id,
        sender_role: data.sender_role,
        body: data.body,
        attachments: data.attachments || [],
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando mensaje: ${error.message}`);
    }

    // Actualizar last_message_at en la disputa
    await admin
      .from('disputes')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', data.dispute_id);

    return message as DisputeMessage;
  }

  /**
   * Buscar mensajes de una disputa
   */
  async findMessagesByDisputeId(disputeId: string, limit: number = 200): Promise<DisputeMessage[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('dispute_messages')
      .select('*')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando mensajes: ${error.message}`);
    }

    return (data || []) as DisputeMessage[];
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead(disputeId: string, userId: string): Promise<void> {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const { error } = await admin
      .from('dispute_reads')
      .upsert({
        dispute_id: disputeId,
        user_id: userId,
        last_read_at: now,
      }, {
        onConflict: 'dispute_id,user_id',
      });

    if (error) {
      console.warn('[DisputesRepository] Error marcando como leído:', error);
      // No crítico, solo loguear
    }
  }
}
