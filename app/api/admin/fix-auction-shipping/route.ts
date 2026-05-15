import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * API temporal para corregir órdenes históricas de subastas
 * que tienen shipping_fee incorrecto ($175 default).
 * 
 * Recalcula el shipping_fee basándose en el listing original:
 * - allow_personal_delivery → shipping_fee = 0, shipping_option_id = 'pickup'
 * - free_shipping → shipping_fee = 0
 * - shipping_by_seller → shipping_fee = listing.shipping_price (custom)
 * - GoVendy → shipping_fee = listing.shipping_price (pre-calculado)
 * 
 * GET  → Preview (dry run, muestra qué cambiaría)
 * POST → Execute (aplica los cambios)
 */
export async function GET(req: NextRequest) {
    return handleRequest(req, true);
}

export async function POST(req: NextRequest) {
    return handleRequest(req, false);
}

async function handleRequest(req: NextRequest, dryRun: boolean) {
    try {
        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const authClient = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: { user }, error: userError } = await authClient.auth.getUser(token);
        if (userError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Verify admin
        const admin = supabaseAdmin();
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!adminRow) {
            const { data: profile } = await admin
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .single();
            if (!profile?.is_admin) {
                return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
            }
        }

        // 1. Get all orders that have order_items linked to auction listings
        const { data: auctionOrders, error: ordersErr } = await admin
            .from('orders')
            .select(`
        id,
        buyer_id,
        seller_id,
        shipping_fee,
        shipping_option_id,
        subtotal,
        total,
        status,
        payment_method,
        created_at
      `)
            .order('created_at', { ascending: false });

        if (ordersErr) {
            console.error('[FIX-AUCTIONS] Error fetching orders:', ordersErr);
            return NextResponse.json({ error: ordersErr.message }, { status: 500 });
        }

        if (!auctionOrders || auctionOrders.length === 0) {
            return NextResponse.json({ message: 'No hay órdenes para revisar', changes: [] });
        }

        // 2. Get order_items to find which orders are from auctions
        const orderIds = auctionOrders.map(o => o.id);
        const { data: orderItems, error: itemsErr } = await admin
            .from('order_items')
            .select('order_id, listing_id')
            .in('order_id', orderIds);

        if (itemsErr) {
            console.error('[FIX-AUCTIONS] Error fetching order items:', itemsErr);
            return NextResponse.json({ error: itemsErr.message }, { status: 500 });
        }

        // Build map: order_id → listing_ids
        const orderListingMap = new Map<string, string[]>();
        (orderItems || []).forEach((item: any) => {
            const existing = orderListingMap.get(item.order_id) || [];
            existing.push(item.listing_id);
            orderListingMap.set(item.order_id, existing);
        });

        // 3. Get all unique listing IDs
        const allListingIds = [...new Set((orderItems || []).map((i: any) => i.listing_id).filter(Boolean))];

        if (allListingIds.length === 0) {
            return NextResponse.json({ message: 'No se encontraron listings asociados', changes: [] });
        }

        // Fetch in batches (Supabase has limits on .in())
        const listingsMap = new Map<string, any>();
        for (let i = 0; i < allListingIds.length; i += 50) {
            const batch = allListingIds.slice(i, i + 50);
            const { data: listings } = await admin
                .from('listings')
                .select('id, sale_type, free_shipping, shipping_by_seller, allow_personal_delivery, shipping_price, shipping_subsidy, is_digital, title')
                .in('id', batch);

            (listings || []).forEach((l: any) => {
                listingsMap.set(l.id, l);
            });
        }

        // 4. Process each order — only fix auction orders
        const changes: any[] = [];
        const errors: any[] = [];

        for (const order of auctionOrders) {
            const listingIds = orderListingMap.get(order.id) || [];
            if (listingIds.length === 0) continue;

            // Check if ANY listing is an auction
            const auctionListing = listingIds
                .map(lid => listingsMap.get(lid))
                .find((l: any) => l?.sale_type === 'auction');

            if (!auctionListing) continue; // Not an auction order

            // Skip digital products
            if (auctionListing.is_digital) continue;

            // Calculate what shipping should be
            const isSellerShipping = Boolean(auctionListing.shipping_by_seller);
            const isFreeShipping = Boolean(auctionListing.free_shipping);
            const allowPersonalDelivery = Boolean(auctionListing.allow_personal_delivery);
            const publishedShippingPrice = Number(auctionListing.shipping_price || 0);

            let correctShippingFee = 0;
            let correctShippingOptionId = order.shipping_option_id;

            if (allowPersonalDelivery) {
                correctShippingFee = 0;
                correctShippingOptionId = 'pickup';
            } else if (isFreeShipping) {
                correctShippingFee = 0;
            } else if (isSellerShipping) {
                correctShippingFee = publishedShippingPrice;
            } else if (publishedShippingPrice > 0) {
                correctShippingFee = publishedShippingPrice;
            } else {
                // GoVendy shipping — keep existing fee if no published price
                // (was calculated at settlement time, may be correct)
                continue;
            }

            const currentShippingFee = Number(order.shipping_fee || 0);
            const currentTotal = Number(order.total || 0);
            const currentSubtotal = Number(order.subtotal || 0);
            const correctTotal = currentSubtotal + correctShippingFee;

            // Only fix if something is different
            if (currentShippingFee === correctShippingFee && order.shipping_option_id === correctShippingOptionId) {
                continue;
            }

            const change = {
                order_id: order.id,
                listing_title: auctionListing.title,
                listing_config: {
                    free_shipping: isFreeShipping,
                    shipping_by_seller: isSellerShipping,
                    allow_personal_delivery: allowPersonalDelivery,
                    published_shipping_price: publishedShippingPrice,
                },
                before: {
                    shipping_fee: currentShippingFee,
                    shipping_option_id: order.shipping_option_id,
                    total: currentTotal,
                },
                after: {
                    shipping_fee: correctShippingFee,
                    shipping_option_id: correctShippingOptionId,
                    total: correctTotal,
                },
                status: order.status,
                created_at: order.created_at,
            };

            changes.push(change);

            // Apply fix if not dry run
            if (!dryRun) {
                const { error: updateErr } = await admin
                    .from('orders')
                    .update({
                        shipping_fee: correctShippingFee,
                        shipping_option_id: correctShippingOptionId,
                        total: correctTotal,
                    })
                    .eq('id', order.id);

                if (updateErr) {
                    errors.push({ order_id: order.id, error: updateErr.message });
                    console.error(`[FIX-AUCTIONS] Error updating order ${order.id}:`, updateErr);
                } else {
                    console.log(`[FIX-AUCTIONS] Fixed order ${order.id}: shipping $${currentShippingFee} → $${correctShippingFee}, total $${currentTotal} → $${correctTotal}`);
                }
            }
        }

        return NextResponse.json({
            dryRun,
            message: dryRun
                ? `Preview: ${changes.length} órdenes de subasta necesitan corrección`
                : `Ejecutado: ${changes.length} órdenes corregidas, ${errors.length} errores`,
            totalAuctionOrders: changes.length,
            changes,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (e: any) {
        console.error('[FIX-AUCTIONS] Error:', e);
        return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
    }
}
