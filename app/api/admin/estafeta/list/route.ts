import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
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

    const status = req.nextUrl.searchParams.get('status') || 'all';

    // OPTIMIZACIÓN: Usar select específico en lugar de select('*') y reducir límite
    const selectCols = 'id,user_id,weight_kg,length_cm,width_cm,height_cm,sender_name,sender_phone,sender_email,sender_between_streets,sender_references,sender_address,sender_city,sender_state,sender_postal_code,recipient_name,recipient_phone,recipient_email,recipient_between_streets,recipient_references,recipient_address,recipient_city,recipient_state,recipient_postal_code,calculated_cost,status,mp_payment_id,mp_payment_status,guide_file_url,guide_uploaded_at,guide_uploaded_by,created_at,paid_at,completed_at';
    let query = admin.from('estafeta_quotes').select(selectCols).order('created_at', { ascending: false }).limit(200);

    if (status !== 'all') {
      query = query.eq('status', status);
    } else {
      // Exclude raw quotations — admin only needs paid/processing/completed
      query = query.neq('status', 'quote');
    }

    const { data: quotes, error: quotesErr } = await query;

    if (quotesErr) {
      console.error('[ADMIN ESTAFETA LIST] Error:', quotesErr);
      return NextResponse.json({ error: 'No se pudieron cargar las cotizaciones.' }, { status: 500 });
    }

    const resp = NextResponse.json({
      ok: true,
      quotes: (quotes as any[]) ?? [],
    });
    // Cachear por 10 segundos (los datos del admin cambian poco frecuentemente)
    resp.headers.set('Cache-Control', 'private, s-maxage=10, stale-while-revalidate=30');
    return resp;
  } catch (e: unknown) {
    console.error(e);
    const resp = NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
