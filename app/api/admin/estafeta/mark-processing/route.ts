import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type Body = {
  quote_id: string;
};

export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const quoteId = String(body.quote_id || '').trim();

    if (!quoteId) {
      return NextResponse.json({ error: 'quote_id es requerido.' }, { status: 400 });
    }

    // Actualizar estado a processing
    const { error: updateErr } = await admin
      .from('estafeta_quotes')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('status', 'paid'); // Solo actualizar si está en paid

    if (updateErr) {
      console.error('[ADMIN ESTAFETA MARK PROCESSING] Error:', updateErr);
      return NextResponse.json({ error: 'No se pudo actualizar el estado.' }, { status: 500 });
    }

    const resp = NextResponse.json({ ok: true, message: 'Estado actualizado a procesando.' });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
