'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

type LogEntry = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  admin_id?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: any;
  created_at: string;
};

export default function ActivityFeed() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/activity-logs', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) throw new Error('Failed to fetch logs');
      
      const json = await res.json();
      if (json.logs) {
        setLogs(json.logs);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      // Don't show error to user constantly, just log it
      if (loading) setError('No se pudieron cargar los eventos recientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Poll every 15 seconds
    intervalRef.current = setInterval(fetchLogs, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getIcon = (type: string, severity: string) => {
    if (severity === 'error' || severity === 'critical') return '🚨';
    if (severity === 'warning') return '⚠️';
    if (type.includes('payment')) return '💰';
    if (type.includes('quote')) return '🚚';
    if (type.includes('auth')) return '🔐';
    return '📝';
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Cargando actividad...
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className="p-4 text-center text-red-500 text-sm bg-red-50 rounded-lg">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">
        No hay actividad reciente registrada.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span>📋</span> Auditoría y Actividad Reciente
        </h3>
        <span className="text-xs font-medium text-green-600 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Actualizando
        </span>
      </div>
      
      <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto custom-scrollbar">
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                log.severity === 'error' || log.severity === 'critical' ? 'bg-red-50/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl mt-0.5">{getIcon(log.event_type, log.severity)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      log.severity === 'error' || log.severity === 'critical' ? 'text-red-600' :
                      log.severity === 'warning' ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      {log.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-800 font-medium break-words">
                    {log.details?.message || 
                     log.details?.error ||
                     (log.event_type === 'quote_created' ? `Cotización Estafeta: $${log.details?.cost} (${log.details?.final_weight}kg)` :
                      log.event_type === 'payment_approved_estafeta' ? `Pago Guía Estafeta: $${log.details?.amount}` :
                      JSON.stringify(log.details).slice(0, 100))}
                  </p>
                  
                  {log.user_id && (
                    <div className="mt-1 text-xs text-gray-500">
                      Usuario: <span className="font-mono bg-gray-100 px-1 rounded">{log.user_id.slice(0, 8)}...</span>
                    </div>
                  )}
                  
                  {log.entity_type === 'estafeta_quote' && log.entity_id !== 'new' && (
                    <Link href={`/admin/estafeta?id=${log.entity_id}`} className="mt-2 inline-block text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      Ver detalles →
                    </Link>
                  )}
                  {log.entity_type === 'checkout_session' && (
                    <Link href={`/admin/pagos`} className="mt-2 inline-block text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      Ir a Pagos Offline →
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
