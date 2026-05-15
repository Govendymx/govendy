import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ListingsRepository } from '@/lib/repositories/listings.repository';
import { getUserAdminState, isRestricted } from '@/lib/userAdminState';
import { mergeFeatureFlags } from '@/lib/admin/feature-flags';
import { CreateListingData, Listing } from '@/lib/types/domain.types';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function toNumber(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { listingId?: string };
    const listingId = String(body?.listingId || '').trim();
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
    const admin = supabaseAdmin();
    const repo = new ListingsRepository();

    const sellerState = await getUserAdminState(admin, sellerId);
    if (isRestricted(sellerState)) {
      return NextResponse.json(
        {
          error:
            sellerState?.status === 'banned'
              ? 'Tu cuenta está bloqueada. No puedes publicar.'
              : 'Tu cuenta está suspendida. No puedes publicar hasta que finalice la suspensión.',
        },
        { status: 403 },
      );
    }

    const original = await repo.findById(listingId);
    if (!original) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    if (String(original.seller_id) !== sellerId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const originalListing = original as Listing & { handling_days?: number | null };
    const saleType = String(original.sale_type || 'direct');

    // Clonar campos para la nueva publicación
    const payload: CreateListingData = {
      seller_id: sellerId,
      title: `${String(original.title || 'Artículo').trim()} (copia)`,
      description: original.description || null,
      currency: original.currency || 'MXN',
      price: toNumber(original.price),
      images: Array.isArray(original.images) ? (original.images as string[]).slice(0, 6) : [],
      status: 'draft',
      sale_type: original.sale_type,
      gender: original.gender || null,
      size: original.size || null,
      brand: original.brand || null,
      model: original.model || null,
      color: original.color || null,
      category: original.category || null,
      subcategory: original.subcategory || null,
      attributes: original.attributes || null,
      tags: original.tags || null,
      free_shipping: Boolean(original.free_shipping),
      shipping_subsidy: original.shipping_subsidy || 0,
      weight_kg: original.weight_kg || 1,
      length_cm: original.length_cm || 20,
      width_cm: original.width_cm || 20,
      height_cm: original.height_cm || 10,
      shipping_by_seller: Boolean(original.shipping_by_seller),
      allow_personal_delivery: Boolean(original.allow_personal_delivery),
      handling_days: originalListing.handling_days ?? 0,
      condition: original.condition || null,
      stock: typeof original.stock === 'number' ? original.stock : 1,
      color_variants: original.color_variants || null,
      size_variants: original.size_variants || null,
      description_blocks: original.description_blocks || null,
      description_blocks_meta: original.description_blocks_meta || null,
      is_featured: false, // Las copias no heredan "destacado" automáticamente
      featured_fee: 0,
    };

    const isDigitalClone = String((original as any).product_type || 'physical').toLowerCase() === 'digital';
    if (!isDigitalClone && !original.shipping_by_seller) {
      const { data: ffRow } = await admin.from('app_settings').select('feature_flags').eq('id', 1).maybeSingle();
      if (!mergeFeatureFlags(ffRow?.feature_flags).gopocket_shipping) {
        payload.shipping_by_seller = true;
      }
    }

    if (saleType === 'auction') {
      const starting = toNumber(original.auction_starting_bid) || toNumber(original.price) || 1;
      const inc = Math.max(1, toNumber(original.auction_bid_increment) || 10);

      payload.price = starting;
      payload.auction_starting_bid = starting;
      payload.auction_bid_increment = inc;
      // Las fechas de subasta se configuran al publicar el borrador
      payload.auction_start_at = null;
      payload.auction_end_at = null;
    }

    // Insertar usando el repositorio (maneja expires_at, view_count y fallbacks)
    const newListing = await repo.create({
      ...payload,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Renovamos vigencia
    } as any);

    return NextResponse.json({ ok: true, id: newListing.id });
  } catch (e: unknown) {
    console.error('[clone] Error:', e);
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

