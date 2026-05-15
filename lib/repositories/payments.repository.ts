// Repository para acceso a datos de pagos (abstracción de Supabase)

import { supabaseAdmin } from '@/lib/supabase/admin';
import { CheckoutSession, CheckoutStatus, PaymentMethod } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export interface CreateCheckoutSessionData {
  buyer_id: string;
  order_ids: string[];
  payment_method: PaymentMethod;
  amount: number;
  reference_code?: string;
  offline_instructions?: any;
}

export interface UpdateCheckoutSessionData {
  status?: CheckoutStatus;
  paid_confirmed_at?: string | null;
  paid_confirmed_by?: string | null;
  paid_confirmed_by_name?: string | null;
  payment_proof_url?: string | null;
  payment_proof_uploaded_at?: string | null;
}

export class PaymentsRepository {
  /**
   * Buscar sesión de checkout por ID
   */
  async findById(id: string): Promise<CheckoutSession | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('checkout_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando sesión: ${error.message}`);
    }

    return data as CheckoutSession | null;
  }

  /**
   * Buscar sesiones por buyer_id
   */
  async findByBuyerId(buyerId: string, limit: number = 200): Promise<CheckoutSession[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('checkout_sessions')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando sesiones: ${error.message}`);
    }

    return (data || []) as CheckoutSession[];
  }

  /**
   * Buscar sesiones offline (bank_transfer, bank_deposit, oxxo)
   */
  async findOfflineSessions(status?: CheckoutStatus, limit: number = 200): Promise<CheckoutSession[]> {
    const admin = supabaseAdmin();
    let query = admin
      .from('checkout_sessions')
      .select('*')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error buscando sesiones offline: ${error.message}`);
    }

    return (data || []) as CheckoutSession[];
  }

  /**
   * Crear nueva sesión de checkout
   */
  async create(data: CreateCheckoutSessionData): Promise<CheckoutSession> {
    const admin = supabaseAdmin();
    const { data: session, error } = await admin
      .from('checkout_sessions')
      .insert([{
        buyer_id: data.buyer_id,
        order_ids: data.order_ids,
        payment_method: data.payment_method,
        status: 'pending',
        amount: data.amount,
        reference_code: data.reference_code,
        offline_instructions: data.offline_instructions,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando sesión: ${error.message}`);
    }

    return session as CheckoutSession;
  }

  /**
   * Actualizar sesión de checkout
   */
  async update(id: string, data: UpdateCheckoutSessionData): Promise<CheckoutSession> {
    const admin = supabaseAdmin();
    const { data: session, error } = await admin
      .from('checkout_sessions')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando sesión: ${error.message}`);
    }

    if (!session) {
      throw new NotFoundError('Sesión de checkout', id);
    }

    return session as CheckoutSession;
  }

  /**
   * Verificar que la sesión existe y tiene el estado esperado
   */
  async verifyStatus(id: string, expectedStatus: CheckoutStatus): Promise<boolean> {
    const session = await this.findById(id);
    if (!session) return false;
    return session.status === expectedStatus;
  }
}
