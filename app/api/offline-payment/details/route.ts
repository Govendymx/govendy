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

    const checkoutId = String(req.nextUrl.searchParams.get('checkoutId') || '').trim();
    if (!checkoutId) return NextResponse.json({ error: 'checkoutId is required' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();

    const { data: sessionRow, error: sErr } = await admin
      .from('checkout_sessions')
      .select('id,buyer_id,order_ids,payment_method,status,amount,reference_code,offline_instructions,created_at,payment_proof_url,payment_proof_uploaded_at')
      .eq('id', checkoutId)
      .maybeSingle();
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!sessionRow) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });

    // Permitir ver la hoja al comprador dueño o a un admin.
    const isBuyer = String((sessionRow as any).buyer_id || '') === userData.user.id;
    let isAdmin = false;
    try {
      const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
      isAdmin = !!adminRow;
    } catch {
      isAdmin = false;
    }
    if (!isBuyer && !isAdmin) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    const orderIds = (((sessionRow as any).order_ids as string[]) ?? []).map(String).filter(Boolean);
    const { data: orders, error: oErr } = await admin
      .from('orders')
      .select('id,status,payment_method,subtotal,shipping_fee,commission_fee,total,coupon_code,coupon_discount,created_at')
      .in('id', orderIds)
      .limit(200);
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });

    const { data: items, error: iErr } = await admin
      .from('order_items')
      .select('order_id,title,quantity,unit_price,line_total')
      .in('order_id', orderIds)
      .limit(2000);
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });

    // Datos de pago desde settings (por si no hay snapshot)
    const { data: settingsRow } = await admin.from('app_settings').select('payment_methods').eq('id', 1).maybeSingle();
    const pm = (settingsRow as any)?.payment_methods ?? {};

    return NextResponse.json({
      ok: true,
      session: sessionRow,
      orders: (orders as any[]) ?? [],
      items: (items as any[]) ?? [],
      payment_methods: pm,
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

