import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  
  // Excepción para reset-password: Delegar el intercambio al cliente
  // Esto evita problemas de sincronización de sesión en flujos sensibles de recuperación
  if (next.startsWith('/reset-password') && code) {
    const targetUrl = new URL(next, requestUrl.origin);
    targetUrl.searchParams.set('code', code);
    return NextResponse.redirect(targetUrl);
  }

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If no code or error, redirect with error params if present
  const redirectUrl = new URL(next, requestUrl.origin);
  
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  
  if (error) redirectUrl.searchParams.set('error', error);
  if (error_description) redirectUrl.searchParams.set('error_description', error_description);
  
  return NextResponse.redirect(redirectUrl);
}
