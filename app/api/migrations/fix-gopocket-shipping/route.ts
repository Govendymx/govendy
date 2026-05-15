import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar service role para saltar RLS en esta migración administrativa
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST() {
  try {
    console.log('[MIGRATION] Iniciando corrección de shipping_by_seller para órdenes GoVendy...');

    // 1. Identificar órdenes que tienen señales de GoVendy pero están marcadas como seller managed
    // Señales: carrier='gopocket', tiene label_url, o tiene subsidio > 0
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, shipping_option_id, shipping_carrier, shipping_label_url, shipping_subsidy, shipping_by_seller')
      .eq('shipping_by_seller', true);

    if (fetchError) throw fetchError;

    const toFix = (orders || []).filter(o => {
      const carr = String(o.shipping_carrier || '').toLowerCase();
      const opt = String(o.shipping_option_id || '').toLowerCase();
      const hasLabel = !!o.shipping_label_url;
      const hasSubsidy = Number(o.shipping_subsidy || 0) > 0;

      const isGoVendy = carr === 'gopocket' || hasLabel || hasSubsidy || (opt !== 'pickup' && opt !== '');
      return isGoVendy;
    });

    console.log(`[MIGRATION] Encontradas ${toFix.length} órdenes para corregir.`);

    if (toFix.length === 0) {
      return NextResponse.json({ ok: true, message: 'No hay órdenes que requieran corrección.' });
    }

    // 2. Ejecutar actualización por lotes
    const ids = toFix.map(o => o.id);
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ shipping_by_seller: false })
      .in('id', ids);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      message: `Se corrigieron ${toFix.length} órdenes exitosamente.`,
      fixed_ids: ids
    });

  } catch (error: any) {
    console.error('[MIGRATION] Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
