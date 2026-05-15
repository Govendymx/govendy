/**
 * Cálculo de retenciones fiscales para plataformas digitales (Ley 2020).
 *
 * Reglas:
 * - ISR: siempre aplica. Tasa 1% con RFC, 20% sin RFC (configurable).
 * - IVA: 8% sobre base gravable. EXENTO para artículos usados (Art. 9 Frac IV LIVA).
 * - Si el sistema está desactivado → retención = 0.
 */

export interface TaxSettings {
    enabled: boolean;
    isrRate: number;       // % con RFC (default 1.00)
    isrNoRfcRate: number;  // % sin RFC (default 20.00)
    ivaRate: number;       // % IVA retenido (default 8.00)
}

export interface WithholdingResult {
    isrRate: number;
    isrAmount: number;
    ivaRate: number;
    ivaAmount: number;
    isIvaExempt: boolean;
    totalWithheld: number;
}

export type ItemCondition = 'nuevo' | 'usado' | 'casi_nuevo' | null;

const DEFAULT_SETTINGS: TaxSettings = {
    enabled: false,
    isrRate: 1.00,
    isrNoRfcRate: 20.00,
    ivaRate: 8.00,
};

/**
 * Calcula retenciones ISR e IVA para una venta.
 *
 * @param subtotal - Monto bruto de la venta (precio que paga el comprador por los productos)
 * @param condition - Condición del artículo: 'nuevo', 'usado', 'casi_nuevo'
 * @param hasRFC - Si el vendedor tiene RFC registrado
 * @param settings - Configuración fiscal desde app_settings
 */
export function calculateWithholding(
    subtotal: number,
    condition: ItemCondition,
    hasRFC: boolean,
    settings: TaxSettings = DEFAULT_SETTINGS,
): WithholdingResult {
    // Sistema apagado → cero retención
    if (!settings.enabled || subtotal <= 0) {
        return { isrRate: 0, isrAmount: 0, ivaRate: 0, ivaAmount: 0, isIvaExempt: false, totalWithheld: 0 };
    }

    // ── ISR: siempre aplica ──
    const isrRate = hasRFC ? settings.isrRate / 100 : settings.isrNoRfcRate / 100;
    const isrAmount = Math.round(subtotal * isrRate * 100) / 100;

    // ── IVA: EXENTO para usados y casi nuevos (Art. 9 Frac IV LIVA) ──
    const isUsed = condition === 'usado' || condition === 'casi_nuevo';
    const ivaRate = isUsed ? 0 : settings.ivaRate / 100;
    // El precio publicado ya incluye IVA → base gravable = subtotal / 1.16
    const baseGravable = subtotal / 1.16;
    const ivaAmount = isUsed ? 0 : Math.round(baseGravable * ivaRate * 100) / 100;

    return {
        isrRate,
        isrAmount,
        ivaRate,
        ivaAmount,
        isIvaExempt: isUsed,
        totalWithheld: Math.round((isrAmount + ivaAmount) * 100) / 100,
    };
}

/**
 * Parsea la configuración fiscal desde el row de app_settings.
 */
export function parseTaxSettings(settingsRow: any): TaxSettings {
    return {
        enabled: Boolean(settingsRow?.tax_withholding_enabled),
        isrRate: Number(settingsRow?.tax_isr_rate ?? 1.00),
        isrNoRfcRate: Number(settingsRow?.tax_isr_no_rfc_rate ?? 20.00),
        ivaRate: Number(settingsRow?.tax_iva_rate ?? 8.00),
    };
}

/**
 * Calcula el desglose de ganancias de GoVendy (para Contador Privado).
 */
export function calculatePlatformTax(commissionTotal: number) {
    // La comisión incluye IVA → base = comisión / 1.16
    const commissionBase = commissionTotal / 1.16;
    const commissionIva = Math.round((commissionTotal - commissionBase) * 100) / 100;
    const commissionBaseRounded = Math.round(commissionBase * 100) / 100;

    // ISR estimado de GoVendy (~30% persona moral)
    const platformIsrRate = 0.30;
    const platformIsr = Math.round(commissionBaseRounded * platformIsrRate * 100) / 100;

    // Ganancia neta
    const netProfit = Math.round((commissionBaseRounded - platformIsr) * 100) / 100;

    return {
        commissionTotal,
        commissionBase: commissionBaseRounded,
        commissionIva,
        platformIsr,
        platformIsrRate,
        netProfit,
    };
}
