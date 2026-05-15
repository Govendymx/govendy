import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.effectiveUserId;
    const admin = auth.admin;

    const [{ data: profile }, { data: stateRow }, authUserResult] = await Promise.all([
      admin
        .from('profiles')
        .select('id,full_name,nickname,username,ine_front_url,ine_back_url,has_seen_onboarding_tour')
        .eq('id', userId)
        .maybeSingle(),
      admin
        .from('user_admin_states')
        .select('status,suspended_until')
        .eq('user_id', userId)
        .maybeSingle(),
      (admin as any).auth?.admin?.getUserById?.(userId).catch(() => null),
    ]);

    const nameParts: string[] = [];
    if (profile?.full_name) nameParts.push(String(profile.full_name).trim());
    if (!nameParts.length && profile?.nickname) nameParts.push(String(profile.nickname).trim());
    if (!nameParts.length && profile?.username) nameParts.push(String(profile.username).trim());

    const authUser = (authUserResult as any)?.data?.user;
    const authMeta = authUser?.user_metadata as Record<string, unknown> | undefined;
    if (!nameParts.length && authMeta) {
      const metaFull =
        (authMeta.full_name as string | undefined) ||
        (authMeta.name as string | undefined) ||
        (authMeta.nickname as string | undefined) ||
        (authMeta.username as string | undefined);
      if (metaFull && typeof metaFull === 'string' && metaFull.trim()) {
        nameParts.push(metaFull.trim());
      }
    }
    if (!nameParts.length && authUser?.email && typeof authUser.email === 'string') {
      const emailName = authUser.email.split('@')[0];
      if (emailName) {
        nameParts.push(emailName.charAt(0).toUpperCase() + emailName.slice(1));
      }
    }

    const displayName = nameParts.join(' ').trim() || 'Usuario';

    const front = typeof profile?.ine_front_url === 'string' ? profile.ine_front_url.trim() : '';
    const back = typeof profile?.ine_back_url === 'string' ? profile.ine_back_url.trim() : '';
    const documentsUploaded = [front, back].filter((x) => x && x.length > 0).length;

    const adminState = stateRow
      ? {
          status: String((stateRow as any)?.status ?? 'active'),
          suspended_until: (stateRow as any)?.suspended_until ?? null,
        }
      : null;

    return NextResponse.json({
      ok: true,
      userId,
      displayName,
      documentsUploaded,
      hasSeenTour: (profile as any)?.has_seen_onboarding_tour === true,
      adminState,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Error cargando perfil' },
      { status: 500 },
    );
  }
}

