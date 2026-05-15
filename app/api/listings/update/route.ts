import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateTemplateBlocks } from '@/lib/templates/validate';
import { blocksToPlainText } from '@/lib/templates/text';
import { listingPolicyHumanWarning, scanListingContentPolicy } from '@/lib/moderation/listingContentPolicy';
import { getUserAdminState, isRestricted, isSuspended } from '@/lib/userAdminState';
import { getPlan } from '@/lib/plans/limits';
import { mergeFeatureFlags } from '@/lib/admin/feature-flags';

type Body = {
  listingId: string;
  patch: Record<string, any>;
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

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const listingId = String(body.listingId ?? '').trim();
    const patch = (body.patch ?? {}) as Record<string, any>;
    if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const sellerId = userData.user.id;

    const { data: row, error: fetchErr } = await admin
      .from('listings')
      .select('id,seller_id,sale_type,status,price,auction_starting_bid,title,description,description_blocks,attributes,product_type')
      .eq('id', listingId)
      .maybeSingle();
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    if (!row) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    if (String((row as any).seller_id) !== sellerId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // --- Validar protección de subastas activas ---
    const currentSaleType = String((row as any).sale_type || 'direct');
    const currentStatus = String((row as any).status || '');
    if (currentSaleType === 'auction' && currentStatus === 'active') {
      if (patch.sale_type && patch.sale_type !== 'auction') {
        return NextResponse.json({ error: 'No puedes cambiar el tipo de venta de una subasta activa.' }, { status: 400 });
      }
      if (patch.status && patch.status !== 'active' && patch.status !== 'sold') {
        return NextResponse.json({ error: 'No puedes pausar una subasta activa.' }, { status: 400 });
      }
    }

    const sellerState = await getUserAdminState(admin, sellerId);
    if (isRestricted(sellerState)) {
      const goingActive = typeof patch?.status === 'string' && String(patch.status).toLowerCase() === 'active';
      if (sellerState?.status === 'banned') {
        return NextResponse.json({ error: 'Tu cuenta está bloqueada. No puedes modificar publicaciones.' }, { status: 403 });
      }
      if (isSuspended(sellerState) && goingActive) {
        return NextResponse.json(
          { error: 'Tu cuenta está suspendida. No puedes activar publicaciones hasta que finalice la suspensión.' },
          { status: 403 },
        );
      }
    }

    // Whitelist de campos editables (evitar cambios peligrosos)
    const allowed = new Set([
      'title',
      'description',
      'price',
      'images',
      'gender',
      'size',
      'brand',
      'model',
      'color',
      'category',
      'condition',
      'stock',
      'currency',
      'free_shipping',
      'description_blocks',
      'description_blocks_meta',
      'sale_type',
      'auction_start_at',
      'auction_end_at',
      'auction_starting_bid',
      'auction_bid_increment',
      'status',
      'is_featured',
      'featured_fee',
      'expires_at',
      'shipping_subsidy',
      'shipping_price',
      'shipping_carrier',
      'weight_kg',
      'length_cm',
      'width_cm',
      'height_cm',
      'shipping_by_seller',
      'allow_personal_delivery',
      'tags',
      'attributes',
      'subcategory',
      'wholesale_tiers',
      'product_type',
      'digital_delivery_type',
      'digital_delivery_fields',
      'handling_days',
      'youtube_url',
      'color_variants',
      'size_variants',
      'size_stock',
      'size_type',
    ]);

    const safePatch: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (allowed.has(k)) safePatch[k] = v;
    }

    // Strip youtube_url for Basic plan users (server-side enforcement)
    if (safePatch.youtube_url !== undefined) {
      const sellerPlan = await getPlan(admin, sellerId);
      if (sellerPlan === 'basic') {
        delete safePatch.youtube_url;
      }
    }

    // Sanitize Gender (map extended to Unisex)
    if (typeof safePatch.gender === 'string') {
      const validGenders = ['Mujer', 'Hombre', 'Unisex'];
      if (!validGenders.includes(safePatch.gender)) {
        // Add tag for original gender if tags allowed
        const original = safePatch.gender;
        safePatch.gender = 'Unisex';

        // If tags are in patch, append; else create new array if we can? 
        // We can't easily append to existing tags in DB without reading them first.
        // But we assume the client sends the FULL list of tags.
        if (Array.isArray(safePatch.tags)) {
          safePatch.tags.push(`gender:${original}`);
        } else {
          // If client didn't send tags, we might overwrite existing tags if we set it.
          // But we don't know existing tags.
          // Safe bet: just map gender to avoid crash. 
          // If client sends tags, we append.
        }
      }
    }

    if (typeof safePatch.title === 'string') safePatch.title = safePatch.title.trim();
    if (typeof safePatch.description === 'string') safePatch.description = safePatch.description.trim();
    if (typeof safePatch.color === 'string') safePatch.color = safePatch.color.trim();
    if (typeof safePatch.category === 'string') safePatch.category = safePatch.category.trim();
    if (Object.prototype.hasOwnProperty.call(safePatch, 'shipping_price')) {
      safePatch.shipping_price = numberOrZero(safePatch.shipping_price);
    }

    if (Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks')) {
      if (safePatch.description_blocks === null) {
        // allow unset
      } else {
        const v = validateTemplateBlocks(safePatch.description_blocks, { maxBlocks: 80, allowImageSlots: false });
        if (!v.ok) {
          const err = 'error' in v ? v.error : 'Bloques inválidos';
          return NextResponse.json({ error: err }, { status: 400 });
        }
        safePatch.description_blocks = v.blocks as any;
      }
    }
    if (Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks_meta')) {
      if (safePatch.description_blocks_meta === null) {
        // allow unset
      } else {
        const m = sanitizeBlocksMeta(safePatch.description_blocks_meta);
        safePatch.description_blocks_meta = m;
      }
    }

    if (Object.prototype.hasOwnProperty.call(safePatch, 'images')) {
      const arr = Array.isArray(safePatch.images) ? safePatch.images : [];
      const cleaned = arr
        .filter((x) => typeof x === 'string' && x.trim().length > 0)
        .map((x) => String(x).trim());

      if (cleaned.length < 2) {
        return NextResponse.json({ error: 'Sube mínimo 2 imágenes.' }, { status: 400 });
      }
      if (cleaned.length > 15) {
        return NextResponse.json({ error: 'Máximo 15 imágenes.' }, { status: 400 });
      }

      safePatch.images = cleaned;
    }

    // Si el vendedor está "publicando" un borrador, aplicamos validaciones extra
    const existing: any = row as any;
    const nextStatus = typeof safePatch.status === 'string' ? safePatch.status : String(existing.status || '');
    const nextSaleType = typeof safePatch.sale_type === 'string' ? safePatch.sale_type : String(existing.sale_type || 'direct');

    // REGLA CRÍTICA: Cada vez que una publicación se activa o se edita estando activa, renovamos su vida.
    // Esto evita que se pause si el usuario la está gestionando activamente.
    if (nextStatus === 'active') {
      if (nextSaleType === 'auction') {
        const endAtRaw = safePatch.auction_end_at !== undefined ? safePatch.auction_end_at : existing.auction_end_at;
        if (endAtRaw) {
          const d = new Date(endAtRaw);
          d.setHours(d.getHours() + 1);
          safePatch.expires_at = d.toISOString();
        } else {
          safePatch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
      } else {
        // Para venta directa, renovar 30 días
        safePatch.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      console.log(`[update] Listing ${listingId} is active/activated. Renewing expires_at to ${safePatch.expires_at}`);
    }

    let moderationStatus: string | null = null;
    let moderationViolations: any[] = [];

    // Política anti-contacto / anti-links externos:
    // - al pasar a active (publicar)
    // - o al editar contenido mientras está activo
    const isPublishingNow = String(existing.status || '') !== 'active' && nextStatus === 'active';
    const touchesContent =
      Object.prototype.hasOwnProperty.call(safePatch, 'title') ||
      Object.prototype.hasOwnProperty.call(safePatch, 'description') ||
      Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks');
    if (nextStatus === 'active' && (isPublishingNow || touchesContent)) {
      const nextTitle = typeof safePatch.title === 'string' ? String(safePatch.title) : String(existing.title || '');
      const nextDescription =
        typeof safePatch.description === 'string' ? String(safePatch.description) : existing.description ? String(existing.description) : null;
      const nextBlocks =
        Object.prototype.hasOwnProperty.call(safePatch, 'description_blocks') ? safePatch.description_blocks : existing.description_blocks;
      const blocksText = Array.isArray(nextBlocks) ? blocksToPlainText(nextBlocks as any) : '';
      const scan = scanListingContentPolicy({ title: nextTitle, description: nextDescription, blocksText });
      if (!scan.ok) {
        // En lugar de bloquear, marcamos para revisión administrativa (Non-blocking policy)
        moderationStatus = 'review_needed';
        moderationViolations = scan.violations;
      }
    }

    // Actualizar atributos si hay moderación
    if (moderationStatus) {
      // Necesitamos obtener los atributos actuales para preservarlos
      const currentAttrs = existing.attributes || {};
      const newAttrs = {
        ...currentAttrs,
        moderation_status: moderationStatus,
        moderation_violations: moderationViolations
      };
      safePatch.attributes = newAttrs;
    } else {
      // Si pasa la moderación (scan.ok) y antes tenía flag, ¿deberíamos limpiarlo?
      // Si el usuario editó para corregir, deberíamos limpiar el flag.
      // Si touchesContent es true y no hubo violaciones, limpiamos.
      if (touchesContent && existing.attributes?.moderation_status === 'review_needed') {
        const currentAttrs = { ...(existing.attributes || {}) };
        delete currentAttrs.moderation_status;
        delete currentAttrs.moderation_violations;
        safePatch.attributes = currentAttrs;
      }
    }

    // (Ya renovado arriba en la REGLA CRÍTICA)

    if (nextStatus === 'active') {
      const nextPrice = Object.prototype.hasOwnProperty.call(safePatch, 'price') ? numberOrZero(safePatch.price) : numberOrZero(existing.price);

      if (nextSaleType === 'direct') {
        if (nextPrice <= 0) return NextResponse.json({ error: 'El precio debe ser mayor a 0.' }, { status: 400 });
        // Limpieza de campos de subasta cuando se publica como venta directa
        safePatch.auction_start_at = null;
        safePatch.auction_end_at = null;
        safePatch.auction_starting_bid = 0;
        safePatch.auction_bid_increment = 0;
      } else if (nextSaleType === 'auction') {
        const startAt = String(safePatch.auction_start_at ?? '').trim();
        const endAt = String(safePatch.auction_end_at ?? '').trim();
        const startingBid = Object.prototype.hasOwnProperty.call(safePatch, 'auction_starting_bid')
          ? numberOrZero(safePatch.auction_starting_bid)
          : numberOrZero(existing.auction_starting_bid) || nextPrice;
        const inc = Object.prototype.hasOwnProperty.call(safePatch, 'auction_bid_increment') ? numberOrZero(safePatch.auction_bid_increment) : 0;

        if (!startAt || !endAt) return NextResponse.json({ error: 'Faltan fechas de subasta.' }, { status: 400 });
        if (startingBid <= 0) return NextResponse.json({ error: 'La puja inicial debe ser mayor a 0.' }, { status: 400 });
        if (inc <= 0) return NextResponse.json({ error: 'El incremento de puja debe ser mayor a 0.' }, { status: 400 });

        // Asegurar consistencia al publicar subasta (SOLO SI NO ESTABA ACTIVA)
        if (currentStatus !== 'active') {
          safePatch.price = startingBid;
          safePatch.auction_starting_bid = startingBid;
          safePatch.auction_highest_bid = startingBid;
          safePatch.auction_highest_bidder_id = null;
        } else {
          // Si ya está activa, solo permitimos actualizar campos informativos (descripción, envío, etc)
          // pero NO reseteamos la puja más alta ni el ganador
          // Tampoco cambiamos el precio base si ya hay pujas (idealmente)
          // Por ahora, confiamos en que el frontend valida, pero protegemos el reset
          delete safePatch.auction_highest_bid;
          delete safePatch.auction_highest_bidder_id;

          // Si intentan cambiar el precio inicial en una subasta activa con pujas, deberíamos bloquearlo?
          // Por ahora, simplemente evitamos el reset.
        }
      }
    }

    const existingProductType = String((existing as any).product_type || 'physical').toLowerCase();
    const effectiveProductType =
      typeof safePatch.product_type === 'string'
        ? String(safePatch.product_type).toLowerCase()
        : existingProductType;
    if (
      effectiveProductType !== 'digital' &&
      Object.prototype.hasOwnProperty.call(safePatch, 'shipping_by_seller') &&
      safePatch.shipping_by_seller === false
    ) {
      const { data: ffRow } = await admin.from('app_settings').select('feature_flags').eq('id', 1).maybeSingle();
      if (!mergeFeatureFlags(ffRow?.feature_flags).gopocket_shipping) {
        return NextResponse.json(
          { error: 'Los envíos GoVendy están desactivados. No puedes guardar envío integrado en esta publicación.' },
          { status: 403 },
        );
      }
    }

    let upd = await admin.from('listings').update(safePatch).eq('id', listingId);
    let updErr = upd.error;
    // Fallback si el esquema no tiene algunas columnas (muy raro, pero evita romper en migraciones incompletas)
    if (updErr) {
      const code = String((updErr as any)?.code || '');
      const msg = String((updErr as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column')) {
        const fallback: any = { ...safePatch };
        delete fallback.auction_highest_bid;
        delete fallback.auction_highest_bidder_id;
        delete fallback.free_shipping;
        delete fallback.description_blocks;
        delete fallback.description_blocks_meta;
        upd = await admin.from('listings').update(fallback).eq('id', listingId);
        updErr = upd.error;
      }
    }
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      warning: moderationStatus ? 'Tu publicación ha sido actualizada pero está bajo revisión por contenido detectado.' : undefined,
      moderation_status: moderationStatus
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

