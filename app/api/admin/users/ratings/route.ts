import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

/** DELETE /api/admin/users/ratings?rating_id=... — eliminar calificación */
export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const ratingId = String(req.nextUrl.searchParams.get('rating_id') || '').trim();
    if (!ratingId) return NextResponse.json({ error: 'rating_id required' }, { status: 400 });

    const { error } = await admin.from('user_ratings').delete().eq('id', ratingId);
    if (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, message: 'Calificación eliminada.' });
  } catch (e: unknown) {
    console.error('[admin users ratings DELETE]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

/** PATCH /api/admin/users/ratings — editar stars y/o comment. Body: { rating_id, stars?, comment? } */
export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const body = (await req.json().catch(() => ({}))) as { rating_id?: string; stars?: number; comment?: string };
    const ratingId = String(body?.rating_id ?? '').trim();
    if (!ratingId) return NextResponse.json({ error: 'rating_id required' }, { status: 400 });

    const patch: { stars?: number; comment?: string } = {};
    if (typeof body?.stars === 'number' && body.stars >= 1 && body.stars <= 10) {
      patch.stars = Math.round(body.stars);
    }
    if (typeof body?.comment === 'string') {
      patch.comment = body.comment.slice(0, 600);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'stars (1-10) o comment required' }, { status: 400 });
    }

    const { data, error } = await admin.from('user_ratings').update(patch).eq('id', ratingId).select('id,stars,comment').single();
    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    return NextResponse.json({ ok: true, rating: data });
  } catch (e: unknown) {
    console.error('[admin users ratings PATCH]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
