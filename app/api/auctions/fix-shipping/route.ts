import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Fix existing auction orders: recalculate shipping to match checkout logic.
 * 
 * POST /api/auctions/fix-shipping?token=SECRET
 * Optional params:
 *   mode=verify  → dry-run, only shows what would change
 *   mode=fix     → (default) apply changes
 *   order_ids=id1,id2  → limit to specific orders
 */
export async function POST(req: NextRequest) {
    try {
        const secretRaw = process.env.AUCTION_SETTLE_SECRET || '';
        const secret = secretRaw.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        const token = req.nextUrl.searchParams.get('token') || '';
        if (!secret || token !== secret) {
            return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
        }

        const admin = supabaseAdmin();
        const mode = (req.nextUrl.searchParams.get('mode') || 'fix').toLowerCase();
        const orderIdsParam = req.nextUrl.searchParams.get('order_ids') || '';
        const orderIdList = orderIdsParam.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // 1. Fetch shipping config
        const { data: settingsRow } = await admin
            .from('app_settings')
            .select('shipping_base, shipping_markup_percent, shipping_markup_fixed, estafeta_config')
            .eq('id', 1)
            .maybeSingle();

        const shippingBase = Number((settingsRow as any)?.shipping_base ?? 175);
        const estafetaConfig = ((settingsRow as any)?.estafeta_config as any) || {
            enabled: true,
            weight_ranges: [
                { max_weight_kg: 1, price: 175 },
                { max_weight_kg: 5, price: 195 },
                { max_weight_kg: 10, price: 235 },
                { max_weight_kg: 15, price: 255 },
                { max_weight_kg: 20, price: 275 },
                { max_weight_kg: 25, price: 300 },
                { max_weight_kg: 30, price: 325 },
                { max_weight_kg: 35, price: 340 },
                { max_weight_kg: 40, price: 355 },
                { max_weight_kg: 45, price: 385 },
                { max_weight_kg: 50, price: 415 },
                { max_weight_kg: 55, price: 435 },
                { max_weight_kg: 60, price: 455 },
            ],
        };

        // 2. Fetch auction orders
        // 2. Fetch auction orders (with fallback for missing columns)
        let orders: any[] = [];
        {
            let q = admin.from('orders')
                .select('id, buyer_id, seller_id, shipping_fee, shipping_subsidy, shipping_carrier, subtotal, total, status, shipping_full_name, shipping_phone, shipping_address');
            if (orderIdList.length > 0) q = q.in('id', orderIdList);
            else q = q.in('status', ['pending_payment', 'paid', 'shipped']);
            let res = await q;

            if (res.error) {
                const code = String(res.error?.code || '');
                const msg = String(res.error?.message || '').toLowerCase();
                if (code === '42703' || msg.includes('does not exist') || msg.includes('column')) {
                    // Fallback: minimal columns
                    let q2 = admin.from('orders').select('id, buyer_id, seller_id, shipping_fee, subtotal, total, status');
                    if (orderIdList.length > 0) q2 = q2.in('id', orderIdList);
                    else q2 = q2.in('status', ['pending_payment', 'paid', 'shipped', 'pending_shipment']);
                    res = await q2 as any;
                }
                if (res.error) {
                    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
                }
            }
            orders = (res.data || []) as any[];
        }
        if (orders.length === 0) {
            return NextResponse.json({ ok: true, message: 'No orders found', fixed: 0 });
        }

        // 3. Get order items to find listing IDs
        const orderIds = orders.map(o => o.id);
        const { data: orderItems, error: oiErr } = await admin
            .from('order_items')
            .select('order_id, listing_id')
            .in('order_id', orderIds);
        if (oiErr) {
            return NextResponse.json({ ok: false, error: oiErr.message }, { status: 500 });
        }

        const orderListings: Record<string, string[]> = {};
        for (const oi of (orderItems || [])) {
            if (!orderListings[oi.order_id]) orderListings[oi.order_id] = [];
            orderListings[oi.order_id].push(oi.listing_id);
        }

        // 4. Fetch all listings
        const allListingIds = Array.from(new Set(Object.values(orderListings).flat()));
        if (allListingIds.length === 0) {
            return NextResponse.json({ ok: true, message: 'No listings found for orders', fixed: 0 });
        }

        const { data: listings } = await admin
            .from('listings')
            .select('id, sale_type, seller_id, shipping_by_seller, free_shipping, allow_personal_delivery, shipping_price, shipping_carrier, weight_kg, length_cm, width_cm, height_cm, shipping_subsidy')
            .in('id', allListingIds);

        const listingById: Record<string, any> = {};
        for (const l of (listings || [])) listingById[l.id] = l;

        // 5. Fetch all unique buyer & seller IDs for profiles
        const buyerIds = Array.from(new Set(orders.map(o => o.buyer_id).filter(Boolean)));
        const sellerIds = Array.from(new Set(orders.map(o => o.seller_id).filter(Boolean)));
        const allProfileIds = Array.from(new Set([...buyerIds, ...sellerIds]));

        const { data: profiles } = await admin
            .from('profiles')
            .select('id, full_name, phone, address_street, ext_number, int_number, neighborhood, zip_code, state, city, references, cross_streets, plan_type')
            .in('id', allProfileIds.length > 0 ? allProfileIds : ['__none__']);

        const profileById: Record<string, any> = {};
        for (const p of (profiles || [])) profileById[p.id] = p;

        const normalize = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // 6. Process each order
        const results: any[] = [];

        for (const order of orders) {
            const listingIds = orderListings[order.id] || [];
            if (listingIds.length === 0) continue;

            // Check if any listing is an auction
            const auctionListings = listingIds.filter(lid => listingById[lid]?.sale_type === 'auction');
            if (auctionListings.length === 0) continue; // Skip non-auction orders

            const buyerProfile = profileById[order.buyer_id] || null;
            const sellerProfile = profileById[order.seller_id] || null;

            // Process shipping for each listing (usually 1 for auctions)
            let finalShippingFee = 0;
            let finalShippingSubsidy = 0;
            let shippingCarrier: string | null = null;

            for (const lid of auctionListings) {
                const listing = listingById[lid];
                if (!listing) continue;

                const isSellerShipping = Boolean(listing.shipping_by_seller);
                const isFreeShipping = Boolean(listing.free_shipping);
                const allowPersonalDelivery = Boolean(listing.allow_personal_delivery);
                const publishedShippingPrice = Number(listing.shipping_price || 0);
                const listingSubsidy = Number(listing.shipping_subsidy || 0);
                const listingCarrier = String(listing.shipping_carrier || '').trim();

                // ─── Check personal delivery ───
                let isPickup = false;
                if (allowPersonalDelivery && buyerProfile && sellerProfile) {
                    const bState = normalize(String(buyerProfile.state || ''));
                    const bCity = normalize(String(buyerProfile.city || ''));
                    const sState = normalize(String(sellerProfile.state || ''));
                    const sCity = normalize(String(sellerProfile.city || ''));
                    const bZip = String(buyerProfile.zip_code || '').replace(/\D/g, '');
                    const sZip = String(sellerProfile.zip_code || '').replace(/\D/g, '');
                    const zipMatch = bZip.length === 5 && sZip.length === 5 && bZip === sZip;
                    const locationMatch = zipMatch || (bState === sState && bCity === sCity);
                    if (locationMatch) isPickup = true;
                }

                if (isPickup) {
                    finalShippingFee = 0;
                    finalShippingSubsidy = 0;
                    shippingCarrier = 'pickup';
                } else if (isSellerShipping) {
                    finalShippingFee = isFreeShipping ? 0 : publishedShippingPrice;
                    finalShippingSubsidy = 0;
                    shippingCarrier = listingCarrier || 'Propio';
                } else {
                    // GoVendy shipping — calculate from weight
                    const w = Number(listing.weight_kg) || 1;
                    const len = Number(listing.length_cm) || 10;
                    const wid = Number(listing.width_cm) || 10;
                    const h = Number(listing.height_cm) || 10;
                    const volW = (len * wid * h) / 5000;
                    const finalWeight = Math.max(w, volW);

                    let calculatedBaseCost = shippingBase;
                    if (Array.isArray(estafetaConfig.weight_ranges)) {
                        const ranges = estafetaConfig.weight_ranges.sort((a: any, b: any) => (a.max_weight_kg || 0) - (b.max_weight_kg || 0));
                        const match = ranges.find((rng: any) => finalWeight <= (rng.max_weight_kg || 0));
                        if (match) {
                            calculatedBaseCost = Number(match.price) || shippingBase;
                        } else if (ranges.length > 0) {
                            calculatedBaseCost = Number(ranges[ranges.length - 1].price) || shippingBase;
                        }
                    }

                    const shippingCost = Number.isFinite(calculatedBaseCost) ? calculatedBaseCost : 175;

                    // Subsidy calculation — same as checkout
                    let totalSubsidy = 0;
                    if (isFreeShipping && listingSubsidy === 0) {
                        totalSubsidy = 999999; // seller pays all
                    } else if (listingSubsidy > 0) {
                        totalSubsidy = listingSubsidy;
                    }

                    finalShippingSubsidy = Math.min(totalSubsidy, shippingCost);
                    finalShippingFee = Math.max(0, shippingCost - finalShippingSubsidy);
                    shippingCarrier = null; // GoVendy
                }
            }

            // Build update payload
            const expectedTotal = Number((Number(order.subtotal || 0) + finalShippingFee).toFixed(2));
            const currentShipping = Number(order.shipping_fee || 0);
            const currentSubsidy = Number(order.shipping_subsidy || 0);
            const currentTotal = Number(order.total || 0);

            // Build buyer address data
            const buyerAddress = buyerProfile ? {
                address_street: String(buyerProfile.address_street ?? ''),
                ext_number: String(buyerProfile.ext_number ?? ''),
                int_number: String(buyerProfile.int_number ?? ''),
                neighborhood: String(buyerProfile.neighborhood ?? ''),
                zip_code: String(buyerProfile.zip_code ?? ''),
                state: String(buyerProfile.state ?? ''),
                city: String(buyerProfile.city ?? ''),
                references: String(buyerProfile.references ?? ''),
                cross_streets: String(buyerProfile.cross_streets ?? ''),
            } : null;

            // Check if anything needs updating
            const shippingChanged = Math.abs(currentShipping - finalShippingFee) > 0.01;
            const subsidyChanged = Math.abs(currentSubsidy - finalShippingSubsidy) > 0.01;
            const totalChanged = Math.abs(currentTotal - expectedTotal) > 0.01;
            const carrierChanged = (order.shipping_carrier || null) !== shippingCarrier;
            const addressMissing = !order.shipping_full_name && buyerProfile?.full_name;

            const needsUpdate = shippingChanged || subsidyChanged || totalChanged || carrierChanged || addressMissing;

            if (!needsUpdate) {
                if (mode === 'verify') {
                    results.push({
                        order_id: order.id,
                        status: order.status,
                        action: 'no_change_needed',
                        current_shipping: currentShipping,
                        current_subsidy: currentSubsidy,
                        current_total: currentTotal,
                    });
                }
                continue;
            }

            const updatePayload: any = {
                shipping_fee: finalShippingFee,
                total: expectedTotal,
            };

            if (finalShippingSubsidy > 0) updatePayload.shipping_subsidy = finalShippingSubsidy;
            if (shippingCarrier) updatePayload.shipping_carrier = shippingCarrier;
            if (buyerProfile?.full_name && !order.shipping_full_name) {
                updatePayload.shipping_full_name = String(buyerProfile.full_name).trim();
            }
            if (buyerProfile?.phone && !order.shipping_phone) {
                updatePayload.shipping_phone = String(buyerProfile.phone).trim();
            }
            if (buyerAddress && !order.shipping_address) {
                updatePayload.shipping_address = buyerAddress;
            }

            if (mode === 'verify') {
                results.push({
                    order_id: order.id,
                    status: order.status,
                    action: 'would_fix',
                    current: { shipping: currentShipping, subsidy: currentSubsidy, total: currentTotal, carrier: order.shipping_carrier },
                    corrected: { shipping: finalShippingFee, subsidy: finalShippingSubsidy, total: expectedTotal, carrier: shippingCarrier },
                });
                continue;
            }

            // Apply fix
            const { error: upErr } = await admin
                .from('orders')
                .update(updatePayload)
                .eq('id', order.id);

            results.push({
                order_id: order.id,
                status: order.status,
                action: upErr ? 'error' : 'fixed',
                old: { shipping: currentShipping, subsidy: currentSubsidy, total: currentTotal },
                new: { shipping: finalShippingFee, subsidy: finalShippingSubsidy, total: expectedTotal, carrier: shippingCarrier },
                error: upErr?.message || null,
            });
        }

        return NextResponse.json({
            ok: true,
            mode,
            total_orders_checked: orders.length,
            auction_orders_found: results.length,
            fixed: results.filter(r => r.action === 'fixed').length,
            would_fix: results.filter(r => r.action === 'would_fix').length,
            errors: results.filter(r => r.action === 'error').length,
            no_change: results.filter(r => r.action === 'no_change_needed').length,
            details: results,
            config: { shippingBase },
        });
    } catch (e: any) {
        console.error('[FIX-SHIPPING] Error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
