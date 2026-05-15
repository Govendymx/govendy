import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes suspended users ARE allowed to visit (within /dashboard)
const SUSPENDED_ALLOWED = [
  '/dashboard/soporte',
  '/dashboard/ayuda',
  '/dashboard/notificaciones',
  '/dashboard/suspendido',
];

// API routes suspended users can still call
const SUSPENDED_API_ALLOWED = [
  '/api/support/',
  '/api/notifications/',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Only enforce on authenticated users visiting protected routes
  if (!user) return response

  const { pathname } = request.nextUrl

  // Skip enforcement for public pages, static assets, auth callbacks
  if (
    pathname === '/cuenta-bloqueada' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth/')
  ) {
    return response
  }

  // ── Check user admin state (with 60s cookie cache) ──
  let adminStatus: string | null = null
  let suspendedUntil: string | null = null

  const cached = request.cookies.get('_gp_admin_state')?.value
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (parsed.ts && Date.now() - parsed.ts < 60_000) {
        adminStatus = parsed.status
        suspendedUntil = parsed.suspended_until || null
      }
    } catch { /* invalid cache, re-fetch */ }
  }

  // If no valid cache, query the database
  if (adminStatus === null) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      const adminClient = createServerClient(url, serviceKey, {
        cookies: {
          getAll() { return [] },
          setAll() { /* noop */ },
        },
      })

      const { data } = await adminClient
        .from('user_admin_states')
        .select('status, suspended_until')
        .eq('user_id', user.id)
        .maybeSingle()

      adminStatus = data?.status || 'active'
      suspendedUntil = data?.suspended_until || null

      // Cache in cookie for 60s to avoid DB queries on every navigation
      const cacheValue = JSON.stringify({
        status: adminStatus,
        suspended_until: suspendedUntil,
        ts: Date.now(),
      })
      response.cookies.set('_gp_admin_state', cacheValue, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60,
        path: '/',
      })
    }
  }

  // ── BANNED: sign out & redirect to /cuenta-bloqueada ──
  if (adminStatus === 'banned') {
    await supabase.auth.signOut()
    const blockedUrl = request.nextUrl.clone()
    blockedUrl.pathname = '/cuenta-bloqueada'
    blockedUrl.search = ''
    const redirectResponse = NextResponse.redirect(blockedUrl)
    // Clear the admin state cache
    redirectResponse.cookies.delete('_gp_admin_state')
    // Clear auth cookies
    redirectResponse.cookies.delete('sb-access-token')
    redirectResponse.cookies.delete('sb-refresh-token')
    return redirectResponse
  }

  // ── SUSPENDED: restrict to support/help/notifications only ──
  if (adminStatus === 'suspended') {
    const isDashboardRoute = pathname.startsWith('/dashboard')
    const isApiRoute = pathname.startsWith('/api/')

    if (isDashboardRoute) {
      // Check if the route is in the allowed list
      const isAllowed = SUSPENDED_ALLOWED.some(
        (allowed) => pathname === allowed || pathname.startsWith(allowed + '/')
      )
      if (!isAllowed) {
        const suspendedUrl = request.nextUrl.clone()
        suspendedUrl.pathname = '/dashboard/suspendido'
        suspendedUrl.search = ''
        return NextResponse.redirect(suspendedUrl)
      }
    }

    if (isApiRoute) {
      // Block non-allowed API routes for suspended users
      const isAllowedApi = SUSPENDED_API_ALLOWED.some(
        (allowed) => pathname.startsWith(allowed)
      )
      // Also allow auth-related API routes
      if (!isAllowedApi && !pathname.startsWith('/api/auth/')) {
        return NextResponse.json(
          { error: 'Tu cuenta está suspendida. Solo puedes acceder a Soporte.' },
          { status: 403 }
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
