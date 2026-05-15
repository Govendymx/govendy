import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { validateTemplateBlocks } from '@/lib/templates/validate';

type Body = {
  id?: string | null;
  title: string;
  description?: string | null;
  preview_image_url?: string | null;
  blocks: unknown;
  is_global?: boolean;
  is_active?: boolean;
};

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

    // Cliente con RLS (usa sesión del usuario)
    const authed = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const id = String(body.id ?? '').trim() || null;
    const title = String(body.title ?? '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const previewImageUrl = typeof body.preview_image_url === 'string' ? body.preview_image_url.trim() : null;
    const wantGlobal = Boolean(body.is_global);
    const wantActive = body.is_active === false ? false : true;

    if (title.length < 2) return NextResponse.json({ error: 'El título debe tener al menos 2 caracteres.' }, { status: 400 });

    const v = validateTemplateBlocks(body.blocks, { maxBlocks: 60, allowImageSlots: true });
    if (!v.ok) {
      const err = 'error' in v ? v.error : 'Bloques inválidos';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const uid = userData.user.id;
    // ¿Admin? (por RLS: el admin solo puede leerse a sí mismo)
    let isAdmin = false;
    try {
      const a: any = await authed.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
      isAdmin = Boolean(a?.data?.user_id) && !a?.error;
    } catch {
      isAdmin = false;
    }

    // Usuario normal: no puede crear/editar globales.
    const is_global = isAdmin ? wantGlobal : false;

    // Preferir Service Role si existe (permite admin gestionar más fácil), si no, usar RLS.
    let db: any = authed;
    try {
      db = supabaseAdmin();
    } catch {
      db = authed;
    }

    if (id) {
      // Editar: asegurar permisos
      const existing: any = await db.from('listing_templates').select('id,owner_id,is_global').eq('id', id).maybeSingle();
      if (existing?.error) return NextResponse.json({ error: String(existing.error?.message || 'No se pudo cargar la plantilla.') }, { status: 400 });
      if (!existing?.data) return NextResponse.json({ error: 'Plantilla no encontrada.' }, { status: 404 });

      const ownerId = String(existing.data.owner_id || '').trim();
      const wasGlobal = Boolean(existing.data.is_global);
      if (!isAdmin) {
        if (!ownerId || ownerId !== uid) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
        if (wasGlobal) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
      }

      const patch: any = {
        title,
        description,
        preview_image_url: previewImageUrl || null,
        blocks: v.blocks as any,
        is_active: wantActive,
      };
      if (isAdmin) patch.is_global = is_global;

      const upd: any = await db.from('listing_templates').update(patch).eq('id', id).select('id').maybeSingle();
      if (upd?.error) return NextResponse.json({ error: String(upd.error?.message || 'No se pudo guardar la plantilla.') }, { status: 400 });
      return NextResponse.json({ ok: true, id: String(upd?.data?.id || id) });
    }

    // Crear
    const payload: any = {
      owner_id: is_global ? null : uid,
      is_global,
      is_active: wantActive,
      title,
      description,
      preview_image_url: previewImageUrl || null,
      blocks: v.blocks as any,
    };

    const ins: any = await db.from('listing_templates').insert([payload]).select('id').single();
    if (ins?.error) return NextResponse.json({ error: String(ins.error?.message || 'No se pudo crear la plantilla.') }, { status: 400 });
    return NextResponse.json({ ok: true, id: String(ins?.data?.id || '') });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

