/**
 * Aplica margen configurable al costo de envío (ej. T1, Envia, base).
 * pct: 0–100 (ej. 10 = 10%). fixed: MXN a sumar.
 */
export function applyShippingMarkup(
  cost: number,
  markupPercent: number,
  markupFixed: number,
): number {
  const c = Number.isFinite(cost) ? cost : 0;
  const p = Number.isFinite(markupPercent) ? markupPercent : 0;
  const f = Number.isFinite(markupFixed) ? markupFixed : 0;
  return Math.max(0, c * (1 + p / 100) + f);
}
