import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !anon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 50) || 50));

    const uid = userData.user.id;
    const selectCols = 'id,owner_id,is_global,is_active,title,description,preview_image_url,blocks,created_at,updated_at';

    // Preferir Service Role si existe; si no, usar RLS con el token del usuario.
    let res: any = null;
    try {
      const admin = supabaseAdmin();
      res = await admin
        .from('listing_templates')
        .select(selectCols)
        .or(`and(is_global.eq.true,is_active.eq.true),owner_id.eq.${uid}`)
        .order('is_global', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);
    } catch {
      const authed = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      res = await authed
        .from('listing_templates')
        .select(selectCols)
        .order('is_global', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);
    }

    if (res?.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist') || msg.includes('schema cache') || code === 'PGRST106') {
        return NextResponse.json(
          {
            error: 'Aún no existe la tabla de plantillas. Ejecuta el SQL `supabase_listing_templates.sql` en Supabase y vuelve a intentar.',
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: String((res.error as any)?.message || 'No se pudieron cargar plantillas.') }, { status: 400 });
    }

    const resp = NextResponse.json({ ok: true, rows: (res.data as any[]) ?? [] });
    // Cachear templates por 10 minutos (cambian muy poco frecuentemente)
    resp.headers.set('Cache-Control', 'private, s-maxage=600, stale-while-revalidate=1200');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

