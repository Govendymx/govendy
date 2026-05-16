import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { orderId, reason } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    const { error } = await supabaseAdmin()
      .from('orders')
      .update({
        status: 'awaiting_voucher',
        buyer_payment_voucher_url: null, // Reset the voucher URL
        // Idealmente guardar el motivo de rechazo en una nueva columna o en notas del admin,
        // pero por ahora volvemos el estado para que pueda subir otro.
      })
      .eq('id', orderId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
