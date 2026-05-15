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
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

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

async function findUserIdByEmail(admin: ReturnType<typeof supabaseAdmin>, email: string): Promise<string | null> {
  // Best-effort: buscar en auth.users (paginado)
  const target = email.trim().toLowerCase();
  if (!target) return null;
  
  try {
    for (let page = 1; page <= 10; page++) {
      try {
        const res: any = await (admin as any).auth?.admin?.listUsers?.({ page, perPage: 200 });
        if (res?.error) {
          console.error('[findUserIdByEmail] Error listando usuarios:', res.error);
          if (page === 1) throw new Error(`No se pudo listar usuarios: ${res.error.message || res.error}`);
          break;
        }
        const users = (res?.data?.users ?? res?.data ?? []) as any[];
        if (!Array.isArray(users)) break;
        const found = users.find((u) => String(u?.email || '').trim().toLowerCase() === target);
        if (found?.id) return String(found.id);
        if (users.length < 200) break;
      } catch (pageErr) {
        console.error(`[findUserIdByEmail] Error en página ${page}:`, pageErr);
        if (page === 1) throw pageErr;
        break;
      }
    }
  } catch (err) {
    console.error('[findUserIdByEmail] Error general:', err);
    throw err;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const { data: rows, error } = await admin.from('admin_users').select('user_id,created_at').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // intentar enriquecer con email (best-effort)
    const out: Array<{ user_id: string; email?: string | null; created_at?: string | null }> = [];
    for (const r of (rows as any[]) ?? []) {
      const uid = String(r?.user_id || '').trim();
      const createdAt = r?.created_at ?? null;
      let email: string | null = null;
      try {
        const ures: any = await (admin as any).auth?.admin?.getUserById?.(uid);
        email = (ures?.data?.user?.email as string | undefined) ?? null;
      } catch {
        // noop
      }
      out.push({ user_id: uid, email, created_at: createdAt });
    }

    return NextResponse.json({ ok: true, admins: out });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as { email?: string; user_id?: string; password?: string };
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    // Validar contraseña si se proporciona
    if (password) {
      try {
        // Obtener el email del usuario actual
        const { data: currentUser } = await admin.auth.admin.getUserById(requesterId);
        const currentUserEmail = currentUser?.user?.email;
        if (!currentUserEmail) {
          return NextResponse.json({ error: 'No se pudo obtener tu email para validar la contraseña.' }, { status: 400 });
        }

        // Validar contraseña intentando iniciar sesión
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        if (!supabaseUrl || !supabaseAnon) {
          return NextResponse.json({ error: 'Configuración de Supabase faltante' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnon, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentUserEmail,
          password: password,
        });

        if (signInError) {
          return NextResponse.json({ error: 'Contraseña incorrecta. No se pudo agregar el administrador.' }, { status: 401 });
        }
      } catch (pwdErr) {
        console.error('[ADMIN USERS POST] Error validando contraseña:', pwdErr);
        return NextResponse.json({ error: 'Error al validar la contraseña.' }, { status: 500 });
      }
    } else {
      // Si no se proporciona contraseña, requerirla
      return NextResponse.json({ error: 'Se requiere tu contraseña para agregar administradores por seguridad.' }, { status: 400 });
    }

    let targetUserId = userId;
    if (!targetUserId && email) {
      try {
        const found = await findUserIdByEmail(admin, email);
        if (!found) {
          return NextResponse.json({ 
            error: `No encontré un usuario con el email "${email}" en Supabase Auth. Asegúrate de que el usuario ya esté registrado.` 
          }, { status: 404 });
        }
        targetUserId = found;
      } catch (findErr) {
        console.error('[ADMIN USERS POST] Error buscando usuario por email:', findErr);
        return NextResponse.json({ 
          error: `Error al buscar usuario por email: ${findErr instanceof Error ? findErr.message : 'Error desconocido'}` 
        }, { status: 500 });
      }
    }
    if (!targetUserId) return NextResponse.json({ error: 'Proporciona email o user_id.' }, { status: 400 });

    // Verificar que el usuario existe antes de agregarlo como admin
    try {
      const { data: userCheck, error: userCheckError } = await (admin as any).auth?.admin?.getUserById?.(targetUserId);
      if (userCheckError || !userCheck?.user) {
        return NextResponse.json({ 
          error: `El usuario con ID "${targetUserId}" no existe en Supabase Auth.` 
        }, { status: 404 });
      }
    } catch (checkErr) {
      console.error('[ADMIN USERS POST] Error verificando usuario:', checkErr);
      // Continuar de todas formas, puede que el método no esté disponible
    }

    try {
      const { error: upsertError } = await admin.from('admin_users').upsert([{ user_id: targetUserId }], { onConflict: 'user_id' });
      if (upsertError) {
        console.error('[ADMIN USERS POST] Error en upsert:', upsertError);
        return NextResponse.json({ 
          error: `No se pudo agregar el administrador: ${upsertError.message || 'Error desconocido'}` 
        }, { status: 400 });
      }
      return NextResponse.json({ ok: true, user_id: targetUserId });
    } catch (upsertErr) {
      console.error('[ADMIN USERS POST] Error en upsert (catch):', upsertErr);
      return NextResponse.json({ 
        error: `Error al agregar administrador: ${upsertErr instanceof Error ? upsertErr.message : 'Error desconocido'}` 
      }, { status: 500 });
    }
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as { user_id?: string; password?: string };
    const targetUserId = String(body?.user_id || '').trim();
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    
    if (!targetUserId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    if (targetUserId === requesterId) {
      return NextResponse.json({ error: 'No puedes quitarte a ti mismo el rol de admin desde aquí.' }, { status: 400 });
    }

    // Validar contraseña si se proporciona
    if (password) {
      try {
        // Obtener el email del usuario actual
        const { data: currentUser } = await admin.auth.admin.getUserById(requesterId);
        const currentUserEmail = currentUser?.user?.email;
        if (!currentUserEmail) {
          return NextResponse.json({ error: 'No se pudo obtener tu email para validar la contraseña.' }, { status: 400 });
        }

        // Validar contraseña intentando iniciar sesión
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        if (!supabaseUrl || !supabaseAnon) {
          return NextResponse.json({ error: 'Configuración de Supabase faltante' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnon, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: currentUserEmail,
          password: password,
        });

        if (signInError) {
          return NextResponse.json({ error: 'Contraseña incorrecta. No se pudo quitar el administrador.' }, { status: 401 });
        }
      } catch (pwdErr) {
        console.error('[ADMIN USERS DELETE] Error validando contraseña:', pwdErr);
        return NextResponse.json({ error: 'Error al validar la contraseña.' }, { status: 500 });
      }
    } else {
      // Si no se proporciona contraseña, requerirla
      return NextResponse.json({ error: 'Se requiere tu contraseña para quitar administradores por seguridad.' }, { status: 400 });
    }

    const { error } = await admin.from('admin_users').delete().eq('user_id', targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

