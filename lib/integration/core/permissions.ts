import { IntegrationPanel } from './types';

// TODO: Integrate with real RBAC system
// This is a placeholder for granular permission logic
export async function checkPanelAccess(userId: string, panel: IntegrationPanel): Promise<boolean> {
  // By default, assume admins have access to all panels for now
  // In a real implementation, we would query the `admin_users` table or roles
  return true; 
}

export async function filterAccessibleItems<T extends { sourcePanel: IntegrationPanel }>(
  userId: string, 
  items: T[]
): Promise<T[]> {
  const results: T[] = [];
  // Optimization: check unique panels first
  const panels = new Set(items.map(i => i.sourcePanel));
  const permissions = new Map<IntegrationPanel, boolean>();
  
  for (const p of panels) {
    permissions.set(p, await checkPanelAccess(userId, p));
  }

  return items.filter(i => permissions.get(i.sourcePanel));
}
