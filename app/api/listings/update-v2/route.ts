// API Route refactorizada para actualizar listing usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { ListingService } from '@/lib/services/listings/listing.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  listingId: string;
  patch: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: sellerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const listingId = String(body?.listingId || '').trim();
    const patch = (body?.patch ?? {}) as Record<string, any>;

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    }

    // Inicializar servicios
    const listingsRepo = new ListingsRepository();
    const listingService = new ListingService(listingsRepo);

    // Actualizar listing
    await listingService.updateListing({
      listingId,
      sellerId,
      patch,
    });

    // Respuesta exitosa
    return NextResponse.json({ ok: true });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
