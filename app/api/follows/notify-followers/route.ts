import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';

export const dynamic = 'force-dynamic';

// Tiered pricing based on follower count
function getNotifPrice(followerCount: number): number {
    if (followerCount <= 50) return 29;
    if (followerCount <= 200) return 59;
    if (followerCount <= 500) return 99;
    if (followerCount <= 1000) return 149;
    return 199;
}

export async function POST(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Auth
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { data: userData } = await admin.auth.getUser(token);
        if (!userData?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const userId = userData.user.id;

        const body = await req.json();
        const { message } = body;

        if (!message || typeof message !== 'string' || message.trim().length < 5) {
            return NextResponse.json({ error: 'El mensaje debe tener al menos 5 caracteres' }, { status: 400 });
        }

        if (message.trim().length > 200) {
            return NextResponse.json({ error: 'El mensaje no puede exceder 200 caracteres' }, { status: 400 });
        }

        // Get followers
        const { data: followers } = await admin
            .from('follows')
            .select('follower_id')
            .eq('seller_id', userId);

        const followerCount = followers?.length || 0;
        if (followerCount === 0) {
            return NextResponse.json({ error: 'No tienes seguidores aún' }, { status: 400 });
        }

        // Calculate price
        const price = getNotifPrice(followerCount);

        // Check wallet balance
        const { data: wallet } = await admin
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        const balance = Number(wallet?.balance ?? 0);
        if (balance < price) {
            return NextResponse.json({
                error: `Saldo insuficiente. Necesitas $${price} MXN pero tienes $${balance.toFixed(2)} MXN`,
                required: price,
                balance,
            }, { status: 402 });
        }

        // Deduct funds
        const { error: deductError } = await admin
            .from('wallets')
            .update({ balance: balance - price })
            .eq('user_id', userId);

        if (deductError) {
            return NextResponse.json({ error: 'Error al cobrar' }, { status: 500 });
        }

        // Record transaction (best effort)
        try {
            await admin.from('wallet_transactions').insert({
                wallet_id: userId,
                user_id: userId,
                type: 'debit',
                amount: price,
                description: `Notificación masiva a ${followerCount} seguidores`,
            });
        } catch (_) { /* ignore */ }

        // Get seller name
        const { data: profile } = await admin
            .from('profiles')
            .select('full_name, nickname')
            .eq('id', userId)
            .single();

        const sellerName = profile?.full_name || profile?.nickname || 'Vendedor Pocket';

        const storeUrl = `/tienda/${userId}`;
        const finalMessage = `${message.trim()}\n\nVisita mi tienda aquí: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gopocket.com.mx'}${storeUrl}`;

        // Send notifications
        let sent = 0;
        for (const f of followers!) {
            const result = await insertNotificationBestEffort(admin, {
                user_id: f.follower_id,
                type: 'admin_announcement',
                title: `📢 Notificación de ${sellerName}`,
                body: message.trim(),
                link_to: storeUrl,
                data: { kind: 'seller_promo', seller_id: userId, seller_name: sellerName },
            });
            if (result.ok) sent++;
        }

        return NextResponse.json({
            ok: true,
            sent,
            total: followerCount,
            charged: price,
        });
    } catch (e: any) {
        console.error('[NOTIFY-FOLLOWERS] Error:', e);
        return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
    }
}
