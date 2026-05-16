/** Parsea size_stock desde JSON string u objeto. */
export function parseSizeStock(raw: unknown): Record<string, number> | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function variantLabel(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const key of ['size', 'label', 'name', 'value']) {
      if (typeof o[key] === 'string' && String(o[key]).trim()) return String(o[key]).trim();
    }
  }
  return null;
}

export function firstVariantLabel(variants: unknown): string | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  for (const item of variants) {
    const label = variantLabel(item);
    if (label) return label;
  }
  return null;
}

/**
 * Stock disponible para una variante (o global).
 * Si no hay control de inventario, devuelve un número alto.
 */
export function getAvailableStock(
  listing: { stock?: number | null; size_stock?: unknown },
  selectedSize?: string | null,
): number {
  const sizeKey = selectedSize?.trim() || null;
  const sizeStock = parseSizeStock(listing.size_stock);

  if (sizeKey && sizeStock && typeof sizeStock[sizeKey] === 'number') {
    return Math.max(0, sizeStock[sizeKey]);
  }

  if (sizeStock && Object.keys(sizeStock).length > 0 && !sizeKey) {
    return Math.max(0, ...Object.values(sizeStock));
  }

  if (listing.stock !== null && listing.stock !== undefined) {
    const st = Number(listing.stock);
    if (Number.isFinite(st)) return Math.max(0, st);
  }

  // Sin inventario configurado: permitir agregar (comportamiento legacy)
  if (!sizeStock) return 9999;

  return 0;
}
