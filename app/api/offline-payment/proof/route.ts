import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/admin/activity-logger';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireUser(req: NextRequest) {
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

  return { ok: true as const, userId: userData.user.id };
}

async function isAdminUser(admin: any, userId: string) {
  try {
    const { data: row } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
    return !!row;
  } catch {
    return false;
  }
}

type Body = {
  checkoutId: string;
  proofUrl: string;
};

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { userId } = guard;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const checkoutId = String(body?.checkoutId || '').trim();
    const proofUrl = String(body?.proofUrl || '').trim();
    if (!checkoutId) return NextResponse.json({ error: 'checkoutId is required' }, { status: 400 });
    if (!proofUrl) return NextResponse.json({ error: 'proofUrl is required' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: sessionRow, error: sErr } = await admin.from('checkout_sessions').select('id,buyer_id').eq('id', checkoutId).maybeSingle();
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!sessionRow) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });

    const buyerId = String((sessionRow as any)?.buyer_id || '').trim();
    const adminOk = await isAdminUser(admin, userId);
    if (buyerId !== userId && !adminOk) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    // Guardar comprobante
    const payload: any = {
      payment_proof_url: proofUrl,
      payment_proof_uploaded_at: new Date().toISOString(),
    };

    let upd: any = await admin.from('checkout_sessions').update(payload).eq('id', checkoutId).select('id,payment_proof_url,payment_proof_uploaded_at');
    if (upd.error) {
      const code = String((upd.error as any)?.code || '');
      const msg = String((upd.error as any)?.message || '').toLowerCase();
      if (code === '42703' || msg.includes('column')) {
        return NextResponse.json(
          {
            error:
              'Faltan columnas para guardar el comprobante. Ejecuta el SQL `supabase_checkout_sessions_offline_proof.sql` en Supabase y vuelve a intentar.',
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: String((upd.error as any)?.message || upd.error) }, { status: 400 });
    }

    const row = Array.isArray(upd.data) ? upd.data[0] : upd.data;
    
    await logActivity({
      event_type: 'payment_proof_uploaded',
      entity_type: 'checkout_session',
      entity_id: checkoutId,
      user_id: userId,
      severity: 'warning', // Warning to attract attention as requested
      details: { proofUrl, message: 'Comprobante subido, requiere validación' }
    });

    const resp = NextResponse.json({ ok: true, session: row });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}

