import type { SupabaseClient } from '@supabase/supabase-js';
import { sendUnifiedNotification } from '@/lib/notifications/unified';

export type UserAction = 'activate' | 'suspend' | 'ban' | 'delete';

export type UserActionResult = {
  ok: boolean;
  error?: string;
  affectedOrders?: number;
  affectedListings?: number;
  warnings?: string[];
};

/**
 * Ejecuta una acción administrativa sobre un usuario
 * Con validaciones exhaustivas y logging completo
 */
export async function executeUserAction(
  admin: SupabaseClient,
  adminId: string,
  userId: string,
  action: UserAction,
  options?: {
    days?: number;
    notes?: string;
    reason?: string;
  },
): Promise<UserActionResult> {
  const warnings: string[] = [];

  // 1. Validar que el usuario existe
  const { data: user, error: userError } = await admin
    .from('profiles')
    .select('id, email, full_name, username')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    return { ok: false, error: 'Usuario no encontrado' };
  }

  // 2. Validar que no es un admin intentando modificar a otro admin
  const { data: targetIsAdmin } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (targetIsAdmin && action !== 'activate') {
    return {
      ok: false,
      error: 'No se puede suspender, bloquear o eliminar a otro administrador',
    };
  }

  // 3. Ejecutar acción según tipo
  switch (action) {
    case 'activate':
      return await activateUser(admin, userId, adminId, options);

    case 'suspend':
      return await suspendUser(admin, userId, adminId, options);

    case 'ban':
      return await banUser(admin, userId, adminId, options);

    case 'delete':
      return await deleteUser(admin, userId, adminId, options);

    default:
      return { ok: false, error: 'Acción inválida' };
  }
}

