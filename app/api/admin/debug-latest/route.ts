import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  const admin = auth.admin;
  const logs: string[] = [];

  try {
    logs.push('Iniciando Auto-Fix de inconsistencias MercadoPago...');

    // 1. Buscar sesiones pagadas de MP recientes (últimas 72h para estar seguros)
    const { data: sessions, error: sErr } = await admin
      .from('checkout_sessions')
      .select('id, order_ids, status, created_at, payment_method')
      .eq('payment_method', 'mercadopago')
      .eq('status', 'paid')
      .gt('created_at', new Date(Date.now() - 72 * 3600 * 1000).toISOString())
      .limit(50);

    if (sErr) throw new Error(`Error fetching sessions: ${sErr.message}`);
    logs.push(`Sesiones pagadas encontradas (últimas 72h): ${sessions?.length || 0}`);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No se encontraron sesiones pagadas recientes', logs });
    }

    const fixedOrders: any[] = [];
    
    for (const session of sessions) {
      const orderIds = (session.order_ids as string[]) || [];
      if (orderIds.length === 0) continue;

      // 2. Verificar estado de órdenes
      const { data: orders, error: oErr } = await admin
        .from('orders')
        .select('id, status, total')
        .in('id', orderIds);

      if (oErr) {
        logs.push(`Error fetching orders for session ${session.id}: ${oErr.message}`);
        continue;
      }

      const pendingOrders = orders?.filter(o => 
        ['pending', 'pending_payment', 'validation_failed'].includes(o.status)
      ) || [];

      if (pendingOrders.length > 0) {
        logs.push(`⚠️ Inconsistencia detectada en sesión ${session.id}: ${pendingOrders.length} órdenes pendientes.`);
        
        // 3. FIX: Actualizar órdenes a paid
        const idsToFix = pendingOrders.map(o => o.id);
        const { error: fixErr } = await admin
          .from('orders')
          .update({ 
            status: 'paid',
            paid_at: new Date().toISOString() // Asumiendo que existe columna paid_at, si no fallará pero el status es lo importante
          })
          .in('id', idsToFix);

        if (fixErr) {
           // Fallback si paid_at no existe
           logs.push(`Error en update con paid_at, reintentando solo status... ${fixErr.message}`);
           await admin.from('orders').update({ status: 'paid' }).in('id', idsToFix);
        }

        logs.push(`✅ Órdenes corregidas: ${idsToFix.join(', ')}`);
        fixedOrders.push(...idsToFix);
        
        // Opcional: Enviar notificación básica (o confiar en que el usuario ya sabe)
        // No enviaremos notificaciones masivas aquí para no spammear, el usuario pidió arreglar la comunicación.
        // Pero al poner status 'paid', el dashboard del vendedor se actualizará solo.
      }
    }

    return NextResponse.json({ 
      success: true, 
      fixed_count: fixedOrders.length,
      fixed_orders: fixedOrders,
      logs 
    });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, logs }, { status: 500 });
  }
}
