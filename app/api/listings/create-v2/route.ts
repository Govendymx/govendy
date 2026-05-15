// API Route refactorizada para crear listing usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { ListingService } from '@/lib/services/listings/listing.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  images: string[];
  status?: string;
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
  sale_type?: 'direct' | 'auction';
  is_featured?: boolean;
  featured_fee?: number;
  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_starting_bid?: number;
  auction_bid_increment?: number;
  description_blocks?: unknown;
  description_blocks_meta?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: sellerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const {
      title,
      description,
      price,
      currency,
      images,
      status,
      gender,
      size,
      color,
      category,
      free_shipping,
      condition,
      stock,
      color_variants,
      size_variants,
      size_stock,
      size_type,
      sale_type,
      is_featured,
      featured_fee,
      auction_start_at,
      auction_end_at,
      auction_starting_bid,
      auction_bid_increment,
      description_blocks,
      description_blocks_meta,
    } = body;

    // Validar campos requeridos
    if (!title || !Array.isArray(images) || typeof price !== 'number') {
      return NextResponse.json({ error: 'title, images y price son requeridos' }, { status: 400 });
    }

    const requestedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
    const normalizedStatus = requestedStatus === 'draft' ? 'draft' : 'active';

    // Inicializar servicios
    const listingsRepo = new ListingsRepository();
    const listingService = new ListingService(listingsRepo);

    // Crear listing
    const listing = await listingService.createListing({
      sellerId,
      title,
      description,
      price,
      currency,
      images,
      status: normalizedStatus as any,
      gender,
      size,
      color,
      category,
      free_shipping,
      condition,
      stock,
      color_variants,
      size_variants,
      size_stock,
      size_type,
      sale_type,
      is_featured,
      featured_fee,
      auction_start_at,
      auction_end_at,
      auction_starting_bid,
      auction_bid_increment,
      description_blocks,
      description_blocks_meta,
    });

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      id: listing.id,
    });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
