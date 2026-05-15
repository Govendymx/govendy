import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlan } from '@/lib/plans/limits';
import { getLiveHoursStatus, LIVE_PACKAGES } from '@/lib/live/hours';

// ─── GET: estado actual de horas ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();

        const { data: profile } = await admin
            .from('profiles')
            .select('plan_type, pro_subscription_end')
            .eq('id', auth.effectiveUserId)
            .single();

        let planType = profile?.plan_type ?? 'basic';
        if ((planType === 'platinum' || planType === 'pro') && profile?.pro_subscription_end) {
            if (new Date() > new Date(profile.pro_subscription_end)) planType = 'basic';
        }

        // PocketCash from wallets table (same source as navbar)
        const { data: wallet } = await admin
            .from('wallets')
            .select('balance')
            .eq('user_id', auth.effectiveUserId)
            .maybeSingle();

        const status = await getLiveHoursStatus(auth.effectiveUserId, planType);
        return NextResponse.json({ ...status, packages: LIVE_PACKAGES, pocket_cash: wallet?.balance ?? 0 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// ─── POST: comprar paquete de horas con PocketCash (TRANSACCIÓN ATÓMICA) ─────
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth(req);
        const admin = supabaseAdmin();
        const { package_id } = await req.json();

        // Validar paquete en servidor (el cliente no puede alterar precios)
        const pkg = LIVE_PACKAGES.find(p => p.id === package_id);
        if (!pkg) return NextResponse.json({ error: 'Paquete no válido' }, { status: 400 });

        // Ejecutar compra atómica via función SQL
        // Una sola transacción con row locking — imposible de hackear o explotar
        const { data, error } = await admin.rpc('purchase_live_hours', {
            p_user_id: auth.effectiveUserId,
            p_package_id: pkg.id,
            p_minutes: pkg.minutes,
            p_price_mxn: pkg.price_mxn,
            p_hours_label: String(pkg.hours),
        });

        if (error) {
            console.error('[Live Hours] RPC error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // La función SQL retorna un jsonb con el resultado
        const result = data as any;
        if (result?.error) {
            return NextResponse.json({ error: result.error }, { status: result.status || 400 });
        }

        return NextResponse.json({
            ok: true,
            minutes_added: result.minutes_added,
            new_balance_minutes: result.new_balance_minutes,
            new_pocket_cash: result.new_pocket_cash,
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
