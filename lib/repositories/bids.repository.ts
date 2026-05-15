// Repository para acceso a datos de bids

import { supabaseAdmin } from '@/lib/supabase/admin';
import { Bid, CreateBidData } from '@/lib/types/domain.types';

export class BidsRepository {
  /**
   * Crear puja
   */
  async create(data: CreateBidData): Promise<Bid> {
    const admin = supabaseAdmin();
    const { data: bid, error } = await admin
      .from('bids')
      .insert([{
        listing_id: data.listing_id,
        bidder_id: data.bidder_id,
        amount: data.amount,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando puja: ${error.message}`);
    }

    return bid as Bid;
  }

  /**
   * Buscar pujas por listing_id
   */
  async findByListingId(listingId: string, limit: number = 100): Promise<Bid[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('bids')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando pujas: ${error.message}`);
    }

    return (data || []) as Bid[];
  }

  /**
   * Buscar pujas por bidder_id
   */
  async findByBidderId(bidderId: string, limit: number = 100): Promise<Bid[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('bids')
      .select('*')
      .eq('bidder_id', bidderId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando pujas: ${error.message}`);
    }

    return (data || []) as Bid[];
  }
}
