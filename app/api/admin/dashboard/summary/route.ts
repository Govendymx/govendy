import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

function startOfTodayUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

function startOfMonthUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
}

function startOfWeekUtc() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0)).toISOString();
}

function isCancelled(s: string) {
  const t = String(s || '').toLowerCase();
  return t === 'cancelled' || t === 'canceled' || t === 'refunded';
}

function isPaidOrShipped(s: string) {
  const t = String(s || '').toLowerCase();
  return ['paid', 'shipped', 'delivered', 'completed', 'disputed'].includes(t);
}

function isReleased(s: string) {
  const t = String(s || '').toLowerCase();
  return t === 'delivered' || t === 'completed';
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const today = startOfTodayUtc();

    const out: {
      disputes_open: number;
      payments_offline_pending: number;
      orders_today: number;
      orders_paid_pending_ship: number;
      payouts_sellers_to_release: number;
      profiles_count: number;
      listings_active: number;
      listings_review_needed: number;
      support_unread_estimate: number;
      estafeta_paid_pending_guide: number;
      estafeta_paid_today: number;
      monthly_pocketcash_issued?: number;
      weekly_pocketcash_issued?: number;
      weekly_pocketcash_spent?: number;
      pocketcash_global_liability?: number;
      pocketcash_total_withdrawn?: number;
      pocketcash_total_spent_orders?: number;
    } = {
      disputes_open: 0,
      payments_offline_pending: 0,
      orders_today: 0,
      orders_paid_pending_ship: 0,
      payouts_sellers_to_release: 0,
      profiles_count: 0,
      listings_active: 0,
      listings_review_needed: 0,
      support_unread_estimate: 0,
      estafeta_paid_pending_guide: 0,
      estafeta_paid_today: 0,
    };

    await Promise.all([
      (async () => {
        try {
          const r: any = await admin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open').limit(1);
          out.disputes_open = typeof r?.count === 'number' ? r.count : 0;
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          const r: any = await admin
            .from('checkout_sessions')
            .select('id', { count: 'exact', head: true })
            .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
            .eq('status', 'pending')
            .limit(1);
          out.payments_offline_pending = typeof r?.count === 'number' ? r.count : 0;
          console.log('[ADMIN DASHBOARD SUMMARY] Pagos offline pendientes:', { count: out.payments_offline_pending, error: r?.error });
        } catch (e) {
          console.error('[ADMIN DASHBOARD SUMMARY] Error contando pagos offline:', e);
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today).limit(1);
          out.orders_today = typeof r?.count === 'number' ? r.count : 0;
          console.log('[ADMIN DASHBOARD SUMMARY] Órdenes hoy:', { count: out.orders_today, today, error: r?.error });
        } catch (e) {
          console.error('[ADMIN DASHBOARD SUMMARY] Error contando órdenes hoy:', e);
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid').limit(1);
          out.orders_paid_pending_ship = typeof r?.count === 'number' ? r.count : 0;
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('orders').select('id,seller_id,status,paid_to_seller_at').limit(4000);
          if (r?.error || !Array.isArray(r?.data)) return;
          const rows = (r.data as any[]) ?? [];
          const sellers = new Set<string>();
          for (const o of rows) {
            const st = String(o?.status || '').toLowerCase();
            if (!isPaidOrShipped(st) || isReleased(st) || isCancelled(st)) continue;
            if (o?.paid_to_seller_at) continue;
            const sid = String(o?.seller_id ?? '').trim();
            if (sid) sellers.add(sid);
          }
          out.payouts_sellers_to_release = sellers.size;
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
          out.profiles_count = typeof r?.count === 'number' ? r.count : 0;
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active').limit(1);
          out.listings_active = typeof r?.count === 'number' ? r.count : 0;
        } catch {
          try {
            const r2: any = await admin.from('listings').select('id', { count: 'exact', head: true }).limit(1);
            out.listings_active = typeof r2?.count === 'number' ? r2.count : 0;
          } catch {
            // ignore
          }
        }
      })(),
      (async () => {
        try {
          // Count listings flagged for review
          // We check the JSONB field attributes->>moderation_status
          // Note: .eq() on a JSON arrow operator requires PostgREST support which Supabase has.
          // Syntax: .eq('attributes->>moderation_status', 'review_needed')
          const r: any = await admin
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('attributes->>moderation_status', 'review_needed')
            .limit(1);
          out.listings_review_needed = typeof r?.count === 'number' ? r.count : 0;
        } catch (e) {
          console.error('[ADMIN SUMMARY] Error counting review needed listings:', e);
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('support_conversations').select('id', { count: 'exact', head: true }).eq('status', 'open').limit(1);
          out.support_unread_estimate = typeof r?.count === 'number' ? r.count : 0;
        } catch {
          try {
            const r2: any = await admin.from('support_conversations').select('id').limit(500);
            if (!r2?.error && Array.isArray(r2?.data)) out.support_unread_estimate = (r2.data as any[]).length;
          } catch {
            // ignore
          }
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('estafeta_quotes').select('id', { count: 'exact', head: true }).eq('status', 'paid').limit(1);
          out.estafeta_paid_pending_guide = typeof r?.count === 'number' ? r.count : 0;
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          const r: any = await admin.from('estafeta_quotes').select('id').gte('paid_at', today).limit(500);
          out.estafeta_paid_today = Array.isArray(r?.data) ? (r.data as any[]).length : 0;
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          // Monthly PocketCash Issued (Deposits, Cashback, Refunds, etc - credit)
          const startMonth = startOfMonthUtc();
          const { data, error } = await admin
            .from('wallet_transactions')
            .select('amount')
            .eq('type', 'credit')
            .gte('created_at', startMonth);

          if (!error && data) {
            out.monthly_pocketcash_issued = data.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          }
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          // Weekly PocketCash Issued (Deposits, Cashback, Refunds, etc - credit)
          const startWeek = startOfWeekUtc();
          const { data, error } = await admin
            .from('wallet_transactions')
            .select('amount')
            .eq('type', 'credit')
            .gte('created_at', startWeek);

          if (!error && data) {
            out.weekly_pocketcash_issued = data.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          }
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          // Weekly PocketCash Spent (Payments, Withdrawals - debit)
          const startWeek = startOfWeekUtc();
          const { data, error } = await admin
            .from('wallet_transactions')
            .select('amount')
            .eq('type', 'debit')
            .gte('created_at', startWeek);

          if (!error && data) {
            out.weekly_pocketcash_spent = data.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          }
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          // GLOBAL PocketCash Liability (Total Balance in all wallets)
          // "cuanto Pokecash hay como una cuenta global"
          const { data, error } = await admin
            .from('wallets')
            .select('balance');

          if (!error && data) {
            out.pocketcash_global_liability = data.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
          }
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          // Total PocketCash Released/Withdrawn (concept: 'withdrawal' or similar?)
          // Usually 'debit' with reference_type 'withdrawal' or similar. 
          // Assuming reference_type 'payout' or 'withdrawal' exists, or relying on concept text if not.
          // Let's use generic 'debit' sum as "Utilizado/Salido" if we want a broad metric, 
          // but specifically for "Liberado" (Withdrawn to bank) we should look for that type.
          // Since the prompt distinguishes "retira" vs "utilizado como compra", let's split if possible.
          // But without strict types, let's grab ALL Debits as "Total Utilizado" and maybe filter for withdrawals if we can.
          // For now, let's just add 'pocketcash_total_withdrawn' and 'pocketcash_total_spent_orders'.

          // 1. Withdrawn
          const { data: withdrawals, error: wErr } = await admin
            .from('wallet_transactions')
            .select('amount')
            .eq('type', 'debit')
            .eq('reference_type', 'withdrawal'); // Assuming this type exists from Payout logic

          if (!wErr && withdrawals) {
            out.pocketcash_total_withdrawn = withdrawals.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          }

          // 2. Spent on Orders
          const { data: ordersTx, error: oErr } = await admin
            .from('wallet_transactions')
            .select('amount')
            .eq('type', 'debit')
            .eq('reference_type', 'order');

          if (!oErr && ordersTx) {
            out.pocketcash_total_spent_orders = ordersTx.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          }

        } catch {
          // ignore
        }
      })(),
    ]);

    // Agregar conteo de eventos recientes
    let recentEventsCount = 0;
    let pendingEventsCount = 0;
    let urgentEventsCount = 0;
    try {
      const today = startOfTodayUtc();
      const eventsRes: any = await admin
        .from('admin_operation_events')
        .select('id,status,metadata')
        .gte('created_at', today)
        .limit(1000);
      if (!eventsRes.error && Array.isArray(eventsRes.data)) {
        recentEventsCount = eventsRes.data.length;
        pendingEventsCount = eventsRes.data.filter((e: any) => e.status === 'pending').length;
        urgentEventsCount = eventsRes.data.filter((e: any) => {
          const priority = (e as any)?.metadata?.priority;
          return priority === 'urgent' || priority === 'high';
        }).length;
      }
    } catch (eventsErr) {
      console.error('[ADMIN DASHBOARD SUMMARY] Error contando eventos:', eventsErr);
    }

    const resp = NextResponse.json({
      ok: true,
      ...out,
      recent_events_count: recentEventsCount,
      pending_events_count: pendingEventsCount,
      urgent_events_count: urgentEventsCount,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[ADMIN DASHBOARD SUMMARY]', e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
