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

    const uid = userData.user.id;
    const authed = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const adminRow: any = await authed.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
    const ok = Boolean(adminRow?.data?.user_id) && !adminRow?.error;
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 200) || 200));

    const selectCols = 'id,owner_id,is_global,is_active,title,description,preview_image_url,blocks,created_at,updated_at';

    // Preferir Service Role si existe, si no: authed con RLS (admin puede ver todo por policy)
    let res: any = null;
    try {
      const admin = supabaseAdmin();
      res = await admin.from('listing_templates').select(selectCols).order('updated_at', { ascending: false }).limit(limit);
    } catch {
      res = await authed.from('listing_templates').select(selectCols).order('updated_at', { ascending: false }).limit(limit);
    }
    if (res?.error) return NextResponse.json({ error: String(res.error?.message || 'No se pudieron cargar plantillas.') }, { status: 400 });

    return NextResponse.json({ ok: true, rows: (res.data as any[]) ?? [] });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

