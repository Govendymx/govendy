// Servicio de lógica de negocio para listings

import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { Listing, CreateListingData, UpdateListingData, ListingStatus, ListingSaleType } from '@/lib/types/domain.types';
import { ValidationError, ForbiddenError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { getUserAdminState, isRestricted } from '@/lib/userAdminState';
import { validateTemplateBlocks } from '@/lib/templates/validate';
import { scanListingContentPolicy, listingPolicyHumanWarning } from '@/lib/moderation/listingContentPolicy';
import { blocksToPlainText } from '@/lib/templates/text';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlan } from '@/lib/plans/limits';

function numberOrZero(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeBlocksMeta(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Record<string, any>;
  const out: Record<string, any> = {};
  const template_id = typeof o.template_id === 'string' ? o.template_id.trim() : '';
  const template_title = typeof o.template_title === 'string' ? o.template_title.trim() : '';
  const applied_at = typeof o.applied_at === 'string' ? o.applied_at.trim() : '';
  const applied_by = typeof o.applied_by === 'string' ? o.applied_by.trim() : '';
  if (template_id) out.template_id = template_id.slice(0, 80);
  if (template_title) out.template_title = template_title.slice(0, 140);
  if (applied_at) out.applied_at = applied_at.slice(0, 64);
  if (applied_by) out.applied_by = applied_by.slice(0, 80);
  return Object.keys(out).length ? out : null;
}

export interface CreateListingParams {
  sellerId: string;
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  images: string[];
  status?: ListingStatus;
  gender?: 'Mujer' | 'Hombre' | 'Unisex' | null;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  free_shipping?: boolean;
  condition?: 'nuevo' | 'usado' | 'casi_nuevo' | null;
  stock?: number | null;
  color_variants?: string[] | null;
  size_variants?: string[] | null;
  size_stock?: Record<string, number> | null;
  size_type?: 'clothing' | 'shoes' | null;
  sale_type?: ListingSaleType;
  is_featured?: boolean;
  featured_fee?: number;
  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_starting_bid?: number;
  auction_bid_increment?: number;
  description_blocks?: unknown;
  description_blocks_meta?: unknown;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  shipping_by_seller?: boolean;
  shipping_subsidy?: number | null;
  allow_personal_delivery?: boolean;
  handling_days?: number | null;
  shipping_price?: number | null;
}

export interface UpdateListingParams {
  listingId: string;
  sellerId: string;
  patch: Record<string, any>;
}

export class ListingService {
  constructor(private listingsRepo: ListingsRepository) { }

  /**
   * Crear listing
   */
  async createListing(params: CreateListingParams): Promise<Listing> {
    const {
      sellerId,
      title,
      description,
      price,
      currency = 'MXN',
      images,
      status = 'active',
      sale_type = 'direct',
      auction_starting_bid,
      auction_bid_increment,
      auction_start_at,
      auction_end_at,
      description_blocks,
      description_blocks_meta,
      ...rest
    } = params;

    // Validaciones básicas
    validateRequired(sellerId, 'sellerId');
    validateRequired(title, 'title');
    validateRequired(images, 'images');

    if (!validateUUID(sellerId)) {
      throw new ValidationError('sellerId debe ser un UUID válido');
    }

    if (title.length < 3) {
      throw new ValidationError('El título debe tener al menos 3 caracteres');
    }

    if (images.length < 2) {
      throw new ValidationError('Sube mínimo 2 imágenes');
    }

    if (images.length > 6) {
      throw new ValidationError('Máximo 6 imágenes');
    }

    // Validar estado del vendedor
    const admin = supabaseAdmin();
    const sellerState = await getUserAdminState(admin, sellerId);
    if (isRestricted(sellerState)) {
      throw new ForbiddenError(
        sellerState?.status === 'banned'
          ? 'Tu cuenta está bloqueada. No puedes publicar.'
          : 'Tu cuenta está suspendida. No puedes publicar hasta que finalice la suspensión.'
      );
    }

    const plan = await getPlan(admin, sellerId);
    const minCommission = plan === 'basic' ? 23 : 18;

    // Validar precio/subasta
    if (sale_type === 'direct') {
      if (price <= 0) {
        throw new ValidationError('El precio debe ser mayor a 0');
      }
    } else {
      if (!auction_start_at || !auction_end_at) {
        throw new ValidationError('Faltan fechas de subasta');
      }
      const startingBid = auction_starting_bid || price;
      const increment = auction_bid_increment || 0;
      if (startingBid <= 0) {
        throw new ValidationError('La puja inicial debe ser mayor a 0');
      }
      if (increment <= 0) {
        throw new ValidationError('El incremento de puja debe ser mayor a 0');
      }
    }

    const basePrice = sale_type === 'auction' ? (auction_starting_bid || price) : price;
    const freeShipping = Boolean(params.free_shipping);
    const allowPersonalDelivery = Boolean(params.allow_personal_delivery);
    const customShippingPrice = Number(params.shipping_price || 0);
    const shippingSubsidy = Number(params.shipping_subsidy || 0);
    const shippingRevenue = allowPersonalDelivery
      ? 0
      : freeShipping
        ? 0
        : Number.isFinite(customShippingPrice) && customShippingPrice > 0
          ? customShippingPrice
          : 0;

    const { data: coupons } = await admin
      .from('coupons')
      .select('discount_type, discount_value, starts_at, ends_at, is_active')
      .eq('seller_id', sellerId)
      .eq('is_active', true);

    const now = Date.now();
    let maxCouponDiscount = 0;
    for (const coupon of (coupons || [])) {
      const starts = coupon?.starts_at ? Date.parse(String(coupon.starts_at)) : null;
      const ends = coupon?.ends_at ? Date.parse(String(coupon.ends_at)) : null;
      if (starts && now < starts) continue;
      if (ends && now > ends) continue;
      const discountValue = Number(coupon?.discount_value || 0);
      if (discountValue <= 0) continue;
      const discount =
        coupon?.discount_type === 'percent'
          ? (basePrice * discountValue) / 100
          : discountValue;
      maxCouponDiscount = Math.max(maxCouponDiscount, Math.min(discount, basePrice));
    }

    const revenueAfterDiscounts = basePrice + shippingRevenue - shippingSubsidy - maxCouponDiscount;

    if (revenueAfterDiscounts <= minCommission) {
      throw new ValidationError(
        `El precio ${basePrice.toFixed(2)} es insuficiente. Después de envío, subsidios y descuentos no cubre la comisión mínima de $${minCommission}.`
      );
    }

    // Validar templates
    let validatedBlocks: any = null;
    if (description_blocks !== undefined) {
      if (description_blocks === null) {
        validatedBlocks = null;
      } else {
        const v = validateTemplateBlocks(description_blocks, { maxBlocks: 80, allowImageSlots: false });
        if (!v.ok) {
          const err = 'error' in v ? v.error : 'Error validando description_blocks';
          throw new ValidationError(err || 'Error validando description_blocks');
        }
        validatedBlocks = v.blocks;
      }
    }
    const blocksMeta = sanitizeBlocksMeta(description_blocks_meta);

    // Validar contenido (solo si se publica como active)
    if (status === 'active') {
      const blocksText = Array.isArray(validatedBlocks) ? blocksToPlainText(validatedBlocks) : '';
      const scan = scanListingContentPolicy({ title, description: description || null, blocksText });
      if (!scan.ok) {
        throw new ValidationError(listingPolicyHumanWarning(scan.violations));
      }
    }

    // Calcular expires_at inteligentemente
    const baseExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let finalExpiresAt = baseExpiresAt;

    if (sale_type === 'auction' && auction_end_at) {
      // Para subastas, expires_at debe ser al menos el auction_end_at + 1 hora de margen
      const end = new Date(auction_end_at);
      end.setHours(end.getHours() + 1);
      finalExpiresAt = end.toISOString();
    }

    const listingData: CreateListingData = {
      seller_id: sellerId,
      title: title.trim(),
      description: description || null,
      price: sale_type === 'direct' ? price : (auction_starting_bid || price),
      currency,
      images: images.filter((img) => typeof img === 'string' && img.trim()).map((img) => img.trim()),
      status,
      sale_type,
      expires_at: finalExpiresAt,
      auction_start_at: sale_type === 'auction' ? auction_start_at || null : null,
      auction_end_at: sale_type === 'auction' ? auction_end_at || null : null,
      auction_starting_bid: sale_type === 'auction' ? (auction_starting_bid || price) : 0,
      auction_bid_increment: sale_type === 'auction' ? (auction_bid_increment || 0) : 0,
      description_blocks: validatedBlocks,
      description_blocks_meta: blocksMeta,
      ...rest,
    };

    // Crear listing
    return this.listingsRepo.create(listingData);
  }

  /**
   * Actualizar listing
   */
  async updateListing(params: UpdateListingParams): Promise<Listing> {
    const { listingId, sellerId, patch } = params;

    // Validaciones básicas
    validateRequired(listingId, 'listingId');
    validateRequired(sellerId, 'sellerId');

    if (!validateUUID(listingId)) {
      throw new ValidationError('listingId debe ser un UUID válido');
    }

    // Buscar listing existente
    const existing = await this.listingsRepo.findById(listingId);
    if (!existing) {
      throw new ValidationError('Publicación no encontrada');
    }

    // Verificar autorización
    if (existing.seller_id !== sellerId) {
      throw new ForbiddenError('No autorizado');
    }

    // Validar estado del vendedor
    const admin = supabaseAdmin();
    const sellerState = await getUserAdminState(admin, sellerId);
    if (isRestricted(sellerState)) {
      const goingActive = typeof patch?.status === 'string' && String(patch.status).toLowerCase() === 'active';
      if (sellerState?.status === 'banned') {
        throw new ForbiddenError('Tu cuenta está bloqueada. No puedes modificar publicaciones.');
      }
      if (isRestricted(sellerState) && goingActive) {
        throw new ForbiddenError('Tu cuenta está suspendida. No puedes activar publicaciones hasta que finalice la suspensión.');
      }
    }

    // Whitelist de campos editables
    const allowed = new Set([
      'title',
      'description',
      'price',
      'images',
      'gender',
      'size',
      'color',
      'category',
      'brand',
      'model',
      'free_shipping',
      'stock',
      'color_variants',
      'size_variants',
      'size_stock',
      'size_type',
      'description_blocks',
      'description_blocks_meta',
      'weight_kg',
      'length_cm',
      'width_cm',
      'height_cm',
      'shipping_by_seller',
      'shipping_subsidy',
      'allow_personal_delivery',
      'handling_days',
      'sale_type',
      'auction_start_at',
      'auction_end_at',
      'auction_starting_bid',
      'auction_bid_increment',
      'status',
      'is_featured',
      'featured_fee',
      'expires_at',
    ]);

    const safePatch: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (allowed.has(k)) safePatch[k] = v;
    }

    // Limpiar strings
    if (typeof safePatch.title === 'string') safePatch.title = safePatch.title.trim();
    if (typeof safePatch.description === 'string') safePatch.description = safePatch.description.trim();
    if (typeof safePatch.color === 'string') safePatch.color = safePatch.color.trim();
    if (typeof safePatch.category === 'string') safePatch.category = safePatch.category.trim();

    // Validar templates
    if (Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks')) {
      if (safePatch.description_blocks === null) {
        // allow unset
      } else {
        const v = validateTemplateBlocks(safePatch.description_blocks, { maxBlocks: 80, allowImageSlots: false });
        if (!v.ok) {
          const err = 'error' in v ? v.error : 'Error validando description_blocks';
          throw new ValidationError(err || 'Error validando description_blocks');
        }
        safePatch.description_blocks = v.blocks;
      }
    }
    if (Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks_meta')) {
      if (safePatch.description_blocks_meta === null) {
        // allow unset
      } else {
        const m = sanitizeBlocksMeta(safePatch.description_blocks_meta);
        safePatch.description_blocks_meta = m;
      }
    }

    // Validar imágenes
    if (Object.prototype.hasOwnProperty.call(safePatch, 'images')) {
      const arr = Array.isArray(safePatch.images) ? safePatch.images : [];
      const cleaned = arr
        .filter((x) => typeof x === 'string' && x.trim().length > 0)
        .map((x) => String(x).trim());

      if (cleaned.length < 2) {
        throw new ValidationError('Sube mínimo 2 imágenes');
      }
      if (cleaned.length > 6) {
        throw new ValidationError('Máximo 6 imágenes');
      }

      safePatch.images = cleaned;
    }

    // Validar contenido si se publica o edita contenido activo
    const nextStatus = typeof safePatch.status === 'string' ? safePatch.status : String(existing.status || '');
    const nextSaleType = typeof safePatch.sale_type === 'string' ? safePatch.sale_type : String(existing.sale_type || 'direct');
    const isPublishingNow = String(existing.status || '') !== 'active' && nextStatus === 'active';
    const touchesContent =
      Object.prototype.hasOwnProperty.call(safePatch, 'title') ||
      Object.prototype.hasOwnProperty.call(safePatch, 'description') ||
      Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks');

    if (nextStatus === 'active' && (isPublishingNow || touchesContent)) {
      const nextTitle = typeof safePatch.title === 'string' ? String(safePatch.title) : String(existing.title || '');
      const nextDescription =
        typeof safePatch.description === 'string' ? String(safePatch.description) : existing.description ? String(existing.description) : null;
      const nextBlocks =
        Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks') ? safePatch.description_blocks : existing.description_blocks;
      const blocksText = Array.isArray(nextBlocks) ? blocksToPlainText(nextBlocks as any) : '';
      const scan = scanListingContentPolicy({ title: nextTitle, description: nextDescription, blocksText });
      if (!scan.ok) {
        throw new ValidationError(listingPolicyHumanWarning(scan.violations));
      }
    }

    // Validar precio/subasta si se publica
    if (nextStatus === 'active') {
      // Auto-refresh expiration if activating (fix activation revert bug)
      if (String(existing.status) !== 'active') {
        if (nextSaleType === 'auction') {
          const endAtRaw = safePatch.auction_end_at || existing.auction_end_at;
          if (endAtRaw) {
            const end = new Date(endAtRaw);
            end.setHours(end.getHours() + 1);
            safePatch.expires_at = end.toISOString();
          } else {
            safePatch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }
        } else {
          safePatch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      const nextPrice = Object.prototype.hasOwnProperty.call(safePatch, 'price') ? numberOrZero(safePatch.price) : numberOrZero(existing.price);

      if (nextSaleType === 'direct') {
        if (nextPrice <= 0) {
          throw new ValidationError('El precio debe ser mayor a 0');
        }
        safePatch.auction_start_at = null;
        safePatch.auction_end_at = null;
        safePatch.auction_starting_bid = 0;
        safePatch.auction_bid_increment = 0;
      } else if (nextSaleType === 'auction') {
        const startAt = String(safePatch.auction_start_at ?? '').trim();
        const endAt = String(safePatch.auction_end_at ?? '').trim();
        const startingBid = Object.prototype.hasOwnProperty.call(safePatch, 'auction_starting_bid')
          ? numberOrZero(safePatch.auction_starting_bid)
          : numberOrZero(existing.auction_starting_bid) || nextPrice;
        const inc = Object.prototype.hasOwnProperty.call(safePatch, 'auction_bid_increment') ? numberOrZero(safePatch.auction_bid_increment) : 0;

        if (!startAt || !endAt) {
          throw new ValidationError('Faltan fechas de subasta');
        }
        if (startingBid <= 0) {
          throw new ValidationError('La puja inicial debe ser mayor a 0');
        }
        if (inc <= 0) {
          throw new ValidationError('El incremento de puja debe ser mayor a 0');
        }

        safePatch.price = startingBid;
        safePatch.auction_starting_bid = startingBid;
        safePatch.auction_highest_bid = startingBid;
        safePatch.auction_highest_bidder_id = null;
      }
    }

    // Actualizar
    return this.listingsRepo.update(listingId, safePatch as UpdateListingData);
  }
}
