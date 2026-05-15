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

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    // Cliente anon para validar token (y fallback RLS si no hay service role).
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = clamp(Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50, 1, 200);
    const uid = userData.user.id;

    // Preferimos service_role para evitar depender de RLS.
    // Pero si NO está configurada, hacemos fallback usando RLS con el JWT del usuario.
    let db: any = null;
    try {
      db = supabaseAdmin();
    } catch (e) {
      console.warn('supabaseAdmin() not available, falling back to RLS (anon+JWT).', e);
      db = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }

    // Listado (best-effort: soporta schemas viejos)
    const trySelect = async (cols: string) =>
      await db.from('notifications').select(cols).eq('user_id', uid).order('created_at', { ascending: false }).limit(limit);

    let hasIsReadColumn = true;
    let res: any = await trySelect('id,user_id,type,title,body,message,link_to,data,is_read,created_at');
    if (res?.error) {
      const code = String((res.error as any)?.code || '');
      const msg = String((res.error as any)?.message || '').toLowerCase();
      // Tabla realmente inexistente / schema cache / PostgREST no encuentra la relación
      // Importante: NO confundir "column ... does not exist" (42703/PGRST204) con tabla faltante.
      const isTableMissing =
        code === '42P01' ||
        code === 'PGRST106' ||
        msg.includes('schema cache') ||
        (msg.includes('relation') && msg.includes('does not exist'));
      if (isTableMissing) {
        const resp = NextResponse.json({
          ok: true,
          rows: [],
          unread_count: 0,
          sales_unread_count: 0,
          table_missing: true,
          // Diagnóstico (no sensible): ayuda a confirmar si estás en el proyecto correcto o si es schema cache.
          supabase_url: supabaseUrl,
          table_error: { code, message: String((res.error as any)?.message || '') },
          hint_sql: "select pg_notify('pgrst','reload schema');",
        });
        resp.headers.set('Cache-Control', 'no-store, max-age=0');
        return resp;
      }
      if (code === '42703' || msg.includes('column')) {
        hasIsReadColumn = false;
        res = await trySelect('id,user_id,type,title,body,message,link_to,created_at');
        if (res?.error) res = await trySelect('id,user_id,type,title,body,message,created_at');
        if (res?.error) res = await trySelect('id,user_id,type,title,body,created_at');
        if (res?.error) res = await trySelect('id,user_id,title,message,created_at');
        if (res?.error) res = await trySelect('id,user_id,title,body');
      }
    }
    if (res?.error) return NextResponse.json({ error: String((res.error as any)?.message || 'Failed to load notifications') }, { status: 400 });

    const rows = ((res.data as any[]) ?? []).map((n) => ({
      ...n,
      body: (n as any)?.body ?? (n as any)?.message ?? null,
      // Compat: si `type` es enum/limitado, el "tipo real" puede venir en data.kind
      kind: String((n as any)?.data?.kind ?? (n as any)?.type ?? '').trim() || null,
      // null => false para que el frontend pueda usar r.is_read === false correctamente
      is_read: (n as any)?.is_read === true ? true : false,
    }));

    // Conteos (si existe is_read)
    let unreadCount = 0;
    let salesUnreadCount = 0;
    const unreadCountFromRows = () => {
      const bools = rows.filter((r: any) => typeof r?.is_read === 'boolean').length;
      if (!hasIsReadColumn || bools === 0) return rows.length;
      return rows.filter((r: any) => r?.is_read === false).length;
    };
    try {
      const c1: any = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).or('is_read.eq.false,is_read.is.null');
      if (!c1?.error) {
        unreadCount = Number(c1?.count ?? 0) || 0;
      } else {
        const fallback: any = await db.from('notifications').select('id').eq('user_id', uid).or('is_read.eq.false,is_read.is.null').limit(5000);
        if (!fallback?.error) unreadCount = Array.isArray(fallback.data) ? fallback.data.length : 0;
        else unreadCount = unreadCountFromRows();
      }
    } catch {
      try {
        const fallback: any = await db.from('notifications').select('id').eq('user_id', uid).eq('is_read', false).limit(5000);
        if (!fallback?.error) unreadCount = Array.isArray(fallback.data) ? fallback.data.length : 0;
        else unreadCount = unreadCountFromRows();
      } catch {
        unreadCount = unreadCountFromRows();
      }
    }
    try {
      // Compat: ventas pueden estar en type (si es TEXT) o en data.kind (si type es ENUM)
      let c2: any = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('is_read', false)
        .or('type.in.(new_sale,sale_paid),data->>kind.in.(new_sale,sale_paid)');
      if (c2?.error) {
        // fallback por si el backend no soporta json path en `or`
        c2 = await db
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_read', false)
          .in('type', ['new_sale', 'sale_paid']);
        if (c2?.error) {
          c2 = await db
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', uid)
            .eq('is_read', false)
            .in('data->>kind', ['new_sale', 'sale_paid']);
        }
      }
      if (!c2?.error) {
        salesUnreadCount = Number(c2?.count ?? 0) || 0;
      } else {
        // fallback: contar leyendo IDs no-leídos y filtrando (límite alto)
        const allUnread: any = await db.from('notifications').select('id,type,data,is_read').eq('user_id', uid).eq('is_read', false).limit(5000);
        if (!allUnread?.error && Array.isArray(allUnread.data)) {
          const isSaleKind = (k: string) => k === 'new_sale' || k === 'sale_paid';
          salesUnreadCount = allUnread.data.filter((r: any) => {
            const kind = String(r?.data?.kind ?? r?.type ?? '').trim();
            return isSaleKind(kind);
          }).length;
        } else {
          const isSaleKind = (k: string) => k === 'new_sale' || k === 'sale_paid';
          salesUnreadCount = rows.filter((r: any) => {
            const kind = String(r?.kind || r?.type || '').trim();
            const isUnread = !hasIsReadColumn ? true : typeof r?.is_read === 'boolean' ? r.is_read === false : true;
            return isUnread && isSaleKind(kind);
          }).length;
        }
      }
    } catch {
      const isSaleKind = (k: string) => k === 'new_sale' || k === 'sale_paid';
      salesUnreadCount = rows.filter((r: any) => {
        const kind = String(r?.kind || r?.type || '').trim();
        const isUnread = !hasIsReadColumn ? true : typeof r?.is_read === 'boolean' ? r.is_read === false : true;
        return isUnread && isSaleKind(kind);
      }).length;
    }

    const resp = NextResponse.json({ ok: true, rows, unread_count: unreadCount, sales_unread_count: salesUnreadCount });
    // No cachear para evitar inconsistencias en tiempo real
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

