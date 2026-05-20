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
  if (userErr || !userData?.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error || !row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin };
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const { data: rawRequests, error } = await admin
      .from('plan_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const requests = rawRequests || [];
    
    // Fetch users manually since we can't join auth.users directly
    const requestsWithUsers = await Promise.all(
      requests.map(async (req) => {
        let user = null;
        if (req.user_id) {
          const { data: userData } = await admin.auth.admin.getUserById(req.user_id);
          if (userData?.user) {
            user = {
              id: userData.user.id,
              email: userData.user.email,
              raw_user_meta_data: userData.user.user_metadata,
            };
          }
        }
        return { ...req, user };
      })
    );

    return NextResponse.json({ requests: requestsWithUsers });
  } catch (e: any) {
    console.error('[plan-requests GET]', e);
    return NextResponse.json({ error: e.message || 'Error fetching requests' }, { status: 500 });
  }
}
