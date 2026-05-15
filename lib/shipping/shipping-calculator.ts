/**
 * Centralized Shipping Calculator — GoVendy
 *
 * Single source of truth for all shipping cost calculations.
 * Used by: checkout.service.ts (direct sales), settle-one (auctions),
 * settleEndedAuctions cron (auctions), update-status (auctions).
 *
 * RULE: Both auction and direct-sale paths call the same pure functions
 * so that prices are always consistent.
 */

// ─── Types ─────────────────────────────────────────────

export interface WeightRange {
    max_weight_kg: number;
    price: number;
}

/** Data from the listing needed to resolve shipping */
export interface ListingShippingInput {
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    shippingPrice: number;       // listing.shipping_price (custom/fixed price)
    freeShipping: boolean;       // listing.free_shipping
    shippingBySeller: boolean;   // listing.shipping_by_seller
    shippingSubsidy: number;     // listing.shipping_subsidy (subsidy from listing form)
    allowPersonalDelivery: boolean;
    productType: 'physical' | 'digital';
}

/** Global shipping settings from app_settings */
export interface ShippingSettings {
    shippingBase: number;        // fallback base cost (default 175)
    weightRanges: WeightRange[]; // from estafeta_config.weight_ranges
    markupPct: number;           // shipping_markup_percent
    markupFixed: number;         // shipping_markup_fixed
}

/** Result of resolving shipping for an order */
export interface ShippingResult {
    shippingFee: number;         // amount the buyer pays
    shippingSubsidy: number;     // amount deducted from seller earnings (GoVendy absorbs)
    shippingCarrier: string | null;
    shippingOptionId: string | null;
    shippingBySeller: boolean;
    isPickup: boolean;
    baseCost: number;            // real shipping cost before subsidy
}

// ─── Default Weight Ranges ─────────────────────────────

export const DEFAULT_WEIGHT_RANGES: WeightRange[] = [
    { max_weight_kg: 1, price: 175 },
    { max_weight_kg: 5, price: 195 },
    { max_weight_kg: 10, price: 235 },
    { max_weight_kg: 15, price: 255 },
    { max_weight_kg: 20, price: 275 },
    { max_weight_kg: 25, price: 300 },
    { max_weight_kg: 30, price: 325 },
    { max_weight_kg: 35, price: 340 },
    { max_weight_kg: 40, price: 355 },
    { max_weight_kg: 45, price: 385 },
    { max_weight_kg: 50, price: 415 },
    { max_weight_kg: 55, price: 435 },
    { max_weight_kg: 60, price: 455 },
];

// ─── Pure Calculation Functions ────────────────────────

/**
 * Calculate effective weight considering volumetric weight.
 * Volumetric: (L × W × H) / 5000
 */
export function calcEffectiveWeight(
    weightKg: number,
    lengthCm: number,
    widthCm: number,
    heightCm: number,
): number {
    const physical = weightKg || 1;
    const volumetric = ((lengthCm || 10) * (widthCm || 10) * (heightCm || 10)) / 5000;
    return Math.max(physical, volumetric);
}

/**
 * Calculate shipping cost based on weight ranges.
 * Pure function — no side effects.
 */
export function calcWeightBasedCost(
    effectiveWeight: number,
    settings: ShippingSettings,
): number {
    const ranges = (settings.weightRanges.length > 0 ? settings.weightRanges : DEFAULT_WEIGHT_RANGES)
        .slice()
        .sort((a, b) => a.max_weight_kg - b.max_weight_kg);

    const match = ranges.find((r) => effectiveWeight <= r.max_weight_kg);
    if (match) return Number(match.price) || settings.shippingBase;
    if (ranges.length > 0) return Number(ranges[ranges.length - 1].price) || settings.shippingBase;
    return settings.shippingBase;
}

/**
 * Resolve shipping for an AUCTION order.
 * Identical logic to direct sale but called from auction paths.
 *
 * For auctions, there is no cart — only a single listing.
 * The buyer doesn't choose a shipping option; the system
 * automatically assigns GoVendy / seller / pickup based on listing config.
 */
