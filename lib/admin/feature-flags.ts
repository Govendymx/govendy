/**
 * Banderas globales persistidas en app_settings.feature_flags (fila id = 1).
 * Añade nuevas claves aquí y en FEATURE_FLAG_REGISTRY para que aparezcan en /admin/interruptores.
 */

export const FEATURE_FLAG_KEYS = {
  gopocket_shipping: 'gopocket_shipping',
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_KEYS;

export type FeatureFlagsState = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlagsState = {
  gopocket_shipping: true,
};

export function mergeFeatureFlags(raw: unknown): FeatureFlagsState {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    gopocket_shipping:
      typeof o.gopocket_shipping === 'boolean' ? o.gopocket_shipping : DEFAULT_FEATURE_FLAGS.gopocket_shipping,
  };
}

export type FeatureFlagDefinition = {
  key: FeatureFlagKey;
  label: string;
  description: string;
};

/** Catálogo para el panel admin (orden de lista). */
export const FEATURE_FLAG_REGISTRY: FeatureFlagDefinition[] = [
  {
    key: 'gopocket_shipping',
    label: 'Envíos GoVendy',
    description:
      'Permite envío integrado de la plataforma (cotización en publicación y checkout con guías GoVendy). Si está apagado, los vendedores solo podrán usar envío gestionado por ellos.',
  },
];
