'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { IntegrationItem, IntegrationPanel } from '@/lib/integration/core/types';
import { Trash2 } from 'lucide-react';

export default function UnifiedDashboardWidget() {
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [panelFilter, setPanelFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
    // Load dismissed IDs
    const stored = localStorage.getItem('admin_dismissed_alerts');
    if (stored) {
      try {
        setDismissedIds(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse dismissed alerts', e);
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/integration/unified', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!res.ok) throw new Error('Failed to load integration data');
      
      const json = await res.json();
      if (json.ok) {
        setItems(json.items || []);
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    const newIds = [...dismissedIds, id];
    setDismissedIds(newIds);
    localStorage.setItem('admin_dismissed_alerts', JSON.stringify(newIds));
  };

  const filteredItems = items.filter(item => {
    if (dismissedIds.includes(item.id)) return false;
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase());
    const matchesPanel = panelFilter === 'all' || item.sourcePanel === panelFilter;
    return matchesSearch && matchesPanel;
  });

  const uniquePanels = Array.from(new Set(items.map(i => i.sourcePanel)));

  const downloadCSV = () => {
    const headers = ['ID', 'Panel', 'Type', 'Priority', 'Title', 'Description', 'Date', 'Link'];
    const rows = filteredItems.map(i => [
      `"${i.id}"`, 
      `"${i.sourcePanel}"`, 
      `"${i.type}"`, 
      `"${i.priority}"`, 
      `"${i.title.replace(/"/g, '""')}"`, 
      `"${i.description.replace(/"/g, '""')}"`, 
      `"${i.timestamp}"`, 
      `"${i.actionUrl}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `integration_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) return <div className="p-4 bg-white rounded-lg shadow animate-pulse h-48">Cargando alertas unificadas...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Error: {error}</div>;
  if (items.length === 0) return null; 

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 gap-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
          </span>
          Atención Requerida
        </h3>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          
          <select
            value={panelFilter}
            onChange={(e) => setPanelFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
          >
            <option value="all">Todos</option>
            {uniquePanels.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          <button 
            onClick={downloadCSV}
            className="text-sm bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-50 flex items-center gap-1"
            title="Exportar CSV"
          >
            📥
          </button>

          <button onClick={fetchData} className="text-sm text-gray-500 hover:text-gray-900 p-1.5">
            ↻
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {items.length > 0 ? 'Todas las alertas han sido descartadas.' : 'No hay alertas que coincidan con los filtros.'}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-4 group">
              <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${
                item.priority === 'high' ? 'bg-red-500' : 
                item.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                    <span className="ml-2 inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      {item.sourcePanel}
                    </span>
                  </p>
                  <span className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                
                {item.actionUrl && (
                  <Link 
                    href={item.actionUrl}
                    className="inline-flex items-center text-xs font-medium text-brand-emerald hover:text-emerald-700"
                  >
                    Ver detalle &rarr;
                  </Link>
                )}
              </div>

              <button 
                onClick={() => handleDismiss(item.id)}
                className="self-start p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Descartar notificación"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
