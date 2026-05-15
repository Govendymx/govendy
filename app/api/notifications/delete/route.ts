import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Body = {
  ids?: string[];
  all?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    // Validar token (usuario)
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const uid = userData.user.id;
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const all = Boolean(body?.all);
    const rawIds = Array.isArray(body?.ids) ? body!.ids! : [];
    const ids = rawIds.map(String).map((x) => x.trim()).filter(Boolean);

    if (!all && ids.length === 0) return NextResponse.json({ error: 'ids o all requerido.' }, { status: 400 });

    // Usar admin client para bypass RLS y asegurar eliminación
    let db: any = null;
    try {
      db = supabaseAdmin();
    } catch {
      // Fallback a cliente normal con token (pero podría fallar si la política DELETE no existe)
      db = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    let q = db.from('notifications').delete().eq('user_id', uid);

    if (!all) {
      // Borrar IDs específicos
      const safeIds = ids.slice(0, clamp(ids.length, 0, 500));
      q = q.in('id', safeIds);
    } else {
      // Borrar TODAS las notificaciones (o solo las no leídas?)
      // El frontend dice "Eliminar todas" (deleteAllUnread) -> suele esperar que se borre todo lo visible.
      // Pero NotificationCenter.tsx llama a `deleteAllUnread` que envía `all: true`.
      // Si el usuario quiere borrar todo, borramos todo.
      // Sin embargo, si solo quiere borrar las "nuevas", debería ser un filtro.
      // Asumamos comportamiento de "Clear All" (Borrar todo el historial de notificaciones).
      // Ojo: Si el usuario tiene miles, esto podría ser lento.
      // Pero para la "campanita", suele ser "Mark all as read" o "Clear".
      // Dado que el usuario dijo "que las borres", asumimos borrado físico.
    }

    const del = await q.select(); // select() para que devuelva lo borrado y confirmar

    if (del.error) {
      return NextResponse.json({ error: del.error.message }, { status: 400 });
    }

    const deletedCount = del.data ? del.data.length : 0;

    return NextResponse.json({ 
      ok: true, 
      deleted: deletedCount,
      message: `${deletedCount} notificaciones eliminadas.` 
    });

  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    return resp;
  }
}
