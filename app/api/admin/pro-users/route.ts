import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    // Basic check, in production use proper session validation
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();

    // Fetch all profiles
    // Intentamos obtener email, pero si falla (porque la columna no existe), reintentamos sin email
    let data, error;

    try {
      // Intentar query principal
      const res = await admin
        .from('profiles')
        .select('id, full_name, email, plan_type, pro_subscription_start, pro_subscription_end')
        // REMOVED: .order('created_at', { ascending: false }) - Causing 500 if column missing
        .limit(1000);

      data = res.data;
      error = res.error;
    } catch (e) {
      // Fallback si falla por columna inexistente (email o created_at)
      console.warn('First attempt failed, retrying with minimal columns', e);
      const res = await admin
        .from('profiles')
        .select('id, full_name, plan_type, pro_subscription_start, pro_subscription_end')
        .limit(1000);
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('Error fetching pro users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Debug Log
    console.log(`[ProUsersAPI] Found ${data?.length || 0} raw profiles`);

    const now = new Date();

    // Filter in Javascript to be 100% sure we catch mixed cases and date logic
    const mappedUsers = data
      .filter(user => {
        const planType = (user.plan_type || '').toLowerCase();
        const isPlanPro = planType.includes('pro') || planType.includes('platinum');
        const hasHistory = !!user.pro_subscription_start;
        return isPlanPro || hasHistory;
      })
      .map(user => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_pro: (user.plan_type || '').toLowerCase().includes('pro') || (user.plan_type || '').toLowerCase().includes('platinum') || (user.pro_subscription_end && new Date(user.pro_subscription_end) > now),
        pro_subscription_start: user.pro_subscription_start,
        pro_subscription_end: user.pro_subscription_end,
        plan_type: user.plan_type || 'basic'
      }));

    return NextResponse.json(mappedUsers);
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
