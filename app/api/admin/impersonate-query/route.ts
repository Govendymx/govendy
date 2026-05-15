import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { payoutNet, isCancelledStatus, isReleasedStatus, isPaidStatus, toNumber } from '@/lib/payouts/calc';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/impersonate-query
 * Proxy endpoint that lets admins query Supabase data AS a target user.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);

        if (!auth.impersonating || !auth.impersonatedUserId) {
            return NextResponse.json({ error: 'No estás impersonando a ningún usuario' }, { status: 400 });
        }

        const body = await req.json();
        const { table, select, filters, order, limit, single } = body;

        if (!table || typeof table !== 'string') {
            return NextResponse.json({ error: 'Se requiere el campo "table"' }, { status: 400 });
        }

        const admin = supabaseAdmin();
        const targetUserId = auth.impersonatedUserId;

        let query: any = admin.from(table).select(select || '*');

        if (filters?.userColumn) {
            query = query.eq(filters.userColumn, targetUserId);
        }
        if (filters?.eq) {
            for (const [col, val] of Object.entries(filters.eq)) {
                query = query.eq(col, val as string);
            }
        }
        if (filters?.in) {
            for (const [col, vals] of Object.entries(filters.in)) {
                query = query.in(col, vals as string[]);
            }
        }
        if (filters?.gte) {
            for (const [col, val] of Object.entries(filters.gte)) {
                query = query.gte(col, val as string);
            }
        }
        if (filters?.lte) {
            for (const [col, val] of Object.entries(filters.lte)) {
                query = query.lte(col, val as string);
            }
        }
        if (order) {
            const orderCol = typeof order === 'string' ? order : order.column;
            const ascending = typeof order === 'string' ? false : (order.ascending ?? false);
            query = query.order(orderCol, { ascending });
        }
        if (limit && Number(limit) > 0) {
            query = query.limit(Number(limit));
        }

        if (single) {
            const { data, error } = await query.maybeSingle();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ data, targetUserId });
        }

        const { data, error, count } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ data, count, targetUserId });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error en query impersonada' }, { status: 500 });
    }
}

