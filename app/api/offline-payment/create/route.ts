import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type Body = {
  orderIds: string[];
  // Nota: `amount` puede llegar desde el cliente por compatibilidad,
  // pero NO se usa como fuente de verdad (se recalcula desde la BD).
  amount?: number;
  payment_method: 'bank_transfer' | 'bank_deposit' | 'oxxo';
};

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function genRef() {
  const d = new Date();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars alfanum (hex)
  return `PCK-${yy}${mm}${dd}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(String) : [];
    const method = String(body.payment_method || '').trim() as Body['payment_method'];

    if (!Array.isArray(orderIds) || orderIds.length === 0) return NextResponse.json({ error: 'orderIds is required' }, { status: 400 });
    if (!['bank_transfer', 'bank_deposit', 'oxxo'].includes(method)) return NextResponse.json({ error: 'payment_method inválido' }, { status: 400 });

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

    // Verificar que las órdenes pertenezcan al buyer
    const { data: orders, error: oErr } = await admin.from('orders').select('id,buyer_id,status,total').in('id', orderIds).limit(200);
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });
    const rows = (orders as any[]) ?? [];
    if (rows.length === 0) return NextResponse.json({ error: 'Órdenes no encontradas.' }, { status: 404 });
    if (rows.some((o) => String(o?.buyer_id || '') !== userData.user.id)) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    const blockedStatuses = new Set(['paid', 'completed', 'shipped', 'delivered', 'cancelled', 'canceled', 'refunded', 'disputed']);
    if (rows.some((o) => blockedStatuses.has(String(o?.status || '').trim()))) {
      return NextResponse.json({ error: 'Hay órdenes que ya no pueden cobrarse.' }, { status: 400 });
    }

    const amount = rows.reduce((sum, o) => {
      const n = typeof o?.total === 'number' ? o.total : Number(o?.total ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Monto inválido (total <= 0).' }, { status: 400 });

    // Snapshot de instrucciones desde settings
    const { data: settingsRow } = await admin.from('app_settings').select('payment_methods').eq('id', 1).maybeSingle();
    const pm = (settingsRow as any)?.payment_methods ?? {};
    const instructions =
      method === 'bank_transfer'
        ? pm?.bank_transfer ?? {}
        : method === 'bank_deposit'
          ? pm?.bank_deposit ?? {}
          : pm?.oxxo ?? {};

    // Verificar si ya existe una sesión para estas órdenes
    console.log('[OFFLINE PAYMENT CREATE] Verificando si ya existe sesión para estas órdenes...', { 
      orderIds,
      orderIdsCount: orderIds.length,
      payment_method: method,
    });
    
    // CRÍTICO: Verificar que las órdenes existen y tienen el payment_method correcto
    const verifyOrdersRes: any = await admin
      .from('orders')
      .select('id,payment_method,status')
      .in('id', orderIds)
      .limit(200);
    
    if (verifyOrdersRes.error) {
      console.error('[OFFLINE PAYMENT CREATE] Error verificando órdenes:', verifyOrdersRes.error);
      return NextResponse.json({ error: `Error verificando órdenes: ${verifyOrdersRes.error.message}` }, { status: 400 });
    }
    
    const verifiedOrders = (verifyOrdersRes.data as any[]) ?? [];
    console.log('[OFFLINE PAYMENT CREATE] Órdenes verificadas:', {
      requested: orderIds.length,
      found: verifiedOrders.length,
      orders: verifiedOrders.map((o: any) => ({
        id: o?.id,
        payment_method: o?.payment_method,
        status: o?.status,
      })),
    });
    
    if (verifiedOrders.length !== orderIds.length) {
      console.error('[OFFLINE PAYMENT CREATE] ⚠️ ERROR: No se encontraron todas las órdenes:', {
        requested: orderIds,
        found: verifiedOrders.map((o: any) => o?.id),
      });
      return NextResponse.json({ error: `No se encontraron todas las órdenes. Se solicitaron ${orderIds.length} pero se encontraron ${verifiedOrders.length}.` }, { status: 404 });
    }
    
    // Verificar que todas tienen el payment_method correcto
    const wrongPaymentMethod = verifiedOrders.filter((o: any) => 
      String(o?.payment_method || '').trim() !== method
    );
    
    if (wrongPaymentMethod.length > 0) {
      console.log('[OFFLINE PAYMENT CREATE] Actualizando payment_method de órdenes divergentes...', {
        count: wrongPaymentMethod.length,
        newMethod: method
      });
      const idsToUpdate = wrongPaymentMethod.map((o: any) => o.id);
      const { error: updatePmError } = await admin
        .from('orders')
        .update({ payment_method: method })
        .in('id', idsToUpdate);

      if (updatePmError) {
        console.error('[OFFLINE PAYMENT CREATE] Error actualizando payment_method:', updatePmError);
        return NextResponse.json({ error: 'No se pudo actualizar el método de pago de las órdenes.' }, { status: 500 });
      }
    }
    
    const existingSessionRes: any = await admin
      .from('checkout_sessions')
      .select('id,status,reference_code,order_ids,payment_method')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
      .eq('status', 'pending')
      .limit(100);
    
    let existingSession: any = null;
    if (!existingSessionRes.error && Array.isArray(existingSessionRes.data)) {
      for (const sess of existingSessionRes.data) {
        const sessOrderIds = (((sess as any)?.order_ids as any[]) ?? []).map((x) => String(x || '').trim()).filter(Boolean);
        const allMatch = orderIds.every((oid) => sessOrderIds.includes(oid)) && sessOrderIds.length === orderIds.length;
        if (allMatch) {
          existingSession = sess;
          console.log('[OFFLINE PAYMENT CREATE] Sesión existente encontrada:', { id: sess.id, status: sess.status });
          break;
        }
      }
    }

    if (existingSession) {
      // Si ya existe una sesión pendiente, verificamos si hay que actualizar el método de pago
      const currentMethod = String(existingSession.payment_method || '').trim();
      
      if (currentMethod !== method) {
        console.log('[OFFLINE PAYMENT CREATE] Actualizando método de pago de sesión existente:', {
          sessionId: existingSession.id,
          oldMethod: currentMethod,
          newMethod: method
        });
        
        const { error: updateSessErr } = await admin
          .from('checkout_sessions')
          .update({ 
            payment_method: method,
            offline_instructions: instructions,
            amount // Actualizamos el monto por si hubo cambios
          })
          .eq('id', existingSession.id);
          
        if (updateSessErr) {
          console.error('[OFFLINE PAYMENT CREATE] Error actualizando sesión:', updateSessErr);
          // Si falla la actualización, mejor fallamos o creamos una nueva (riesgo de duplicado)
          // Pero aquí es mejor reportar error
          return NextResponse.json({ error: 'Error actualizando la sesión de pago existente.' }, { status: 500 });
        }
      } else {
         console.log('[OFFLINE PAYMENT CREATE] Reutilizando sesión existente sin cambios');
      }

      return NextResponse.json({ 
        ok: true, 
        checkoutId: existingSession.id, 
        reference_code: existingSession.reference_code || null,
        reused: true,
      });
    }

    // Crear nueva sesión offline con referencia
    console.log('[OFFLINE PAYMENT CREATE] Creando nueva sesión...');
    const reference_code = genRef();
    const payload: any = {
      buyer_id: userData.user.id,
      order_ids: orderIds,
      payment_method: method,
      status: 'pending',
      amount,
      reference_code,
      offline_instructions: instructions,
    };

    let ins: any = await admin.from('checkout_sessions').insert([payload]).select('id,reference_code').single();
    if (ins.error) {
      const code = String((ins.error as any)?.code || '');
      const msg = String((ins.error as any)?.message || '').toLowerCase();
      console.error('[OFFLINE PAYMENT CREATE] Error creando sesión:', { code, msg, error: ins.error });
      
      if (code === '42703' || msg.includes('column')) {
        return NextResponse.json(
          {
            error:
              'Tu tabla `checkout_sessions` aún no tiene columnas para pagos offline.\n\nEjecuta `supabase_checkout_sessions_offline.sql` en Supabase y reinicia.',
          },
          { status: 400 },
        );
      }
      // Si chocó la referencia por unique, reintentar una vez
      if (msg.includes('duplicate') || msg.includes('unique')) {
        console.log('[OFFLINE PAYMENT CREATE] Referencia duplicada, generando nueva...');
        payload.reference_code = genRef();
        ins = await admin.from('checkout_sessions').insert([payload]).select('id,reference_code').single();
      }
    }
    
    if (ins.error) {
      console.error('[OFFLINE PAYMENT CREATE] Error persistente al crear sesión:', ins.error);
      return NextResponse.json({ error: `Error al crear sesión: ${ins.error.message}` }, { status: 400 });
    }

    const checkoutId = String((ins.data as any)?.id || '').trim();
    const referenceCode = String((ins.data as any)?.reference_code || '').trim();
    
    console.log('[OFFLINE PAYMENT CREATE] ✅ Sesión creada exitosamente:', { 
      checkoutId, 
      reference_code: referenceCode,
      orderIds,
      amount,
      payment_method: method,
    });

    // CRÍTICO: Verificar que la sesión realmente se guardó
    const verifyRes: any = await admin
      .from('checkout_sessions')
      .select('id,status,payment_method,order_ids,amount,reference_code')
      .eq('id', checkoutId)
      .maybeSingle();
    
    if (verifyRes.error || !verifyRes.data) {
      console.error('[OFFLINE PAYMENT CREATE] ⚠️ ERROR: La sesión no se encontró después de crearla:', {
        error: verifyRes.error,
        checkoutId,
      });
      return NextResponse.json({ 
        error: 'La sesión se creó pero no se pudo verificar. Contacta soporte.',
        checkoutId,
      }, { status: 500 });
    }
    
    console.log('[OFFLINE PAYMENT CREATE] ✅ Verificación exitosa:', {
      checkoutId: verifyRes.data.id,
      status: verifyRes.data.status,
      payment_method: verifyRes.data.payment_method,
      order_ids_count: Array.isArray(verifyRes.data.order_ids) ? verifyRes.data.order_ids.length : 0,
    });

    // CRÍTICO: Registrar evento para panel de admin
    try {
      const { recordAdminEvent } = await import('@/lib/admin/events');
      const { notifyAllAdmins, AdminEventTypes } = await import('@/lib/notifications/admin');
      
      await recordAdminEvent(admin, {
        event_type: 'payment_offline_created',
        entity_type: 'payment',
        entity_id: checkoutId,
        user_id: userData.user.id,
        status: 'pending',
        metadata: {
          payment_method: method,
          amount,
          reference_code: referenceCode,
          order_ids: orderIds,
        },
      });
      
      // Notificar a admins sobre pago offline pendiente
      await notifyAllAdmins({
        type: AdminEventTypes.PAYMENT_OFFLINE_PENDING,
        title: '⏳ Pago Offline Pendiente',
        body: `Pago offline de ${amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} pendiente de revisión`,
        linkTo: `/admin/pagos?checkout=${checkoutId}`,
        data: {
          checkoutId,
          amount,
          buyerId: userData.user.id,
          payment_method: method,
          reference_code: referenceCode,
        },
      });
    } catch (eventErr) {
      console.error('[OFFLINE PAYMENT CREATE] Error registrando evento admin:', eventErr);
    }

    return NextResponse.json({ 
      ok: true, 
      checkoutId, 
      reference_code: referenceCode,
      reused: false,
    });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error creating offline payment' }, { status: 500 });
  }
}

