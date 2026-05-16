import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const admin = auth.admin;
    const results: any = { 
      checks: {}, 
      samples: {},
      stats: {
        total_profiles: 0,
        plan_pro: 0,
        plan_basic: 0,
        plan_null: 0,
        active_sub: 0,
        is_pro_legacy: 0
      } 
    };

    // 1. Check Stats
    try {
      const { count: total } = await admin.from('profiles').select('*', { count: 'exact', head: true });
      results.stats.total_profiles = total || 0;

      const { count: pro } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('plan_type', 'pro');
      results.stats.plan_pro = pro || 0;

      const { count: basic } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('plan_type', 'basic');
      results.stats.plan_basic = basic || 0;
      
      const { count: nullPlan } = await admin.from('profiles').select('*', { count: 'exact', head: true }).is('plan_type', null);
      results.stats.plan_null = nullPlan || 0;

      const now = new Date().toISOString();
      const { count: active } = await admin.from('profiles').select('*', { count: 'exact', head: true }).gt('pro_subscription_end', now);
      results.stats.active_sub = active || 0;

      // Check legacy column if exists
      try {
        const { count: legacy } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true);
        results.stats.is_pro_legacy = legacy || 0;
      } catch {
        results.stats.is_pro_legacy = 'Column not found';
      }

    } catch (e: any) {
      results.checks.stats_error = e.message;
    }

    // 2. Sample Data (Raw)
    try {
      const { data, error } = await admin
        .from('profiles')
        .select('id, full_name, plan_type, pro_subscription_end') // Removed email to be safe
        .limit(10);
      
      // Try to fetch emails separately or assume they are there if script ran
      const { data: dataWithEmail } = await admin
        .from('profiles')
        .select('id, email, plan_type')
        .limit(5);

      results.checks.pro_columns = error ? `Error: ${error.message}` : 'OK';
      results.samples.raw_profiles = dataWithEmail || data;
    } catch (e: any) {
      results.checks.pro_columns = `Exception: ${e.message}`;
    }

    return NextResponse.json(results);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
