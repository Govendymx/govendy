import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateTemplateBlocks } from '@/lib/templates/validate';
import { blocksToPlainText } from '@/lib/templates/text';
import { listingPolicyHumanWarning, scanListingContentPolicy } from '@/lib/moderation/listingContentPolicy';
import { getUserAdminState, isRestricted } from '@/lib/userAdminState';
import { NEW_CATEGORIES_CONFIG } from '@/lib/categories';
import { getPlan } from '@/lib/plans/limits';
import { mergeFeatureFlags } from '@/lib/admin/feature-flags';

type Body = {
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  images: string[];
  status?: string;

  gender?: 'Mujer' | 'Hombre' | 'Unisex' | null;
  size?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  category?: string | null;
  free_shipping?: boolean;
  condition?: 'nuevo' | 'usado' | 'casi_nuevo' | null;
  stock?: number | null;
  color_variants?: string[] | null;
  size_variants?: string[] | null;

  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;

  shipping_by_seller?: boolean;
  shipping_price?: number;
  shipping_carrier?: string;
  shipping_subsidy?: number | null;
  allow_personal_delivery?: boolean;
  handling_days?: number | null;

  sale_type?: 'direct' | 'auction';
  is_featured?: boolean;
  featured_fee?: number;

  auction_start_at?: string | null;
  auction_end_at?: string | null;
  auction_starting_bid?: number;
  auction_bid_increment?: number;
  auction_highest_bid?: number;

  description_blocks?: unknown;
  description_blocks_meta?: unknown;
  tags?: string[];
  attributes?: Record<string, any>;
  subcategory?: string | null;
  wholesale_tiers?: any[] | null;
  product_type?: 'physical' | 'digital';
  digital_delivery_type?: string | null;
  digital_delivery_fields?: { label: string }[] | null;
};

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function numberOrZero(v: unknown) {
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

import { checkLimit } from '@/lib/plans/limits';

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const title = String(body.title ?? '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const images = Array.isArray(body.images) ? body.images.filter((x) => typeof x === 'string' && x.trim()) : [];
    const currency = String(body.currency ?? 'MXN').trim() || 'MXN';
    const saleType = (body.sale_type ?? 'direct') as 'direct' | 'auction';

    const price = numberOrZero(body.price);
    const auctionStartingBid = numberOrZero(body.auction_starting_bid);
    const auctionBidIncrement = numberOrZero(body.auction_bid_increment);

    if (title.length < 3) return NextResponse.json({ error: 'El título debe tener al menos 3 caracteres.' }, { status: 400 });
    if (images.length < 2) return NextResponse.json({ error: 'Sube mínimo 2 imágenes.' }, { status: 400 });
    if (images.length > 15) return NextResponse.json({ error: 'Máximo 15 imágenes.' }, { status: 400 });

    if (saleType === 'direct') {
      if (price <= 0) return NextResponse.json({ error: 'El precio debe ser mayor a 0.' }, { status: 400 });
    } else {
      if (!body.auction_start_at || !body.auction_end_at) {
        return NextResponse.json({ error: 'Faltan fechas de subasta.' }, { status: 400 });
      }
      if (auctionStartingBid <= 0) return NextResponse.json({ error: 'La puja inicial debe ser mayor a 0.' }, { status: 400 });
      if (auctionBidIncrement <= 0) return NextResponse.json({ error: 'El incremento de puja debe ser mayor a 0.' }, { status: 400 });
    }

    // Snapshot de bloques (plantillas) — validación estricta (si viene)
    let descriptionBlocks: any = null;
    if (Object.prototype.hasOwnProperty.call(body, 'description_blocks')) {
      if (body.description_blocks === null) {
        descriptionBlocks = null;
      } else {
        const v = validateTemplateBlocks(body.description_blocks, { maxBlocks: 80, allowImageSlots: false });
        if (!v.ok) {
          const err = 'error' in v ? v.error : 'Bloques inválidos';
          return NextResponse.json({ error: err }, { status: 400 });
        }
        descriptionBlocks = v.blocks as any;
      }
    }
    const blocksMeta = sanitizeBlocksMeta((body as any).description_blocks_meta);

    const requestedStatus = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const normalizedStatus = requestedStatus === 'draft' ? 'draft' : 'active';

    // Política anti-contacto / anti-links externos (solo al publicar en "active")
    const nextStatus = normalizedStatus;
    let moderationStatus: string | null = null;
    let moderationViolations: any[] = [];

    if (nextStatus === 'active') {
      const blocksText = Array.isArray(descriptionBlocks) ? blocksToPlainText(descriptionBlocks as any) : '';
      const scan = scanListingContentPolicy({ title, description, blocksText });
      if (!scan.ok) {
        // En lugar de bloquear (return 400), marcamos para revisión administrativa
        moderationStatus = 'review_needed';
        moderationViolations = scan.violations;
        // console.log(`Listing flagged for review: ${title}`);
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    // Validar token → usuario
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let admin: ReturnType<typeof supabaseAdmin> | null = null;
    try {
      admin = supabaseAdmin();
    } catch {
      admin = null;
    }

    const sellerId = userData.user.id;

    const productTypeForShipping = body.product_type === 'digital' ? 'digital' : 'physical';
    if (productTypeForShipping === 'physical' && admin) {
      const { data: ffRow } = await admin.from('app_settings').select('feature_flags').eq('id', 1).maybeSingle();
      if (!mergeFeatureFlags(ffRow?.feature_flags).gopocket_shipping && !Boolean(body.shipping_by_seller)) {
        return NextResponse.json(
          { error: 'Los envíos GoVendy están desactivados. Debes usar envío gestionado por vendedor.' },
          { status: 403 },
        );
      }
    }

    // Validate Plan Limits (Server-side enforcement)
    if (Boolean(body.is_featured)) {
      const clientToCheck = admin || supabase;
      const limitCheck = await checkLimit(clientToCheck, sellerId, 'featured');
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { error: `Has alcanzado tu límite de ${limitCheck.limit} destacados este mes.` },
          { status: 403 }
        );
      }
    }

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

    // Validate Restricted Categories (Official Stores Only)
    const subcategoryID = typeof body.subcategory === 'string' ? body.subcategory.trim() : null;
    if (subcategoryID) {
      let isRestrictedCategory = false;
      let restrictedLabel = '';

      for (const group of Object.values(NEW_CATEGORIES_CONFIG)) {
        for (const cat of group) {
          const found = cat.subcategories.find((s) => s.id === subcategoryID);
          if (found && found.restricted) {
            isRestrictedCategory = true;
            restrictedLabel = found.label;
            break;
          }
        }
        if (isRestrictedCategory) break;
      }

      if (isRestrictedCategory) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_official_store')
          .eq('id', sellerId)
          .single();

        if (!profile?.is_official_store) {
          return NextResponse.json(
            { error: `⛔ La venta de "${restrictedLabel}" está restringida exclusivamente a Tiendas Oficiales.` },
            { status: 403 }
          );
        }
      }
    }

    // Prepare Gender & Tags mapping for extended categories (Niños, Niñas, Hogar)
    let finalGender = body.gender ?? null;
    let extraTags: string[] = [];

    if (finalGender) {
      const validGenders = ['Mujer', 'Hombre', 'Unisex'];
      if (!validGenders.includes(finalGender)) {
        // If it's an extended gender (Niños, Niñas, Hogar), map to Unisex and add tag
        extraTags.push(`gender:${finalGender}`);
        finalGender = 'Unisex';
      }
    }

    // Merge tags from body with extra tags
    const incomingTags = Array.isArray(body.tags) ? body.tags : [];
    const finalTags = [...new Set([...incomingTags, ...extraTags])].filter(t => typeof t === 'string' && t.trim());

    // Establecer expiración inicial (30 días)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const finalAttributes = { ...(body.attributes || {}) };
    if (moderationStatus) {
      finalAttributes.moderation_status = moderationStatus;
      if (moderationViolations.length > 0) {
        finalAttributes.moderation_violations = moderationViolations;
      }
    }

    const payload: any = {
      seller_id: sellerId,
      title,
      description: description || null,
      price: saleType === 'direct' ? price : auctionStartingBid,
      currency,
      images,
      status: normalizedStatus,
      expires_at: expiresAt,

      gender: finalGender,
      size: body.size ?? null,
      color: typeof body.color === 'string' ? body.color.trim() : null,
      category: typeof body.category === 'string' ? body.category.trim() : null,
      free_shipping: Boolean((body as any).free_shipping),
      condition: (body as any).condition || null,
      stock: typeof body.stock === 'number' ? (body.stock > 0 ? body.stock : null) : null,
      color_variants: Array.isArray(body.color_variants) && body.color_variants.length > 0 && body.color_variants.length <= 12
        ? body.color_variants.filter((c: any) => typeof c === 'string' && c.trim()).map((c: string) => c.trim())
        : null,
      size_variants: Array.isArray(body.size_variants) && body.size_variants.length > 0 && body.size_variants.length <= 12
        ? body.size_variants.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
        : null,

      tags: finalTags.length > 0 ? finalTags : null,
      attributes: Object.keys(finalAttributes).length > 0 ? finalAttributes : null,
      subcategory: typeof body.subcategory === 'string' ? body.subcategory.trim() : null,

      weight_kg: numberOrZero(body.weight_kg) || 1.0,
      length_cm: numberOrZero(body.length_cm) || 10.0,
      width_cm: numberOrZero(body.width_cm) || 10.0,
      height_cm: numberOrZero(body.height_cm) || 10.0,

      shipping_by_seller: Boolean(body.shipping_by_seller),
      shipping_price: numberOrZero(body.shipping_price),
      shipping_carrier: typeof body.shipping_carrier === 'string' ? body.shipping_carrier.trim() : null,
      shipping_subsidy: numberOrZero(body.shipping_subsidy),
      allow_personal_delivery: Boolean(body.allow_personal_delivery),
      handling_days: numberOrZero(body.handling_days),

      sale_type: saleType,
      is_featured: Boolean(body.is_featured),
      featured_fee: numberOrZero(body.featured_fee),

      auction_start_at: body.auction_start_at ?? null,
      auction_end_at: body.auction_end_at ?? null,
      auction_starting_bid: saleType === 'auction' ? auctionStartingBid : 0,
      auction_bid_increment: saleType === 'auction' ? auctionBidIncrement : 0,
      auction_highest_bid: saleType === 'auction' ? numberOrZero(body.auction_highest_bid ?? auctionStartingBid) : 0,

      brand: typeof body.brand === 'string' ? body.brand.trim() : null,
      model: typeof body.model === 'string' ? body.model.trim() : null,
      wholesale_tiers: Array.isArray(body.wholesale_tiers) && body.wholesale_tiers.length > 0 ? body.wholesale_tiers : null,
      product_type: body.product_type === 'digital' ? 'digital' : 'physical',
      digital_delivery_type: body.product_type === 'digital' ? (typeof body.digital_delivery_type === 'string' ? body.digital_delivery_type : 'manual') : null,
      digital_delivery_fields: body.product_type === 'digital' && Array.isArray(body.digital_delivery_fields) ? body.digital_delivery_fields : null,
      youtube_url: typeof (body as any).youtube_url === 'string' && (body as any).youtube_url.trim() ? (body as any).youtube_url.trim() : null,
    };

    // Strip youtube_url for Basic plan users (server-side enforcement)
    const sellerPlan = await getPlan(admin || supabase, sellerId);
    if (sellerPlan === 'basic' && payload.youtube_url) {
      payload.youtube_url = null;
    }

    if (descriptionBlocks !== null) payload.description_blocks = descriptionBlocks;
    else if (Object.prototype.hasOwnProperty.call(body, 'description_blocks')) payload.description_blocks = null;
    if (blocksMeta) payload.description_blocks_meta = blocksMeta;

    // Intentar incluir lifecycle si existe; si no, reintentar sin esas columnas.
    const payloadWithLifecycle = {
      ...payload,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      view_count: 0,
    };

    let insert;
    if (admin) {
      insert = await admin.from('listings').insert([payloadWithLifecycle]).select('id').single();
    } else {
      const userScoped = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      insert = await userScoped.from('listings').insert([payloadWithLifecycle]).select('id').single();
    }
    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msg = String((insert.error as any)?.message || '');
      const low = msg.toLowerCase();

      // Lista de errores que sugieren problemas de columnas/schema
      if (code === '42703' || low.includes('does not exist') || low.includes('schema cache') || low.includes('column')) {
        console.warn('Listing create error (schema/column), retrying with fallback payload:', msg);

        // 1. Crear payload seguro eliminando columnas nuevas que podrían no existir aún
        const fallbackPayload = { ...payload };

        // Si el error menciona específicamente una columna, la quitamos
        if (low.includes('shipping_carrier')) delete fallbackPayload.shipping_carrier;
        if (low.includes('shipping_subsidy')) delete fallbackPayload.shipping_subsidy;
        if (low.includes('shipping_by_seller')) delete fallbackPayload.shipping_by_seller;
        if (low.includes('allow_personal_delivery')) delete fallbackPayload.allow_personal_delivery;

        // Intentar inserción con payload limpio
        if (admin) {
          insert = await admin.from('listings').insert([fallbackPayload]).select('id').single();
        } else {
          const userScoped = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          insert = await userScoped.from('listings').insert([fallbackPayload]).select('id').single();
        }
      }
    }

    // Fallback extra: si tu tabla aún no tiene ciertas columnas, reintentar sin esos campos.
    if (insert.error) {
      const code = String((insert.error as any)?.code || '');
      const msg = String((insert.error as any)?.message || '');
      const low = msg.toLowerCase();
      if (code === '42703' || low.includes('schema cache') || low.includes('column') || low.includes('does not exist')) {
        const fallback: any = { ...payload };
        // Borrar solo las columnas que causaron error
        if (low.includes('free_shipping')) delete fallback.free_shipping;
        if (low.includes('description_blocks')) delete fallback.description_blocks;
        if (low.includes('description_blocks_meta')) delete fallback.description_blocks_meta;
        if (low.includes('size_variants')) delete fallback.size_variants;
        if (low.includes('color_variants')) delete fallback.color_variants;
        if (low.includes('tags')) delete fallback.tags;
        if (low.includes('attributes')) delete fallback.attributes;
        if (low.includes('subcategory')) delete fallback.subcategory;
        if (low.includes('total_stock')) delete fallback.total_stock;
        if (low.includes('shipping_carrier')) delete fallback.shipping_carrier;
        if (low.includes('shipping_price')) delete fallback.shipping_price;
        if (low.includes('shipping_subsidy')) delete fallback.shipping_subsidy;
        if (low.includes('shipping_by_seller')) delete fallback.shipping_by_seller;
        if (low.includes('allow_personal_delivery')) delete fallback.allow_personal_delivery;
        if (low.includes('handling_days')) delete fallback.handling_days;
        if (low.includes('wholesale_tiers')) delete fallback.wholesale_tiers;

        if (admin) {
          insert = await admin.from('listings').insert([fallback]).select('id').single();
        } else {
          const userScoped = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          insert = await userScoped.from('listings').insert([fallback]).select('id').single();
        }
      }
    }

    const { data: listing, error: insertErr } = insert;
    if (insertErr) {
      const msg = String((insertErr as any)?.message || '');
      if (msg.toLowerCase().includes('row-level security')) {
        return NextResponse.json(
          {
            error:
              'RLS está bloqueando el insert incluso en server-side. Esto casi siempre significa que `SUPABASE_SERVICE_ROLE_KEY` es incorrecta (pegaste la anon key) o no reiniciaste el servidor.\n\n' +
              'Ve a Supabase: Settings → API → "service_role" (NO "anon") y pon esa key en `.env.local` como `SUPABASE_SERVICE_ROLE_KEY`, luego reinicia `npm run dev`.',
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: msg || 'No se pudo crear la publicación.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      id: (listing as any).id,
      warning: moderationStatus ? 'Tu publicación ha sido creada pero está bajo revisión por contenido detectado.' : undefined,
      moderation_status: moderationStatus
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error creating listing' }, { status: 500 });
  }
}

