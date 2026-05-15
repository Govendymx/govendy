'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type ScamReport = {
  id: string;
  reporter_id: string;
  suspect_id: string | null;
  listing_id: string | null;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  reporter?: { raw_user_meta_data?: any; email?: string };
};

export default function ScamReportsAdminPage() {
  const [reports, setReports] = useState<ScamReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('scam_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch user data for reporters if possible, but for simplicity we show IDs if auth.users is restricted
      // Due to RLS on auth.users, getting emails directly via join might not work for non-superadmins.
      setReports(data as ScamReport[]);
    } catch (err) {
      console.error('Error fetching scam reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('scam_reports')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      setReports((prev) => 
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Error al actualizar el estado.');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-sm">
              🚨
            </span>
            Panel de Estafas
          </h1>
          <p className="mt-2 text-sm text-gray-500 font-medium">Gestión y seguimiento de reportes de posibles fraudes.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filterStatus === 'pending' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${filterStatus === 'resolved' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Resueltos
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="h-8 w-8 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">No hay reportes</h3>
            <p className="text-gray-500 text-sm mt-1">Actualmente no hay reportes en esta categoría.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-bold">Fecha</th>
                  <th className="px-6 py-4 font-bold">Motivo</th>
                  <th className="px-6 py-4 font-bold">Estado</th>
                  <th className="px-6 py-4 font-bold">Detalles</th>
                  <th className="px-6 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(report.created_at).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">{report.reason}</span>
                    </td>
                    <td className="px-6 py-4">
                      {report.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          Pendiente
                        </span>
                      )}
                      {report.status === 'resolved' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          Resuelto
                        </span>
                      )}
                      {report.status === 'investigating' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          Investigando
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-gray-600" title={report.description}>
                      {report.description}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {report.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(report.id, 'investigating')}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition-colors"
                          >
                            Investigar
                          </button>
                        )}
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => handleUpdateStatus(report.id, 'resolved')}
                            className="px-3 py-1.5 rounded-lg bg-green-50 text-green-600 font-bold hover:bg-green-100 transition-colors"
                          >
                            Resolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
