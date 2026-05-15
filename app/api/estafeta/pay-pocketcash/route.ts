import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = userData.user.id;
        const body = await req.json().catch(() => ({}));
        const quoteId = String(body.quote_id || '').trim();

        if (!quoteId) {
            return NextResponse.json({ error: 'quote_id es requerido.' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // Verify quote exists and belongs to user
        const { data: quote, error: quoteErr } = await admin
            .from('estafeta_quotes')
            .select('id, user_id, calculated_cost, status, sender_name, recipient_name')
            .eq('id', quoteId)
            .maybeSingle();

        if (quoteErr || !quote) {
            return NextResponse.json({ error: 'Cotización no encontrada.' }, { status: 404 });
        }

        if (quote.user_id !== userId) {
            return NextResponse.json({ error: 'No tienes permiso para pagar esta cotización.' }, { status: 403 });
        }

        if (quote.status !== 'quote' && quote.status !== 'pending_payment') {
            return NextResponse.json({ error: 'Esta cotización ya fue procesada.' }, { status: 400 });
        }

        // Validate all required fields are present
        const { data: fullQuote } = await admin
            .from('estafeta_quotes')
            .select('sender_name, sender_phone, sender_address, sender_city, sender_state, sender_postal_code, recipient_name, recipient_phone, recipient_address, recipient_city, recipient_state, recipient_postal_code')
            .eq('id', quoteId)
            .single();

        if (!fullQuote || !fullQuote.sender_name || !fullQuote.recipient_name) {
            return NextResponse.json({ error: 'La cotización no tiene todos los datos necesarios.' }, { status: 400 });
        }

        const amount = Number(quote.calculated_cost || 0);
        if (amount <= 0) {
            return NextResponse.json({ error: 'El monto debe ser mayor a 0.' }, { status: 400 });
        }

        // Check wallet balance
        const { data: wallet } = await admin
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

        const currentBalance = Number(wallet?.balance || 0);
        if (currentBalance < amount) {
            return NextResponse.json({
                error: `Saldo insuficiente. Necesitas $${amount.toFixed(2)} MXN y tienes $${currentBalance.toFixed(2)} MXN. Recarga tu PocketCash primero.`,
                balance: currentBalance,
                required: amount,
            }, { status: 402 });
        }

        // Deduct from PocketCash
        try {
            await WalletService.deductFunds(
                userId,
                amount,
                `Guía Estafeta — Envío de ${fullQuote.sender_city} a ${fullQuote.recipient_city}`,
                'order',
                quoteId
            );
        } catch (walletErr: any) {
            console.error('[pay-pocketcash] Wallet deduction error:', walletErr);
            return NextResponse.json({
                error: walletErr.message || 'Error al cobrar de PocketCash.',
            }, { status: 500 });
        }

        // Update quote status to paid
        await admin
            .from('estafeta_quotes')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
            })
            .eq('id', quoteId);

        // Get updated balance
        const { data: updatedWallet } = await admin
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

        return NextResponse.json({
            ok: true,
            message: `Pago exitoso. Se descontaron $${amount.toFixed(2)} MXN de tu PocketCash.`,
            new_balance: Number(updatedWallet?.balance || 0),
        });
    } catch (e: any) {
        console.error('[pay-pocketcash] Exception:', e);
        return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
    }
}
