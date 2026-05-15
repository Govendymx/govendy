
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = supabaseAdmin();
  
  // 1. Get last 5 checkout sessions
  const { data: sessions, error: sessError } = await admin
    .from('checkout_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (sessError) {
    return NextResponse.json({ error: sessError }, { status: 500 });
  }

  // 2. For each session, get linked orders
  const results = [];
  for (const session of sessions) {
    let orderIds: string[] = [];
    const rawIds = session.order_ids;
    
    // Logic from update route
    if (Array.isArray(rawIds)) {
      orderIds = rawIds;
    } else if (typeof rawIds === 'string') {
      try {
        if (rawIds.startsWith('[')) {
          orderIds = JSON.parse(rawIds);
        } else {
          orderIds = rawIds.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        // ignore
      }
    }

    const { data: orders, error: ordError } = await admin
      .from('orders')
      .select('id, status, total, payment_method, created_at, paid_at')
      .in('id', orderIds);
      
    results.push({
      session: {
        id: session.id,
        status: session.status,
        payment_method: session.payment_method,
        order_ids_raw: rawIds,
        order_ids_parsed: orderIds,
        order_ids_type: typeof rawIds
      },
      orders: orders || [],
      orders_error: ordError
    });
  }

  return NextResponse.json({
    env: process.env.NODE_ENV,
    results
  });
}
