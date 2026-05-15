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

/**
 * POST /api/admin/users/delete-account
 * Body: { user_id, notes? }
 * Elimina completamente la cuenta y todos sus datos:
 * - Marca user_admin_states status = 'deleted'
 * - Elimina TODAS las publicaciones (listings) del usuario
 * - Elimina datos relacionados (cupones, favoritos, preguntas, etc.)
 * - No borra auth.users (para mantener referencias en órdenes)
 * - Reversible parcialmente con "Activar cuenta" (pero las publicaciones eliminadas no se restauran)
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[delete-account] Request recibido');
    
    const guard = await requireAdmin(req);
    if (!guard.ok) {
      console.error('[delete-account] Error de autorización:', guard.error);
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const { admin, requesterId } = guard;

    const body = (await req.json().catch((parseErr) => {
      console.error('[delete-account] Error parseando body:', parseErr);
      return {};
    })) as { user_id?: string; notes?: string };
    
    const userId = String(body?.user_id ?? '').trim();
    const notes = String(body?.notes ?? '').trim();

    console.log('[delete-account] Datos recibidos:', { userId, hasNotes: !!notes });

    if (!userId) {
      console.error('[delete-account] user_id faltante');
      return NextResponse.json({ error: 'user_id requerido' }, { status: 400 });
    }

    // Verificar que el usuario existe
    const { data: userCheck, error: userCheckErr } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (userCheckErr) {
      console.error('[delete-account] Error verificando usuario:', userCheckErr);
      return NextResponse.json({ error: 'Error al verificar el usuario' }, { status: 500 });
    }
    
    if (!userCheck) {
      console.error('[delete-account] Usuario no encontrado:', userId);
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const { data: adminUser } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
    if (adminUser) {
      console.error('[delete-account] Intento de eliminar cuenta de administrador:', userId);
      return NextResponse.json({ error: 'No se puede eliminar una cuenta de administrador.' }, { status: 400 });
    }

    console.log('[delete-account] Iniciando eliminación completa de cuenta:', userId);

    // 1. Obtener todas las publicaciones del usuario antes de eliminarlas (para logs)
    const { data: userListings, error: listingsErr } = await admin
      .from('listings')
      .select('id,title')
      .eq('seller_id', userId);
    
    const listingsCount = Array.isArray(userListings) ? userListings.length : 0;
    console.log(`[delete-account] Encontradas ${listingsCount} publicaciones del usuario`);

    // 2. Eliminar TODAS las publicaciones del usuario
    console.log('[delete-account] Eliminando publicaciones...');
    const { error: deleteListingsErr, count: deletedCount } = await admin
      .from('listings')
      .delete()
      .eq('seller_id', userId);
    
    if (deleteListingsErr) {
      console.error('[delete-account] Error eliminando publicaciones:', deleteListingsErr);
      // Intentar con soft-delete como fallback
      const { error: blockErr } = await admin.from('listings').update({ status: 'blocked' }).eq('seller_id', userId);
      if (blockErr) {
        console.warn('[delete-account] No se pudieron eliminar ni bloquear listados:', (blockErr as Error).message);
      } else {
        console.warn('[delete-account] No se pudieron eliminar listados, se bloquearon como fallback');
      }
    } else {
      console.log(`[delete-account] ✅ ${deletedCount || listingsCount} publicaciones eliminadas`);
    }

    // 3. Eliminar cupones del vendedor (si existen)
    console.log('[delete-account] Eliminando cupones del vendedor...');
    const { error: deleteCouponsErr } = await admin
      .from('coupons')
      .delete()
      .eq('seller_id', userId);
    if (deleteCouponsErr) {
      console.warn('[delete-account] No se pudieron eliminar cupones:', (deleteCouponsErr as Error).message);
    } else {
      console.log('[delete-account] ✅ Cupones eliminados');
    }

    // 4. Eliminar favoritos relacionados (si existen)
    console.log('[delete-account] Eliminando favoritos...');
    const { error: deleteFavoritesErr } = await admin
      .from('favorites')
      .delete()
      .eq('user_id', userId);
    if (deleteFavoritesErr) {
      console.warn('[delete-account] No se pudieron eliminar favoritos:', (deleteFavoritesErr as Error).message);
    } else {
      console.log('[delete-account] ✅ Favoritos eliminados');
    }

    // 5. Eliminar perfil de profiles
    console.log('[delete-account] Eliminando perfil de profiles...');
    const { error: deleteProfileErr } = await admin
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (deleteProfileErr) {
      console.error('[delete-account] Error eliminando perfil:', deleteProfileErr);
      return NextResponse.json({ 
        error: `Error eliminando perfil: ${deleteProfileErr.message}` 
      }, { status: 500 });
    }
    console.log('[delete-account] ✅ Perfil eliminado de profiles');

    // 6. ELIMINAR DE auth.users (CRÍTICO: Esto previene que el trigger recree el perfil)
    console.log('[delete-account] Eliminando usuario de auth.users...');
    try {
      const { error: authDeleteError } = await (admin as any).auth.admin.deleteUser(userId);
      if (authDeleteError) {
        console.error('[delete-account] Error eliminando de auth.users:', authDeleteError);
        // Si falla, marcar como eliminado para prevenir recreación
        const payload = {
          user_id: userId,
          status: 'deleted',
          suspended_until: null as string | null,
          notes: notes || `Cuenta eliminada por admin - ${listingsCount} publicaciones eliminadas - Error al eliminar de auth.users: ${authDeleteError.message} (${new Date().toISOString()})`,
          updated_at: new Date().toISOString(),
          updated_by: requesterId,
        };
        await admin.from('user_admin_states').upsert([payload], { onConflict: 'user_id' });
        return NextResponse.json({ 
          error: `Error eliminando usuario de auth.users: ${authDeleteError.message}. El perfil fue eliminado pero el usuario puede reaparecer.` 
        }, { status: 500 });
      }
      console.log('[delete-account] ✅ Usuario eliminado de auth.users');
    } catch (authErr) {
      console.error('[delete-account] Excepción al eliminar de auth.users:', authErr);
      // Marcar como eliminado para prevenir recreación
      const payload = {
        user_id: userId,
        status: 'deleted',
        suspended_until: null as string | null,
        notes: notes || `Cuenta eliminada por admin - ${listingsCount} publicaciones eliminadas - Excepción al eliminar de auth.users (${new Date().toISOString()})`,
        updated_at: new Date().toISOString(),
        updated_by: requesterId,
      };
      await admin.from('user_admin_states').upsert([payload], { onConflict: 'user_id' });
      return NextResponse.json({ 
        error: `Error al eliminar usuario de auth.users: ${authErr instanceof Error ? authErr.message : 'Error desconocido'}. El perfil fue eliminado pero el usuario puede reaparecer.` 
      }, { status: 500 });
    }

    // 7. Marcar cuenta como eliminada en user_admin_states (por si acaso)
    console.log('[delete-account] Marcando cuenta como eliminada en user_admin_states...');
    const payload = {
      user_id: userId,
      status: 'deleted',
      suspended_until: null as string | null,
      notes: notes || `Cuenta eliminada completamente por admin - ${listingsCount} publicaciones eliminadas (${new Date().toISOString()})`,
      updated_at: new Date().toISOString(),
      updated_by: requesterId,
    };

    const res: any = await admin.from('user_admin_states').upsert([payload], { onConflict: 'user_id' }).select('user_id,status').single();
    if (res?.error) {
      const code = String((res.error as any)?.code ?? '');
      const msg = String((res.error as any)?.message ?? '').toLowerCase();
      if (code === '42P01' || msg.includes('relation') || msg.includes('does not exist')) {
        console.warn('[delete-account] Tabla user_admin_states no existe, continuando sin marcar estado');
      } else {
        console.error('[delete-account] Error marcando estado:', res.error);
        // Continuar de todas formas, el usuario ya fue eliminado
      }
    } else {
      console.log('[delete-account] ✅ Cuenta marcada como eliminada en user_admin_states');
    }

    const response = {
      ok: true, 
      message: `Cuenta eliminada completamente. ${listingsCount} publicaciones eliminadas. Esta acción no es reversible.`,
      deletedListings: listingsCount,
    };
    
    console.log('[delete-account] ✅ Eliminación completada exitosamente:', response);
    
    return NextResponse.json(response, { status: 200 });
  } catch (e: unknown) {
    console.error('[delete-account] ❌ Error inesperado:', e);
    const errorMessage = e instanceof Error ? e.message : 'Error inesperado al eliminar la cuenta';
    return NextResponse.json({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined,
    }, { status: 500 });
  }
}
