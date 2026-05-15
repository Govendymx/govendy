'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CopyButton } from '@/components/ui/CopyButton';
import { FileText, Download, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// Tipos basados en la tabla orders y profiles
interface TransactionReport {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_email: string;
  created_at: string;
  total: number;
  status: string;
  payment_method: string;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<TransactionReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('30d');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // const supabase = createClientComponentClient();

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calcular fecha de inicio según el filtro
      const now = new Date();
      let startDate = new Date();
      if (filterPeriod === '24h') startDate.setHours(now.getHours() - 24);
      else if (filterPeriod === '7d') startDate.setDate(now.getDate() - 7);
      else if (filterPeriod === '30d') startDate.setDate(now.getDate() - 30);
      else if (filterPeriod === 'year') startDate.setFullYear(now.getFullYear() - 1);
      
      let query = supabase
        .from('orders')
        .select('id, seller_id, created_at, total, status, payment_method')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Obtener nombres de vendedores
      const sellerIds = Array.from(new Set(ordersData.map(o => o.seller_id)));
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sellerIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, { id: string, full_name: string, email: string }>(
        profilesData?.map(p => [p.id, p]) || []
      );

      const formattedReports: TransactionReport[] = ordersData.map(o => {
        const profile = profileMap.get(o.seller_id);
        return {
          id: o.id,
          seller_id: o.seller_id,
          seller_name: profile?.full_name || 'Desconocido',
          seller_email: profile?.email || '',
          created_at: o.created_at,
          total: o.total,
          status: o.status,
          payment_method: o.payment_method
        };
      });

      setReports(formattedReports);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterPeriod, filterStatus]);

  const exportToExcel = () => {
    const data = reports.map(r => ({
      'ID Orden': r.id,
      'ID Vendedor': r.seller_id,
      'Nombre Vendedor': r.seller_name,
      'Email Vendedor': r.seller_email,
      'Fecha': new Date(r.created_at).toLocaleString(),
      'Monto': r.total,
      'Estado': r.status,
      'Método Pago': r.payment_method
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reportes");
    XLSX.writeFile(wb, `Reporte_Transacciones_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-brand-emerald" />
            Reportes y Transacciones
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualiza y descarga reportes detallados de operaciones.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchReports}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-brand-emerald text-white px-4 py-2 rounded-lg hover:bg-brand-emerald/90 transition-colors shadow-sm"
            disabled={loading || reports.length === 0}
          >
            <Download size={18} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
          <Filter size={16} />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-transparent text-sm border border-gray-200 rounded-md px-2 py-1 focus:ring-brand-emerald focus:border-brand-emerald text-gray-700 cursor-pointer"
        >
          <option value="all">Todos los estados</option>
          <option value="paid">Pagado</option>
          <option value="pending_payment">Pendiente Pago</option>
          <option value="shipped">Enviado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
        </select>

        <div className="h-4 w-px bg-gray-300 mx-2"></div>
        
        <select 
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="bg-transparent text-sm border border-gray-200 rounded-md px-2 py-1 focus:ring-brand-emerald focus:border-brand-emerald text-gray-700 cursor-pointer"
        >
          <option value="24h">Últimas 24 horas</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="year">Este Año</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
           <div className="p-8 text-center text-gray-500">Cargando datos...</div>
        ) : error ? (
           <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2">
             <AlertCircle size={24} />
             <p>{error}</p>
             <button onClick={fetchReports} className="text-sm underline">Reintentar</button>
           </div>
        ) : reports.length === 0 ? (
           <div className="p-8 text-center text-gray-500">No se encontraron transacciones en este período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 font-semibold text-gray-700">ID Orden</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Vendedor (ID + Nombre)</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Fecha</th>
                  <th className="px-6 py-4 font-semibold text-gray-700 text-right">Monto</th>
                  <th className="px-6 py-4 font-semibold text-gray-700 text-center">Estado</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        {report.id.slice(0, 8)}...
                        <CopyButton text={report.id} size="sm" iconSize={12} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{report.seller_name}</span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                          {report.seller_id.slice(0, 8)}...
                          <CopyButton text={report.seller_id} size="sm" iconSize={12} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      ${report.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${report.status === 'paid' ? 'bg-green-100 text-green-800' : 
                          report.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                          report.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 capitalize">
                      {report.payment_method.replace('_', ' ')}
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
