'use client';

// Acciones rápidas flotantes para administración

import { useRouter } from 'next/navigation';
import { useAdminContext } from '@/lib/admin/AdminContext';

export function AdminQuickActions() {
  const router = useRouter();
  const { metrics, alerts } = useAdminContext();
  
  if (!metrics) return null;
  
  const quickActions = [
    {
      label: 'Marcar pago',
      icon: '✅',
      count: metrics.payments_offline_pending,
      onClick: () => router.push('/admin/pagos?filter=pending'),
      color: 'green',
    },
    {
      label: 'Subir guía',
      icon: '📦',
      count: metrics.orders_paid_pending_ship,
      onClick: () => router.push('/admin/logistica?status=paid'),
      color: 'blue',
    },
    {
      label: 'Resolver disputa',
      icon: '⚖️',
      count: metrics.disputes_open,
      onClick: () => router.push('/admin/disputas?filter=open'),
      color: 'red',
    },
    {
      label: 'Responder soporte',
      icon: '💬',
      count: metrics.support_unread_estimate,
      onClick: () => router.push('/admin/soporte?filter=unread'),
      color: 'purple',
    },
  ];
  
  const actionsWithCount = quickActions.filter(a => a.count > 0);
  
  if (actionsWithCount.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="flex flex-col gap-3">
        {actionsWithCount.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`
              flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl
              font-bold text-white transition-all hover:scale-105 hover:shadow-2xl
              backdrop-blur-sm
              ${action.color === 'green' ? 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800' : ''}
              ${action.color === 'blue' ? 'bg-gradient-to-r from-blue-600 to-cyan-700 hover:from-blue-700 hover:to-cyan-800' : ''}
              ${action.color === 'red' ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800' : ''}
              ${action.color === 'purple' ? 'bg-gradient-to-r from-purple-600 to-brand-emerald hover:from-purple-700 hover:to-teal-600' : ''}
            `}
          >
            <div className="rounded-full bg-white/20 backdrop-blur-sm p-2">
              <span className="text-2xl">{action.icon}</span>
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">{action.label}</div>
              <div className="text-xs opacity-90">{action.count} pendiente(s)</div>
            </div>
            <div className="ml-2 rounded-full bg-white/30 backdrop-blur-sm px-3 py-1.5 text-xs font-bold shadow-md">
              {action.count}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
