import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Body = {
  code: string;
  cartItems: Array<{ listingId: string; quantity: number }>;
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

    const { code, cartItems } = (await req.json()) as Body;
    const couponCode = (code || '').trim().toUpperCase();
    if (!couponCode) return NextResponse.json({ error: 'code is required' }, { status: 400 });
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: 'cartItems is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    // Auth del usuario (solo para evitar abuso y tener buyer_id si luego registramos redenciones)
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let admin: ReturnType<typeof supabaseAdmin>;
    try {
      admin = supabaseAdmin();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo inicializar el cliente admin de Supabase.';
      return NextResponse.json(
        {
          error:
            msg +
            '\n\nPara cupones (server-side) necesitas configurar `SUPABASE_SERVICE_ROLE_KEY` en tu `.env.local` y reiniciar `npm run dev`.',
        },
        { status: 500 },
      );
    }

    const { data: couponRow, error: cErr } = await admin
      .from('coupons')
      .select('id,code,discount_type,discount_value,starts_at,ends_at,is_active')
      .eq('code', couponCode)
      .eq('is_active', true)
      .maybeSingle();

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
    if (!couponRow) return NextResponse.json({ error: 'Cupón inválido o inactivo.' }, { status: 400 });

    const now = Date.now();
    const starts = (couponRow as any).starts_at ? Date.parse((couponRow as any).starts_at) : null;
    const ends = (couponRow as any).ends_at ? Date.parse((couponRow as any).ends_at) : null;
    if (starts && now < starts) return NextResponse.json({ error: 'Este cupón aún no inicia.' }, { status: 400 });
    if (ends && now > ends) return NextResponse.json({ error: 'Este cupón ya expiró.' }, { status: 400 });

    const couponId = (couponRow as any).id as string;
    const { data: links, error: linkErr } = await admin.from('coupon_listings').select('listing_id').eq('coupon_id', couponId);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });
    const eligibleIds = new Set(((links as any[]) ?? []).map((x) => x.listing_id).filter(Boolean));
    if (eligibleIds.size === 0) return NextResponse.json({ error: 'Este cupón no tiene publicaciones asociadas.' }, { status: 400 });

    const ids = Array.from(new Set(cartItems.map((c) => c.listingId).filter(Boolean)));
    if (ids.length === 0) return NextResponse.json({ error: 'Carrito inválido.' }, { status: 400 });

    // Traer precios reales del server (no confiar en el cliente)
    // Nota: algunas BDs antiguas usan `user_id` en vez de `seller_id`, por eso hay fallback.
    let listings: any[] = [];
    let lErr: any = null;
    let lres: any = await admin.from('listings').select('id,price,seller_id').in('id', ids);
    if (lres?.error) {
      const code = String((lres.error as any)?.code || '');
      const msg = String((lres.error as any)?.message || '').toLowerCase();
      // fallback si `seller_id` no existe
      if (code === '42703' || msg.includes('column')) {
        lres = await admin.from('listings').select('id,price,user_id').in('id', ids);
      }
    }
    listings = ((lres?.data as any[]) ?? []) as any[];
    lErr = lres?.error ?? null;
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });
    const priceById: Record<string, number> = {};
    const sellerById: Record<string, string> = {};
    for (const row of (listings as any[]) ?? []) {
      const p = typeof row.price === 'number' ? row.price : Number(row.price ?? 0);
      priceById[row.id] = Number.isFinite(p) ? p : 0;
      const sid = String(row.seller_id ?? row.user_id ?? '').trim();
      if (sid) sellerById[row.id] = sid;
    }

    const eligibleSubtotalBySeller: Record<string, number> = {};
    const eligibleListingIds: string[] = [];
    const eligibleSubtotal = cartItems.reduce((sum, ci) => {
      if (!eligibleIds.has(ci.listingId)) return sum;
      const qty = Math.max(1, Number(ci.quantity ?? 1));
      const price = priceById[ci.listingId] ?? 0;
      const line = price * qty;
      const sid = sellerById[ci.listingId] || '';
      if (sid) eligibleSubtotalBySeller[sid] = (eligibleSubtotalBySeller[sid] ?? 0) + line;
      eligibleListingIds.push(ci.listingId);
      return sum + line;
    }, 0);

    if (eligibleSubtotal <= 0) {
      return NextResponse.json({ error: 'Este cupón no aplica a artículos de tu carrito.' }, { status: 400 });
    }

    const dtype = (couponRow as any).discount_type as 'percent' | 'fixed';
    const dval = Number((couponRow as any).discount_value ?? 0);
    const discountBySeller: Record<string, number> = {};
    let discount = 0;
    if (dtype === 'percent') {
      const rate = Math.max(0, Math.min(100, dval)) / 100;
      for (const [sid, sub] of Object.entries(eligibleSubtotalBySeller)) {
        const ds = sub * rate;
        discountBySeller[sid] = ds;
        discount += ds;
      }
    } else {
      const fixed = Math.max(0, dval);
      const cap = Math.min(eligibleSubtotal, fixed);
      // Repartir proporcionalmente por vendedor (para carritos multi-vendedor)
      for (const [sid, sub] of Object.entries(eligibleSubtotalBySeller)) {
        const portion = eligibleSubtotal > 0 ? (sub / eligibleSubtotal) * cap : 0;
        // Nunca descontar más que el subtotal elegible del vendedor
        discountBySeller[sid] = Math.min(sub, portion);
      }
      discount = cap;
    }

    return NextResponse.json({
      ok: true,
      code: couponCode,
      discount,
      eligibleSubtotal,
      eligibleListingIds: Array.from(new Set(eligibleListingIds)),
      eligibleSubtotalBySeller,
      discountBySeller,
      discount_type: dtype,
      discount_value: dval,
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error applying coupon' }, { status: 500 });
  }
}

