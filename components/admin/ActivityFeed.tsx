'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { EventSeverity } from '@/lib/admin/activity-logger';

type LogEntry = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  severity: EventSeverity;
  details: any;
  created_at: string;
};

export default function ActivityFeed() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLogs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/activity-logs', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        if (res.status === 404) return; // Endpoint not ready or table missing
        throw new Error('Failed to fetch logs');
      }

      const json = await res.json();
      if (json.logs) {
        setLogs(json.logs);
        setError(null);
      }
    } catch (err) {
      console.error(err);
      // Don't show error to UI to avoid clutter, just log to console
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
    
    // Polling every 5 seconds for "real-time" feel
    intervalRef.current = setInterval(fetchLogs, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getSeverityColor = (s: string) => {
    switch (s) {
      case 'error': return 'bg-red-50 text-red-700 border-red-100';
      case 'warning': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 font-bold';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getIcon = (type: string) => {
    if (type.includes('payment')) return '💰';
    if (type.includes('quote')) return '🚚';
    if (type.includes('error')) return '🚨';
    if (type.includes('ship')) return '📦';
    if (type.includes('manual')) return '🛠️';
    return '📝';
  };

  if (isLoading && logs.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500 animate-pulse">Cargando actividad...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-gray-500">No hay actividad reciente registrada.</div>
        <p className="text-xs text-gray-400 mt-1">Los eventos aparecerán aquí en tiempo real.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
      {logs.map((log) => (
        <div 
          key={log.id} 
          className={`relative flex gap-3 rounded-xl border p-3 text-sm transition-all hover:shadow-md ${getSeverityColor(log.severity)}`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/50 text-lg shadow-sm">
            {getIcon(log.event_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate capitalize">
                {log.event_type.replace(/_/g, ' ')}
              </span>
              <span className="shrink-0 text-[10px] opacity-70 tabular-nums">
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="mt-0.5 text-xs opacity-90 break-words">
              {log.entity_type}: {log.entity_id.split('-')[0]}...
              {log.details?.amount && ` • $${log.details.amount}`}
              {log.details?.error && ` • Error: ${log.details.error}`}
              {log.details?.message && ` • ${log.details.message}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
