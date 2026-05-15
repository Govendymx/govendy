import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Body = { id: string; title?: string | null };

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
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

    const authed = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const id = String(body.id ?? '').trim();
    if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });

    const uid = userData.user.id;
    let isAdmin = false;
    try {
      const a: any = await authed.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
      isAdmin = Boolean(a?.data?.user_id) && !a?.error;
    } catch {
      isAdmin = false;
    }

    let db: any = authed;
    try {
      db = supabaseAdmin();
    } catch {
      db = authed;
    }

    const existing: any = await db
      .from('listing_templates')
      .select('id,owner_id,is_global,is_active,title,description,preview_image_url,blocks')
      .eq('id', id)
      .maybeSingle();
    if (existing?.error) return NextResponse.json({ error: String(existing.error?.message || 'No se pudo cargar la plantilla.') }, { status: 400 });
    if (!existing?.data) return NextResponse.json({ error: 'Plantilla no encontrada.' }, { status: 404 });

    const ownerId = String(existing.data.owner_id || '').trim();
    const isGlobal = Boolean(existing.data.is_global);
    if (!isAdmin) {
      // Usuario: puede duplicar global activa o su propia plantilla
      if (isGlobal) {
        if (!Boolean(existing.data.is_active)) return NextResponse.json({ error: 'Plantilla no disponible.' }, { status: 400 });
      } else {
        if (!ownerId || ownerId !== uid) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
      }
    }

    const newTitleRaw = typeof body.title === 'string' ? body.title.trim() : '';
    const newTitle = newTitleRaw || `${String(existing.data.title || 'Plantilla').trim()} (copia)`;

    const payload: any = {
      owner_id: uid,
      is_global: false,
      is_active: true,
      title: newTitle.slice(0, 120),
      description: String(existing.data.description || ''),
      preview_image_url: existing.data.preview_image_url ?? null,
      blocks: existing.data.blocks ?? [],
    };

    const ins: any = await db.from('listing_templates').insert([payload]).select('id').single();
    if (ins?.error) return NextResponse.json({ error: String(ins.error?.message || 'No se pudo duplicar.') }, { status: 400 });
    return NextResponse.json({ ok: true, id: String(ins?.data?.id || '') });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

