import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/listings/[id]
 * Obtiene una publicación por ID usando service role (bypass RLS).
 * Devuelve solo publicaciones activas al público; el vendedor puede ver las propias en cualquier estado.
 * 
 * IMPORTANT: Uses select('*') to automatically include ALL columns.
 * DO NOT use explicit column lists — adding a column that doesn't exist in the DB
 * causes a silent fallback that breaks stock, shipping, attributes, and more.
 */

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params;
    const rawId = String(params?.id ?? '').trim();

    if (!rawId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Si es public_id (ej: PCK-XXX), resolver a UUID primero
    let listingId = rawId;
    if (!isUuid(rawId)) {
      const admin = supabaseAdmin();
      const { data: resolved } = await admin
        .from('listings')
        .select('id')
        .eq('public_id', rawId)
        .maybeSingle();
      if (!resolved?.id) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
      listingId = String(resolved.id);
    }

    const admin = supabaseAdmin();

    // Obtener Authorization header para verificar si es el vendedor (puede ver draft/paused/etc)
    const authHeader = req.headers.get('authorization');
    let viewerId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseAnon) {
          const client = createClient(supabaseUrl, supabaseAnon);
          const { data: { user } } = await client.auth.getUser(authHeader.slice(7));
          viewerId = user?.id ?? null;
        }
      } catch {
        // Ignorar errores de auth; seguir como anónimo
      }
    }

    // Use select('*') to always return ALL columns — never use explicit column lists
    // to avoid silent fallback when a column doesn't exist yet.
    const res = await admin
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();

    if (res?.error) {
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    const row = res?.data;
    if (!row) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });

    const status = String(row.status ?? '').toLowerCase();
    const sellerId = String(row.seller_id ?? '');

    // Público solo puede ver activas; el vendedor puede ver las propias
    const isOwner = viewerId && sellerId && viewerId === sellerId;
    if (status !== 'active' && !isOwner) {
      return NextResponse.json(
        { error: `Publicación en estado "${status}". Solo visible para el vendedor.` },
        { status: 403 }
      );
    }

    // Joinear con profiles para datos del vendedor
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name,city,state,zip_code,store_logo_url,plan_type,is_official_store,official_store_name,official_store_banner_url,official_store_brand_color,is_verified,is_wholesaler,is_manufacturer,rating_total_count,rating_good_count,reputation_score,manual_reputation_score,manual_sales_count')
      .eq('id', sellerId)
      .maybeSingle();

    const listing = {
      ...row,
      seller: profile ?? undefined,
    };

    // Cache for public viewers; owners bypass this with auth headers which Vercel keys separately
    const cacheHeader = viewerId ? 'no-store, no-cache' : 'public, s-maxage=60, stale-while-revalidate=120';
    return NextResponse.json(listing, {
      headers: {
        'Cache-Control': cacheHeader,
      },
    });
  } catch (e: unknown) {
    console.error('[api/listings/[id]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al cargar la publicación' },
      { status: 500 }
    );
  }
}