/**
 * GET /api/admin/impersonate-query
 * Returns complete profile + wallet + financial data for the impersonated user.
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);

        if (!auth.impersonating || !auth.impersonatedUserId) {
            return NextResponse.json({ error: 'No estás impersonando a ningún usuario' }, { status: 400 });
        }

        const admin = supabaseAdmin();
        const targetUserId = auth.impersonatedUserId;

        // Fetch all user data in parallel
        const [
            profileRes,
            walletRes,
            ordersAsBuyerRes,
            ordersAsSellerRes,
            listingsRes,
            reviewsRes,
            walletTxRes,
            disputesBuyerRes,
            disputesSellerRes,
            withdrawalsRes,
        ] = await Promise.all([
            admin.from('profiles').select('*').eq('id', targetUserId).maybeSingle(),
            admin.from('wallets').select('*').eq('user_id', targetUserId).maybeSingle(),
            // Orders as BUYER (compras)
            admin.from('orders')
                .select('id,status,total,subtotal,shipping_fee,commission_fee,coupon_discount,created_at,seller_id')
                .eq('buyer_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(30),
            // Orders as SELLER (ventas/pagos)
            admin.from('orders')
                .select('id,status,total,subtotal,shipping_fee,commission_fee,coupon_discount,shipping_subsidy,shipping_option_id,shipping_carrier,shipping_by_seller,paid_to_seller_at,created_at,buyer_id')
                .eq('seller_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(100),
            admin.from('listings')
                .select('id,title,price,status,created_at')
                .eq('user_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(20),
            admin.from('reviews')
                .select('id,rating,comment,created_at')
                .eq('reviewer_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(10),
            // Wallet transactions (PocketCash history)
            admin.from('wallet_transactions')
                .select('id,type,amount,concept,reference_type,reference_id,created_at')
                .eq('wallet_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(50),
            // Disputes as buyer
            admin.from('disputes')
                .select('id,order_id,status,admin_decision,created_at')
                .eq('buyer_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(10),
            // Disputes as seller
            admin.from('disputes')
                .select('id,order_id,status,admin_decision,return_guide_cost,created_at')
                .eq('seller_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(10),
            // Withdrawals
            admin.from('seller_withdrawals')
                .select('id,amount,status,created_at,order_ids')
                .eq('seller_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(10),
        ]);

        // Get auth user info
        const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);

        // --- Calculate seller balance (same logic as /api/payouts/balance) ---
        const sellerOrders: any[] = (ordersAsSellerRes.data as any[]) ?? [];
        const openDisputeOrderIds = new Set<string>(
            ((disputesSellerRes.data as any[]) ?? [])
                .filter((d: any) => d.status === 'open')
                .map((d: any) => String(d.order_id ?? '').trim())
                .filter(Boolean)
        );

        const withdrawnIds = new Set<string>(
            ((withdrawalsRes.data as any[]) ?? [])
                .filter((w: any) => w.status === 'completed')
                .flatMap((w: any) => Array.isArray(w.order_ids) ? w.order_ids.map((x: any) => String(x).trim()) : [])
        );

        let guideDeduction = 0;
        ((disputesSellerRes.data as any[]) ?? [])
            .filter((d: any) => d.status === 'resolved' && d.admin_decision === 'assign_guide_charged_seller')
            .forEach((d: any) => { guideDeduction += toNumber(d.return_guide_cost); });

        const active = sellerOrders.filter((o: any) => !isCancelledStatus(String(o?.status ?? '')));

        let disponible = 0;
        const disponiblesOrderIds: string[] = [];
        for (const o of active) {
            const id = String(o?.id ?? '').trim();
            if (!id) continue;
            if (withdrawnIds.has(id) || openDisputeOrderIds.has(id)) continue;
            if (!o?.paid_to_seller_at) continue;
            const st = String(o?.status ?? '').toLowerCase();
            if (['cancelled', 'canceled', 'refunded'].includes(st)) continue;
            disponible += payoutNet(o);
            disponiblesOrderIds.push(id);
        }
        disponible = Math.max(0, disponible - guideDeduction);

        const released = active.filter((o: any) => isReleasedStatus(String(o?.status ?? '')));
        let porLiberar = 0;
        for (const o of released) {
            const id = String(o?.id ?? '').trim();
            if (!id || o?.paid_to_seller_at || withdrawnIds.has(id) || openDisputeOrderIds.has(id)) continue;
            porLiberar += payoutNet(o);
        }

        const paidNotReleased = active.filter((o: any) => isPaidStatus(String(o?.status ?? '')) && !isReleasedStatus(String(o?.status ?? '')));
        let estimado = 0;
        for (const o of paidNotReleased) {
            const id = String(o?.id ?? '').trim();
            if (!id || withdrawnIds.has(id) || openDisputeOrderIds.has(id)) continue;
            estimado += payoutNet(o);
        }

        const totalWithdrawn = ((withdrawalsRes.data as any[]) ?? [])
            .filter((w: any) => w.status === 'completed')
            .reduce((acc: number, w: any) => acc + toNumber(w.amount), 0);

        const totalCommissions = sellerOrders
            .filter((o: any) => !isCancelledStatus(String(o?.status ?? '')))
            .reduce((acc: number, o: any) => acc + toNumber(o.commission_fee), 0);

        const sellerBalance = {
            disponible: Math.round(disponible * 100) / 100,
            por_liberar: Math.round(porLiberar * 100) / 100,
            estimado: Math.round(estimado * 100) / 100,
            total_withdrawn: Math.round(totalWithdrawn * 100) / 100,
            total_commissions: Math.round(totalCommissions * 100) / 100,
            orders_disponible: disponiblesOrderIds.length,
        };

        return NextResponse.json({
            ok: true,
            targetUserId,
            user: {
                email: authUser?.user?.email || null,
                phone: authUser?.user?.phone || null,
                created_at: authUser?.user?.created_at || null,
                last_sign_in_at: authUser?.user?.last_sign_in_at || null,
                email_confirmed_at: authUser?.user?.email_confirmed_at || null,
            },
            profile: profileRes.data || null,
            wallet: walletRes.data || null,
            orders: ordersAsBuyerRes.data || [],
            // NEW
            seller_orders: sellerOrders.slice(0, 30),
            wallet_transactions: walletTxRes.data || [],
            seller_balance: sellerBalance,
            disputes_buyer: disputesBuyerRes.data || [],
            disputes_seller: disputesSellerRes.data || [],
            withdrawals: withdrawalsRes.data || [],
            listings: listingsRes.data || [],
            reviews: reviewsRes.data || [],
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Error obteniendo datos impersonados' }, { status: 500 });
    }
}
