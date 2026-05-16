import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

const ADMIN_CACHE_COOKIE = '_gp_is_admin';
const ADMIN_CACHE_MS = 60_000;

/** Rutas /api/admin que no requieren sesión admin (webhooks, health público). */
export const ADMIN_API_PUBLIC_PREFIXES = [
  '/api/admin/mail/inbound',
  '/api/admin/version',
];

export function isAdminApiPublicPath(pathname: string): boolean {
  return ADMIN_API_PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdminProtectedPath(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/api/admin/') && !isAdminApiPublicPath(pathname)) return true;
  return false;
}

type AdminCheckResult = { isAdmin: boolean; userId: string | null };

function readAdminCache(request: NextRequest): boolean | null {
  const raw = request.cookies.get(ADMIN_CACHE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v?: number; ok?: boolean };
    if (!parsed.ts || Date.now() - parsed.ts >= ADMIN_CACHE_MS) return null;
    return Boolean(parsed.ok);
  } catch {
    return null;
  }
}

export function adminCacheCookieValue(isAdmin: boolean): string {
  return JSON.stringify({ ok: isAdmin, ts: Date.now() });
}

export async function checkUserIsAdmin(
  request: NextRequest,
  userId: string,
): Promise<boolean> {
  const cached = readAdminCache(request);
  if (cached !== null) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;

  const adminClient = createServerClient(url, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  const { data, error } = await adminClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.user_id);
}

export async function resolveAdminAccess(request: NextRequest): Promise<AdminCheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { isAdmin: false, userId: null };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, userId: null };

  const isAdmin = await checkUserIsAdmin(request, user.id);
  return { isAdmin, userId: user.id };
}
