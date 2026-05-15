import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
import { getUserAdminState, isRestricted } from '@/lib/userAdminState';

type Body = {
  listingId: string;
  amount: number;
};

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const { listingId, amount } = (await req.json()) as Body;
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    // Autenticar usuario con el token del cliente
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();

    const bidderState = await getUserAdminState(admin, userData.user.id);
    if (isRestricted(bidderState)) {
      return NextResponse.json(
        {
          error:
            bidderState?.status === 'banned'
              ? 'Tu cuenta está bloqueada. No puedes pujar.'
              : 'Tu cuenta está suspendida. No puedes pujar hasta que finalice la suspensión.',
        },
        { status: 403 },
      );
    }

    // Leer el listing (service role) y validar subasta
    const { data: l, error: lErr } = await admin
      .from('listings')
      .select(
        'id,seller_id,status,sale_type,auction_start_at,auction_end_at,auction_bid_increment,auction_highest_bid,auction_highest_bidder_id,title',
      )
      .eq('id', listingId)
      .maybeSingle();
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });
    if (!l) return NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 });

    const listing: any = l;
    if (listing.status !== 'active') return NextResponse.json({ error: 'La subasta no está activa.' }, { status: 400 });
    if (listing.sale_type !== 'auction') return NextResponse.json({ error: 'Esta publicación no es subasta.' }, { status: 400 });

    const now = new Date();
    const startAt = listing.auction_start_at ? new Date(listing.auction_start_at) : null;
    const endAt = listing.auction_end_at ? new Date(listing.auction_end_at) : null;
    if (!startAt || !endAt) return NextResponse.json({ error: 'Subasta mal configurada (fechas).' }, { status: 400 });
    if (now.getTime() < startAt.getTime()) return NextResponse.json({ error: 'La subasta aún no inicia.' }, { status: 400 });
    if (now.getTime() >= endAt.getTime()) return NextResponse.json({ error: 'La subasta ya terminó.' }, { status: 400 });

    // Regla: no puedes pujar dos veces seguidas => no puedes pujar si ya eres el mayor postor
    const currentHighestBidderId = (listing.auction_highest_bidder_id as string | null) ?? null;
    if (currentHighestBidderId && currentHighestBidderId === userData.user.id) {
      return NextResponse.json({ error: 'Ya eres el mayor postor. Espera a que alguien te supere para pujar de nuevo.' }, { status: 400 });
    }

    const inc = Number(listing.auction_bid_increment ?? 0);
    const currentHighest = Number(listing.auction_highest_bid ?? 0);
    const minNext = currentHighest + Math.max(inc, 1);
    if (Number(amount) < minNext) {
      return NextResponse.json({ error: `La puja mínima es ${minNext}.` }, { status: 400 });
    }

    // Insertar puja
    const { data: bidRow, error: bidErr } = await admin
      .from('bids')
      .insert([{ listing_id: listingId, bidder_id: userData.user.id, amount: Number(amount) }])
      .select('id,amount,created_at')
      .single();
    if (bidErr) return NextResponse.json({ error: bidErr.message }, { status: 500 });

    // Actualizar high bid + notificar al anterior (si existe)
    const prevBidder = currentHighestBidderId;
    const { error: updErr } = await admin
      .from('listings')
      .update({ auction_highest_bid: Number(amount), auction_highest_bidder_id: userData.user.id })
      .eq('id', listingId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    // Notificar al vendedor que recibió una puja (best-effort)
    try {
      const sellerId = String(listing.seller_id || '').trim();
      if (sellerId) {
        await insertNotificationBestEffort(admin, {
          user_id: sellerId,
          type: 'auction_bid_received',
          title: 'Nueva puja recibida',
          body: `Alguien pujó ${Number(amount)} en: ${(listing.title as string) || 'Tu subasta'}.`,
          data: { listingId, amount: Number(amount) },
          is_read: false,
        });
      }
    } catch {
      // noop
    }

    // Notificar al postor que su puja fue registrada (best-effort)
    try {
      await insertNotificationBestEffort(admin, {
        user_id: userData.user.id,
        type: 'bid_placed',
        title: 'Puja registrada',
        body: `Tu puja fue registrada en: ${(listing.title as string) || 'Subasta'}.`,
        data: { listingId, amount: Number(amount) },
        is_read: false,
      });
    } catch {
      // noop
    }

    if (prevBidder && prevBidder !== userData.user.id) {
      await insertNotificationBestEffort(admin, {
        user_id: prevBidder,
        type: 'outbid',
        title: 'Te ganaron la puja',
        body: `Alguien superó tu oferta en: ${(listing.title as string) || 'Subasta'}.`,
        data: { listingId, newHighest: Number(amount) },
        is_read: false,
      });
    }

    return NextResponse.json({
      ok: true,
      bid: bidRow,
      newHighest: Number(amount),
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error placing bid' }, { status: 500 });
  }
}

