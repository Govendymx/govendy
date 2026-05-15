import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest): Promise<
    { ok: false; error: string; status: number } |
    { ok: true; admin: ReturnType<typeof supabaseAdmin>; userId: string }
> {
    const token = getBearerToken(req);
    if (!token) return { ok: false, error: 'No autenticado', status: 401 };
    const admin = supabaseAdmin();
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return { ok: false, error: 'Token inválido', status: 401 };
    const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
    if (!adminRow) return { ok: false, error: 'Sin permisos', status: 403 };
    return { ok: true, admin, userId: userData.user.id };
}

// Helper dates
function startOfDayUtc(daysAgo = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
}
function startOfMonthUtc(monthsAgo = 0) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - monthsAgo, 1);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
}

export async function GET(req: NextRequest) {
    try {
        const guard = await requireAdmin(req);
        if (!guard.ok) return NextResponse.json({ error: (guard as any).error }, { status: (guard as any).status });
        const admin = (guard as any).admin as ReturnType<typeof supabaseAdmin>;

        const section = req.nextUrl.searchParams.get('section') || 'resumen';

        // ─── RESUMEN EJECUTIVO ───
        if (section === 'resumen') {
            const thisMonth = startOfMonthUtc(0);
            const lastMonth = startOfMonthUtc(1);
            const today = startOfDayUtc(0);
            const thisWeekStart = startOfDayUtc(7);

            const [
                ordersThisMonth, ordersLastMonth,
                sessionsThisMonth, sessionsLastMonth,
                profilesTotal, listingsActive,
                disputesOpen, ordersToday,
                walletsTotal
            ] = await Promise.all([
                admin.from('orders').select('id,total,created_at,status,payment_method').gte('created_at', thisMonth).limit(5000),
                admin.from('orders').select('id,total,created_at,status').gte('created_at', lastMonth).lt('created_at', thisMonth).limit(5000),
                admin.from('checkout_sessions').select('id,status,created_at,payment_method').gte('created_at', thisMonth).limit(5000),
                admin.from('checkout_sessions').select('id,status,created_at').gte('created_at', lastMonth).lt('created_at', thisMonth).limit(5000),
                admin.from('profiles').select('id', { count: 'exact', head: true }),
                admin.from('listings').select('id', { count: 'exact', head: true }),
                admin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
                admin.from('orders').select('id,total').gte('created_at', today).limit(5000),
                admin.from('wallets').select('balance').limit(50000),
            ]);

            const oThis = (ordersThisMonth.data ?? []) as any[];
            const oLast = (ordersLastMonth.data ?? []) as any[];
            const sThis = (sessionsThisMonth.data ?? []) as any[];
            const sLast = (sessionsLastMonth.data ?? []) as any[];
            const oToday = (ordersToday.data ?? []) as any[];
            const wAll = (walletsTotal.data ?? []) as any[];

            const ventasBrutasMes = oThis.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
            const ventasBrutasLastMes = oLast.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
            const ventasHoy = oToday.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
            const ticketPromedio = oThis.length > 0 ? ventasBrutasMes / oThis.length : 0;
            const ticketPromedioLast = oLast.length > 0 ? ventasBrutasLastMes / oLast.length : 0;

            // Conversion rate: paid sessions / total sessions
            const sessionsPaid = sThis.filter((s: any) => s.status === 'paid' || s.status === 'completed').length;
            const sessionsTotal = sThis.length;
            const conversionRate = sessionsTotal > 0 ? Math.round((sessionsPaid / sessionsTotal) * 10000) / 100 : 0;
            const sessionsPaidLast = sLast.filter((s: any) => s.status === 'paid' || s.status === 'completed').length;
            const conversionRateLast = sLast.length > 0 ? Math.round((sessionsPaidLast / sLast.length) * 10000) / 100 : 0;

            // Abandono de carrito
            const abandonRate = sessionsTotal > 0 ? Math.round(((sessionsTotal - sessionsPaid) / sessionsTotal) * 10000) / 100 : 0;

            // PocketCash global liability
            const pocketcashLiability = wAll.reduce((s: number, w: any) => s + (Number(w.balance) || 0), 0);

            // Pct change helper
            const pct = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0);

            // Daily sales for sparkline (last 7 days)
            const dailySales: { date: string; total: number; count: number }[] = [];
            for (let i = 6; i >= 0; i--) {
                const dayStart = new Date();
                dayStart.setUTCDate(dayStart.getUTCDate() - i);
                dayStart.setUTCHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
                const dayOrders = oThis.filter((o: any) => {
                    const d = new Date(o.created_at);
                    return d >= dayStart && d < dayEnd;
                });
                dailySales.push({
                    date: dayStart.toISOString().split('T')[0],
                    total: dayOrders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0),
                    count: dayOrders.length,
                });
            }

            // Payment method breakdown
            const paymentMethods: Record<string, number> = {};
            oThis.forEach((o: any) => {
                const pm = String(o.payment_method || 'unknown');
                paymentMethods[pm] = (paymentMethods[pm] || 0) + 1;
            });

            const resp = NextResponse.json({
                ok: true,
                section: 'resumen',
                data: {
                    ventasBrutasMes, ventasHoy, ticketPromedio,
                    ordenesMes: oThis.length, ordenesHoy: oToday.length,
                    conversionRate, abandonRate,
                    pocketcashLiability,
                    perfilesTotales: (profilesTotal as any)?.count ?? 0,
                    listingsActivos: (listingsActive as any)?.count ?? 0,
                    disputasAbiertas: (disputesOpen as any)?.count ?? 0,
                    // Comparisons
                    ventasBrutasCambio: pct(ventasBrutasMes, ventasBrutasLastMes),
                    ordenesCambio: pct(oThis.length, oLast.length),
                    ticketCambio: pct(ticketPromedio, ticketPromedioLast),
                    conversionCambio: pct(conversionRate, conversionRateLast),
                    dailySales,
                    paymentMethods,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── VENTAS & CONVERSIÓN ───
        if (section === 'ventas') {
            const last30 = startOfDayUtc(30);
            const [ordersRes, sessionsRes] = await Promise.all([
                admin.from('orders').select('id,total,created_at,status,payment_method,buyer_id').gte('created_at', last30).order('created_at', { ascending: true }).limit(5000),
                admin.from('checkout_sessions').select('id,status,created_at,payment_method,total_amount').gte('created_at', last30).limit(10000),
            ]);

            const orders = (ordersRes.data ?? []) as any[];
            const sessions = (sessionsRes.data ?? []) as any[];

            // Daily chart last 30 days
            const dailyData: { date: string; ventas: number; ordenes: number; sessions: number; pagadas: number }[] = [];
            for (let i = 29; i >= 0; i--) {
                const ds = new Date(); ds.setUTCDate(ds.getUTCDate() - i); ds.setUTCHours(0, 0, 0, 0);
                const de = new Date(ds); de.setUTCDate(de.getUTCDate() + 1);
                const dayO = orders.filter((o: any) => { const d = new Date(o.created_at); return d >= ds && d < de; });
                const dayS = sessions.filter((s: any) => { const d = new Date(s.created_at); return d >= ds && d < de; });
                const dayPaid = dayS.filter((s: any) => s.status === 'paid' || s.status === 'completed').length;
                dailyData.push({
                    date: ds.toISOString().split('T')[0],
                    ventas: dayO.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0),
                    ordenes: dayO.length,
                    sessions: dayS.length,
                    pagadas: dayPaid,
                });
            }

            // Payment method breakdown
            const methodBreakdown: Record<string, { count: number; total: number }> = {};
            orders.forEach((o: any) => {
                const pm = String(o.payment_method || 'otro');
                if (!methodBreakdown[pm]) methodBreakdown[pm] = { count: 0, total: 0 };
                methodBreakdown[pm].count++;
                methodBreakdown[pm].total += Number(o.total) || 0;
            });

            // Top buyers
            const buyerSpend: Record<string, number> = {};
            orders.forEach((o: any) => {
                if (o.buyer_id) {
                    buyerSpend[o.buyer_id] = (buyerSpend[o.buyer_id] || 0) + (Number(o.total) || 0);
                }
            });
            const topBuyers = Object.entries(buyerSpend)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([id, total]) => ({ id, total }));

            const resp = NextResponse.json({
                ok: true, section: 'ventas',
                data: { dailyData, methodBreakdown, topBuyers },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── USUARIOS ───
        if (section === 'usuarios') {
            const thisMonth = startOfMonthUtc(0);
            const last30 = startOfDayUtc(30);

            const [profilesRes, ordersRes] = await Promise.all([
                admin.from('profiles').select('id,created_at,full_name,nickname,username,phone,avatar_url').limit(50000),
                admin.from('orders').select('id,buyer_id,seller_id,created_at').gte('created_at', last30).limit(10000),
            ]);

            const profiles = (profilesRes.data ?? []) as any[];
            const orders = (ordersRes.data ?? []) as any[];

            // New users this month
            const newThisMonth = profiles.filter((p: any) => p.created_at && p.created_at >= thisMonth).length;
            const totalUsers = profiles.length;

            // Segmentation
            const buyerIds = new Set(orders.map((o: any) => o.buyer_id).filter(Boolean));
            const sellerIds = new Set(orders.map((o: any) => o.seller_id).filter(Boolean));
            const both = new Set([...buyerIds].filter(id => sellerIds.has(id)));
            const onlyBuyers = buyerIds.size - both.size;
            const onlySellers = sellerIds.size - both.size;
            const activeIds = new Set([...buyerIds, ...sellerIds]);
            const inactive = totalUsers - activeIds.size;

            // Incomplete profiles  
            const incomplete = profiles.filter((p: any) => !p.phone || !p.avatar_url).length;

            // Recurring buyers (bought more than once in 30 days)
            const buyerCounts: Record<string, number> = {};
            orders.forEach((o: any) => {
                if (o.buyer_id) buyerCounts[o.buyer_id] = (buyerCounts[o.buyer_id] || 0) + 1;
            });
            const recurring = Object.values(buyerCounts).filter(c => c > 1).length;
            const oneTime = Object.values(buyerCounts).filter(c => c === 1).length;

            // Registration trend last 30 days
            const regTrend: { date: string; count: number }[] = [];
            for (let i = 29; i >= 0; i--) {
                const ds = new Date(); ds.setUTCDate(ds.getUTCDate() - i); ds.setUTCHours(0, 0, 0, 0);
                const de = new Date(ds); de.setUTCDate(de.getUTCDate() + 1);
                const count = profiles.filter((p: any) => {
                    const d = new Date(p.created_at);
                    return d >= ds && d < de;
                }).length;
                regTrend.push({ date: ds.toISOString().split('T')[0], count });
            }

            const resp = NextResponse.json({
                ok: true, section: 'usuarios',
                data: {
                    totalUsers, newThisMonth, incomplete,
                    segmentation: { onlyBuyers, onlySellers, both: both.size, inactive },
                    retention: { recurring, oneTime, total: Object.keys(buyerCounts).length },
                    regTrend,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── PRODUCTOS & CATEGORÍAS ───
        if (section === 'productos') {
            const thirtyDaysAgo = startOfDayUtc(30);
            const [listingsRes, ordersRes] = await Promise.all([
                admin.from('listings').select('id,title,price,category,status,view_count,created_at').limit(10000),
                admin.from('orders').select('id,listing_id,total,created_at').gte('created_at', thirtyDaysAgo).limit(10000),
            ]);

            const listings = (listingsRes.data ?? []) as any[];
            const orders = (ordersRes.data ?? []) as any[];

            // Count orders per listing
            const ordersByListing: Record<string, number> = {};
            orders.forEach((o: any) => {
                if (o.listing_id) ordersByListing[o.listing_id] = (ordersByListing[o.listing_id] || 0) + 1;
            });

            // Listings with no sales (active for 30+ days, 0 orders)
            const thirtyDaysAgoDate = new Date(thirtyDaysAgo);
            const noSales = listings
                .filter((l: any) => !ordersByListing[l.id] && new Date(l.created_at) < thirtyDaysAgoDate)
                .slice(0, 20)
                .map((l: any) => ({ id: l.id, title: l.title, price: l.price, category: l.category, views: l.view_count || 0 }));

            // Most viewed without conversion
            const viewedNoConversion = listings
                .filter((l: any) => (l.view_count || 0) > 5 && !ordersByListing[l.id])
                .sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
                .slice(0, 15)
                .map((l: any) => ({ id: l.id, title: l.title, views: l.view_count, price: l.price, category: l.category }));

            // Average price by category
            const catPrices: Record<string, { sum: number; count: number }> = {};
            listings.forEach((l: any) => {
                const cat = String(l.category || 'Sin categoría');
                if (!catPrices[cat]) catPrices[cat] = { sum: 0, count: 0 };
                catPrices[cat].sum += Number(l.price) || 0;
                catPrices[cat].count++;
            });
            const avgByCategory = Object.entries(catPrices)
                .map(([category, v]) => ({ category, avgPrice: Math.round(v.sum / v.count), count: v.count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20);

            // Top categories by orders
            const catOrders: Record<string, number> = {};
            orders.forEach((o: any) => {
                const listing = listings.find((l: any) => l.id === o.listing_id);
                const cat = listing ? String(listing.category || 'Sin categoría') : 'Sin categoría';
                catOrders[cat] = (catOrders[cat] || 0) + 1;
            });
            const topCategories = Object.entries(catOrders)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([category, count]) => ({ category, orders: count }));

            const resp = NextResponse.json({
                ok: true, section: 'productos',
                data: {
                    totalActive: listings.length,
                    noSales, viewedNoConversion, avgByCategory, topCategories,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── ENVÍOS & SLA ───
        if (section === 'envios') {
            const last30 = startOfDayUtc(30);
            const [ordersRes, estafetaRes] = await Promise.all([
                admin.from('orders').select('id,status,created_at,seller_id,shipping_label_url,updated_at').gte('created_at', last30).limit(5000),
                admin.from('estafeta_quotes').select('id,status,created_at,paid_at,guide_url,total_price').gte('created_at', last30).limit(5000),
            ]);

            const orders = (ordersRes.data ?? []) as any[];
            const estafeta = (estafetaRes.data ?? []) as any[];

            // Orders that are paid but have no shipping label
            const paidNoLabel = orders.filter((o: any) => {
                const s = String(o.status || '').toLowerCase();
                return (s === 'paid' || s === 'processing') && !o.shipping_label_url;
            });

            // Aging: how many days since paid, no label
            const now = Date.now();
            const aging = { d1: 0, d2: 0, d3plus: 0 };
            paidNoLabel.forEach((o: any) => {
                const days = Math.floor((now - new Date(o.created_at).getTime()) / 86400000);
                if (days <= 1) aging.d1++;
                else if (days <= 2) aging.d2++;
                else aging.d3plus++;
            });

            // SLA: time from order creation to shipping label
            const withLabel = orders.filter((o: any) => o.shipping_label_url);
            const slaHours: number[] = [];
            withLabel.forEach((o: any) => {
                if (o.updated_at && o.created_at) {
                    const hours = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 3600000;
                    if (hours > 0 && hours < 720) slaHours.push(hours); // ignore outliers > 30 days
                }
            });
            const sla24 = slaHours.filter(h => h <= 24).length;
            const sla48 = slaHours.filter(h => h > 24 && h <= 48).length;
            const sla72 = slaHours.filter(h => h > 48 && h <= 72).length;
            const sla72plus = slaHours.filter(h => h > 72).length;
            const slaAvg = slaHours.length > 0 ? Math.round(slaHours.reduce((a, b) => a + b, 0) / slaHours.length) : 0;

            // Average shipping cost (from estafeta)
            const shippingCosts = estafeta.filter((e: any) => e.total_price).map((e: any) => Number(e.total_price) || 0);
            const avgShippingCost = shippingCosts.length > 0 ? Math.round(shippingCosts.reduce((a, b) => a + b, 0) / shippingCosts.length) : 0;

            // Slowest sellers (most orders without label)
            const sellerNoLabel: Record<string, number> = {};
            paidNoLabel.forEach((o: any) => {
                if (o.seller_id) sellerNoLabel[o.seller_id] = (sellerNoLabel[o.seller_id] || 0) + 1;
            });
            const slowSellers = Object.entries(sellerNoLabel)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([id, count]) => ({ id, pendingOrders: count }));

            const resp = NextResponse.json({
                ok: true, section: 'envios',
                data: {
                    totalOrders: orders.length,
                    paidNoLabel: paidNoLabel.length,
                    aging,
                    sla: { h24: sla24, h48: sla48, h72: sla72, h72plus: sla72plus, avgHours: slaAvg, total: slaHours.length },
                    avgShippingCost,
                    slowSellers,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── DISPUTAS & CALIDAD ───
        if (section === 'disputas') {
            const last90 = startOfDayUtc(90);
            const [disputesRes, ordersRes, reviewsRes] = await Promise.all([
                admin.from('disputes').select('id,status,created_at,resolved_at,seller_id,buyer_id,admin_decision').limit(5000),
                admin.from('orders').select('id', { count: 'exact', head: true }),
                admin.from('reviews').select('id,rating,created_at').gte('created_at', startOfMonthUtc(0)).limit(10000),
            ]);

            const disputes = (disputesRes.data ?? []) as any[];
            const totalOrders = (ordersRes as any)?.count ?? 0;
            const reviews = (reviewsRes.data ?? []) as any[];

            const open = disputes.filter((d: any) => d.status === 'open').length;
            const resolved = disputes.filter((d: any) => d.status === 'resolved' || d.resolved_at).length;
            const total = disputes.length;
            const rate = totalOrders > 0 ? Math.round((total / totalOrders) * 10000) / 100 : 0;

            // Avg resolution time
            const resolvedWithDates = disputes.filter((d: any) => d.resolved_at && d.created_at);
            const resHours = resolvedWithDates.map((d: any) =>
                (new Date(d.resolved_at).getTime() - new Date(d.created_at).getTime()) / 3600000
            ).filter(h => h > 0 && h < 2160); // < 90 days
            const avgResolution = resHours.length > 0 ? Math.round(resHours.reduce((a, b) => a + b, 0) / resHours.length) : 0;

            // Sellers with most disputes
            const sellerDisputes: Record<string, number> = {};
            disputes.forEach((d: any) => {
                if (d.seller_id) sellerDisputes[d.seller_id] = (sellerDisputes[d.seller_id] || 0) + 1;
            });
            const topDisputeSellers = Object.entries(sellerDisputes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([id, count]) => ({ id, disputes: count }));

            // Monthly trend
            const monthlyTrend: { date: string; count: number }[] = [];
            for (let i = 29; i >= 0; i--) {
                const ds = new Date(); ds.setUTCDate(ds.getUTCDate() - i); ds.setUTCHours(0, 0, 0, 0);
                const de = new Date(ds); de.setUTCDate(de.getUTCDate() + 1);
                const count = disputes.filter((d: any) => {
                    const dd = new Date(d.created_at);
                    return dd >= ds && dd < de;
                }).length;
                monthlyTrend.push({ date: ds.toISOString().split('T')[0], count });
            }

            // Reviews avg
            const avgRating = reviews.length > 0
                ? Math.round(reviews.reduce((s: number, r: any) => s + (Number(r.rating) || 0), 0) / reviews.length * 10) / 10
                : 0;

            const resp = NextResponse.json({
                ok: true, section: 'disputas',
                data: {
                    total, open, resolved, rate,
                    avgResolutionHours: avgResolution,
                    topDisputeSellers, monthlyTrend,
                    reviews: { count: reviews.length, avgRating },
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── POCKETCASH DETALLADO ───
        if (section === 'pocketcash') {
            const thisMonth = startOfMonthUtc(0);
            const [walletsRes, txThisMonthRes, txAllCreditsRes] = await Promise.all([
                admin.from('wallets').select('id,user_id,balance').order('balance', { ascending: false }).limit(50000),
                admin.from('wallet_transactions').select('id,type,amount,reference_type,created_at').gte('created_at', thisMonth).limit(10000),
                admin.from('wallet_transactions').select('id,type,amount,reference_type').eq('type', 'credit').limit(50000),
            ]);

            const wallets = (walletsRes.data ?? []) as any[];
            const txMonth = (txThisMonthRes.data ?? []) as any[];
            const txCredits = (txAllCreditsRes.data ?? []) as any[];

            // Top wallets
            const topWallets = wallets
                .filter((w: any) => (Number(w.balance) || 0) > 0)
                .slice(0, 15)
                .map((w: any) => ({ userId: w.user_id, balance: Number(w.balance) || 0 }));

            // Unusual balances (> $5000)
            const unusual = wallets.filter((w: any) => (Number(w.balance) || 0) > 5000);

            // Global liability
            const globalLiability = wallets.reduce((s: number, w: any) => s + (Number(w.balance) || 0), 0);

            // This month breakdown by type
            const monthCredits = txMonth.filter((t: any) => t.type === 'credit');
            const monthDebits = txMonth.filter((t: any) => t.type === 'debit');
            const totalCredited = monthCredits.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
            const totalDebited = monthDebits.reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);

            // Credit breakdown by reference_type
            const creditBreakdown: Record<string, { count: number; total: number }> = {};
            monthCredits.forEach((t: any) => {
                const ref = String(t.reference_type || 'otro');
                if (!creditBreakdown[ref]) creditBreakdown[ref] = { count: 0, total: 0 };
                creditBreakdown[ref].count++;
                creditBreakdown[ref].total += Number(t.amount) || 0;
            });

            // Debit breakdown by reference_type
            const debitBreakdown: Record<string, { count: number; total: number }> = {};
            monthDebits.forEach((t: any) => {
                const ref = String(t.reference_type || 'otro');
                if (!debitBreakdown[ref]) debitBreakdown[ref] = { count: 0, total: 0 };
                debitBreakdown[ref].count++;
                debitBreakdown[ref].total += Math.abs(Number(t.amount) || 0);
            });

            const resp = NextResponse.json({
                ok: true, section: 'pocketcash',
                data: {
                    globalLiability, walletsActive: wallets.filter((w: any) => (Number(w.balance) || 0) > 0).length,
                    topWallets, unusualCount: unusual.length,
                    month: { totalCredited, totalDebited, creditBreakdown, debitBreakdown },
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── SOPORTE & ACTIVIDAD ───
        if (section === 'soporte') {
            const last30 = startOfDayUtc(30);
            const today = startOfDayUtc(0);
            const [convosRes, eventsRes] = await Promise.all([
                admin.from('support_conversations').select('id,status,created_at,updated_at,assigned_to').limit(5000),
                admin.from('admin_operation_events').select('id,event_type,status,created_at,admin_id').gte('created_at', last30).order('created_at', { ascending: false }).limit(1000),
            ]);

            const convos = (convosRes.data ?? []) as any[];
            const events = (eventsRes.data ?? []) as any[];

            const openTickets = convos.filter((c: any) => c.status === 'open').length;
            const closedTickets = convos.filter((c: any) => c.status === 'closed' || c.status === 'resolved').length;
            const totalTickets = convos.length;

            // Avg response time (created_at to updated_at on closed)
            const closedWithDates = convos.filter((c: any) =>
                (c.status === 'closed' || c.status === 'resolved') && c.updated_at && c.created_at
            );
            const responseHours = closedWithDates.map((c: any) =>
                (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 3600000
            ).filter(h => h > 0 && h < 720);
            const avgResponseHours = responseHours.length > 0
                ? Math.round(responseHours.reduce((a, b) => a + b, 0) / responseHours.length)
                : 0;

            // Tickets without response > 24h
            const now = Date.now();
            const staleTickets = convos.filter((c: any) => {
                if (c.status !== 'open') return false;
                const hours = (now - new Date(c.created_at).getTime()) / 3600000;
                return hours > 24;
            }).length;

            // Daily ticket trend
            const ticketTrend: { date: string; opened: number; closed: number }[] = [];
            for (let i = 29; i >= 0; i--) {
                const ds = new Date(); ds.setUTCDate(ds.getUTCDate() - i); ds.setUTCHours(0, 0, 0, 0);
                const de = new Date(ds); de.setUTCDate(de.getUTCDate() + 1);
                const opened = convos.filter((c: any) => { const d = new Date(c.created_at); return d >= ds && d < de; }).length;
                const closed = convos.filter((c: any) => {
                    if (c.status !== 'closed' && c.status !== 'resolved') return false;
                    const d = new Date(c.updated_at || c.created_at);
                    return d >= ds && d < de;
                }).length;
                ticketTrend.push({ date: ds.toISOString().split('T')[0], opened, closed });
            }

            // Recent admin activity
            const recentActivity = events.slice(0, 20).map((e: any) => ({
                id: e.id,
                type: e.event_type,
                status: e.status,
                createdAt: e.created_at,
                adminId: e.admin_id,
            }));

            const resp = NextResponse.json({
                ok: true, section: 'soporte',
                data: {
                    totalTickets, openTickets, closedTickets,
                    avgResponseHours, staleTickets,
                    ticketTrend, recentActivity,
                    todayEvents: events.filter((e: any) => e.created_at >= today).length,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── ATENCIÓN REQUERIDA ───
        if (section === 'atencion') {
            const today = startOfDayUtc(0);
            const d30 = startOfDayUtc(30);

            // 1. Slow sellers - paid orders without shipping label
            const { data: paidNoLabel } = await admin
                .from('orders')
                .select('id, seller_id, created_at, total_amount, status')
                .eq('status', 'paid')
                .is('shipping_label_url', null)
                .order('created_at', { ascending: true })
                .limit(30);

            // Get seller profiles for display
            const sellerIds = [...new Set((paidNoLabel || []).map((o: any) => o.seller_id).filter(Boolean))];
            let sellerProfiles: Record<string, any> = {};
            if (sellerIds.length > 0) {
                const { data: profiles } = await admin
                    .from('profiles')
                    .select('id, full_name, nickname, username, email')
                    .in('id', sellerIds);
                (profiles || []).forEach((p: any) => {
                    sellerProfiles[p.id] = p;
                });
            }

            // Group by seller
            const sellerOrders: Record<string, any[]> = {};
            (paidNoLabel || []).forEach((o: any) => {
                if (!sellerOrders[o.seller_id]) sellerOrders[o.seller_id] = [];
                sellerOrders[o.seller_id].push(o);
            });
            const slowSellers = Object.entries(sellerOrders)
                .map(([sellerId, orders]) => {
                    const profile = sellerProfiles[sellerId] || {};
                    const oldestOrder = orders[0];
                    const hoursWaiting = Math.round((Date.now() - new Date(oldestOrder.created_at).getTime()) / 3600000);
                    return {
                        id: sellerId,
                        name: profile.full_name || profile.nickname || profile.username || profile.email || sellerId.slice(0, 8),
                        pendingOrders: orders.length,
                        totalAmount: orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
                        oldestOrderDate: oldestOrder.created_at,
                        hoursWaiting,
                        severity: hoursWaiting > 72 ? 'critical' : hoursWaiting > 24 ? 'warning' : 'info',
                    };
                })
                .sort((a, b) => b.hoursWaiting - a.hoursWaiting);

            // 2. Stale support tickets (>24h without response)
            const { data: staleTicketsRaw } = await admin
                .from('support_conversations')
                .select('id, subject, user_id, created_at, status')
                .eq('status', 'open')
                .lt('created_at', startOfDayUtc(1))
                .order('created_at', { ascending: true })
                .limit(20);

            const ticketUserIds = [...new Set((staleTicketsRaw || []).map((t: any) => t.user_id).filter(Boolean))];
            let ticketProfiles: Record<string, any> = {};
            if (ticketUserIds.length > 0) {
                const { data: profiles } = await admin
                    .from('profiles')
                    .select('id, full_name, nickname, username, email')
                    .in('id', ticketUserIds);
                (profiles || []).forEach((p: any) => {
                    ticketProfiles[p.id] = p;
                });
            }
            const staleTickets = (staleTicketsRaw || []).map((t: any) => {
                const profile = ticketProfiles[t.user_id] || {};
                const hoursOpen = Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000);
                return {
                    id: t.id,
                    userId: t.user_id,
                    userName: profile.full_name || profile.nickname || profile.username || profile.email || t.user_id?.slice(0, 8),
                    subject: t.subject || 'Sin asunto',
                    hoursOpen,
                    severity: hoursOpen > 72 ? 'critical' : hoursOpen > 48 ? 'warning' : 'info',
                    createdAt: t.created_at,
                };
            });

            // 3. Open disputes
            const { data: openDisputes } = await admin
                .from('disputes')
                .select('id, order_id, reason, status, created_at, buyer_id, seller_id')
                .in('status', ['open', 'pending', 'escalated'])
                .order('created_at', { ascending: true })
                .limit(20);

            const disputeUserIds = [...new Set((openDisputes || []).flatMap((d: any) => [d.buyer_id, d.seller_id]).filter(Boolean))];
            let disputeProfiles: Record<string, any> = {};
            if (disputeUserIds.length > 0) {
                const { data: profiles } = await admin
                    .from('profiles')
                    .select('id, full_name, nickname, username, email')
                    .in('id', disputeUserIds);
                (profiles || []).forEach((p: any) => {
                    disputeProfiles[p.id] = p;
                });
            }
            const disputes = (openDisputes || []).map((d: any) => {
                const buyerP = disputeProfiles[d.buyer_id] || {};
                const sellerP = disputeProfiles[d.seller_id] || {};
                const hoursOpen = Math.round((Date.now() - new Date(d.created_at).getTime()) / 3600000);
                return {
                    id: d.id,
                    orderId: d.order_id,
                    reason: d.reason || 'Sin razón',
                    status: d.status,
                    buyerId: d.buyer_id,
                    buyerName: buyerP.full_name || buyerP.nickname || buyerP.email || d.buyer_id?.slice(0, 8),
                    sellerId: d.seller_id,
                    sellerName: sellerP.full_name || sellerP.nickname || sellerP.email || d.seller_id?.slice(0, 8),
                    hoursOpen,
                    severity: d.status === 'escalated' ? 'critical' : hoursOpen > 48 ? 'warning' : 'info',
                    createdAt: d.created_at,
                };
            });

            // 4. Unusual wallet balances (>$5000)
            const { data: highWallets } = await admin
                .from('wallets')
                .select('user_id, balance')
                .gt('balance', 5000)
                .order('balance', { ascending: false })
                .limit(10);

            const walletUserIds = (highWallets || []).map((w: any) => w.user_id).filter(Boolean);
            let walletProfiles: Record<string, any> = {};
            if (walletUserIds.length > 0) {
                const { data: profiles } = await admin
                    .from('profiles')
                    .select('id, full_name, nickname, username, email')
                    .in('id', walletUserIds);
                (profiles || []).forEach((p: any) => {
                    walletProfiles[p.id] = p;
                });
            }
            const unusualWallets = (highWallets || []).map((w: any) => {
                const profile = walletProfiles[w.user_id] || {};
                return {
                    userId: w.user_id,
                    userName: profile.full_name || profile.nickname || profile.username || profile.email || w.user_id?.slice(0, 8),
                    balance: w.balance,
                };
            });

            // Summary counts
            const totalAlerts = slowSellers.length + staleTickets.length + disputes.length + unusualWallets.length;
            const criticalCount = [...slowSellers, ...staleTickets, ...disputes].filter((i: any) => i.severity === 'critical').length;

            const resp = NextResponse.json({
                data: {
                    totalAlerts,
                    criticalCount,
                    slowSellers,
                    staleTickets,
                    disputes,
                    unusualWallets,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── FINANZAS ───
        if (section === 'finanzas') {
            // Date boundaries
            const todayStart = startOfDayUtc(0);
            // Week: Monday of current week
            const nowDate = new Date();
            const dayOfWeek = nowDate.getUTCDay(); // 0=Sun, 1=Mon...
            const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const weekStart = new Date(nowDate);
            weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
            weekStart.setUTCHours(0, 0, 0, 0);
            const weekStartISO = weekStart.toISOString();
            const monthStart = startOfMonthUtc(0);

            // ── Parallel queries ──
            const [
                walletTxRes,        // wallet_transactions for multiple metrics
                ordersRes,          // orders for shipping + commissions
                estafetaRes,        // estafeta_quotes for shipping store
                proLogsRes,         // pro_subscription_logs for plans
            ] = await Promise.all([
                admin.from('wallet_transactions')
                    .select('id,type,amount,reference_type,concept,created_at')
                    .gte('created_at', monthStart)
                    .limit(50000),
                admin.from('orders')
                    .select('id,seller_id,shipping_fee,shipping_subsidy,commission_fee,created_at')
                    .gte('created_at', monthStart)
                    .limit(50000),
                admin.from('estafeta_quotes')
                    .select('id,total_price,status,created_at')
                    .eq('status', 'paid')
                    .gte('created_at', monthStart)
                    .limit(10000),
                admin.from('pro_subscription_logs')
                    .select('id,user_id,amount,created_at')
                    .gte('created_at', monthStart)
                    .limit(10000),
            ]);

            const walletTx = (walletTxRes.data ?? []) as any[];
            const orders = (ordersRes.data ?? []) as any[];
            const estafeta = (estafetaRes.data ?? []) as any[];
            const proLogs = (proLogsRes.data ?? []) as any[];

            // Get seller plan types for commission split + pro/platinum differentiation
            const sellerIds = [...new Set([
                ...orders.map((o: any) => o.seller_id),
                ...proLogs.map((l: any) => l.user_id),
            ].filter(Boolean))];

            let sellerPlans: Record<string, string> = {};
            if (sellerIds.length > 0) {
                // Batch in chunks of 500
                for (let i = 0; i < sellerIds.length; i += 500) {
                    const chunk = sellerIds.slice(i, i + 500);
                    const { data: profiles } = await admin.from('profiles')
                        .select('id,plan_type')
                        .in('id', chunk);
                    (profiles || []).forEach((p: any) => {
                        sellerPlans[p.id] = (p.plan_type || 'basic').toLowerCase();
                    });
                }
            }

            // ── Helper: sum by period ──
            type PeriodTotals = { hoy: number; semana: number; mes: number };
            const sumByPeriod = (items: any[], amountFn: (i: any) => number): PeriodTotals => {
                let hoy = 0, semana = 0, mes = 0;
                for (const item of items) {
                    const created = item.created_at || '';
                    const amt = amountFn(item);
                    if (created >= monthStart) mes += amt;
                    if (created >= weekStartISO) semana += amt;
                    if (created >= todayStart) hoy += amt;
                }
                return { hoy: Math.round(hoy * 100) / 100, semana: Math.round(semana * 100) / 100, mes: Math.round(mes * 100) / 100 };
            };

            // ── 1. Publicidad pagada con PocketCash ──
            const adTx = walletTx.filter((t: any) => t.type === 'debit' && t.reference_type === 'subscription');
            const m1 = sumByPeriod(adTx, (t: any) => Math.abs(Number(t.amount) || 0));

            // ── 2. Costo guías GoVendy (shipping_fee charged to buyer + shipping_subsidy = free shipping from seller) ──
            const m2 = sumByPeriod(orders, (o: any) => (Number(o.shipping_fee) || 0) + (Number(o.shipping_subsidy) || 0));

            // ── 3. Tienda Estafeta ──
            const m3 = sumByPeriod(estafeta, (e: any) => Number(e.total_price) || 0);

            // ── 4. Plan Pro ──
            const proOnlyLogs = proLogs.filter((l: any) => {
                const plan = sellerPlans[l.user_id] || 'basic';
                return plan === 'pro';
            });
            const m4 = sumByPeriod(proOnlyLogs, (l: any) => Number(l.amount) || 0);

            // ── 5. Plan Platinum ──
            const platLogs = proLogs.filter((l: any) => {
                const plan = sellerPlans[l.user_id] || 'basic';
                return plan === 'platinum';
            });
            const m5 = sumByPeriod(platLogs, (l: any) => Number(l.amount) || 0);

            // ── 6. GoVendyLive (horas compradas) ──
            const liveTx = walletTx.filter((t: any) => t.type === 'debit' && t.reference_type === 'live_hours');
            const m6 = sumByPeriod(liveTx, (t: any) => Math.abs(Number(t.amount) || 0));

            // ── 7. Gift Cards (NO TOCAR) ──
            const giftTx = walletTx.filter((t: any) => t.type === 'debit' && t.reference_type === 'gift_card');
            const m7 = sumByPeriod(giftTx, (t: any) => Math.abs(Number(t.amount) || 0));

            // ── 8. Comisiones 15% (Pro/Platinum) ──
            const proOrders = orders.filter((o: any) => {
                const plan = sellerPlans[o.seller_id] || 'basic';
                return plan === 'pro' || plan === 'platinum';
            });
            const m8 = sumByPeriod(proOrders, (o: any) => Number(o.commission_fee) || 0);

            // ── 9. Comisiones 20% (Básico) ──
            const basicOrders = orders.filter((o: any) => {
                const plan = sellerPlans[o.seller_id] || 'basic';
                return plan === 'basic' || plan === '' || !plan;
            });
            const m9 = sumByPeriod(basicOrders, (o: any) => Number(o.commission_fee) || 0);

            // ── 10. Cashback otorgado (NO TOCAR) ──
            const cashbackTx = walletTx.filter((t: any) => t.type === 'credit' && t.reference_type === 'cashback');
            const m10 = sumByPeriod(cashbackTx, (t: any) => Math.abs(Number(t.amount) || 0));

            // ── 11. Notificar seguidores (publicidad menú) ──
            const notifTx = walletTx.filter((t: any) => {
                if (t.type !== 'debit') return false;
                const concept = String(t.concept || '').toLowerCase();
                return concept.includes('notif') || concept.includes('seguidor') || concept.includes('publicidad');
            });
            const m11 = sumByPeriod(notifTx, (t: any) => Math.abs(Number(t.amount) || 0));

            // ── Totals ──
            const calcTotal = (period: 'hoy' | 'semana' | 'mes') => {
                const usable = m1[period] + m2[period] + m3[period] + m4[period] + m5[period]
                    + m6[period] + m8[period] + m9[period] + m11[period];
                const reserved = m7[period] + m10[period];
                return { usable: Math.round(usable * 100) / 100, reserved: Math.round(reserved * 100) / 100, total: Math.round((usable + reserved) * 100) / 100 };
            };

            const resp = NextResponse.json({
                ok: true,
                section: 'finanzas',
                data: {
                    metrics: [
                        { key: 'publicidad', label: 'Publicidad pagada (PocketCash)', icon: '📢', ...m1, reserved: false },
                        { key: 'guias', label: 'Guías GoVendy (envío)', icon: '📦', ...m2, reserved: false },
                        { key: 'estafeta', label: 'Tienda Estafeta', icon: '🏪', ...m3, reserved: false },
                        { key: 'plan_pro', label: 'Plan Pro', icon: '⭐', ...m4, reserved: false },
                        { key: 'plan_platinum', label: 'Plan Platinum', icon: '💎', ...m5, reserved: false },
                        { key: 'live', label: 'GoVendyLive (horas)', icon: '📺', ...m6, reserved: false },
                        { key: 'gift_cards', label: 'Gift Cards', icon: '🎁', ...m7, reserved: true },
                        { key: 'comision_pro', label: 'Comisiones 15% (Pro/Platinum)', icon: '💰', ...m8, reserved: false },
                        { key: 'comision_basic', label: 'Comisiones 20% (Básico)', icon: '💵', ...m9, reserved: false },
                        { key: 'cashback', label: 'Cashback otorgado', icon: '🔄', ...m10, reserved: true },
                        { key: 'notificar', label: 'Notificar seguidores', icon: '🔔', ...m11, reserved: false },
                    ],
                    totals: {
                        hoy: calcTotal('hoy'),
                        semana: calcTotal('semana'),
                        mes: calcTotal('mes'),
                    },
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        // ─── TAX SUMMARY (Contador Privado) ───
        if (section === 'tax_summary') {
            const thisMonth = startOfMonthUtc(0);

            // Fetch orders with tax columns for this month
            const { data: ordersRaw } = await admin
                .from('orders')
                .select('id,subtotal,total,commission_fee,isr_withheld,iva_withheld')
                .gte('created_at', thisMonth)
                .not('status', 'in', '("cancelled","canceled","refunded")')
                .limit(50000);

            const orders = (ordersRaw ?? []) as any[];

            let totalSales = 0;
            let totalCommissions = 0;
            let totalIsrWithheld = 0;
            let totalIvaWithheld = 0;
            let newItemOrders = 0;
            let usedItemOrders = 0;

            for (const o of orders) {
                totalSales += Number(o.subtotal || o.total || 0);
                totalCommissions += Number(o.commission_fee || 0);
                totalIsrWithheld += Number(o.isr_withheld || 0);
                totalIvaWithheld += Number(o.iva_withheld || 0);
                if (Number(o.iva_withheld || 0) > 0) {
                    newItemOrders++;
                } else {
                    usedItemOrders++;
                }
            }

            // Count sellers with/without RFC
            const { data: profilesRaw } = await admin
                .from('profiles')
                .select('id,rfc')
                .limit(50000);

            const profiles = (profilesRaw ?? []) as any[];
            let sellersWithRfc = 0;
            let sellersWithoutRfc = 0;
            for (const p of profiles) {
                const rfc = String(p.rfc || '').trim();
                if (rfc.length >= 12) {
                    sellersWithRfc++;
                } else {
                    sellersWithoutRfc++;
                }
            }

            const resp = NextResponse.json({
                ok: true,
                section: 'tax_summary',
                data: {
                    totalSales: Math.round(totalSales * 100) / 100,
                    totalCommissions: Math.round(totalCommissions * 100) / 100,
                    totalIsrWithheld: Math.round(totalIsrWithheld * 100) / 100,
                    totalIvaWithheld: Math.round(totalIvaWithheld * 100) / 100,
                    orderCount: orders.length,
                    newItemOrders,
                    usedItemOrders,
                    sellersWithRfc,
                    sellersWithoutRfc,
                },
            });
            resp.headers.set('Cache-Control', 'no-store, max-age=0');
            return resp;
        }

        return NextResponse.json({ error: `Sección desconocida: ${section}` }, { status: 400 });
    } catch (e: unknown) {
        console.error('[ADMIN ESTADISTICAS]', e);
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 });
    }
}
