import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function requireUserFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  return { ok: true as const, userId: userData.user.id };
}

async function isAdminUser(admin: any, userId: string) {
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    const guard = await requireUserFromToken(token);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const disputeId = String(req.nextUrl.searchParams.get('disputeId') || '').trim();
    if (!disputeId) return NextResponse.json({ error: 'disputeId is required' }, { status: 400 });

    const admin = supabaseAdmin();
    const adminOk = await isAdminUser(admin, guard.userId).catch(() => false);

    const { data: dispute, error: dErr } = await admin
      .from('disputes')
      .select('id,order_id,buyer_id,seller_id,opened_by,reason_code,reason_text,status,admin_decision,admin_note,last_message_at,created_at,updated_at')
      .eq('id', disputeId)
      .maybeSingle();

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });
    if (!dispute) return NextResponse.json({ error: 'Disputa no encontrada.' }, { status: 404 });

    // Verificar permisos: admin, buyer o seller
    const buyerId = String((dispute as any)?.buyer_id || '').trim();
    const sellerId = String((dispute as any)?.seller_id || '').trim();
    if (!adminOk && buyerId !== guard.userId && sellerId !== guard.userId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, dispute });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al obtener la disputa.' }, { status: 500 });
  }
}
