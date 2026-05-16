import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const admin = auth.admin;
    const results: any = {
      pro_fixed: 0,
      stores_fixed: 0,
      errors: []
    };

    // 1. Fix PRO Users
    try {
      const now = new Date().toISOString();
      // Find users with active subscription
      const { data: potentialPros, error: fetchError } = await admin
        .from('profiles')
        .select('id, plan_type')
        .gt('pro_subscription_end', now);

      if (fetchError) throw fetchError;

      if (potentialPros) {
        for (const user of potentialPros) {
          if (user.plan_type !== 'pro') {
            const { error: updateError } = await admin
              .from('profiles')
              .update({ plan_type: 'pro' })
              .eq('id', user.id);
            
            if (!updateError) results.pro_fixed++;
            else results.errors.push(`Failed to update PRO user ${user.id}: ${updateError.message}`);
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`PRO fix error: ${e.message}`);
    }

    // 2. Fix Official Stores
    try {
      // Find users with official_store_name but is_official_store false/null
      const { data: potentialStores, error: fetchError } = await admin
        .from('profiles')
        .select('id, is_official_store')
        .neq('official_store_name', null)
        .neq('official_store_name', ''); // Ensure not empty string

      if (fetchError) throw fetchError;

      if (potentialStores) {
        for (const user of potentialStores) {
          if (!user.is_official_store) {
            const { error: updateError } = await admin
              .from('profiles')
              .update({ is_official_store: true })
              .eq('id', user.id);
            
            if (!updateError) results.stores_fixed++;
            else results.errors.push(`Failed to update Store user ${user.id}: ${updateError.message}`);
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`Store fix error: ${e.message}`);
    }

    return NextResponse.json(results);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
