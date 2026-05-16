import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { firstVariantLabel, getAvailableStock } from '@/lib/cart/availability';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Inicia sesión para agregar al carrito.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Sesión inválida. Vuelve a iniciar sesión.' }, { status: 401 });
    }

    const body = await req.json();
    const listingId = String(body.listingId || '').trim();
    const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1));
    const selected_color =
      typeof body.selected_color === 'string' && body.selected_color.trim()
        ? body.selected_color.trim()
        : null;
    let selected_size =
      typeof body.selected_size === 'string' && body.selected_size.trim()
        ? body.selected_size.trim()
        : null;

    if (!listingId) {
      return NextResponse.json({ error: 'Falta el identificador de la publicación.' }, { status: 400 });
    }

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, title, stock, size_variants, color_variants, size_stock, seller_id, status, sale_type')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    }

    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: 'No puedes comprar tu propia publicación' }, { status: 400 });
    }

    if (listing.status !== 'active') {
      return NextResponse.json({ error: 'Esta publicación no está disponible para compra.' }, { status: 400 });
    }

    if (listing.sale_type === 'auction') {
      return NextResponse.json({ error: 'Las subastas no se agregan al carrito. Usa pujar.' }, { status: 400 });
    }

    const sizeVariants = Array.isArray(listing.size_variants) ? listing.size_variants : [];
    const colorVariants = Array.isArray(listing.color_variants) ? listing.color_variants : [];

    if (!selected_size && sizeVariants.length > 0) {
      selected_size = firstVariantLabel(sizeVariants);
    }
    let finalColor = selected_color;
    if (!finalColor && colorVariants.length > 0) {
      finalColor = firstVariantLabel(colorVariants);
    }

    const available = getAvailableStock(listing, selected_size);
    if (available <= 0) {
      return NextResponse.json({ error: 'Producto agotado.' }, { status: 400 });
    }

    let query = supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('listing_id', listingId);

    if (selected_size) query = query.eq('selected_size', selected_size);
    else query = query.is('selected_size', null);

    if (finalColor) query = query.eq('selected_color', finalColor);
    else query = query.is('selected_color', null);

    const { data: existingItems, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error('[cart/add] fetch existing:', fetchError);
      return NextResponse.json({ error: 'Error al verificar el carrito' }, { status: 500 });
    }

    const existingItem = existingItems;
    const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

    if (newQuantity > available) {
      const inCart = existingItem?.quantity ?? 0;
      return NextResponse.json(
        {
          error:
            inCart > 0
              ? `Stock insuficiente. Tienes ${inCart} en el carrito y quedan ${available} disponibles.`
              : `Stock insuficiente. Disponible: ${available}`,
        },
        { status: 400 },
      );
    }

    if (existingItem) {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', existingItem.id);

      if (updateError) {
        console.error('[cart/add] update:', updateError);
        return NextResponse.json({ error: 'Error al actualizar el carrito' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from('cart_items').insert({
        user_id: user.id,
        listing_id: listingId,
        quantity: newQuantity,
        selected_size: selected_size || null,
        selected_color: finalColor || null,
      });

      if (insertError) {
        console.error('[cart/add] insert:', insertError);
        // Conflicto UNIQUE (user_id, listing_id) sin variantes en BD antigua
        if (insertError.code === '23505') {
          const { data: legacy } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('listing_id', listingId)
            .maybeSingle();

          if (legacy) {
            const merged = legacy.quantity + quantity;
            if (merged > available) {
              return NextResponse.json({ error: `Stock insuficiente. Disponible: ${available}` }, { status: 400 });
            }
            const { error: legacyUp } = await supabase
              .from('cart_items')
              .update({
                quantity: merged,
                selected_size: selected_size || null,
                selected_color: finalColor || null,
              })
              .eq('id', legacy.id);
            if (legacyUp) {
              return NextResponse.json({ error: 'Error al guardar en el carrito' }, { status: 500 });
            }
          } else {
            return NextResponse.json({ error: 'Error al guardar en el carrito' }, { status: 500 });
          }
        } else {
          return NextResponse.json(
            { error: insertError.message || 'Error al guardar en el carrito' },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Agregado al carrito',
      item: {
        listing_id: listingId,
        quantity: newQuantity,
        selected_size: selected_size || null,
        selected_color: finalColor || null,
        title: listing.title,
      },
    });
  } catch (err: unknown) {
    console.error('[cart/add] unexpected:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
