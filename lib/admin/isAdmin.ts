import type { SupabaseClient } from '@supabase/supabase-js';

export async function isAdminUser(admin: SupabaseClient, userId: string): Promise<boolean> {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  try {
    const res: any = await admin.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
    return Boolean(res?.data?.user_id) && !res?.error;
  } catch {
    return false;
  }
}

