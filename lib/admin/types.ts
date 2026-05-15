// Tipos para el sistema de administración

import { Order, CheckoutSession, Dispute, Listing } from '@/lib/types/domain.types';

export interface AdminMetrics {
  disputes_open: number;
  payments_offline_pending: number;
  orders_today: number;
  orders_paid_pending_ship: number;
  payouts_sellers_to_release: number;
  profiles_count: number;
  listings_active: number;
  support_unread_estimate: number;
  estafeta_paid_pending_guide: number;
  estafeta_paid_today: number;
  recent_events_count: number;
  pending_events_count: number;
  urgent_events_count: number;
  monthly_pocketcash_issued?: number;
  weekly_pocketcash_spent?: number;
  pocketcash_global_liability?: number;
  pocketcash_total_withdrawn?: number;
  pocketcash_total_spent_orders?: number;
}

export interface AdminAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'payment' | 'order' | 'dispute' | 'support' | 'logistics' | 'audit';
  title: string;
  description: string;
  actionUrl: string;
  actionLabel: string;
  relatedIds: {
    orderId?: string;
    paymentId?: string;
    disputeId?: string;
    userId?: string;
  };
  createdAt: string;
  priority: number; // 1-10, mayor = más urgente
}

export interface AdminContextType {
  // Estado global compartido
  orders: Order[];
  payments: CheckoutSession[];
  disputes: Dispute[];
  listings: Listing[];
  
  // Métricas globales
  metrics: AdminMetrics | null;
  
  // Estado de carga
  loading: {
    orders: boolean;
    payments: boolean;
    disputes: boolean;
    metrics: boolean;
  };
  
  // Alertas
  alerts: AdminAlert[];
  
  // Funciones de actualización
  refreshOrders: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshDisputes: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // Funciones de acción
  markPaymentAsPaid: (paymentId: string, adminName: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  resolveDispute: (disputeId: string, resolution: string) => Promise<void>;
  
  // Navegación contextual
  navigateToRelated: (type: 'order' | 'payment' | 'dispute', id: string) => void;
}
