import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { calculateMercadoPagoFee } from '@/lib/fees';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const VALID_AMOUNTS = [50, 100, 200, 500, 1000];
const VALID_PAYMENT_METHODS = ['mercadopago', 'pocketcash', 'bank_transfer', 'bank_deposit', 'oxxo'];

function getBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

/** Generate a cryptographically secure gift card code: GP-XXXX-XXXX-XXXX */
function generateGiftCardCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I to avoid confusion
    const bytes = crypto.randomBytes(12);
    let code = '';
    for (let i = 0; i < 12; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return `GP-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
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
        const amount = Number(body.amount);
        const paymentMethod = String(body.payment_method || 'pocketcash');
        const forSelf = Boolean(body.for_self);
        const recipientEmail = body.recipient_email ? String(body.recipient_email).trim() : null;
        const message = body.message ? String(body.message).slice(0, 500) : null;

        // Validations
        if (!VALID_AMOUNTS.includes(amount)) {
            return NextResponse.json({ error: `Monto inválido. Opciones: $${VALID_AMOUNTS.join(', $')}` }, { status: 400 });
        }
        if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
            return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // Generate unique code (retry up to 5 times for collisions)
        let code = '';
        for (let attempt = 0; attempt < 5; attempt++) {
            code = generateGiftCardCode();
            const { data: existing } = await admin.from('gift_cards').select('id').eq('code', code).maybeSingle();
            if (!existing) break;
            if (attempt === 4) {
                return NextResponse.json({ error: 'Error interno al generar código' }, { status: 500 });
            }
        }

        // ═══════════════════════════════════════════
        // PocketCash Payment
        // ═══════════════════════════════════════════
        if (paymentMethod === 'pocketcash') {
            // Check balance
            const wallet = await WalletService.getOrCreateWallet(userId);
            if (Number(wallet.balance) < amount) {
                return NextResponse.json({ error: 'Saldo insuficiente en PocketCash' }, { status: 400 });
            }

            // Deduct funds
            await WalletService.deductFunds(
                userId,
                amount,
                `Compra Tarjeta de Regalo $${amount}`,
                'gift_card',
                code
            );

            // Create gift card as paid
            const { data: giftCard, error: gcErr } = await admin.from('gift_cards').insert({
                code,
                amount,
                status: forSelf ? 'redeemed' : 'active',
                purchased_by: userId,
                redeemed_by: forSelf ? userId : null,
                for_self: forSelf,
                recipient_email: recipientEmail,
                message,
                payment_method: 'pocketcash',
                payment_status: 'paid',
                redeemed_at: forSelf ? new Date().toISOString() : null,
            }).select('id, code, amount, status').single();

            if (gcErr) {
                console.error('[GIFT-CARD] Error creating gift card:', gcErr);
                return NextResponse.json({ error: 'Error al crear tarjeta de regalo' }, { status: 500 });
            }

            // If for self, credit immediately
            if (forSelf) {
                await WalletService.addFunds(
                    userId,
                    amount,
                    `Tarjeta de Regalo canjeada — ${code}`,
                    'gift_card',
                    giftCard!.id
                );
            }

            return NextResponse.json({
                ok: true,
                gift_card: giftCard,
                message: forSelf
                    ? `¡$${amount} MXN acreditados a tu PocketCash!`
                    : `Tarjeta de regalo generada: ${code}`,
            });
        }

        // ═══════════════════════════════════════════
        // Manual Payment (Transfer / Deposit / OXXO)
        // ═══════════════════════════════════════════
        const offlineMethods = ['bank_transfer', 'bank_deposit', 'oxxo'];
        if (offlineMethods.includes(paymentMethod)) {
            const { data: giftCard, error: gcErr } = await admin.from('gift_cards').insert({
                code,
                amount,
                status: 'active',
                purchased_by: userId,
                for_self: forSelf,
                recipient_email: recipientEmail,
                message,
                payment_method: paymentMethod,
                payment_status: 'pending',
            }).select('id, code, amount, status, payment_status').single();

            if (gcErr) {
                console.error('[GIFT-CARD] Error creating offline gift card:', gcErr);
                return NextResponse.json({ error: 'Error al crear tarjeta de regalo' }, { status: 500 });
            }

            return NextResponse.json({
                ok: true,
                gift_card: giftCard,
                status: 'pending_payment',
                message: 'Tarjeta creada. Realiza el pago y sube tu comprobante para activarla.',
            });
        }

        // ═══════════════════════════════════════════
        // MercadoPago Payment
        // ═══════════════════════════════════════════
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
        if (!accessToken) {
            return NextResponse.json({ error: 'MercadoPago no configurado' }, { status: 500 });
        }

        const { total, fee } = calculateMercadoPagoFee(amount);

        // Create gift card record (pending payment)
        const { data: giftCard, error: gcErr } = await admin.from('gift_cards').insert({
            code,
            amount,
            status: 'active',
            purchased_by: userId,
            for_self: forSelf,
            recipient_email: recipientEmail,
            message,
            payment_method: 'mercadopago',
            payment_status: 'pending',
        }).select('id').single();

        if (gcErr) {
            console.error('[GIFT-CARD] Error creating MP gift card:', gcErr);
            return NextResponse.json({ error: 'Error al crear tarjeta de regalo' }, { status: 500 });
        }

        // Create MercadoPago preference
        const client = new MercadoPagoConfig({ accessToken });
        const preference = new Preference(client);
        const origin = req.nextUrl.origin;
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
        const notificationUrl = webhookSecret
            ? `${origin}/api/mercadopago/webhook?token=${encodeURIComponent(webhookSecret)}`
            : `${origin}/api/mercadopago/webhook`;

        const result = await preference.create({
            body: {
                items: [{
                    id: `gift-card-${giftCard!.id}`,
                    title: `Tarjeta de Regalo PocketCash $${amount}`,
                    description: `Tarjeta de Regalo por $${amount} MXN para PocketCash`,
                    quantity: 1,
                    unit_price: total,
                    currency_id: 'MXN',
                }],
                external_reference: `gift_card_${giftCard!.id}`,
                notification_url: notificationUrl,
                payment_methods: { installments: 1 },
                back_urls: {
                    success: `${origin}/gift-cards?status=success`,
                    failure: `${origin}/gift-cards?status=failure`,
                    pending: `${origin}/gift-cards?status=pending`,
                },
                metadata: {
                    type: 'gift_card',
                    user_id: userId,
                    gift_card_id: giftCard!.id,
                    for_self: forSelf,
                    amount,
                },
            },
        });

        const preferenceId = (result as any)?.id;
        const initPoint = (result as any)?.init_point || (result as any)?.sandbox_init_point;

        if (!preferenceId || !initPoint) {
            return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 500 });
        }

        // Save preference ID
        await admin.from('gift_cards')
            .update({ mercadopago_preference_id: String(preferenceId) })
            .eq('id', giftCard!.id);

        return NextResponse.json({
            ok: true,
            init_point: initPoint,
            preference_id: preferenceId,
            gift_card_id: giftCard!.id,
            fee,
            total,
        });

    } catch (error: any) {
        console.error('[GIFT-CARD PURCHASE] Error:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
