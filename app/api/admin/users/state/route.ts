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

type Body = {
  user_id: string;
  action: 'activate' | 'suspend' | 'ban' | 'delete';
  days?: number;
  notes?: string;
};

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const userId = String(body?.user_id || '').trim();
    const action = String(body?.action || '').trim() as Body['action'];
    const days = Number(body?.days ?? 0);
    const notes = String(body?.notes || '').trim();

    if (!userId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    if (!['activate', 'suspend', 'ban', 'delete'].includes(action)) return NextResponse.json({ error: 'action inválida' }, { status: 400 });

    // Usar el módulo centralizado de gestión de usuarios
    const { executeUserAction } = await import('@/lib/admin/userManagement');
    
    const result = await executeUserAction(admin, requesterId, userId, action as any, {
      days,
      notes
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Error al ejecutar la acción' }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Acción ejecutada correctamente',
      affectedListings: result.affectedListings,
      warnings: result.warnings
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

