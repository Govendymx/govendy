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

function startOfTodayUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const today = startOfTodayUtc();
    const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get('limit') || 20)));

    let paidPending = 0;
    let paidToday = 0;
    let recent: any[] = [];

    try {
      const [rPaid, rToday, rRecent] = await Promise.all([
        admin.from('estafeta_quotes').select('id', { count: 'exact', head: true }).eq('status', 'paid').limit(1),
        admin.from('estafeta_quotes').select('id').gte('paid_at', today).limit(500),
        admin
          .from('estafeta_quotes')
          .select('id,status,calculated_cost,paid_at,created_at,sender_name,sender_city,sender_state,recipient_name,recipient_city,recipient_state,guide_file_url,guide_uploaded_at')
          .in('status', ['paid', 'processing'])
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      paidPending = typeof (rPaid as any)?.count === 'number' ? (rPaid as any).count : 0;
      paidToday = Array.isArray((rToday as any)?.data) ? ((rToday as any).data as any[]).length : 0;
      recent = Array.isArray((rRecent as any)?.data) ? ((rRecent as any).data as any[]) : [];
    } catch (e) {
      console.error('[supervision/estafeta]', e);
    }

    const resp = NextResponse.json({
      ok: true,
      estafeta_paid_pending_guide: paidPending,
      estafeta_paid_today: paidToday,
      recent,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error('[supervision/estafeta]', e);
    const r = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  }
}
