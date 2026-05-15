import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Get Token
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado (Token faltante)' }, { status: 401 });
    }

    // 2. Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Create client with user token to respect RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // 3. Verify User
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 4. Parse Body
    const body = await req.json();
    const { listingId, quantity = 1, selected_color, selected_size } = body;

    if (!listingId) {
      return NextResponse.json({ error: 'Falta listingId' }, { status: 400 });
    }

    // 5. Fetch Listing details (stock, variants)
    const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('id, title, stock, size_variants, color_variants, seller_id')
        .eq('id', listingId)
        .single();

    if (listingError || !listing) {
        return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 });
    }

    // Prevent adding own listing
    if (listing.seller_id === user.id) {
         return NextResponse.json({ error: 'No puedes comprar tu propia publicación' }, { status: 400 });
    }

    // 6. Validate Stock
    if (listing.stock !== null && listing.stock < quantity) {
        return NextResponse.json({ error: `Stock insuficiente. Disponible: ${listing.stock}` }, { status: 400 });
    }

    // 7. Handle Variants (Automatic Selection if missing)
    let finalSize = selected_size;
    let finalColor = selected_color;

    // Helper to ensure we have an array
    const normalizeArray = (arr: any) => Array.isArray(arr) ? arr : [];

    const sizeVariants = normalizeArray(listing.size_variants);
    const colorVariants = normalizeArray(listing.color_variants);

    // If variants exist but none selected, pick the first one (Automatic Mode)
    if (!finalSize && sizeVariants.length > 0) {
        finalSize = sizeVariants[0];
    }
    if (!finalColor && colorVariants.length > 0) {
        finalColor = colorVariants[0];
    }

    // 8. Check existing item in cart to increment quantity
    // We need to match the exact variant combination
    let query = supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('listing_id', listingId);

    if (finalSize) query = query.eq('selected_size', finalSize);
    else query = query.is('selected_size', null);

    if (finalColor) query = query.eq('selected_color', finalColor);
    else query = query.is('selected_color', null);

    const { data: existingItems, error: fetchError } = await query;

    if (fetchError) {
        console.error('Error checking cart:', fetchError);
        return NextResponse.json({ error: 'Error al verificar el carrito' }, { status: 500 });
    }

    const existingItem = existingItems?.[0];
    let newQuantity = quantity;

    if (existingItem) {
        newQuantity = existingItem.quantity + quantity;
        // Check stock again for total quantity
        if (listing.stock !== null && listing.stock < newQuantity) {
             return NextResponse.json({ error: `Stock insuficiente para agregar más. Tienes ${existingItem.quantity} en el carrito.` }, { status: 400 });
        }
    }

    // 9. Upsert into cart
    const payload = {
        user_id: user.id,
        listing_id: listingId,
        quantity: newQuantity,
        selected_size: finalSize || null,
        selected_color: finalColor || null
    };

    const { error: upsertError } = await supabase
        .from('cart_items')
        .upsert(payload, { onConflict: 'user_id,listing_id,selected_color,selected_size' });

    if (upsertError) {
        console.error('Error upserting cart item:', upsertError);
        return NextResponse.json({ error: 'Error al guardar en el carrito' }, { status: 500 });
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Agregado al carrito',
        item: {
            ...payload,
            title: listing.title // optional, mostly for frontend if needed
        }
    });

  } catch (err: any) {
    console.error('Cart add error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