async function activateUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { notes?: string },
): Promise<UserActionResult> {
  // 1. Actualizar estado
  const { error: stateError } = await admin
    .from('user_admin_states')
    .upsert(
      [
        {
          user_id: userId,
          status: 'active',
          suspended_until: null,
          notes: options?.notes || '',
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        },
      ],
      { onConflict: 'user_id' },
    );

  if (stateError) {
    return { ok: false, error: `Error actualizando estado: ${stateError.message}` };
  }

  // 2. Reactivar publicaciones pausadas (con renovación de vigencia)
  const { data: reactivatedListings } = await admin
    .from('listings')
    .update({
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .eq('seller_id', userId)
    .eq('status', 'paused')
    .select('id');

  // 3. Notificar al usuario
  await sendUnifiedNotification(admin, {
    userId,
    type: 'user_activated',
    title: 'Cuenta Reactivada',
    body: 'Tu cuenta ha sido reactivada. Ya puedes usar todos los servicios.',
    channels: ['both'],
    priority: 'medium',
  });

  // 4. Log de acción
  await logAdminAction(admin, {
    admin_id: adminId,
    action: 'activate_user',
    target_user_id: userId,
    notes: options?.notes || 'Usuario reactivado',
  });

  return {
    ok: true,
    affectedListings: reactivatedListings?.length || 0,
  };
}

async function suspendUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { days?: number; notes?: string },
): Promise<UserActionResult> {
  const days = Number.isFinite(options?.days) && options?.days! > 0
    ? Math.min(365, Math.floor(options!.days!))
    : 7;

  const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const warnings: string[] = [];

  // 1. Actualizar estado
  const { error: stateError } = await admin
    .from('user_admin_states')
    .upsert(
      [
        {
          user_id: userId,
          status: 'suspended',
          suspended_until: suspendedUntil,
          notes: options?.notes || '',
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        },
      ],
      { onConflict: 'user_id' },
    );

  if (stateError) {
    return { ok: false, error: `Error actualizando estado: ${stateError.message}` };
  }

  // 2. Pausar publicaciones activas
  const { data: pausedListings } = await admin
    .from('listings')
    .update({ status: 'paused' })
    .eq('seller_id', userId)
    .eq('status', 'active')
    .select('id');

  // 3. Cancelar órdenes pendientes (opcional, según política)
  const { data: pendingOrders } = await admin
    .from('orders')
    .select('id')
    .eq('buyer_id', userId)
    .in('status', ['pending', 'paid']);

  if (pendingOrders && pendingOrders.length > 0) {
    warnings.push(`${pendingOrders.length} orden(es) pendiente(s) del usuario`);
  }

  // 4. Notificar al usuario
  await sendUnifiedNotification(admin, {
    userId,
    type: 'user_suspended',
    title: 'Cuenta Suspendida',
    body: `Tu cuenta ha sido suspendida hasta ${new Date(suspendedUntil).toLocaleDateString('es-MX')}. ${options?.notes || ''}`,
    channels: ['both'],
    priority: 'high',
  });

  // 5. Log de acción
  await logAdminAction(admin, {
    admin_id: adminId,
    action: 'suspend_user',
    target_user_id: userId,
    notes: `Suspendido por ${days} días. ${options?.notes || ''}`,
    metadata: { days, suspended_until: suspendedUntil },
  });

  return {
    ok: true,
    affectedListings: pausedListings?.length || 0,
    warnings,
  };
}

async function banUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { notes?: string },
): Promise<UserActionResult> {
  // 1. Actualizar estado
  const { error: stateError } = await admin
    .from('user_admin_states')
    .upsert(
      [
        {
          user_id: userId,
          status: 'banned',
          suspended_until: null,
          notes: options?.notes || '',
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        },
      ],
      { onConflict: 'user_id' },
    );

  if (stateError) {
    return { ok: false, error: `Error actualizando estado: ${stateError.message}` };
  }

  // 2. Bloquear todas las publicaciones
  const { data: blockedListings } = await admin
    .from('listings')
    .update({ status: 'blocked' })
    .eq('seller_id', userId)
    .select('id');

  // 3. Cancelar órdenes pendientes
  const pendingOrderIds = (
    await admin
      .from('orders')
      .select('id')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in('status', ['pending', 'paid'])
  ).data?.map((o) => o.id) || [];

  let cancelledOrders = 0;
  if (pendingOrderIds.length > 0) {
    const { data: cancelled } = await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .in('id', pendingOrderIds)
      .select('id');
    cancelledOrders = cancelled?.length || 0;
  }

  // 4. Notificar al usuario
  await sendUnifiedNotification(admin, {
    userId,
    type: 'user_banned',
    title: 'Cuenta Bloqueada Permanentemente',
    body: `Tu cuenta ha sido bloqueada permanentemente. ${options?.notes || ''}`,
    channels: ['both'],
    priority: 'urgent',
  });

  // 5. Log de acción
  await logAdminAction(admin, {
    admin_id: adminId,
    action: 'ban_user',
    target_user_id: userId,
    notes: options?.notes || 'Usuario baneado permanentemente',
  });

  return {
    ok: true,
    affectedListings: blockedListings?.length || 0,
    affectedOrders: cancelledOrders,
  };
}

