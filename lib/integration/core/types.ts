export type IntegrationPanel = 
  | 'general' 
  | 'metrics' 
  | 'supervision' 
  | 'pagos' 
  | 'pocketcash' 
  | 'retiros' 
  | 'logistica' 
  | 'disputas' 
  | 'devoluciones' 
  | 'soporte' 
  | 'usuarios' 
  | 'publicaciones' 
  | 'tienda_estafeta'
  | 'seguridad';

export type IntegrationItemType = 'warning' | 'info' | 'error' | 'success';
export type IntegrationItemPriority = 'high' | 'medium' | 'low';

export interface IntegrationItem {
  id: string;
  sourcePanel: IntegrationPanel;
  type: IntegrationItemType;
  priority: IntegrationItemPriority;
  title: string;
  description: string;
  timestamp: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface IntegrationFilter {
  status?: string;
  startDate?: string;
  endDate?: string;
  priority?: IntegrationItemPriority;
  search?: string;
  limit?: number;
}

export interface IntegrationResult {
  items: IntegrationItem[];
  total: number;
  hasMore: boolean;
  errors?: string[];
}

export interface IntegrationAdapter {
  panel: IntegrationPanel;
  getItems(filter: IntegrationFilter): Promise<IntegrationResult>;
  getMetrics?(): Promise<Record<string, number>>;
  healthCheck?(): Promise<boolean>;
}
