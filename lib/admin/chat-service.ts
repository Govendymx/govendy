
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface AdminChatContext {
  orders_today: number;
  sales_today: number;
  payments_pending: number;
  disputes_open: number;
  users_new_today: number;
  support_pending: number;
  withdrawals_pending: number;
  active_listings: number;
}

export async function getAdminChatContext(): Promise<AdminChatContext> {
  const admin = supabaseAdmin();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // 1. Orders Today & Sales
  const { data: orders } = await admin
    .from('orders')
    .select('total')
    .gte('created_at', todayIso);

  const orders_today = orders?.length || 0;
  const sales_today = orders?.reduce((acc, o) => acc + (o.total || 0), 0) || 0;

  // 2. Pending Payments (Offline)
  const { count: payments_pending } = await admin
    .from('checkout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('payment_method', 'offline')
    .eq('status', 'pending');

  // 3. Open Disputes
  const { count: disputes_open } = await admin
    .from('disputes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  // 4. New Users Today
  const { count: users_new_today } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayIso);

  // 5. Support Pending
  const { count: support_pending } = await admin
    .from('support_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');
    
  // 6. Withdrawals Pending
  const { count: withdrawals_pending } = await admin
    .from('seller_withdrawals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // 7. Active Listings
  const { count: active_listings } = await admin
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  return {
    orders_today,
    sales_today,
    payments_pending: payments_pending || 0,
    disputes_open: disputes_open || 0,
    users_new_today: users_new_today || 0,
    support_pending: support_pending || 0,
    withdrawals_pending: withdrawals_pending || 0,
    active_listings: active_listings || 0,
  };
}
