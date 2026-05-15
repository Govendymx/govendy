// Repository para acceso a datos de listings

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Listing, CreateListingData, UpdateListingData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class ListingsRepository {
  /**
   * Crear listing
   */
  async create(data: CreateListingData): Promise<Listing> {
    const admin = supabaseAdmin();

    // Preparar payload base
    const payload: any = {
      seller_id: data.seller_id,
      title: data.title.trim(),
      description: data.description || null,
      price: data.price,
      currency: data.currency || 'MXN',
      images: data.images,
      status: data.status || 'active',
      sale_type: data.sale_type || 'direct',
    };

    // Campos opcionales
    if (data.gender !== undefined) payload.gender = data.gender;
    if (data.size !== undefined) payload.size = data.size;
    if (data.color !== undefined) payload.color = data.color;
    if (data.category !== undefined) payload.category = data.category;
    if (data.free_shipping !== undefined) payload.free_shipping = data.free_shipping;
    if (data.condition !== undefined) payload.condition = data.condition;
    if (data.stock !== undefined) payload.stock = data.stock;
    if (data.brand !== undefined) payload.brand = data.brand;
    if (data.model !== undefined) payload.model = data.model;
    if (data.color_variants !== undefined) payload.color_variants = data.color_variants;
    if (data.size_variants !== undefined) payload.size_variants = data.size_variants;
    if (data.size_stock !== undefined) payload.size_stock = data.size_stock;
    if (data.size_type !== undefined) payload.size_type = data.size_type;
    if (data.is_featured !== undefined) payload.is_featured = data.is_featured;
    if (data.featured_fee !== undefined) payload.featured_fee = data.featured_fee;
    if (data.description_blocks !== undefined) payload.description_blocks = data.description_blocks;
    if (data.description_blocks_meta !== undefined) payload.description_blocks_meta = data.description_blocks_meta;
    if (data.shipping_by_seller !== undefined) payload.shipping_by_seller = data.shipping_by_seller;
    if (data.shipping_price !== undefined) payload.shipping_price = data.shipping_price;
    if (data.shipping_carrier !== undefined) payload.shipping_carrier = data.shipping_carrier;
    if (data.shipping_subsidy !== undefined) payload.shipping_subsidy = data.shipping_subsidy;
    if (data.allow_personal_delivery !== undefined) payload.allow_personal_delivery = data.allow_personal_delivery;

    // Campos de subasta
    if (data.sale_type === 'auction') {
      payload.auction_start_at = data.auction_start_at || null;
      payload.auction_end_at = data.auction_end_at || null;
      payload.auction_starting_bid = data.auction_starting_bid || data.price;
      payload.auction_bid_increment = data.auction_bid_increment || 0;
      payload.auction_highest_bid = data.auction_starting_bid || data.price;
    } else {
      payload.auction_start_at = null;
      payload.auction_end_at = null;
      payload.auction_starting_bid = 0;
      payload.auction_bid_increment = 0;
      payload.auction_highest_bid = 0;
    }

    // Intentar insertar con lifecycle (expires_at, view_count)
    const payloadWithLifecycle = {
      ...payload,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      view_count: 0,
    };

    let insert = await admin.from('listings').insert([payloadWithLifecycle]).select('id').single();

    // Fallback si faltan columnas de lifecycle
    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msg = String((insert.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column')) {
        insert = await admin.from('listings').insert([payload]).select('id').single();
      }
    }

    // Fallback extra si faltan otras columnas
    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msg = String((insert.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('schema cache') || msg.includes('column') || msg.includes('does not exist')) {
        const fallback: any = { ...payload };
        // Solo borrar si el mensaje de error menciona explícitamente la columna
        if (msg.includes('free_shipping')) delete fallback.free_shipping;
        if (msg.includes('description_blocks')) delete fallback.description_blocks;
        if (msg.includes('description_blocks_meta')) delete fallback.description_blocks_meta;
        if (msg.includes('size_variants')) delete fallback.size_variants;
        if (msg.includes('color_variants')) delete fallback.color_variants;
        if (msg.includes('size_stock')) delete fallback.size_stock;
        if (msg.includes('size_type')) delete fallback.size_type;
        if (msg.includes('shipping_by_seller')) delete fallback.shipping_by_seller;
        if (msg.includes('shipping_carrier')) delete fallback.shipping_carrier;
        if (msg.includes('shipping_price')) delete fallback.shipping_price;
        if (msg.includes('shipping_subsidy')) delete fallback.shipping_subsidy;
        if (msg.includes('allow_personal_delivery')) delete fallback.allow_personal_delivery;
        if (msg.includes('handling_days')) delete fallback.handling_days;
        if (msg.includes('weight_kg')) delete fallback.weight_kg;
        if (msg.includes('is_featured')) delete fallback.is_featured;
        if (msg.includes('total_stock')) delete fallback.total_stock;

        insert = await admin.from('listings').insert([fallback]).select('id').single();
      }
    }

    if (insert.error) {
      const msg = String((insert.error as any)?.message || '');
      if (msg.toLowerCase().includes('row-level security')) {
        throw new Error(
          'RLS está bloqueando el insert. Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurada correctamente.'
        );
      }
      throw new Error(`Error creando listing: ${insert.error.message}`);
    }

    // Obtener el listing completo
    const listing = await this.findById((insert.data as any).id);
    if (!listing) {
      throw new Error('Error: Listing creado pero no se pudo recuperar');
    }

    return listing;
  }

  /**
   * Buscar listing por ID
   */
  async findById(id: string): Promise<Listing | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando listing: ${error.message}`);
    }

    return data as Listing | null;
  }

  /**
   * Buscar listings por seller_id
   */
  async findBySellerId(sellerId: string, limit: number = 200): Promise<Listing[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('listings')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando listings: ${error.message}`);
    }

    return (data || []) as Listing[];
  }

  /**
   * Actualizar listing
   */
  async update(id: string, data: UpdateListingData): Promise<Listing> {
    const admin = supabaseAdmin();

    // Preparar payload
    const payload: any = {};
    if (data.title !== undefined) payload.title = data.title.trim();
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.price !== undefined) payload.price = data.price;
    if (data.images !== undefined) payload.images = data.images;
    if (data.status !== undefined) payload.status = data.status;
    if (data.gender !== undefined) payload.gender = data.gender;
    if (data.size !== undefined) payload.size = data.size;
    if (data.color !== undefined) payload.color = data.color;
    if (data.category !== undefined) payload.category = data.category;
    if (data.free_shipping !== undefined) payload.free_shipping = data.free_shipping;
    if (data.condition !== undefined) payload.condition = data.condition;
    if (data.stock !== undefined) payload.stock = data.stock;
    if (data.color_variants !== undefined) payload.color_variants = data.color_variants;
    if (data.size_variants !== undefined) payload.size_variants = data.size_variants;
    if (data.size_stock !== undefined) payload.size_stock = data.size_stock;
    if (data.size_type !== undefined) payload.size_type = data.size_type;
    if (data.sale_type !== undefined) payload.sale_type = data.sale_type;
    if (data.is_featured !== undefined) payload.is_featured = data.is_featured;
    if (data.featured_fee !== undefined) payload.featured_fee = data.featured_fee;
    if (data.description_blocks !== undefined) payload.description_blocks = data.description_blocks;
    if (data.description_blocks_meta !== undefined) payload.description_blocks_meta = data.description_blocks_meta;
    if (data.auction_start_at !== undefined) payload.auction_start_at = data.auction_start_at;
    if (data.auction_end_at !== undefined) payload.auction_end_at = data.auction_end_at;
    if (data.auction_starting_bid !== undefined) payload.auction_starting_bid = data.auction_starting_bid;
    if (data.auction_bid_increment !== undefined) payload.auction_bid_increment = data.auction_bid_increment;
    if (data.weight_kg !== undefined) payload.weight_kg = data.weight_kg;
    if (data.length_cm !== undefined) payload.length_cm = data.length_cm;
    if (data.width_cm !== undefined) payload.width_cm = data.width_cm;
    if (data.height_cm !== undefined) payload.height_cm = data.height_cm;
    if (data.shipping_by_seller !== undefined) payload.shipping_by_seller = data.shipping_by_seller;
    if (data.shipping_subsidy !== undefined) payload.shipping_subsidy = data.shipping_subsidy;
    if (data.allow_personal_delivery !== undefined) payload.allow_personal_delivery = data.allow_personal_delivery;
    if (data.handling_days !== undefined) payload.handling_days = data.handling_days;
    if (data.expires_at !== undefined) payload.expires_at = data.expires_at;
    if (data.is_deleted !== undefined) payload.is_deleted = data.is_deleted;
    if (data.deleted_at !== undefined) payload.deleted_at = data.deleted_at;
    if (data.deleted_reason !== undefined) payload.deleted_reason = data.deleted_reason;

    let update = await admin.from('listings').update(payload).eq('id', id).select().single();

    // Fallback si faltan columnas
    if (update.error) {
      const code = String((update.error as any)?.code || '');
      const msg = String((update.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column')) {
        const fallback: any = { ...payload };
        // Solo borrar si el mensaje de error menciona explícitamente la columna
        if (msg.includes('auction_highest_bid')) delete fallback.auction_highest_bid;
        if (msg.includes('auction_highest_bidder_id')) delete fallback.auction_highest_bidder_id;
        if (msg.includes('free_shipping')) delete fallback.free_shipping;
        if (msg.includes('description_blocks')) delete fallback.description_blocks;
        if (msg.includes('description_blocks_meta')) delete fallback.description_blocks_meta;
        if (msg.includes('size_stock')) delete fallback.size_stock;
        if (msg.includes('size_type')) delete fallback.size_type;
        if (msg.includes('total_stock')) delete fallback.total_stock;
        if (msg.includes('shipping_carrier')) delete fallback.shipping_carrier;
        if (msg.includes('shipping_price')) delete fallback.shipping_price;
        if (msg.includes('shipping_subsidy')) delete fallback.shipping_subsidy;
        if (msg.includes('shipping_by_seller')) delete fallback.shipping_by_seller;
        if (msg.includes('allow_personal_delivery')) delete fallback.allow_personal_delivery;
        if (msg.includes('handling_days')) delete fallback.handling_days;
        if (msg.includes('expires_at')) delete fallback.expires_at;
        if (msg.includes('view_count')) delete fallback.view_count;
        if (msg.includes('is_deleted')) delete fallback.is_deleted;
        if (msg.includes('deleted_at')) delete fallback.deleted_at;
        if (msg.includes('deleted_reason')) delete fallback.deleted_reason;

        update = await admin.from('listings').update(fallback).eq('id', id).select().single();
      }
    }

    if (update.error) {
      throw new Error(`Error actualizando listing: ${update.error.message}`);
    }

    if (!update.data) {
      throw new NotFoundError('Listing', id);
    }

    return update.data as Listing;
  }
}
