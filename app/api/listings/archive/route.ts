import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ListingsRepository } from '@/lib/repositories/listings.repository';

type Body = {
  listingId: string;
  reason?: string | null;
};

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const listingId = String(body.listingId ?? '').trim();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null;
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Auth check
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sellerId = userData.user.id;
    const repo = new ListingsRepository();

    // Permissions check
    const listing = await repo.findById(listingId);
    if (!listing) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    if (String(listing.seller_id) !== sellerId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (Boolean(listing.is_deleted)) return NextResponse.json({ ok: true, already: true });

    // Rules check
    const saleType = String(listing.sale_type || 'direct');
    if (saleType === 'auction') {
      const endAt = listing.auction_end_at ? Date.parse(listing.auction_end_at) : NaN;
      if (!Number.isFinite(endAt) || Date.now() < endAt) {
        return NextResponse.json({ error: 'No puedes eliminar una subasta hasta que finalice.' }, { status: 400 });
      }
    }

    // Borrado lógico: NO borramos la fila, solo archivamos.
    const patch: any = {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_reason: reason || 'seller_archived',
      status: 'paused',
    };

    // Update with Repository (includes fallbacks)
    await repo.update(listingId, patch);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[archive] Error:', e);
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


