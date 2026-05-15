'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Eye,
  FileText
} from 'lucide-react';
import Link from 'next/link';

type AuditLog = {
  id: string;
  created_at: string;
  severity: 'info' | 'warning' | 'critical';
  entity_type: string;
  entity_id: string;
  message: string;
  details: any;
  status: 'open' | 'resolved' | 'ignored';
  resolved_at: string | null;
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSentinel, setRunningSentinel] = useState(false);
  const [filter, setFilter] = useState('open'); // open, all

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter === 'open') {
        query = query.eq('status', 'open');
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      toast.error('Error cargando registros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const runSentinel = async () => {
    try {
      setRunningSentinel(true);
      const toastId = toast.loading('Ejecutando Centinela Auditor...');
      
      const response = await fetch('/api/admin/auditor/run', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ADMIN_SECRET_KEY'
        }
      });

      const result = await response.json();
      
      if (result.status === 'clean') {
        toast.success('Sistema limpio: Integridad 100% verificada', { id: toastId });
      } else if (result.status === 'alert') {
        toast.error(`¡Alerta! Se detectaron ${result.discrepancies.length} problemas`, { id: toastId });
        fetchLogs(); // Refresh list
      } else {
        toast.error('Error ejecutando auditoría', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión con el Centinela');
    } finally {
      setRunningSentinel(false);
    }
  };

  const markResolved = async (id: string) => {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .update({ 
          status: 'resolved', 
          resolved_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Incidente marcado como resuelto');
      setLogs(logs.filter(l => l.id !== id));
    } catch (err) {
      toast.error('Error al actualizar estado');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-brand-orange" />
            Auditoría Financiera Autónoma
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistema de vigilancia de integridad contable y detección de anomalías.
          </p>
        </div>
        
        <button
          onClick={runSentinel}
          disabled={runningSentinel}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 ${
            runningSentinel ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'
          }`}
        >
          <RefreshCw className={`h-5 w-5 ${runningSentinel ? 'animate-spin' : ''}`} />
          {runningSentinel ? 'Auditando...' : 'Ejecutar Centinela Ahora'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setFilter('open')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            filter === 'open' 
              ? 'bg-red-50 text-red-700 border-b-2 border-red-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pendientes ({logs.filter(l => l.status === 'open').length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            filter === 'all' 
              ? 'bg-gray-100 text-gray-900 border-b-2 border-gray-500' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Historial Completo
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin mb-2" />
            <p>Cargando registros...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium text-gray-900">Todo en orden</p>
            <p className="text-sm">No hay incidentes pendientes de revisión.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {log.severity === 'critical' ? (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  ) : log.severity === 'warning' ? (
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  ) : (
                    <FileText className="h-6 w-6 text-blue-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${log.severity === 'critical' ? 'bg-red-100 text-red-800' : 
                        log.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-blue-100 text-blue-800'}`}>
                      {log.severity}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <h3 className="text-sm font-bold text-gray-900">{log.message}</h3>
                  
                  <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 overflow-x-auto border border-gray-100">
                    {JSON.stringify(log.details, null, 2)}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {log.status === 'open' && (
                      <button
                        onClick={() => markResolved(log.id)}
                        className="text-xs flex items-center gap-1 text-green-600 hover:text-green-700 font-semibold border border-green-200 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Marcar Resuelto
                      </button>
                    )}
                    <span className="text-xs text-gray-400 px-2 border-l border-gray-200">
                      ID: {log.entity_id}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
