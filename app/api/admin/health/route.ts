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

  return { ok: true as const, admin };
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Salud de pagos
    const { data: paymentLogs24h, error: paymentError } = await admin
      .from('payment_logs')
      .select('status')
      .gte('created_at', last24h);

    const paymentsLast24h = paymentLogs24h?.length || 0;
    const paymentErrors = paymentLogs24h?.filter((log) => log.status === 'error').length || 0;
    const paymentSuccess = paymentLogs24h?.filter((log) => log.status === 'success').length || 0;

    // 2. Salud de notificaciones (aproximado desde notifications)
    const { data: notifications24h } = await admin
      .from('notifications')
      .select('id')
      .gte('created_at', last24h);

    const notificationsLast24h = notifications24h?.length || 0;

    // 3. Estado de usuarios
    const { data: userStates } = await admin.from('user_admin_states').select('status');
    const activeUsers = userStates?.filter((s) => s.status === 'active').length || 0;
    const suspendedUsers = userStates?.filter((s) => s.status === 'suspended').length || 0;
    const bannedUsers = userStates?.filter((s) => s.status === 'banned').length || 0;

    // 4. Estado de órdenes
    const { data: orders } = await admin.from('orders').select('status');
    const pendingOrders = orders?.filter((o) => o.status === 'pending_payment').length || 0;
    const paidOrders = orders?.filter((o) => o.status === 'paid').length || 0;
    const shippedOrders = orders?.filter((o) => o.status === 'shipped').length || 0;

    // 5. Errores recientes en payment_logs
    const { data: recentErrors } = await admin
      .from('payment_logs')
      .select('id, error, stage, created_at')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Calcular estado general
    const paymentErrorRate = paymentsLast24h > 0 ? (paymentErrors / paymentsLast24h) * 100 : 0;
    const paymentStatus = paymentErrorRate < 5 ? 'healthy' : paymentErrorRate < 15 ? 'warning' : 'critical';

    const resp = NextResponse.json({
      ok: true,
      health: {
        payments: {
          status: paymentStatus,
          last24h: paymentsLast24h,
          success: paymentSuccess,
          errors: paymentErrors,
          errorRate: `${paymentErrorRate.toFixed(2)}%`,
        },
        notifications: {
          status: 'healthy',
          sent: notificationsLast24h,
        },
        users: {
          active: activeUsers,
          suspended: suspendedUsers,
          banned: bannedUsers,
        },
        orders: {
          pending: pendingOrders,
          paid: paidOrders,
          shipped: shippedOrders,
        },
        recentErrors: recentErrors || [],
        timestamp: now.toISOString(),
      },
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[ADMIN HEALTH]', e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
