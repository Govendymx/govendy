export function normalizeReturnTo(input: string | null | undefined): string | null {
  const value = (input ?? '').trim();
  if (!value) return null;
  // Solo permitimos rutas relativas internas para evitar open-redirects
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}

export function getCurrentPathWithQuery(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function buildLoginHref(returnTo?: string | null): string {
  const safe = normalizeReturnTo(returnTo);
  // Home-first: llevamos al Home y abrimos modal de auth ahí.
  // Si no hay returnTo, solo abrimos auth.
  const sp = new URLSearchParams({ auth: '1' });
  if (safe) sp.set('returnTo', safe);
  return `/?${sp.toString()}`;
}

export function redirectToLogin(returnTo?: string | null) {
  if (typeof window === 'undefined') return;
  window.location.href = buildLoginHref(returnTo ?? getCurrentPathWithQuery());
}

export function isAuthSessionMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return msg.includes('auth session missing');
}
