import { IntegrationAdapter, IntegrationFilter, IntegrationResult, IntegrationItem } from '../core/types';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const paymentsAdapter: IntegrationAdapter = {
  panel: 'pagos',
  
  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      // 1. Detectar Inconsistencias: Sesiones Pagadas pero Órdenes Pendientes
      // Esta lógica replica la de /api/admin/payments/offline/list
      const { data: potentialInconsistencies, error: incError } = await admin
        .from('checkout_sessions')
        .select('id, status, payment_method, created_at, order_ids')
        .eq('payment_method', 'mercadopago')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(20);

      if (incError) {
        errors.push(`Error fetching inconsistencies: ${incError.message}`);
      } else if (potentialInconsistencies) {
        const orderIds = potentialInconsistencies.flatMap(s => (s.order_ids as string[]) || []);
        
        if (orderIds.length > 0) {
           const { data: orders } = await admin
             .from('orders')
             .select('id, status')
             .in('id', orderIds);
             
           const ordersMap = new Map(orders?.map(o => [o.id, o.status]));
           
           for (const session of potentialInconsistencies) {
             const sOrderIds = (session.order_ids as string[]) || [];
             const hasPendingOrders = sOrderIds.some(oid => {
               const st = ordersMap.get(oid);
               return st && !['paid', 'shipped', 'delivered', 'completed'].includes(st);
             });
             
             if (hasPendingOrders) {
               items.push({
                 id: `inc-${session.id}`,
                 sourcePanel: 'pagos',
                 type: 'error',
                 priority: 'high',
                 title: 'Inconsistencia de Pago Detectada',
                 description: `Sesión ${session.id.substring(0,8)} está pagada pero tiene órdenes pendientes.`,
                 timestamp: new Date().toISOString(),
                 actionUrl: `/admin/pagos?status=paid&highlight=${session.id}`,
                 metadata: { sessionId: session.id, paymentMethod: session.payment_method }
               });
             }
           }
        }
      }

      // 2. Pagos Offline Pendientes de Revisión
      if (!filter.status || filter.status === 'pending') {
        const { data: pendingSessions, error: pendError } = await admin
          .from('checkout_sessions')
          .select('id, amount, payment_method, created_at, payment_proof_uploaded_at')
          .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
          .eq('status', 'pending')
          .not('payment_proof_uploaded_at', 'is', null) // Solo los que ya subieron comprobante
          .order('payment_proof_uploaded_at', { ascending: true })
          .limit(filter.limit || 10);

        if (pendError) {
           errors.push(`Error fetching pending sessions: ${pendError.message}`);
        } else if (pendingSessions) {
          for (const session of pendingSessions) {
            items.push({
              id: `pend-${session.id}`,
              sourcePanel: 'pagos',
              type: 'warning',
              priority: 'medium',
              title: 'Pago Offline por Revisar',
              description: `Comprobante subido para sesión de $${session.amount}`,
              timestamp: session.payment_proof_uploaded_at || session.created_at,
              actionUrl: `/admin/pagos?status=pending&highlight=${session.id}`,
              metadata: { amount: session.amount, method: session.payment_method }
            });
          }
        }
      }

    } catch (e: any) {
      errors.push(e.message);
    }

    return {
      items,
      total: items.length,
      hasMore: false, // Simplificado
      errors: errors.length > 0 ? errors : undefined
    };
  },

  async getMetrics(): Promise<Record<string, number>> {
    const admin = supabaseAdmin();
    // Ejemplo simple de métrica
    const { count } = await admin
      .from('checkout_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo']);
      
    return {
      pending_offline_reviews: count || 0
    };
  }
};
