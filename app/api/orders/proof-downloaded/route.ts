import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || '').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Actualizar la fecha de descarga de la constancia si aún no existe
    const { data, error } = await admin
      .from('orders')
      .update({ 
        delivery_proof_downloaded_at: new Date().toISOString() 
      })
      .eq('id', orderId)
      .is('delivery_proof_downloaded_at', null)
      .select('id, delivery_proof_downloaded_at')
      .maybeSingle();

    if (error) {
      console.error('[PROOF-DOWNLOADED] Error updating order:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      orderId, 
      delivery_proof_downloaded_at: data?.delivery_proof_downloaded_at || null 
    });
  } catch (error: any) {
    console.error('[PROOF-DOWNLOADED] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
