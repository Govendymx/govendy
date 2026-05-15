import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

/** Admin API for managing gift cards */
export async function GET(req: NextRequest) {
    try {
        // Simple admin check via secret header
        const adminSecret = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret');
        const expectedSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET || '';

        if (!expectedSecret || adminSecret !== expectedSecret) {
            // Fallback: check if user is admin via auth
            const auth = req.headers.get('authorization') || '';
            const token = auth.replace(/^Bearer\s+/i, '').trim();
            if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

            const { createClient } = await import('@supabase/supabase-js');
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
            const supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            });
            const { data: userData } = await supabase.auth.getUser(token);
            if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

            const admin = supabaseAdmin();
            const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
            if (!adminRow) {
                // Fallback: also check profiles.role
                const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
                if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const admin = supabaseAdmin();
        const status = req.nextUrl.searchParams.get('status') || '';

        let query = admin
            .from('gift_cards')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        // Stats
        const all = data || [];
        const stats = {
            total: all.length,
            active: all.filter(g => g.status === 'active' && g.payment_status === 'paid').length,
            pending_payment: all.filter(g => g.payment_status === 'pending').length,
            redeemed: all.filter(g => g.status === 'redeemed').length,
            cancelled: all.filter(g => g.status === 'cancelled').length,
            total_sold: all.filter(g => g.payment_status === 'paid').reduce((sum: number, g: any) => sum + Number(g.amount), 0),
        };

        return NextResponse.json({ ok: true, gift_cards: all, stats });
    } catch (err: any) {
        console.error('[ADMIN GIFT-CARDS] GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/** Admin actions: approve payment, cancel card */
export async function POST(req: NextRequest) {
    try {
        const auth = req.headers.get('authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: userData } = await supabase.auth.getUser(token);
        if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminDb = supabaseAdmin();
        const { data: adminRow } = await adminDb.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
        if (!adminRow) {
            const { data: profile } = await adminDb.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
            if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { action, gift_card_id } = body;

        if (!gift_card_id || !action) {
            return NextResponse.json({ error: 'Missing action or gift_card_id' }, { status: 400 });
        }

        // Fetch gift card
        const { data: gc, error: gcErr } = await adminDb
            .from('gift_cards')
            .select('*')
            .eq('id', gift_card_id)
            .single();

        if (gcErr || !gc) {
            return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
        }

        // ── APPROVE MANUAL PAYMENT ──
        if (action === 'approve_payment') {
            if (gc.payment_status === 'paid') {
                return NextResponse.json({ error: 'Ya fue pagada' }, { status: 400 });
            }

            // Mark as paid
            await adminDb.from('gift_cards').update({ payment_status: 'paid' }).eq('id', gc.id);

            // If for_self, credit wallet immediately
            if (gc.for_self) {
                await WalletService.addFunds(
                    gc.purchased_by,
                    Number(gc.amount),
                    `Tarjeta de Regalo canjeada — ${gc.code}`,
                    'gift_card',
                    gc.id
                );
                await adminDb.from('gift_cards').update({
                    status: 'redeemed',
                    redeemed_by: gc.purchased_by,
                    redeemed_at: new Date().toISOString(),
                }).eq('id', gc.id);
            }

            return NextResponse.json({ ok: true, message: 'Pago aprobado' + (gc.for_self ? ' y saldo acreditado' : '') });
        }

        // ── CANCEL CARD ──
        if (action === 'cancel') {
            if (gc.status === 'redeemed') {
                return NextResponse.json({ error: 'No se puede cancelar una tarjeta ya canjeada' }, { status: 400 });
            }

            await adminDb.from('gift_cards').update({ status: 'cancelled' }).eq('id', gc.id);

            // If was paid with pocketcash, refund
            if (gc.payment_status === 'paid' && gc.payment_method === 'pocketcash') {
                await WalletService.addFunds(
                    gc.purchased_by,
                    Number(gc.amount),
                    `Reembolso — Tarjeta de Regalo ${gc.code} cancelada`,
                    'refund',
                    gc.id
                );
            }

            return NextResponse.json({ ok: true, message: 'Tarjeta cancelada' });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    } catch (err: any) {
        console.error('[ADMIN GIFT-CARDS] POST error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
