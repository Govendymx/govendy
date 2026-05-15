/**
 * Helper para leer el estado admin de un usuario (suspended, banned, active).
 * Usar con supabaseAdmin() en APIs.
 */

export type UserAdminState = {
  status: 'active' | 'suspended' | 'banned';
  suspended_until: string | null;
};

export async function getUserAdminState(admin: any, userId: string): Promise<UserAdminState | null> {
  if (!userId?.trim()) return null;
  const { data, error } = await admin
    .from('user_admin_states')
    .select('status,suspended_until')
    .eq('user_id', userId.trim())
    .maybeSingle();
  if (error || !data) return null;
  const status = String((data as any)?.status || 'active').trim().toLowerCase();
  const suspended_until = (data as any)?.suspended_until ?? null;
  return {
    status: status === 'banned' ? 'banned' : status === 'suspended' ? 'suspended' : 'active',
    suspended_until: suspended_until ? String(suspended_until) : null,
  };
}

export function isRestricted(state: UserAdminState | null): boolean {
  if (!state) return false;
  return state.status === 'banned' || state.status === 'suspended';
}

export function isSuspended(state: UserAdminState | null): boolean {
  return state?.status === 'suspended';
}

export function isBanned(state: UserAdminState | null): boolean {
  return state?.status === 'banned';
}
