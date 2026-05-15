import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify user identity
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const authClient = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: { user }, error: userError } = await authClient.auth.getUser(token);
        if (userError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Verify admin via admin_users table (same pattern as summary API)
        const admin = supabaseAdmin();
        const { data: adminRow } = await admin
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!adminRow) {
            // Fallback: check profiles.is_admin
            const { data: profile } = await admin
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .single();

            if (!profile?.is_admin) {
                return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
            }
        }

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const qRaw = (url.searchParams.get('q') || '').trim();
        const userIdParam = (url.searchParams.get('userId') || '').trim();

        const filterWalletIds: string[] = [];

        const cleanCardFrom = (value: string) => value.replace(/\s+/g, '');
        const isUuid = (value: string) => /^[0-9a-fA-F-]{32,36}$/.test(value);
        const isCard = (value: string) => /^\d{12,20}$/.test(cleanCardFrom(value));

        async function findWalletBy(column: 'user_id' | 'id' | 'pocket_cash_number', value: string) {
            try {
                const { data, error } = await admin
                    .from('wallets')
                    .select('user_id, id, pocket_cash_number')
                    .eq(column, value)
                    .maybeSingle();
                if (error) {
                    const msg = String(error.message || '').toLowerCase();
                    if (msg.includes('column') && msg.includes('does not exist')) {
                        return null;
                    }
                    console.error('[Admin Wallet Transactions] findWalletBy error:', error.message);
                    return null;
                }
                return data as any | null;
            } catch {
                return null;
            }
        }

        const q = qRaw;

        if (userIdParam) {
            let wallet = await findWalletBy('user_id', userIdParam);
            if (!wallet && isUuid(userIdParam)) {
                wallet = await findWalletBy('id', userIdParam);
            }
            if (wallet) {
                if (wallet.user_id) filterWalletIds.push(String(wallet.user_id));
                if (wallet.id && wallet.id !== wallet.user_id) filterWalletIds.push(String(wallet.id));
            }
        } else if (q) {
            if (isCard(q)) {
                const cleanCard = cleanCardFrom(q);
                const wallet = await findWalletBy('pocket_cash_number', cleanCard);
                if (wallet) {
                    if (wallet.user_id) filterWalletIds.push(String(wallet.user_id));
                    if (wallet.id && wallet.id !== wallet.user_id) filterWalletIds.push(String(wallet.id));
                }
            } else if (isUuid(q)) {
                let wallet = await findWalletBy('user_id', q);
                if (!wallet) {
                    wallet = await findWalletBy('id', q);
                }
                if (wallet) {
                    if (wallet.user_id) filterWalletIds.push(String(wallet.user_id));
                    if (wallet.id && wallet.id !== wallet.user_id) filterWalletIds.push(String(wallet.id));
                } else {
                    filterWalletIds.push(q);
                }
            }
        }

        let query = admin
            .from('wallet_transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (filterWalletIds.length > 0) {
            query = query.in('wallet_id', filterWalletIds);
        }

        if (!filterWalletIds.length && qRaw) {
            const pattern = `%${qRaw}%`;
            query = query.or(
                `concept.ilike.${pattern},reference_id.ilike.${pattern}`
            );
        }

        query = query.limit(limit);

        const { data: transactions, error } = await query;
        if (error) {
            console.error('[Admin Wallet Transactions List] Query error:', error);
            throw error;
        }

        // Enrich with user profiles AND product details for "Pay Order" transactions
        const txList = transactions || [];

        // Find order IDs from transactions (reference_id usually contains order ID for payments)
        // Format can be "order_123" or just "123" depending on how it was saved
        const orderIds = new Set<string>();
        const txOrderMap = new Map<string, string>(); // transaction.id -> order.id

        txList.forEach((t: any) => {
            // Match both 'payment' and 'debit' transactions that reference an order
            const isOrderPayment = (
                (t.type === 'payment' || t.type === 'debit') &&
                (t.reference_type === 'order' || (t.reference_id && t.concept?.toLowerCase().includes('orden')))
            );
            if (isOrderPayment && t.reference_id) {
                // Try to extract UUID if it looks like one
                const match = t.reference_id.match(/[0-9a-fA-F-]{36}/);
                if (match) {
                    orderIds.add(match[0]);
                    txOrderMap.set(t.id, match[0]);
                } else if (t.reference_id.length > 10) {
                    // Fallback for direct IDs
                    orderIds.add(t.reference_id);
                    txOrderMap.set(t.id, t.reference_id);
                }
            }
        });

        // Fetch Order Details if any
        const orderDetailsMap = new Map<string, any>();
        if (orderIds.size > 0) {
            const oIds = Array.from(orderIds);

            // 1. Get Listings from Order Items
            const { data: items } = await admin
                .from('order_items')
                .select('order_id, title, listing_id, listings(slug, images, sale_type)')
                .in('order_id', oIds);

            if (items) {
                items.forEach((item: any) => {
                    if (!orderDetailsMap.has(item.order_id)) {
                        // Get first image
                        let thumb = null;
                        const imgs = item.listings?.images;
                        if (Array.isArray(imgs) && imgs.length > 0) thumb = imgs[0];
                        else if (typeof imgs === 'string') {
                            try {
                                const parsed = JSON.parse(imgs);
                                if (Array.isArray(parsed) && parsed.length > 0) thumb = parsed[0];
                            } catch { }
                        }

                        orderDetailsMap.set(item.order_id, {
                            title: item.title,
                            listing_id: item.listing_id,
                            slug: item.listings?.slug,
                            thumb,
                            is_auction: item.listings?.sale_type === 'auction'
                        });
                    }
                });
            }

            // 2. Get Shipping Info + Order details
            const { data: orders } = await admin
                .from('orders')
                .select('id, buyer_id, seller_id, shipping_option_id, shipping_carrier, shipping_fee, shipping_by_seller, shipping_subsidy, subtotal, commission_fee, total, status, payment_method, order_source')
                .in('id', oIds);

            if (orders) {
                orders.forEach((o: any) => {
                    const existing = orderDetailsMap.get(o.id) || {};
                    orderDetailsMap.set(o.id, {
                        ...existing,
                        buyer_id: o.buyer_id,
                        seller_id: o.seller_id,
                        shipping_fee: o.shipping_fee,
                        shipping_carrier: o.shipping_carrier,
                        shipping_option_id: o.shipping_option_id,
                        shipping_by_seller: o.shipping_by_seller,
                        shipping_subsidy: o.shipping_subsidy,
                        subtotal: o.subtotal,
                        commission_fee: o.commission_fee,
                        order_total: o.total,
                        order_status: o.status,
                        order_payment_method: o.payment_method,
                        order_source: o.order_source,
                    });
                });
            }
        }

        // Attach enriched data to transactions
        txList.forEach((t: any) => {
            const orderId = txOrderMap.get(t.id);
            if (orderId) {
                const details = orderDetailsMap.get(orderId);
                if (details) {
                    t.product_title = details.title;
                    t.product_id = details.listing_id;
                    t.product_slug = details.slug;
                    t.product_thumb = details.thumb;
                    t.is_auction = details.is_auction;
                    t.shipping_fee = details.shipping_fee;
                    t.shipping_carrier = details.shipping_carrier;
                    t.shipping_option_id = details.shipping_option_id;
                    t.shipping_by_seller = details.shipping_by_seller;
                    t.shipping_subsidy = details.shipping_subsidy;
                    t.order_total = details.order_total;
                    t.order_status = details.order_status;
                    t.order_payment_method = details.order_payment_method;
                    t.order_source = details.order_source;
                    t.buyer_id = details.buyer_id;
                    t.seller_id = details.seller_id;
                    t.subtotal = details.subtotal;
                    t.commission_fee = details.commission_fee;
                    t.order_id = orderId;
                    // Mark this as an order-payment type for UI
                    t._is_order_payment = true;
                }
            }
        });

        // Collect all user IDs: wallet owners + buyers/sellers from enriched order data
        const allUserIds = new Set(txList.map((t: any) => t.wallet_id).filter(Boolean));
        txList.forEach((t: any) => {
            if (t.buyer_id) allUserIds.add(t.buyer_id);
            if (t.seller_id) allUserIds.add(t.seller_id);
        });
        const userIds = Array.from(allUserIds);
        const profilesMap: Record<string, { full_name: string; email: string }> = {};

        if (userIds.length > 0) {
            // 1. Try profiles table first
            const { data: profiles } = await admin
                .from('profiles')
                .select('id, full_name, first_name, last_name, email, nickname')
                .in('id', userIds);

            if (profiles) {
                for (const p of profiles) {
                    const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.nickname || '';
                    profilesMap[p.id] = { full_name: name, email: p.email || '' };
                }
            }

            // 2. For any missing, try auth.admin
            const missingIds = userIds.filter(id => !profilesMap[id]?.full_name);
            for (const id of missingIds.slice(0, 50)) { // limit to 50 to avoid overload
                try {
                    const { data: { user } } = await admin.auth.admin.getUserById(id);
                    if (user) {
                        const meta = user.user_metadata || {};
                        const name = meta.full_name || meta.name || user.email?.split('@')[0] || '';
                        const email = user.email || '';
                        profilesMap[id] = {
                            full_name: profilesMap[id]?.full_name || name,
                            email: profilesMap[id]?.email || email,
                        };
                    }
                } catch {
                    // ignore individual auth lookup failures
                }
            }
        }

        return NextResponse.json({ transactions: txList, profiles: profilesMap });
    } catch (error: any) {
        console.error('[Admin Wallet Transactions List]', error);
        return NextResponse.json(
            { error: error.message || 'Error al cargar transacciones' },
            { status: 500 }
        );
    }
}
