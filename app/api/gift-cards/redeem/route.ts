import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const userId = userData.user.id;
        const body = await req.json();
        const code = String(body.code || '').trim().toUpperCase();

        if (!code || !/^GP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
            return NextResponse.json({ error: 'Formato de código inválido. Debe ser GP-XXXX-XXXX-XXXX' }, { status: 400 });
        }

        const admin = supabaseAdmin();
        const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

        // ── Rate Limiting: 5 attempts per minute ──
        const fiveMinAgo = new Date(Date.now() - 60_000).toISOString();
        const { count } = await admin
            .from('gift_card_redeem_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', fiveMinAgo);

        if ((count ?? 0) >= 5) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Espera 1 minuto antes de intentar de nuevo.' },
                { status: 429 }
            );
        }

        // ── Look up the gift card ──
        const { data: giftCard, error: gcErr } = await admin
            .from('gift_cards')
            .select('*')
            .eq('code', code)
            .maybeSingle();

        // Log the attempt
        await admin.from('gift_card_redeem_attempts').insert({
            user_id: userId,
            code_attempted: code,
            success: false,
            ip_address: ip,
        });

        if (gcErr || !giftCard) {
            return NextResponse.json({ error: 'Código no encontrado. Verifica e intenta de nuevo.' }, { status: 404 });
        }

        // Validations
        if (giftCard.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Esta tarjeta aún no ha sido pagada.' }, { status: 400 });
        }

        if (giftCard.status === 'redeemed') {
            return NextResponse.json({ error: 'Esta tarjeta ya fue canjeada.' }, { status: 400 });
        }

        if (giftCard.status === 'cancelled') {
            return NextResponse.json({ error: 'Esta tarjeta ha sido cancelada.' }, { status: 400 });
        }

        if (giftCard.status !== 'active') {
            return NextResponse.json({ error: 'Esta tarjeta no está activa.' }, { status: 400 });
        }

        // ── Redeem: credit wallet ──
        const amount = Number(giftCard.amount);

        await WalletService.addFunds(
            userId,
            amount,
            `Tarjeta de Regalo canjeada — ${code}`,
            'gift_card',
            giftCard.id
        );

        // Mark as redeemed
        await admin.from('gift_cards').update({
            status: 'redeemed',
            redeemed_by: userId,
            redeemed_at: new Date().toISOString(),
        }).eq('id', giftCard.id);

        // Update the attempt as successful
        await admin.from('gift_card_redeem_attempts')
            .update({ success: true })
            .eq('user_id', userId)
            .eq('code_attempted', code)
            .order('created_at', { ascending: false })
            .limit(1);

        return NextResponse.json({
            ok: true,
            amount,
            message: `¡$${amount.toLocaleString('es-MX')} MXN acreditados a tu PocketCash!`,
        });

    } catch (error: any) {
        console.error('[GIFT-CARD REDEEM] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
