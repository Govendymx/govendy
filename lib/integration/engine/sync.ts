import { integrationRegistry } from '../core/registry';
import { filterAccessibleItems } from '../core/permissions';
import { IntegrationFilter, IntegrationItem, IntegrationResult } from '../core/types';

export class SyncEngine {
  
  /**
   * Aggregates items from all registered adapters, filtered by permissions and criteria.
   * @param userId The ID of the user requesting the data (for permission checks)
   * @param filter Global filters to apply
   */
  async aggregateItems(userId: string, filter: IntegrationFilter = {}): Promise<IntegrationResult> {
    const adapters = integrationRegistry.getAll();
    const results: IntegrationItem[] = [];
    const errors: string[] = [];

    // Execute all adapters in parallel
    const promises = adapters.map(async (adapter) => {
      try {
        const result = await adapter.getItems(filter);
        if (result.errors) {
          errors.push(...result.errors.map(e => `[${adapter.panel}] ${e}`));
        }
        return result.items;
      } catch (e: any) {
        errors.push(`[${adapter.panel}] Crash: ${e.message}`);
        return [];
      }
    });

    const itemsArrays = await Promise.all(promises);
    const allItems = itemsArrays.flat();

    // Sort by timestamp (newest first)
    allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by permissions
    const accessibleItems = await filterAccessibleItems(userId, allItems);

    return {
      items: accessibleItems,
      total: accessibleItems.length,
      hasMore: false, // TODO: Implement pagination across adapters
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Aggregates metrics from all adapters.
   */
  async aggregateMetrics(): Promise<Record<string, number>> {
    const adapters = integrationRegistry.getAll();
    const metrics: Record<string, number> = {};

    const promises = adapters.map(async (adapter) => {
      if (adapter.getMetrics) {
        try {
          const m = await adapter.getMetrics();
          // Prefix metrics with panel name to avoid collisions
          Object.entries(m).forEach(([k, v]) => {
            metrics[`${adapter.panel}_${k}`] = v;
          });
        } catch (e) {
          console.error(`Error fetching metrics for ${adapter.panel}`, e);
        }
      }
    });

    await Promise.all(promises);
    return metrics;
  }
}

export const syncEngine = new SyncEngine();
