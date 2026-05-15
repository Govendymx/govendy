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

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get('event_type') || '';
    const entityType = searchParams.get('entity_type') || '';
    const status = searchParams.get('status') || '';
    const dateRange = searchParams.get('date_range') || 'today';
    const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') || 100)));

    let query: any = admin
      .from('admin_operation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) query = query.eq('event_type', eventType);
    if (entityType) query = query.eq('entity_type', entityType);
    if (status) query = query.eq('status', status);

    // Filtrar por fecha
    if (dateRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (dateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (dateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      query = query.gte('created_at', monthAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      const code = String((error as any)?.code || '');
      const msg = String((error as any)?.message || '').toLowerCase();
      if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
        return NextResponse.json(
          { error: 'Falta configurar eventos. Ejecuta `supabase_admin_operation_events.sql` en Supabase.' },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Contar eventos por tipo
    const eventsByType: Record<string, number> = {};
    const pendingCount = Array.isArray(data) ? data.filter((e: any) => e.status === 'pending').length : 0;
    const urgentCount = Array.isArray(data)
      ? data.filter((e: any) => {
          const priority = (e as any)?.metadata?.priority;
          return priority === 'urgent' || priority === 'high';
        }).length
      : 0;

    if (Array.isArray(data)) {
      for (const event of data as any[]) {
        const et = String(event?.event_type || 'unknown');
        eventsByType[et] = (eventsByType[et] || 0) + 1;
      }
    }

    const resp = NextResponse.json({
      ok: true,
      events: data || [],
      summary: {
        total: Array.isArray(data) ? data.length : 0,
        pending: pendingCount,
        urgent: urgentCount,
        by_type: eventsByType,
      },
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[ADMIN EVENTS API]', e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
