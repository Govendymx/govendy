import { IntegrationAdapter, IntegrationPanel } from './types';

class IntegrationRegistry {
  private adapters: Map<IntegrationPanel, IntegrationAdapter> = new Map();

  register(adapter: IntegrationAdapter) {
    if (this.adapters.has(adapter.panel)) {
      console.warn(`[IntegrationRegistry] Adapter for panel ${adapter.panel} is already registered. Overwriting.`);
    }
    this.adapters.set(adapter.panel, adapter);
  }

  get(panel: IntegrationPanel): IntegrationAdapter | undefined {
    return this.adapters.get(panel);
  }

  getAll(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }

  getPanels(): IntegrationPanel[] {
    return Array.from(this.adapters.keys());
  }
}

export const integrationRegistry = new IntegrationRegistry();
