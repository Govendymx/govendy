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
 * Endpoint para obtener el número de usuarios conectados en tiempo real
 * Un usuario se considera "conectado" si ha tenido actividad en los últimos 5 minutos
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

    // Verificar que es admin
    const admin = supabaseAdmin();
    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: 'No tienes permisos de administrador.' }, { status: 403 });
    }

    // Calcular el tiempo límite (últimos 5 minutos)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesAgoIso = fiveMinutesAgo.toISOString();

    // Contar usuarios activos basado en actividad reciente
    // Usamos múltiples fuentes para obtener una aproximación precisa:
    // 1. Usuarios que han creado órdenes recientemente
    // 2. Usuarios que han recibido/enviado notificaciones recientemente
    // 3. Usuarios que han creado/actualizado listings recientemente
    // 4. Usuarios que han hecho preguntas/respuestas recientemente

    const activeUserIds = new Set<string>();

    // 1. Órdenes recientes (compradores y vendedores)
    try {
      const { data: activeFromOrders } = await admin
        .from('orders')
        .select('buyer_id, seller_id')
        .gte('created_at', fiveMinutesAgoIso)
        .limit(1000);

      if (activeFromOrders && Array.isArray(activeFromOrders)) {
        for (const order of activeFromOrders) {
          if (order?.buyer_id) activeUserIds.add(String(order.buyer_id));
          if (order?.seller_id) activeUserIds.add(String(order.seller_id));
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo órdenes:', err);
    }

    // 2. Notificaciones recientes
    try {
      const { data: activeFromNotifications } = await admin
        .from('notifications')
        .select('user_id')
        .gte('created_at', fiveMinutesAgoIso)
        .limit(1000);

      if (activeFromNotifications && Array.isArray(activeFromNotifications)) {
        for (const notif of activeFromNotifications) {
          if (notif?.user_id) activeUserIds.add(String(notif.user_id));
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo notificaciones:', err);
    }

    // 3. Listings recientes (vendedores activos)
    try {
      const { data: activeFromListings } = await admin
        .from('listings')
        .select('seller_id, user_id')
        .gte('created_at', fiveMinutesAgoIso)
        .limit(500);

      if (activeFromListings && Array.isArray(activeFromListings)) {
        for (const listing of activeFromListings) {
          if (listing?.seller_id) activeUserIds.add(String(listing.seller_id));
          if (listing?.user_id) activeUserIds.add(String(listing.user_id));
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo listings:', err);
    }

    // 4. Preguntas/respuestas recientes
    try {
      const { data: activeFromQuestions } = await admin
        .from('listing_questions')
        .select('asker_id, seller_id')
        .gte('created_at', fiveMinutesAgoIso)
        .limit(500);

      if (activeFromQuestions && Array.isArray(activeFromQuestions)) {
        for (const q of activeFromQuestions) {
          if (q?.asker_id) activeUserIds.add(String(q.asker_id));
          if (q?.seller_id) activeUserIds.add(String(q.seller_id));
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo preguntas:', err);
    }

    // 5. Usuarios que han actualizado su perfil recientemente (indica actividad)
    try {
      const { data: activeFromProfiles } = await admin
        .from('profiles')
        .select('id')
        .gte('updated_at', fiveMinutesAgoIso)
        .limit(500);

      if (activeFromProfiles && Array.isArray(activeFromProfiles)) {
        for (const profile of activeFromProfiles) {
          if (profile?.id) activeUserIds.add(String(profile.id));
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo perfiles actualizados:', err);
    }

    // 6. Usuarios con actividad registrada en la tabla user_activity (heartbeat)
    // Esto captura usuarios que están navegando aunque no hagan acciones específicas
    try {
      const { data: activeFromActivity } = await admin
        .from('user_activity')
        .select('user_id')
        .gte('last_activity_at', fiveMinutesAgoIso)
        .limit(1000);

      if (activeFromActivity && Array.isArray(activeFromActivity)) {
        for (const activity of activeFromActivity) {
          if (activity?.user_id) activeUserIds.add(String(activity.user_id));
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo actividad de usuarios (puede que la tabla no exista aún):', err);
    }

    // 7. Usuarios con sesiones activas (última actividad en los últimos 5 minutos)
    // Nota: Esto requiere que Supabase Auth almacene last_sign_in_at o similar
    try {
      const { data: recentSessions } = await admin.auth.admin.listUsers();
      if (recentSessions?.users && Array.isArray(recentSessions.users)) {
        for (const user of recentSessions.users) {
          const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
          if (lastSignIn && lastSignIn >= fiveMinutesAgo) {
            activeUserIds.add(user.id);
          }
        }
      }
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo sesiones activas:', err);
    }

    const activeUsersCount = activeUserIds.size;

    // También obtener el total de usuarios registrados para contexto
    let totalUsersCount = 0;
    try {
      const { count, error: totalErr } = await admin.from('profiles').select('id', { count: 'exact', head: true });
      if (!totalErr) totalUsersCount = count || 0;
    } catch (err) {
      console.warn('[ACTIVE USERS] Error obteniendo total de usuarios:', err);
    }

    // Obtener detalles de los usuarios conectados (apodo, email, etc.)
    const activeUsersDetails: Array<{
      id: string;
      nickname?: string | null;
      full_name?: string | null;
      username?: string | null;
      email?: string | null;
      is_verified?: boolean;
      last_activity?: string;
    }> = [];

    if (activeUserIds.size > 0) {
      try {
        const userIdsArray = Array.from(activeUserIds);
        
        // Obtener perfiles de los usuarios activos
        const { data: profiles, error: profilesErr } = await admin
          .from('profiles')
          .select('id, nickname, full_name, username, is_verified, updated_at')
          .in('id', userIdsArray)
          .limit(100);

        // Obtener última actividad desde user_activity
        const activityMap = new Map<string, string>();
        try {
          const { data: activities } = await admin
            .from('user_activity')
            .select('user_id, last_activity_at')
            .in('user_id', userIdsArray)
            .gte('last_activity_at', fiveMinutesAgoIso);
          
          if (activities && Array.isArray(activities)) {
            for (const activity of activities) {
              const userId = String(activity.user_id);
              const activityAt = String(activity.last_activity_at || '');
              if (activityAt) {
                activityMap.set(userId, activityAt);
              }
            }
          }
        } catch (err) {
          console.warn('[ACTIVE USERS] Error obteniendo actividad:', err);
        }

        // Obtener emails y metadata de auth.users para TODOS los usuarios activos
        // Primero intentar con listUsers (más eficiente), luego getUserById para los faltantes
        const emailMap = new Map<string, string | null>();
        const authMetadataMap = new Map<string, { email?: string | null; metadata?: any }>();
        
        // Intentar obtener todos los usuarios de una vez con listUsers
        try {
          const { data: authUsers } = await admin.auth.admin.listUsers();
          if (authUsers?.users) {
            for (const authUser of authUsers.users) {
              if (activeUserIds.has(authUser.id)) {
                emailMap.set(authUser.id, authUser.email ?? null);
                authMetadataMap.set(authUser.id, {
                  email: authUser.email ?? null,
                  metadata: authUser.user_metadata || {},
                });
              }
            }
          }
        } catch (err) {
          console.warn('[ACTIVE USERS] Error con listUsers, usando getUserById:', err);
        }
        
        // Para usuarios que no se encontraron en listUsers, usar getUserById
        const missingUserIds = userIdsArray.filter(id => !emailMap.has(id));
        for (const userId of missingUserIds.slice(0, 20)) { // Limitar a 20 para no sobrecargar
          try {
            const { data: authUserData } = await admin.auth.admin.getUserById(userId);
            if (authUserData?.user) {
              const user = authUserData.user;
              emailMap.set(userId, user.email ?? null);
              authMetadataMap.set(userId, {
                email: user.email ?? null,
                metadata: user.user_metadata || {},
              });
            }
          } catch (err) {
            // Si falla getUserById, al menos guardar el ID sin email
            console.warn(`[ACTIVE USERS] Error obteniendo usuario ${userId}:`, err);
          }
        }

        // Crear un mapa de perfiles para acceso rápido
        const profileMap = new Map<string, any>();
        if (!profilesErr && profiles && Array.isArray(profiles)) {
          for (const profile of profiles) {
            profileMap.set(String(profile.id), profile);
          }
        }

        // Crear detalles para TODOS los usuarios activos, incluso si no tienen perfil
        for (const userId of userIdsArray) {
          const profile = profileMap.get(userId);
          const authData = authMetadataMap.get(userId);
          const email = emailMap.get(userId) || authData?.email || null;
          
          // Obtener nombre desde múltiples fuentes
          let nickname: string | null = null;
          let full_name: string | null = null;
          let username: string | null = null;
          let is_verified = false;
          
          if (profile) {
            nickname = profile.nickname ?? null;
            full_name = profile.full_name ?? null;
            username = profile.username ?? null;
            is_verified = profile.is_verified ?? false;
          }
          
          // Si no hay perfil, intentar desde metadata de auth
          if (!nickname && !full_name && authData?.metadata) {
            full_name = authData.metadata.full_name || authData.metadata.name || null;
            nickname = authData.metadata.nickname || authData.metadata.username || null;
          }
          
          // Si aún no hay nombre, usar email como fallback
          if (!nickname && !full_name && !username && email) {
            const emailName = email.split('@')[0];
            nickname = emailName.charAt(0).toUpperCase() + emailName.slice(1);
          }
          
          // Obtener última actividad
          const lastActivity = activityMap.get(userId) || 
            (profile?.updated_at ? new Date(profile.updated_at).toISOString() : 
             now.toISOString()); // Si no hay actividad registrada, usar "ahora"
          
          activeUsersDetails.push({
            id: userId,
            nickname,
            full_name,
            username,
            email,
            is_verified,
            last_activity: lastActivity,
          });
        }
        
        // Ordenar por última actividad (más reciente primero)
        activeUsersDetails.sort((a, b) => {
          const aTime = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const bTime = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          return bTime - aTime;
        });
        
        console.log('[ACTIVE USERS] Usuarios encontrados:', {
          totalIds: activeUserIds.size,
          detailsCount: activeUsersDetails.length,
          sample: activeUsersDetails.slice(0, 3).map(u => ({
            id: u.id,
            nickname: u.nickname,
            email: u.email,
            hasName: !!(u.nickname || u.full_name || u.username),
          })),
        });
      } catch (err) {
        console.error('[ACTIVE USERS] Error obteniendo detalles de usuarios:', err);
      }
    } else {
      console.log('[ACTIVE USERS] No hay usuarios activos (activeUserIds.size = 0)');
    }

    // Asegurar que siempre tengamos al menos los IDs de usuarios activos, incluso sin detalles
    if (activeUsersDetails.length === 0 && activeUserIds.size > 0) {
      // Si no se pudieron obtener detalles, al menos devolver los IDs
      for (const userId of Array.from(activeUserIds).slice(0, 50)) {
        activeUsersDetails.push({
          id: userId,
          nickname: null,
          full_name: null,
          username: null,
          email: null,
          is_verified: false,
          last_activity: now.toISOString(),
        });
      }
    }

    const resp = NextResponse.json({
      ok: true,
      activeUsers: activeUsersCount,
      totalUsers: totalUsersCount || 0,
      timestamp: now.toISOString(),
      windowMinutes: 5,
      users: activeUsersDetails, // Siempre incluir usuarios, incluso si solo tienen ID
    });

    // No cachear - esto debe ser en tiempo real
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[ACTIVE USERS] Error:', e);
    const resp = NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al obtener usuarios activos' },
      { status: 500 }
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
