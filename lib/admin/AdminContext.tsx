'use client';

// Context para compartir estado entre paneles de administración

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AdminContextType, AdminMetrics, AdminAlert } from './types';
import { Order, CheckoutSession, Dispute, Listing } from '@/lib/types/domain.types';
import { calculateAllAlerts } from './alerts';

const AdminContext = createContext<AdminContextType | null>(null);

export function useAdminContext(): AdminContextType {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext debe usarse dentro de AdminProvider');
  }
  return context;
}

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  const router = useRouter();
  
  // Estado global compartido
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<CheckoutSession[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Estado de carga
  const [loading, setLoading] = useState({
    orders: false,
    payments: false,
    disputes: false,
    metrics: false,
    audit: false,
  });

  // Función para obtener token
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: sess } = await supabase.auth.getSession();
    return sess.session?.access_token || null;
  }, []);

  // Cargar órdenes
  const refreshOrders = useCallback(async () => {
    setLoading(prev => ({ ...prev, orders: true }));
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch('/api/admin/logistica/orders/list?limit=200', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      if (!res.ok) {
        console.error('[AdminContext] Error cargando órdenes:', res.status);
        return;
      }
      
      const json = await res.json();
      const ordersData = (json?.orders ?? []) as Order[];
      setOrders(ordersData);
    } catch (error) {
      console.error('[AdminContext] Error en refreshOrders:', error);
    } finally {
      setLoading(prev => ({ ...prev, orders: false }));
    }
  }, [getToken]);

  // Cargar pagos
  const refreshPayments = useCallback(async () => {
    setLoading(prev => ({ ...prev, payments: true }));
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch('/api/admin/payments/offline/list?limit=200', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      if (!res.ok) {
        console.error('[AdminContext] Error cargando pagos:', res.status);
        return;
      }
      
      const json = await res.json();
      const paymentsData = (json?.sessions ?? []) as CheckoutSession[];
      setPayments(paymentsData);
    } catch (error) {
      console.error('[AdminContext] Error en refreshPayments:', error);
    } finally {
      setLoading(prev => ({ ...prev, payments: false }));
    }
  }, [getToken]);

  // Cargar disputas
  const refreshDisputes = useCallback(async () => {
    setLoading(prev => ({ ...prev, disputes: true }));
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch('/api/admin/disputes/list?limit=200', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      if (!res.ok) {
        console.error('[AdminContext] Error cargando disputas:', res.status);
        return;
      }
      
      const json = await res.json();
      const disputesData = (json?.disputes ?? []) as Dispute[];
      setDisputes(disputesData);
    } catch (error) {
      console.error('[AdminContext] Error en refreshDisputes:', error);
    } finally {
      setLoading(prev => ({ ...prev, disputes: false }));
    }
  }, [getToken]);

  // Cargar métricas
  const refreshMetrics = useCallback(async () => {
    setLoading(prev => ({ ...prev, metrics: true }));
    try {
      const token = await getToken();
      if (!token) return;
      
      const res = await fetch('/api/admin/dashboard/summary', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      
      if (!res.ok) {
        console.error('[AdminContext] Error cargando métricas:', res.status);
        return;
      }
      
      const json = await res.json();
      setMetrics(json as AdminMetrics);
    } catch (error) {
      console.error('[AdminContext] Error en refreshMetrics:', error);
    } finally {
      setLoading(prev => ({ ...prev, metrics: false }));
    }
  }, [getToken]);

  // Cargar logs de auditoría
  const refreshAuditLogs = useCallback(async () => {
    setLoading(prev => ({ ...prev, audit: true }));
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) {
        // Ignorar error si la tabla no existe aún
        if (error.code !== '42P01') {
           console.error('[AdminContext] Error cargando audit_logs:', error);
        }
        return;
      }
      
      setAuditLogs(data || []);
    } catch (error) {
      console.error('[AdminContext] Error en refreshAuditLogs:', error);
    } finally {
      setLoading(prev => ({ ...prev, audit: false }));
    }
  }, []);

  // Actualizar alertas cuando cambian los datos
  useEffect(() => {
    if (payments.length > 0 || orders.length > 0 || disputes.length > 0 || auditLogs.length > 0) {
      calculateAllAlerts(payments, orders, disputes).then(baseAlerts => {
        // Integrar alertas de auditoría
        const auditAlerts: AdminAlert[] = auditLogs.map(log => ({
          id: `audit-${log.id}`,
          type: (log.severity === 'critical' ? 'critical' : 'warning') as 'critical' | 'warning',
          category: 'audit',
          title: log.severity === 'critical' ? '🚨 Error Financiero Crítico' : '⚠️ Advertencia Financiera',
          description: log.message,
          actionUrl: '/admin/auditoria',
          actionLabel: 'Revisar',
          createdAt: log.created_at,
          priority: log.severity === 'critical' ? 10 : 5,
          relatedIds: { userId: log.details?.user_id }
        }));

        const allAlerts = [...baseAlerts, ...auditAlerts];
        // Ordenar por prioridad
        allAlerts.sort((a, b) => b.priority - a.priority);
        
        setAlerts(allAlerts);
      });
    }
  }, [payments, orders, disputes, auditLogs]);

  // Cargar todo
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshOrders(),
      refreshPayments(),
      refreshDisputes(),
      refreshMetrics(),
      refreshAuditLogs(),
    ]);
  }, [refreshOrders, refreshPayments, refreshDisputes, refreshMetrics, refreshAuditLogs]);

  // Marcar pago como pagado
  const markPaymentAsPaid = useCallback(async (paymentId: string, adminName: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No hay token');
      
      const res = await fetch('/api/admin/payments/offline/update-v2', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkoutId: paymentId,
          status: 'paid',
          adminName,
        }),
      });
      
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'Error marcando pago como pagado');
      }
      
      // Refrescar pagos y órdenes
      await Promise.all([refreshPayments(), refreshOrders()]);
    } catch (error) {
      console.error('[AdminContext] Error en markPaymentAsPaid:', error);
      throw error;
    }
  }, [getToken, refreshPayments, refreshOrders]);

  // Actualizar estado de orden
  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No hay token');
      
      const res = await fetch('/api/admin/logistica/orders/update', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          status,
        }),
      });
      
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'Error actualizando orden');
      }
      
      await refreshOrders();
    } catch (error) {
      console.error('[AdminContext] Error en updateOrderStatus:', error);
      throw error;
    }
  }, [getToken, refreshOrders]);

  // Resolver disputa
  const resolveDispute = useCallback(async (disputeId: string, resolution: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No hay token');
      
      const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolution,
        }),
      });
      
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error || 'Error resolviendo disputa');
      }
      
      await refreshDisputes();
    } catch (error) {
      console.error('[AdminContext] Error en resolveDispute:', error);
      throw error;
    }
  }, [getToken, refreshDisputes]);

  // Navegación contextual
  const navigateToRelated = useCallback((type: 'order' | 'payment' | 'dispute', id: string) => {
    if (type === 'order') {
      router.push(`/admin/operations?orderId=${id}`);
    } else if (type === 'payment') {
      router.push(`/admin/operations?paymentId=${id}`);
    } else if (type === 'dispute') {
      router.push(`/admin/operations?disputeId=${id}`);
    }
  }, [router]);

  const value: AdminContextType = {
    orders,
    payments,
    disputes,
    listings,
    metrics,
    loading,
    alerts,
    refreshOrders,
    refreshPayments,
    refreshDisputes,
    refreshMetrics,
    refreshAll,
    markPaymentAsPaid,
    updateOrderStatus,
    resolveDispute,
    navigateToRelated,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
