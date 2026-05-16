import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedPlan = String(body.plan || '').trim();
    const contactPref = String(body.contact_preference || '').trim();

    if (!['pro', 'platinum', 'verification'].includes(requestedPlan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });
    }

    const { error: insertErr } = await supabase
      .from('plan_requests')
      .insert({
        user_id: userData.user.id,
        requested_plan: requestedPlan,
        contact_preference: contactPref || 'whatsapp',
        status: 'pending'
      });

    if (insertErr) {
      console.error('[request-plan] insert error:', insertErr);
      return NextResponse.json({ error: 'No se pudo guardar la solicitud' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[request-plan] route error:', e);
    return NextResponse.json({ error: e.message || 'Error processing request' }, { status: 500 });
  }
}
