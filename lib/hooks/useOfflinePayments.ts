// Hook reutilizable para manejo de pagos offline

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface UseOfflinePaymentsResult {
  markAsPaid: (checkoutId: string, adminName: string, force?: boolean) => Promise<void>;
  markAsUnpaid: (checkoutId: string) => Promise<void>;
  cancel: (checkoutId: string) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
  success: string | null;
}

export function useOfflinePayments(): UseOfflinePaymentsResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const expectedStatusRef = useRef<Record<string, { status: string; paid_confirmed_at?: string | null }>>({});

  const executeAction = async (
    checkoutId: string,
    action: 'mark_paid' | 'mark_unpaid' | 'cancel',
    adminName?: string,
    force?: boolean
  ): Promise<void> => {
    setError(null);
    setSuccess(null);
    setIsProcessing(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error('No hay sesión activa');
      }

      const res = await fetch(`/api/admin/payments/offline/update-v2?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        body: JSON.stringify({
          checkoutId,
          action,
          adminName: adminName?.trim() || null,
          force: Boolean(force),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Error al ${action === 'mark_paid' ? 'autorizar' : action === 'mark_unpaid' ? 'revertir' : 'cancelar'} el pago`);
      }

      // Guardar estado esperado
      const expectedStatus = action === 'mark_paid' ? 'paid' : action === 'mark_unpaid' ? 'pending' : 'cancelled';
      expectedStatusRef.current[checkoutId] = {
        status: expectedStatus,
        paid_confirmed_at: action === 'mark_paid' ? json.session?.paid_confirmed_at || new Date().toISOString() : null,
      };

      setSuccess(`Pago ${action === 'mark_paid' ? 'autorizado' : action === 'mark_unpaid' ? 'revertido' : 'cancelado'} exitosamente`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
      setError(errorMsg);
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    markAsPaid: (checkoutId: string, adminName: string, force?: boolean) =>
      executeAction(checkoutId, 'mark_paid', adminName, force),
    markAsUnpaid: (checkoutId: string) => executeAction(checkoutId, 'mark_unpaid'),
    cancel: (checkoutId: string) => executeAction(checkoutId, 'cancel'),
    isProcessing,
    error,
    success,
  };
}
