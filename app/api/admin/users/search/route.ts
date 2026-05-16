import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: adminCheck } = await supabaseAdmin()
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!adminCheck) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const query = (req.nextUrl.searchParams.get('q') || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 100) || 100));

    const admin = supabaseAdmin();
    let profiles: any[] = [];
    let authUsersForProfiles: any[] = [];

    // Primero obtener usuarios de auth para tener todos los usuarios (incluso sin perfil)
    try {
      let allAuthUsers: any[] = [];
      let page = 1;
      const maxPages = 20; // Límite de seguridad

      while (page <= maxPages) {
        try {
          const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ page, perPage: 100 });
          if (authErr || !authUsers?.users || authUsers.users.length === 0) break;

          allAuthUsers = allAuthUsers.concat(authUsers.users);

          // Si hay menos de 100 usuarios, ya obtuvimos todos
          if (authUsers.users.length < 100) break;

          page++;
        } catch (pageErr) {
          console.warn(`[ADMIN USERS SEARCH] Error en página ${page} de auth users:`, pageErr);
          break;
        }
      }

      authUsersForProfiles = allAuthUsers;
      console.log(`[ADMIN USERS SEARCH] Total usuarios en auth: ${allAuthUsers.length}`);
    } catch (e) {
      console.warn('[ADMIN USERS SEARCH] Error obteniendo usuarios de auth:', e);
    }

    // profiles: created_at, is_verified pueden no existir.
    const colsBase = 'id, full_name, nickname';
    const colsWithDate = 'id, full_name, first_name, last_name, nickname, created_at, is_verified';
    const runList = async () => {
      const q = admin.from('profiles').select(colsWithDate).order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await q;
      if (error) {
        const msg = String((error as any)?.message ?? '').toLowerCase();
        const code = String((error as any)?.code ?? '');
        if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
          const fallback = await admin.from('profiles').select(colsBase).order('id', { ascending: false }).limit(limit);
          if (fallback.error) throw fallback.error;
          return fallback.data ?? [];
        }
        throw error;
      }
      return data ?? [];
    };
    const runSearch = async () => {
      const term = `%${query.toLowerCase()}%`;
      const q = admin
        .from('profiles')
        .select(colsWithDate)
        .or(`full_name.ilike.${term},nickname.ilike.${term}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      const { data, error } = await q;
      if (error) {
        const msg = String((error as any)?.message ?? '').toLowerCase();
        const code = String((error as any)?.code ?? '');
        if (code === '42703' || msg.includes('column') || msg.includes('does not exist')) {
          const fallback = await admin
            .from('profiles')
            .select(colsBase)
            .or(`full_name.ilike.${term},nickname.ilike.${term}`)
            .order('id', { ascending: false })
            .limit(limit);
          if (fallback.error) throw fallback.error;
          return fallback.data ?? [];
        }
        throw error;
      }
      return data ?? [];
    };

    if (!query || query.length < 2) {
      profiles = await runList();
    } else {
      profiles = await runSearch();
    }

    // Si hay usuarios en auth que no tienen perfil, agregarlos también
    const profileIds = new Set(profiles.map((p: any) => String(p?.id ?? '').trim()).filter(Boolean));
    const missingAuthUsers = authUsersForProfiles
      .filter((au) => {
        const auId = String(au?.id ?? '').trim();
        if (!auId) return false;
        // Si hay query, verificar que coincida con email o id
        if (query && query.length >= 2) {
          const qLower = query.toLowerCase();
          const emailMatch = au.email?.toLowerCase().includes(qLower);
          const idMatch = auId.toLowerCase().includes(qLower);
          return (emailMatch || idMatch) && !profileIds.has(auId);
        }
        // Sin query, incluir todos los que no tienen perfil
        return !profileIds.has(auId);
      })
      .slice(0, limit - profiles.length); // Limitar para no exceder el límite total

    // Crear perfiles virtuales para usuarios de auth sin perfil
    for (const authUser of missingAuthUsers) {
      profiles.push({
        id: authUser.id,
        full_name: null,
        username: null,
        created_at: authUser.created_at ?? null,
        is_verified: false,
      });
    }

    const ids = profiles.map((p: any) => String(p?.id ?? '').trim()).filter(Boolean);
    const adminStateByUserId = new Map<string, { status: string; suspended_until?: string | null; notes?: string | null }>();
    if (ids.length > 0) {
      try {
        const r: any = await admin.from('user_admin_states').select('user_id,status,suspended_until,notes').in('user_id', ids);
        if (!r?.error && Array.isArray(r?.data)) {
          for (const row of r.data as any[]) {
            const uid = String(row?.user_id ?? '').trim();
            if (!uid) continue;
            adminStateByUserId.set(uid, {
              status: String(row?.status ?? 'active'),
              suspended_until: row?.suspended_until ?? null,
              notes: row?.notes ?? null,
            });
          }
        }
      } catch {
        // ignore
      }
    }

    const statsMap = new Map<
      string,
      {
        ventas_count: number;
        ventas_total: number;
        ventas_total_count: number;
        ventas_cancelled_count: number;
        compras_count: number;
        compras_total: number;
        compras_total_count: number;
        compras_cancelled_count: number;
        operations_count: number;
        disputes_buyer: number;
        disputes_seller: number;
        disputes_total: number;
        withdrawn_total: number;
      }
    >();

    if (ids.length > 0) {
      const CANCELLED = ['cancelled', 'canceled', 'refunded'];
      const orderCols = 'id,seller_id,buyer_id,status,total';
      try {
        const [asSeller, asBuyer, dispBuyer, dispSeller, withRows] = await Promise.all([
          admin.from('orders').select(orderCols).in('seller_id', ids).limit(3000),
          admin.from('orders').select(orderCols).in('buyer_id', ids).limit(3000),
          admin.from('disputes').select('buyer_id').in('buyer_id', ids).limit(2000),
          admin.from('disputes').select('seller_id').in('seller_id', ids).limit(2000),
          admin.from('seller_withdrawals').select('seller_id,amount_cents,status').in('seller_id', ids).limit(2000),
        ]);
        if ((asSeller as any)?.error) console.warn('[ADMIN USERS SEARCH] orders as seller:', (asSeller as any).error);
        if ((asBuyer as any)?.error) console.warn('[ADMIN USERS SEARCH] orders as buyer:', (asBuyer as any).error);
        const sellerRows = ((asSeller as any)?.error ? [] : (asSeller as any)?.data ?? []) as any[];
        const buyerRows = ((asBuyer as any)?.error ? [] : (asBuyer as any)?.data ?? []) as any[];
        const dB = ((dispBuyer as any)?.error ? [] : (dispBuyer as any)?.data ?? []) as any[];
        const dS = ((dispSeller as any)?.error ? [] : (dispSeller as any)?.data ?? []) as any[];
        const wR = ((withRows as any)?.error ? [] : (withRows as any)?.data ?? []) as any[];

        for (const uid of ids) {
          statsMap.set(uid, {
            ventas_count: 0,
            ventas_total: 0,
            ventas_total_count: 0,
            ventas_cancelled_count: 0,
            compras_count: 0,
            compras_total: 0,
            compras_total_count: 0,
            compras_cancelled_count: 0,
            operations_count: 0,
            disputes_buyer: 0,
            disputes_seller: 0,
            disputes_total: 0,
            withdrawn_total: 0,
          });
        }
        for (const o of sellerRows) {
          const sid = String(o?.seller_id ?? '').trim();
          if (!sid || !statsMap.has(sid)) continue;
          const s = statsMap.get(sid)!;
          s.ventas_count += 1;
          s.ventas_total_count += 1;
          s.ventas_total += Number(o?.total ?? 0) || 0;
          const st = String(o?.status ?? '').toLowerCase();
          if (CANCELLED.includes(st)) s.ventas_cancelled_count += 1;
          else s.operations_count += 1;
        }
        for (const o of buyerRows) {
          const bid = String(o?.buyer_id ?? '').trim();
          if (!bid || !statsMap.has(bid)) continue;
          const s = statsMap.get(bid)!;
          s.compras_count += 1;
          s.compras_total_count += 1;
          s.compras_total += Number(o?.total ?? 0) || 0;
          const st = String(o?.status ?? '').toLowerCase();
          if (CANCELLED.includes(st)) s.compras_cancelled_count += 1;
          else s.operations_count += 1;
        }
        for (const d of dB) {
          const uid = String(d?.buyer_id ?? '').trim();
          if (uid && statsMap.has(uid)) {
            const s = statsMap.get(uid)!;
            s.disputes_buyer += 1;
            s.disputes_total += 1;
          }
        }
        for (const d of dS) {
          const uid = String(d?.seller_id ?? '').trim();
          if (uid && statsMap.has(uid)) {
            const s = statsMap.get(uid)!;
            s.disputes_seller += 1;
            s.disputes_total += 1;
          }
        }
        for (const w of wR) {
          if (String(w?.status ?? '').toLowerCase() !== 'completed') continue;
          const uid = String(w?.seller_id ?? '').trim();
          if (!uid || !statsMap.has(uid)) continue;
          const s = statsMap.get(uid)!;
          s.withdrawn_total += (Number(w?.amount_cents ?? 0) || 0) / 100;
        }
        for (const s of Array.from(statsMap.values())) {
          s.withdrawn_total = Math.round(s.withdrawn_total * 100) / 100;
        }
      } catch (e) {
        console.error('[ADMIN USERS SEARCH] stats from orders/disputes/withdrawals:', e);
      }
    }

    const defaultStats = () => ({
      ventas_count: 0,
      ventas_total: 0,
      ventas_total_count: 0,
      ventas_cancelled_count: 0,
      compras_count: 0,
      compras_total: 0,
      compras_total_count: 0,
      compras_cancelled_count: 0,
      operations_count: 0,
      disputes_buyer: 0,
      disputes_seller: 0,
      disputes_total: 0,
      withdrawn_total: 0,
    });

    // Obtener información de Supabase Auth (email, fechas) - MEJORADO: obtener TODOS los usuarios de auth
    const emailMap = new Map<string, string | null>();
    const authCreatedAtMap = new Map<string, string | null>();
    const lastSignInAtMap = new Map<string, string | null>();

    // Obtener TODOS los usuarios de auth (paginado) para enriquecer los datos
    try {
      let allAuthUsers: any[] = [];
      let page = 1;
      const maxPages = 20; // Límite de seguridad

      while (page <= maxPages) {
        try {
          const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ page, perPage: 100 });
          if (authErr || !authUsers?.users || authUsers.users.length === 0) break;

          allAuthUsers = allAuthUsers.concat(authUsers.users);

          // Si hay menos de 100 usuarios, ya obtuvimos todos
          if (authUsers.users.length < 100) break;

          page++;
        } catch (pageErr) {
          console.warn(`[ADMIN USERS SEARCH] Error en página ${page} de auth users:`, pageErr);
          break;
        }
      }

      // Mapear todos los usuarios de auth
      for (const authUser of allAuthUsers) {
        emailMap.set(authUser.id, authUser.email ?? null);
        authCreatedAtMap.set(authUser.id, authUser.created_at ?? null);
        lastSignInAtMap.set(authUser.id, authUser.last_sign_in_at ?? null);
      }

      console.log(`[ADMIN USERS SEARCH] Usuarios de auth cargados: ${allAuthUsers.length}`);
    } catch (e) {
      console.warn('[ADMIN USERS SEARCH] Error obteniendo datos de auth:', e);
    }

    // Obtener saldos de monedero (wallets)
    const walletMap = new Map<string, number>();
    if (ids.length > 0) {
      try {
        const { data: wallets, error: walletErr } = await admin
          .from('wallets')
          .select('user_id, balance')
          .in('user_id', ids);

        if (!walletErr && wallets) {
          wallets.forEach((w: any) => {
            walletMap.set(w.user_id, Number(w.balance) || 0);
          });
        }
      } catch (e) {
        console.warn('[ADMIN USERS SEARCH] Error obteniendo wallets:', e);
      }
    }

    const users = profiles.map((p: any) => {
      const uid = String(p?.id ?? '').trim();
      const stats = statsMap.get(uid) ?? defaultStats();
      const ast = adminStateByUserId.get(uid);
      return {
        id: uid,
        email: emailMap.get(uid) ?? null,
        full_name: p.full_name ?? null,
        nickname: p.nickname ?? null,
        created_at: p.created_at ?? null,
        auth_created_at: authCreatedAtMap.get(uid) ?? null,
        last_sign_in_at: lastSignInAtMap.get(uid) ?? null,
        name: p.full_name || p.nickname || 'Sin nombre',
        is_verified: Boolean(p?.is_verified ?? false),
        wallet_balance: walletMap.get(uid) ?? 0,
        admin_state: ast ? { status: ast.status, suspended_until: ast.suspended_until, notes: ast.notes } : { status: 'active' as const },
        stats: {
          ventas_count: stats.ventas_count,
          ventas_total: stats.ventas_total,
          ventas_total_count: stats.ventas_total_count,
          ventas_cancelled_count: stats.ventas_cancelled_count,
          compras_count: stats.compras_count,
          compras_total: stats.compras_total,
          compras_total_count: stats.compras_total_count,
          compras_cancelled_count: stats.compras_cancelled_count,
          comision_total: 0,
          envios_total: 0,
          operations_count: stats.operations_count,
          disputes_buyer: stats.disputes_buyer,
          disputes_seller: stats.disputes_seller,
          disputes_total: stats.disputes_total,
          withdrawn_total: stats.withdrawn_total,
        },
      };
    });
    // Apply filter if specified (e.g., ?filter=suspended)
    const filter = (req.nextUrl.searchParams.get('filter') || '').trim().toLowerCase();
    let filteredUsers = users;
    if (filter === 'suspended') {
      filteredUsers = users.filter((u: any) => {
        const st = String(u?.admin_state?.status || 'active').toLowerCase();
        return st === 'suspended';
      });
    } else if (filter === 'banned') {
      filteredUsers = users.filter((u: any) => {
        const st = String(u?.admin_state?.status || 'active').toLowerCase();
        return st === 'banned';
      });
    }

    return NextResponse.json({ users: filteredUsers });
  } catch (err: any) {
    console.error('[ADMIN USERS SEARCH] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al buscar usuarios' }, { status: 500 });
  }
}