async function deleteUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { notes?: string },
): Promise<UserActionResult> {
  // ADVERTENCIA: Esta acción es IRREVERSIBLE

  // 1. Verificar que no tiene órdenes activas
  const { data: activeOrders } = await admin
    .from('orders')
    .select('id')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in('status', ['paid', 'shipped', 'delivered']);

  if (activeOrders && activeOrders.length > 0) {
    return {
      ok: false,
      error: `No se puede eliminar usuario con ${activeOrders.length} orden(es) activa(s)`,
    };
  }

  // 2. Eliminar en cascada (en orden correcto para evitar violaciones de FK)
  console.log(`[DELETE USER] Iniciando eliminación completa de usuario ${userId}`);

  // - Favoritos
  await admin.from('favorites').delete().eq('user_id', userId);
  console.log(`[DELETE USER] Favoritos eliminados`);

  // - Cupones del usuario
  await admin.from('user_coupons').delete().eq('user_id', userId);
  console.log(`[DELETE USER] Cupones eliminados`);

  // - Preguntas y respuestas
  await admin.from('listing_questions').delete().or(`asked_by.eq.${userId},answered_by.eq.${userId}`);
  console.log(`[DELETE USER] Preguntas/respuestas eliminadas`);

  // - Notificaciones
  await admin.from('notifications').delete().eq('user_id', userId);
  console.log(`[DELETE USER] Notificaciones eliminadas`);

  // - Carrito
  await admin.from('cart_items').delete().eq('user_id', userId);
  console.log(`[DELETE USER] Carrito eliminado`);

  // - Publicaciones (eliminar completamente, no solo archivar)
  const { count: deletedListings } = await admin
    .from('listings')
    .delete()
    .eq('seller_id', userId);
  console.log(`[DELETE USER] ${deletedListings || 0} publicaciones eliminadas`);

  // - Órdenes (cancelar las pendientes)
  await admin
    .from('orders')
    .update({ status: 'cancelled' })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in('status', ['pending']);
  console.log(`[DELETE USER] Órdenes pendientes canceladas`);

  // - Estado admin
  await admin.from('user_admin_states').delete().eq('user_id', userId);
  console.log(`[DELETE USER] Estado admin eliminado`);

  // - Perfil (antes de eliminar de auth.users)
  const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);

  if (profileError) {
    console.error(`[DELETE USER] Error eliminando perfil:`, profileError);
    return { ok: false, error: `Error eliminando perfil: ${profileError.message}` };
  }
  console.log(`[DELETE USER] Perfil eliminado de profiles`);

  // 3. ELIMINAR DE auth.users (CRÍTICO: Esto previene que el trigger recree el perfil)
  try {
    const { error: authDeleteError } = await (admin as any).auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error(`[DELETE USER] Error eliminando de auth.users:`, authDeleteError);
      // Si falla, intentar marcar como eliminado en user_admin_states para prevenir recreación
      await admin.from('user_admin_states').upsert([{
        user_id: userId,
        status: 'deleted',
        notes: `Usuario eliminado - Error al eliminar de auth.users: ${authDeleteError.message}`,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      }], { onConflict: 'user_id' });
      return { ok: false, error: `Error eliminando usuario de auth.users: ${authDeleteError.message}` };
    }
    console.log(`[DELETE USER] ✅ Usuario eliminado de auth.users`);
  } catch (authErr) {
    console.error(`[DELETE USER] Excepción al eliminar de auth.users:`, authErr);
    // Intentar marcar como eliminado para prevenir recreación
    await admin.from('user_admin_states').upsert([{
      user_id: userId,
      status: 'deleted',
      notes: `Usuario eliminado - Excepción al eliminar de auth.users`,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }], { onConflict: 'user_id' });
    return { ok: false, error: `Error al eliminar usuario de auth.users: ${authErr instanceof Error ? authErr.message : 'Error desconocido'}` };
  }

  // 4. Log de la eliminación
  await logAdminAction(admin, {
    admin_id: adminId,
    action: 'delete_user',
    target_user_id: userId,
    notes: options?.notes || 'Usuario eliminado completamente (profiles + auth.users)',
  });

  console.log(`[DELETE USER] ✅ Eliminación completa exitosa para usuario ${userId}`);
  return { ok: true };
}

/**
 * Registra una acción administrativa en el log
 */
async function logAdminAction(
  admin: SupabaseClient,
  log: {
    admin_id: string;
    action: string;
    target_user_id?: string;
    target_entity_type?: string;
    target_entity_id?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from('admin_action_logs').insert([
      {
        ...log,
        created_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    // No fallar si el logging falla
    console.error('[ADMIN ACTION LOG] Error logging action:', e);
  }
}
