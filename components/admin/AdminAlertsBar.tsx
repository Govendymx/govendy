'use client';

// Barra de alertas unificada para administración

import Link from 'next/link';
import { useAdminContext } from '@/lib/admin/AdminContext';

export function AdminAlertsBar() {
  const { alerts } = useAdminContext();
  
  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const warningAlerts = alerts.filter(a => a.type === 'warning');
  
  if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
    return null;
  }
  
  return (
    <div className="sticky top-[60px] z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
      {criticalAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 border-b-2 border-red-400 px-6 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/20 backdrop-blur-sm p-2">
                <span className="text-2xl">🚨</span>
              </div>
              <div>
                <span className="font-bold text-white text-base">
                  {criticalAlerts.length} alerta(s) crítica(s) requiere(n) atención inmediata
                </span>
              </div>
            </div>
            <Link
              href="/admin/alerts?type=critical"
              className="rounded-lg bg-white/20 backdrop-blur-sm px-5 py-2.5 text-sm font-bold text-white hover:bg-white/30 transition-all shadow-md"
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
      
      {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 border-b-2 border-amber-400 px-6 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/20 backdrop-blur-sm p-2">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <span className="font-semibold text-white text-base">
                  {warningAlerts.length} alerta(s) que requieren revisión
                </span>
              </div>
            </div>
            <Link
              href="/admin/alerts?type=warning"
              className="rounded-lg bg-white/20 backdrop-blur-sm px-5 py-2.5 text-sm font-bold text-white hover:bg-white/30 transition-all shadow-md"
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
