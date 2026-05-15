// Servicio de lógica de negocio para bids

import { BidsRepository } from '@/lib/repositories/bids.repository';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { Bid, Listing } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError } from '@/lib/utils/errors';
import { validateRequired, validateUUID } from '@/lib/utils/validation';
import { getUserAdminState, isRestricted } from '@/lib/userAdminState';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyAuctionLost } from '@/lib/email/notify';

export interface PlaceBidParams {
  listingId: string;
  bidderId: string;
  amount: number;
}

export class BidService {
  private notificationService?: NotificationService;

  constructor(
    private bidsRepo: BidsRepository,
    private listingsRepo: ListingsRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Colocar puja
   */
  async placeBid(params: PlaceBidParams): Promise<Bid> {
    const { listingId, bidderId, amount } = params;

    // Validaciones
    validateRequired(listingId, 'listingId');
    validateRequired(bidderId, 'bidderId');
    validateRequired(amount, 'amount');

    if (!validateUUID(listingId)) {
      throw new ValidationError('listingId debe ser un UUID válido');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('El monto debe ser mayor a 0');
    }

    // Validar estado del pujador
    const admin = supabaseAdmin();
    const bidderState = await getUserAdminState(admin, bidderId);
    if (isRestricted(bidderState)) {
      throw new ValidationError(
        bidderState?.status === 'banned'
          ? 'Tu cuenta está bloqueada. No puedes pujar.'
          : 'Tu cuenta está suspendida. No puedes pujar hasta que finalice la suspensión.'
      );
    }

    // Buscar listing
    const listing = await this.listingsRepo.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Publicación', listingId);
    }

    // Validar que es subasta activa
    if (listing.status !== 'active') {
      throw new ValidationError('La subasta no está activa');
    }

    if (listing.sale_type !== 'auction') {
      throw new ValidationError('Esta publicación no es subasta');
    }

    // Validar que el pujador no sea el vendedor (Anti-Autopuja)
    const sellerId = listing.seller_id;
    if (sellerId === bidderId) {
      throw new ValidationError('No puedes pujar en tu propia subasta.');
    }

    // Validar fechas
    const now = new Date();
    const startAt = listing.auction_start_at ? new Date(listing.auction_start_at) : null;
    const endAt = listing.auction_end_at ? new Date(listing.auction_end_at) : null;

    if (!startAt || !endAt) {
      throw new ValidationError('Subasta mal configurada (fechas)');
    }

    if (now.getTime() < startAt.getTime()) {
      throw new ValidationError('La subasta aún no inicia');
    }

    if (now.getTime() >= endAt.getTime()) {
      throw new ValidationError('La subasta ya terminó');
    }

    // Validar que no sea el mayor postor actual
    if (listing.auction_highest_bidder_id === bidderId) {
      throw new ValidationError('Ya eres el mayor postor. Espera a que alguien te supere para pujar de nuevo.');
    }

    // Validar monto mínimo
    const increment = listing.auction_bid_increment || 0;
    const currentHighest = listing.auction_highest_bid || 0;
    const minNext = currentHighest + Math.max(increment, 1);

    if (amount < minNext) {
      throw new ValidationError(`La puja mínima es ${minNext}`);
    }

    // Crear puja
    const bid = await this.bidsRepo.create({
      listing_id: listingId,
      bidder_id: bidderId,
      amount,
    });

    // Actualizar listing con nueva puja más alta
    await this.listingsRepo.update(listingId, {
      auction_highest_bid: amount,
      auction_highest_bidder_id: bidderId,
    });

    // Notificar al vendedor (best-effort)
    if (this.notificationService && listing.seller_id) {
      try {
        await this.notificationService.create({
          user_id: listing.seller_id,
          type: 'auction_bid_received',
          title: 'Nueva puja recibida',
          body: `Alguien pujó ${amount} en: ${listing.title || 'Tu subasta'}.`,
          link_to: `/dashboard/ventas?listing=${listingId}`,
          data: {
            listingId,
            amount,
            kind: 'auction_bid_received',
          },
        });
      } catch (notifyErr) {
        console.warn('[BidService] Error enviando notificación al vendedor:', notifyErr);
      }
    }

    // Notificar al pujador (best-effort)
    if (this.notificationService) {
      try {
        await this.notificationService.create({
          user_id: bidderId,
          type: 'bid_placed',
          title: 'Puja registrada',
          body: `Tu puja fue registrada en: ${listing.title || 'Subasta'}.`,
          link_to: `/listings/${listingId}`,
          data: {
            listingId,
            amount,
            kind: 'bid_placed',
          },
        });
      } catch (notifyErr) {
        console.warn('[BidService] Error enviando notificación al pujador:', notifyErr);
      }
    }

    // Notificar al anterior mayor postor si existe (best-effort)
    if (listing.auction_highest_bidder_id && listing.auction_highest_bidder_id !== bidderId) {
      if (this.notificationService) {
        try {
          await this.notificationService.create({
            user_id: listing.auction_highest_bidder_id,
            type: 'outbid',
            title: 'Te ganaron la puja',
            body: `Alguien superó tu oferta en: ${listing.title || 'Subasta'}.`,
            link_to: `/listings/${listingId}`,
            data: {
              listingId,
              newHighest: amount,
              kind: 'outbid',
            },
          });
        } catch (notifyErr) {
          console.warn('[BidService] Error enviando notificación al anterior postor:', notifyErr);
        }
      }

      // Email notification
      try {
        await notifyAuctionLost({
          bidderId: listing.auction_highest_bidder_id,
          listingTitle: listing.title || 'Subasta',
          listingId,
        });
      } catch (emailErr) {
        console.warn('[BidService] Error enviando email de subasta perdida:', emailErr);
      }
    }

    return bid;
  }

  /**
   * Obtener pujas de un listing
   */
  async getBidsByListingId(listingId: string, limit: number = 100): Promise<Bid[]> {
    validateRequired(listingId, 'listingId');
    if (!validateUUID(listingId)) {
      throw new ValidationError('listingId debe ser un UUID válido');
    }

    return this.bidsRepo.findByListingId(listingId, limit);
  }

  /**
   * Obtener pujas de un usuario
   */
  async getBidsByBidderId(bidderId: string, limit: number = 100): Promise<Bid[]> {
    validateRequired(bidderId, 'bidderId');
    if (!validateUUID(bidderId)) {
      throw new ValidationError('bidderId debe ser un UUID válido');
    }

    return this.bidsRepo.findByBidderId(bidderId, limit);
  }
}
