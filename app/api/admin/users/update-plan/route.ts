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

  return { ok: true as const, admin };
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const body = await req.json().catch(() => ({}));
    const userId = String(body.user_id || '').trim();
    const plan = String(body.plan || '').trim();
    const customStart = body.pro_subscription_start ? String(body.pro_subscription_start) : null;
    const customEnd = body.pro_subscription_end ? String(body.pro_subscription_end) : null;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    if (!['basic', 'pro', 'platinum'].includes(plan)) return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });

    const updateData: any = { plan_type: plan };
    if (plan === 'pro' || plan === 'platinum') {
      if (customEnd) {
        updateData.pro_subscription_start = customStart || new Date().toISOString();
        updateData.pro_subscription_end = customEnd;
      } else {
        const now = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);
        updateData.pro_subscription_start = now.toISOString();
        updateData.pro_subscription_end = end.toISOString();
      }
    } else {
      updateData.pro_subscription_start = null;
      updateData.pro_subscription_end = null;
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[update-plan]', e);
    return NextResponse.json({ error: e.message || 'Error updating plan' }, { status: 500 });
  }
}
