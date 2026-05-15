import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnon,
        hasServiceRoleKey: !!supabaseServiceRole,
        supabaseUrlLength: supabaseUrl.length,
        anonKeyLength: supabaseAnon.length,
        serviceRoleKeyLength: supabaseServiceRole.length,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
