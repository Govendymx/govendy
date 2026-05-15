import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Listar campañas publicitarias
 * - Usuarios: solo sus propias campañas
 * - Admins: todas las campañas
 */
export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const isAdmin = Boolean(adminRow);

    // Parámetros de consulta
    const status = req.nextUrl.searchParams.get('status');
    const placement = req.nextUrl.searchParams.get('placement');
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 50)));

    let query = admin.from('ad_campaigns').select('*').order('created_at', { ascending: false }).limit(limit);

    // Si no es admin, solo sus propias campañas
    if (!isAdmin) {
      query = query.eq('user_id', userData.user.id);
    }

    // Filtros opcionales
    if (status) {
      query = query.eq('status', status);
    }
    if (placement) {
      query = query.eq('placement', placement);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, campaigns: campaigns || [] });
  } catch (e: unknown) {
    console.error('[ADS LIST] Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al listar campañas' }, { status: 500 });
  }
}
