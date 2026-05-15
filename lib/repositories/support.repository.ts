// Repository para acceso a datos de support

import { supabaseAdmin } from '@/lib/supabase/admin';
import { SupportConversation, SupportMessage, CreateSupportConversationData, CreateSupportMessageData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class SupportRepository {
  /**
   * Crear conversación de soporte
   */
  async createConversation(data: CreateSupportConversationData): Promise<SupportConversation> {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const { data: conversation, error } = await admin
      .from('support_conversations')
      .insert([{
        created_by: data.created_by,
        subject: data.subject,
        status: 'open',
        last_message_at: now,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando conversación: ${error.message}`);
    }

    return conversation as SupportConversation;
  }

  /**
   * Buscar conversación por ID
   */
  async findConversationById(id: string): Promise<SupportConversation | null> {
    const admin = supabaseAdmin();
    
    // Intentar con todas las columnas
    let { data, error } = await admin
      .from('support_conversations')
      .select('id,created_by,subject,status,last_message_at,created_at,updated_at,assigned_admin_id,assigned_at,last_read_by_admin_at,last_read_by_user_at,last_delivered_to_user_at')
      .eq('id', id)
      .maybeSingle();

    // Fallback si faltan columnas PRO
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();
      if (msg.includes('assigned') || msg.includes('last_read') || msg.includes('last_delivered') || msg.includes('column') || msg.includes('does not exist')) {
        const fallback = await admin
          .from('support_conversations')
          .select('id,created_by,subject,status,last_message_at,created_at,updated_at')
          .eq('id', id)
          .maybeSingle();
        if (fallback.error) {
          throw new Error(`Error buscando conversación: ${fallback.error.message}`);
        }
        return fallback.data as SupportConversation | null;
      }
      throw new Error(`Error buscando conversación: ${error.message}`);
    }

    return data as SupportConversation | null;
  }

  /**
   * Buscar conversaciones por usuario
   */
  async findConversationsByUser(userId: string, limit: number = 100): Promise<SupportConversation[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('support_conversations')
      .select('*')
      .eq('created_by', userId)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando conversaciones: ${error.message}`);
    }

    return (data || []) as SupportConversation[];
  }

  /**
   * Crear mensaje de soporte
   */
  async createMessage(data: CreateSupportMessageData): Promise<SupportMessage> {
    const admin = supabaseAdmin();
    
    const payload: any = {
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      sender_role: data.sender_role,
      body: data.body,
    };

    // Campos opcionales de adjuntos
    if (data.attachment_url !== undefined) payload.attachment_url = data.attachment_url;
    if (data.attachment_name !== undefined) payload.attachment_name = data.attachment_name;
    if (data.attachment_mime !== undefined) payload.attachment_mime = data.attachment_mime;
    if (data.attachment_size !== undefined) payload.attachment_size = data.attachment_size;

    const { data: message, error } = await admin
      .from('support_messages')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando mensaje: ${error.message}`);
    }

    // Actualizar last_message_at en la conversación
    await admin
      .from('support_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', data.conversation_id);

    return message as SupportMessage;
  }

  /**
   * Buscar mensajes de una conversación
   */
  async findMessagesByConversationId(conversationId: string, limit: number = 200): Promise<SupportMessage[]> {
    const admin = supabaseAdmin();
    
    // Intentar con columnas de adjuntos
    let { data, error } = await admin
      .from('support_messages')
      .select('id,conversation_id,sender_id,sender_role,body,attachment_url,attachment_name,attachment_mime,attachment_size,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    // Fallback si faltan columnas de adjuntos
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();
      if (msg.includes('attachment') || msg.includes('column') || msg.includes('does not exist')) {
        const fallback = await admin
          .from('support_messages')
          .select('id,conversation_id,sender_id,sender_role,body,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(limit);
        if (fallback.error) {
          throw new Error(`Error buscando mensajes: ${fallback.error.message}`);
        }
        // Agregar valores por defecto para adjuntos
        return ((fallback.data || []) as any[]).map((msg: any) => ({
          ...msg,
          attachment_url: null,
          attachment_name: null,
          attachment_mime: null,
          attachment_size: null,
        })) as SupportMessage[];
      }
      throw new Error(`Error buscando mensajes: ${error.message}`);
    }

    return (data || []) as SupportMessage[];
  }

  /**
   * Marcar conversación como entregada al usuario
   */
  async markAsDelivered(conversationId: string): Promise<void> {
    const admin = supabaseAdmin();
    try {
      await admin
        .from('support_conversations')
        .update({ last_delivered_to_user_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      // No crítico, solo loguear
      console.warn('[SupportRepository] Error marcando como entregado:', error);
    }
  }
}
