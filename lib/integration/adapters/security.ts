import { supabaseAdmin } from '@/lib/supabase/admin';
import { IntegrationAdapter, IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export const securityAdapter: IntegrationAdapter = {
  panel: 'seguridad',

  async getItems(filter: IntegrationFilter): Promise<IntegrationResult> {
    const admin = supabaseAdmin();
    const items: IntegrationItem[] = [];
    const errors: string[] = [];

    try {
      if (!filter.status || filter.status === 'open') {
        const { data: alerts, error } = await admin
          .from('security_alerts')
          .select('*')
          .in('status', ['new', 'investigating'])
          .order('created_at', { ascending: false })
          .limit(filter.limit || 20);

        if (error) {
          // If table doesn't exist yet, we might get an error, just ignore or log
          if (error.code !== '42P01') { // undefined_table
             errors.push(`Error fetching security alerts: ${error.message}`);
          }
        } else if (alerts) {
          for (const a of alerts) {
            const isCritical = a.severity === 'critical' || a.severity === 'high';
            items.push({
              id: a.id,
              sourcePanel: 'seguridad',
              type: isCritical ? 'warning' : 'info',
              priority: isCritical ? 'high' : 'medium',
              title: `${a.type} - ${a.severity.toUpperCase()}`,
              description: a.details?.message || 'Alerta de seguridad detectada',
              timestamp: a.created_at,
              actionUrl: `/admin/seguridad`,
              metadata: {
                severity: a.severity,
                ip: a.ip_address
              }
            });
          }
        }
      }
    } catch (e: any) {
      errors.push(e.message);
    }

    return {
      items,
      total: items.length,
      hasMore: false,
      errors: errors.length > 0 ? errors : undefined
    };
  },

  async getMetrics() {
    const admin = supabaseAdmin();
    try {
      const { count: criticalCount } = await admin
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'investigating'])
        .in('severity', ['critical', 'high']);
      
      const { count: totalOpen } = await admin
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'investigating']);

      return {
        critical_alerts: criticalCount || 0,
        pending_alerts: totalOpen || 0
      };
    } catch {
      return {};
    }
  }
};
