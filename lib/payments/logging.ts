import { supabaseAdmin } from '@/lib/supabase/admin';

export type PaymentLog = {
  payment_id: string;
  external_reference?: string;
  status: 'success' | 'error';
  stage: string;
  error?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

/**
 * Registra un error de pago para análisis
 */
export async function logPaymentError(
  log: Omit<PaymentLog, 'created_at' | 'status'>,
): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from('payment_logs').insert([
      {
        ...log,
        status: 'error',
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    // No fallar si el logging falla
    console.error('[PAYMENT LOG] Error logging payment error:', e);
  }
}

/**
 * Registra un pago exitoso
 */
export async function logPaymentSuccess(
  log: Omit<PaymentLog, 'created_at' | 'status'>,
): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from('payment_logs').insert([
      {
        ...log,
        status: 'success',
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.error('[PAYMENT LOG] Error logging payment success:', e);
  }
}