export function resolveAuctionShipping(
    input: ListingShippingInput,
    settings: ShippingSettings,
): ShippingResult {
    // Default result
    const result: ShippingResult = {
        shippingFee: 0,
        shippingSubsidy: 0,
        shippingCarrier: null,
        shippingOptionId: null,
        shippingBySeller: false,
        isPickup: false,
        baseCost: 0,
    };

    // SERVER-SIDE PROTECTION: Auctions NEVER allow subsidy (prevents seller from covering 100% of shipping)
    input = { ...input, shippingSubsidy: 0 };

    // Digital product → no shipping
    if (input.productType === 'digital') {
        return result;
    }

    // Detect which shipping path applies
    const hasGoVendyShipping = !input.shippingBySeller && !input.freeShipping &&
        (input.shippingPrice > 0 || input.weightKg > 0);

    // 1. Pickup-only: only if no other shipping is available
    if (input.allowPersonalDelivery && !hasGoVendyShipping && !input.shippingBySeller && !input.freeShipping) {
        result.isPickup = true;
        result.shippingCarrier = 'pickup';
        return result;
    }

    // 2. Free shipping
    if (input.freeShipping) {
        if (input.shippingBySeller) {
            // Seller absorbs costs — no platform involvement
            result.shippingBySeller = true;
            return result;
        }

        // GoVendy free shipping → calculate real cost as subsidy
        const effectiveWeight = calcEffectiveWeight(input.weightKg, input.lengthCm, input.widthCm, input.heightCm);

        let baseCost = input.shippingPrice; // custom price from listing
        if (!(baseCost > 0)) {
            baseCost = calcWeightBasedCost(effectiveWeight, settings);
        }

        result.shippingFee = 0;
        result.shippingSubsidy = baseCost; // deducted from seller via payoutNet()
        result.shippingCarrier = 'gopocket';
        result.baseCost = baseCost;
        return result;
    }

    // 3. Seller-managed shipping
    if (input.shippingBySeller) {
        result.shippingFee = input.shippingPrice;
        result.shippingBySeller = true;
        result.baseCost = input.shippingPrice;
        return result;
    }

    // 4. GoVendy with published shipping price (frontend pre-calculated)
    if (input.shippingPrice > 0) {
        // IMPORTANT: shipping_price on the listing is ALREADY the buyer-facing price.
        // During listing creation, the seller sets subsidy which reduces shipping_price:
        //   shipping_price = carrier_cost - shipping_subsidy (done by listing form/API)
        // So we must NOT subtract the subsidy again here — that would cause double deduction.
        result.shippingFee = input.shippingPrice;
        result.shippingCarrier = 'gopocket';
        result.baseCost = input.shippingPrice + input.shippingSubsidy; // reconstruct original cost for tracking
        // Record subsidy for tracking/display only — NOT applied to shippingFee
        if (input.shippingSubsidy > 0) {
            result.shippingSubsidy = input.shippingSubsidy;
        }
        return result;
    }

    // 5. GoVendy calculated by weight (no fixed price on listing)
    const effectiveWeight = calcEffectiveWeight(input.weightKg, input.lengthCm, input.widthCm, input.heightCm);
    const baseCost = calcWeightBasedCost(effectiveWeight, settings);

    result.shippingCarrier = 'gopocket';
    result.baseCost = baseCost;
    // Buyer pays baseCost minus any listing-level subsidy
    result.shippingFee = Math.max(0, baseCost - input.shippingSubsidy);
    if (input.shippingSubsidy > 0) {
        result.shippingSubsidy = input.shippingSubsidy;
    }

    return result;
}

// ─── Helper: Build input from raw listing row ──────────

/**
 * Convert a raw listing row (from Supabase) into a ListingShippingInput.
 * Works for both the repo object and admin query result.
 */
export function listingToShippingInput(listing: any): ListingShippingInput {
    return {
        weightKg: Number(listing.weight_kg || 0),
        lengthCm: Number(listing.length_cm || 0),
        widthCm: Number(listing.width_cm || 0),
        heightCm: Number(listing.height_cm || 0),
        shippingPrice: Number(listing.shipping_price || 0),
        freeShipping: Boolean(listing.free_shipping),
        shippingBySeller: Boolean(listing.shipping_by_seller),
        shippingSubsidy: Number(listing.shipping_subsidy || 0),
        allowPersonalDelivery: Boolean(listing.allow_personal_delivery),
        productType: String(listing.product_type || 'physical').toLowerCase() === 'digital' ? 'digital' : 'physical',
    };
}

/**
 * Build ShippingSettings from an app_settings row.
 */
export function buildShippingSettings(settingsRow: any): ShippingSettings {
    const estafetaConfig = (settingsRow?.estafeta_config as any) || {};
    const weightRanges = Array.isArray(estafetaConfig.weight_ranges) && estafetaConfig.weight_ranges.length >= 5
        ? estafetaConfig.weight_ranges
        : DEFAULT_WEIGHT_RANGES;

    return {
        shippingBase: Number(settingsRow?.shipping_base ?? 175),
        weightRanges,
        markupPct: Number(settingsRow?.shipping_markup_percent ?? 0) || 0,
        markupFixed: Number(settingsRow?.shipping_markup_fixed ?? 0) || 0,
    };
}
