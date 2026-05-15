// API Route refactorizada para colocar puja usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { BidsRepository } from '@/lib/repositories/bids.repository';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { BidService } from '@/lib/services/bids/bid.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  listingId: string;
  amount: number;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: bidderId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const listingId = String(body?.listingId || '').trim();
    const amount = Number(body?.amount ?? 0);

    // Inicializar servicios
    const bidsRepo = new BidsRepository();
    const listingsRepo = new ListingsRepository();
    const notificationsRepo = new NotificationsRepository();
    const bidService = new BidService(bidsRepo, listingsRepo, notificationsRepo);

    // Colocar puja
    const bid = await bidService.placeBid({
      listingId,
      bidderId,
      amount,
    });

    // Obtener listing actualizado
    const listing = await listingsRepo.findById(listingId);

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      bid,
      newHighest: listing?.auction_highest_bid || amount,
    });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
