import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLAN_LIMITS } from '@/lib/plans/limits';

// ─── Catálogo de paquetes ──────────────────────────────────────────────────────
export const LIVE_PACKAGES = [
    { id: 'h1', hours: 1, minutes: 60, price_mxn: 59 },
    { id: 'h2', hours: 2, minutes: 120, price_mxn: 109 },
    { id: 'h3', hours: 3, minutes: 180, price_mxn: 149 },
    { id: 'h4', hours: 4, minutes: 240, price_mxn: 179 },
    { id: 'h5', hours: 5, minutes: 300, price_mxn: 199 },
    { id: 'h10', hours: 10, minutes: 600, price_mxn: 349 },
    { id: 'h15', hours: 15, minutes: 900, price_mxn: 479 },
    { id: 'h20', hours: 20, minutes: 1200, price_mxn: 599 },
    { id: 'h25', hours: 25, minutes: 1500, price_mxn: 729 },
    { id: 'h30', hours: 30, minutes: 1800, price_mxn: 849 },
    { id: 'h35', hours: 35, minutes: 2100, price_mxn: 969 },
    { id: 'h40', hours: 40, minutes: 2400, price_mxn: 1079 },
    { id: 'h50', hours: 50, minutes: 3000, price_mxn: 1299 },
    { id: 'h100', hours: 100, minutes: 6000, price_mxn: 2299 },
] as const;

// ─── Helper: obtener saldo de horas del usuario ───────────────────────────────
export async function getLiveHoursStatus(userId: string, planType: string) {
    const admin = supabaseAdmin();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const freeMinsDaily = (PLAN_LIMITS as any)[planType]?.live_free_mins_daily ?? 0;

    // Obtener uso de hoy (solo relevante para Platinum)
    const { data: usage } = await admin
        .from('live_daily_usage')
        .select('minutes_used')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle();

    const minutesUsedToday = usage?.minutes_used ?? 0;
    const freeMinsRemainingToday = Math.max(0, freeMinsDaily - minutesUsedToday);

    // Obtener saldo de horas extra
    const { data: extra } = await admin
        .from('live_extra_hours')
        .select('minutes_balance')
        .eq('user_id', userId)
        .maybeSingle();

    const extraMinsBalance = extra?.minutes_balance ?? 0;

    return {
        plan: planType,
        free_mins_daily: freeMinsDaily,
        free_mins_remaining_today: freeMinsRemainingToday,
        minutes_used_today: minutesUsedToday,
        extra_mins_balance: extraMinsBalance,
        can_go_live: freeMinsRemainingToday > 0 || extraMinsBalance > 0,
    };
}

// ─── Helper: deducir minutos de un live terminado ─────────────────────────────
export async function deductLiveMinutes(userId: string, planType: string, minutesUsed: number) {
    if (minutesUsed <= 0) return;
    const admin = supabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    const freeMinsDaily = (PLAN_LIMITS as any)[planType]?.live_free_mins_daily ?? 0;

    // Cuántos minutos gratuitos quedan hoy
    const { data: usageRow } = await admin
        .from('live_daily_usage')
        .select('minutes_used')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle();

    const usedToday = usageRow?.minutes_used ?? 0;
    const freeRemaining = Math.max(0, freeMinsDaily - usedToday);

    // Consumir primero horas gratuitas
    const fromFree = Math.min(minutesUsed, freeRemaining);
    const fromExtra = minutesUsed - fromFree;

    if (fromFree > 0) {
        await admin.from('live_daily_usage').upsert(
            { user_id: userId, usage_date: today, minutes_used: usedToday + fromFree },
            { onConflict: 'user_id,usage_date' }
        );
    }

    if (fromExtra > 0) {
        const { data: extraRow } = await admin
            .from('live_extra_hours')
            .select('minutes_balance')
            .eq('user_id', userId)
            .maybeSingle();

        const currentBalance = extraRow?.minutes_balance ?? 0;
        const newBalance = Math.max(0, currentBalance - fromExtra);

        await admin.from('live_extra_hours').upsert(
            { user_id: userId, minutes_balance: newBalance, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
        );
    }
}
