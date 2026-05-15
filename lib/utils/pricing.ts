
import { Listing } from '@/lib/types/domain.types';

export interface WholesaleTier {
  min: number;
  max: number | null; // null means "and up" / "y más"
  price: number;
}

/**
 * Parse wholesale tiers from listing data.
 * Tiers are stored as JSONB in the database, or passed as an object/array.
 */
export function parseWholesaleTiers(listing: Partial<Listing> | any): WholesaleTier[] {
  if (!listing || !listing.wholesale_tiers) return [];
  
  try {
    const raw = typeof listing.wholesale_tiers === 'string' 
      ? JSON.parse(listing.wholesale_tiers) 
      : listing.wholesale_tiers;

    if (!Array.isArray(raw)) return [];

    return raw.map((t: any) => ({
      min: Number(t.min) || 0,
      max: t.max ? Number(t.max) : null,
      price: Number(t.price) || 0,
    })).sort((a, b) => a.min - b.min);
  } catch (err) {
    console.error('Error parsing wholesale tiers:', err);
    return [];
  }
}

/**
 * Calculate the unit price based on quantity and wholesale tiers.
 */
export function calculateUnitPrice(listing: Partial<Listing> | any, quantity: number): number {
  if (!listing) return 0;
  const basePrice = typeof listing.price === 'number' ? listing.price : Number(listing.price ?? 0);
  if (!Number.isFinite(basePrice)) return 0;
  if (quantity <= 0) return basePrice;

  const tiers = parseWholesaleTiers(listing);
  if (tiers.length === 0) return basePrice;

  // Find the matching tier
  // We look for a tier where quantity >= min AND (max is null OR quantity <= max)
  // Since we sorted by min, if there are overlapping ranges (which shouldn't happen with good validation),
  // this simple find might pick the first one. 
  // Ideally, we want the "best" price, but usually tiers imply volume discount.
  // Let's assume tiers are non-overlapping or at least consistent.
  
  const match = tiers.find(t => quantity >= t.min && (t.max === null || quantity <= t.max));
  
  if (match) {
    return match.price;
  }
  
  return basePrice;
}
