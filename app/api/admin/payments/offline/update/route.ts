import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin as requireAdminNew } from '@/lib/auth/middleware';
import { handleError } from '@/lib/utils/errors';
import { logActivity } from '@/lib/admin/activity-logger';
import { notifyPaymentApprovedBuyer, notifyPaymentApprovedSellers } from '@/lib/email/notify';

export const dynamic = 'force-dynamic';

// Mantener función antigua para compatibilidad con sesiones virtuales
function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  try {
    const { userId, admin } = await requireAdminNew(req);
    return { ok: true as const, admin, requesterId: userId };
  } catch (error) {
    const { message, statusCode } = handleError(error);
    return { ok: false as const, status: statusCode, error: message };
  }
}

type Body = {
  checkoutId: string;
  action: 'mark_paid' | 'mark_unpaid' | 'cancel' | 'sync_orders';
  adminName?: string | null;
  force?: boolean; // Opción para forzar aprobación sin verificaciones estrictas
};

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    let checkoutId = String(body?.checkoutId || '').trim();
    const action = String(body?.action || '').trim() as Body['action'];
    const adminName = String(body?.adminName || '').trim() || null;
    const force = Boolean(body?.force);

    if (!checkoutId) return NextResponse.json({ error: 'checkoutId is required' }, { status: 400 });
    if (!['mark_paid', 'mark_unpaid', 'cancel', 'sync_orders'].includes(action)) return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    if (action === 'mark_paid' && !adminName) return NextResponse.json({ error: 'adminName es requerido para marcar como pagado' }, { status: 400 });

    if (force) {
      console.log('[admin/offline-update] ⚠️ MODO FORZADO ACTIVADO');
    }

    // Verificar si es una sesión virtual (empieza con "virtual-")
    const isVirtualSession = checkoutId.startsWith('virtual-');
    let sessionRow: any = null;
    let orderIdsFromVirtual: string[] = [];

    if (isVirtualSession) {
      if (action === 'sync_orders') {
        return NextResponse.json({ error: 'No se puede sincronizar una sesión virtual. Primero debe acreditarse.' }, { status: 400 });
      }

      // Es una sesión virtual, extraer orderId y crear sesión real
      const orderId = checkoutId.replace('virtual-', '');
      console.log('[admin/offline-update] Sesión virtual detectada, creando sesión real para orden:', orderId);

      // Obtener datos de la orden
      const { data: orderData, error: orderErr } = await admin
        .from('orders')
        .select('id,buyer_id,payment_method,status,total,commission_fee,shipping_fee,created_at')
        .eq('id', orderId)
        .maybeSingle();

      if (orderErr || !orderData) {
        console.error('[admin/offline-update] Error obteniendo orden para sesión virtual:', orderErr);
        return NextResponse.json({ error: 'Orden no encontrada para sesión virtual.' }, { status: 404 });
      }

      const paymentMethod = String((orderData as any)?.payment_method || '').trim();

      // Obtener instrucciones de pago
      const { data: settingsRow } = await admin.from('app_settings').select('payment_methods').eq('id', 1).maybeSingle();
      const pm = (settingsRow as any)?.payment_methods ?? {};
      const instructions =
        paymentMethod === 'bank_transfer'
          ? pm?.bank_transfer ?? {}
          : paymentMethod === 'bank_deposit'
            ? pm?.bank_deposit ?? {}
            : pm?.oxxo ?? {};

      // Generar referencia
      const d = new Date();
      const yy = String(d.getUTCFullYear()).slice(-2);
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
      const reference_code = `PCK-${yy}${mm}${dd}-${rand}`;

      const amount = typeof (orderData as any)?.total === 'number'
        ? (orderData as any).total
        : Number((orderData as any)?.total ?? 0) || 0;

      // Crear sesión real
      const newSessionPayload: any = {
        buyer_id: (orderData as any).buyer_id,
        order_ids: [orderId],
        payment_method: paymentMethod,
        status: 'pending',
        amount,
        reference_code,
        offline_instructions: instructions,
      };

      const { data: newSession, error: createErr } = await admin
        .from('checkout_sessions')
        .insert([newSessionPayload])
        .select('id,buyer_id,order_ids,status,payment_method,reference_code')
        .single();

      if (createErr || !newSession) {
        console.error('[admin/offline-update] Error creando sesión real desde virtual:', createErr);
        return NextResponse.json({ error: `No se pudo crear sesión real: ${createErr?.message || 'Error desconocido'}` }, { status: 400 });
      }

      console.log('[admin/offline-update] ✅ Sesión real creada desde virtual:', { id: newSession.id, orderId });
      sessionRow = newSession;
      orderIdsFromVirtual = [orderId];
      checkoutId = newSession.id; // Actualizar checkoutId al real
    } else {
      // Sesión real, obtener normalmente
      const { data: session, error: sErr } = await admin
        .from('checkout_sessions')
        .select('id,buyer_id,order_ids,status,payment_method,reference_code')
        .eq('id', checkoutId)
        .maybeSingle();

      if (sErr) {
        console.error('[admin/offline-update] Error obteniendo sesión:', sErr);
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }
      if (!session) {
        console.error('[admin/offline-update] Sesión no encontrada:', checkoutId);
        return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });
      }
      sessionRow = session;
    }

    // Preparar order_ids
    let orderIds: string[] = [];
    const orderIdsRaw = (sessionRow as any)?.order_ids;

    if (isVirtualSession) {
      orderIds = orderIdsFromVirtual;
    } else if (Array.isArray(orderIdsRaw)) {
      orderIds = orderIdsRaw;
    } else if (typeof orderIdsRaw === 'string') {
      try {
        if (orderIdsRaw.startsWith('[')) {
          orderIds = JSON.parse(orderIdsRaw);
        } else {
          orderIds = orderIdsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        console.error('[admin/offline-update] Error parseando orderIdsRaw string:', e);
      }
    }

    console.log('[admin/offline-update] Datos de sesión:', {
      id: checkoutId,
      action,
      orderIdsCount: orderIds.length,
      orderIds
    });

    const decrementStockForOrders = async (orderIdsToProcess: string[]) => {
      const { data: orderItems, error: itemsError } = await admin
        .from('order_items')
        .select('listing_id, quantity, selected_size, title')
        .in('order_id', orderIdsToProcess);
      if (itemsError) throw itemsError;

      const failed: Array<{ listing_id: string; title?: string | null; quantity: number; selected_size?: string | null; message: string }> = [];

      for (const item of (orderItems as any[]) ?? []) {
        const listingId = String(item?.listing_id ?? '').trim();
        const quantity = Number(item?.quantity ?? 0);
        const selectedSize = typeof item?.selected_size === 'string' ? String(item.selected_size).trim() : null;
        const title = typeof item?.title === 'string' ? String(item.title).trim() : null;

        if (!listingId || !Number.isFinite(quantity) || quantity <= 0) continue;

        let rpc: any = await admin.rpc('decrement_stock', {
          p_listing_id: listingId,
          p_quantity: quantity,
          p_size: selectedSize || null,
        });

        if (rpc?.error) {
          const code = String((rpc.error as any)?.code ?? '');
          const msg = String((rpc.error as any)?.message ?? '').toLowerCase();
          const maybeSignatureMismatch =
            code === '42883' || msg.includes('p_size') || msg.includes('decrement_stock(') || msg.includes('function');
          if (maybeSignatureMismatch) {
            rpc = await admin.rpc('decrement_stock', {
              p_listing_id: listingId,
              p_quantity: quantity,
            });
          }
        }

        if (rpc?.error) {
          failed.push({
            listing_id: listingId,
            title,
            quantity,
            selected_size: selectedSize,
            message: String((rpc.error as any)?.message ?? 'Error actualizando stock'),
          });
          continue;
        }

        const result = rpc?.data as any;
        if (!result?.success) {
          failed.push({
            listing_id: listingId,
            title,
            quantity,
            selected_size: selectedSize,
            message: String(result?.message ?? 'Stock insuficiente'),
          });
        }
      }

      if (failed.length > 0) {
        const first = failed[0];
        const base = first?.title ? `"${first.title}"` : 'un artículo';
        const sizeTxt = first?.selected_size ? ` (Talla: ${first.selected_size})` : '';
        throw new Error(`Stock insuficiente para ${base}${sizeTxt}. No se acreditó el pago en el sistema.`);
      }
    };

    let nextStatus = '';
    if (action === 'mark_paid') nextStatus = 'paid';
    else if (action === 'mark_unpaid') nextStatus = 'pending';
    else if (action === 'cancel') nextStatus = 'cancelled';

    let upd: any = { data: null, error: null };

    if (orderIds.length > 0 && (action === 'mark_paid' || action === 'sync_orders')) {
      try {
        const { data: ordRows } = await admin.from('orders').select('id,status').in('id', orderIds);
        const safeToDecrement = ((ordRows as any[]) ?? [])
          .filter((o) => {
            const st = String(o?.status ?? '').toLowerCase();
            return st === 'pending' || st === 'pending_payment';
          })
          .map((o) => String(o?.id ?? '').trim())
          .filter(Boolean);
        if (safeToDecrement.length > 0) {
          await decrementStockForOrders(safeToDecrement);
        }
      } catch (e: any) {
        const msg = typeof e?.message === 'string' && e.message.trim().length > 0 ? e.message : 'Stock insuficiente.';
        if (!isVirtualSession) {
          await admin
            .from('checkout_sessions')
            .update({
              status: 'fulfillment_failed',
              mp_status: `Stock Error: ${msg}`,
            } as any)
            .eq('id', checkoutId);
        }
        return NextResponse.json({ error: msg }, { status: 409 });
      }
    }

    // Si es sync_orders, no actualizamos checkout_sessions, solo ordenes
    if (action !== 'sync_orders') {
      const updatePayload: any = {
        status: nextStatus,
        paid_confirmed_at: action === 'mark_paid' ? new Date().toISOString() : null,
        paid_confirmed_by: action === 'mark_paid' ? requesterId : null,
        paid_confirmed_by_name: action === 'mark_paid' ? adminName : null,
      };

      // Verificar keys de supabase
      const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!adminKey || adminKey === anonKey) {
        console.error('[admin/offline-update] ⚠️ ERROR CRÍTICO: Configuración de keys inválida');
      }

      upd = await admin
        .from('checkout_sessions')
        .update(updatePayload)
        .eq('id', checkoutId)
        .select('id,status,paid_confirmed_at,paid_confirmed_by,updated_at');

      // Fallback para columna faltante
      if (upd.error) {
        const msg = String((upd.error as any)?.message || '').toLowerCase();
        if (msg.includes('column') || msg.includes('does not exist')) {
          console.warn('[admin/offline-update] Fallback: quitando paid_confirmed_by_name');
          delete updatePayload.paid_confirmed_by_name;
          upd = await admin.from('checkout_sessions').update(updatePayload).eq('id', checkoutId).select();
        }
      }

      if (upd.error) {
        console.error('[admin/offline-update] Error actualizando checkout_sessions:', upd.error);
        return NextResponse.json({ error: upd.error.message }, { status: 400 });
      }
    } else {
      // Para sync_orders, asumimos que queremos forzar a 'paid' si la sesión está paid
      if (sessionRow.status === 'paid') {
        nextStatus = 'paid';
      } else {
        return NextResponse.json({ error: 'Solo se pueden sincronizar sesiones pagadas.' }, { status: 400 });
      }
    }

    // --- ACTUALIZACIÓN DE ÓRDENES ---
    let updatedOrders = 0;
    let orderUpdateError = null;

    if (orderIds.length > 0 && (action === 'mark_paid' || action === 'sync_orders')) {
      console.log('[admin/offline-update] Sincronizando órdenes a PAID:', orderIds);

      const now = new Date().toISOString();
      const orderPayload: any = {
        status: 'paid',
        paid_at: now
      };

      // Intento 1: Con paid_at
      let oUpd = await admin.from('orders').update(orderPayload).in('id', orderIds).select('id,status');

      // Fallback: Sin paid_at si falla
      if (oUpd.error) {
        console.warn('[admin/offline-update] Error actualizando órdenes (con paid_at):', oUpd.error.message);
        delete orderPayload.paid_at;
        oUpd = await admin.from('orders').update(orderPayload).in('id', orderIds).select('id,status');
      }

      if (oUpd.error) {
        console.error('[admin/offline-update] ❌ Error FINAL actualizando órdenes:', oUpd.error);
        orderUpdateError = oUpd.error.message;
      } else {
        updatedOrders = Array.isArray(oUpd.data) ? oUpd.data.length : 0;
        console.log(`[admin/offline-update] ✅ ${updatedOrders} órdenes actualizadas correctamente.`);

        // Enviar notificaciones por email a comprador y vendedores (BACKGROUND)
        if (updatedOrders > 0) {
          console.log('[admin/offline-update] Iniciando notificaciones en background (Fire & Forget)...');

          // CRÍTICO: No usamos 'await' aquí para evitar bloquear la respuesta al admin.
          // El usuario reportó delays de ~1 minuto esperando el SMTP.
          // Ejecutamos en background con manejo de errores individual.
          const emailPromises = [];

          // Notificar a comprador
          if (sessionRow?.buyer_id) {
            emailPromises.push(
              notifyPaymentApprovedBuyer({
                buyerId: sessionRow.buyer_id,
                orderIds: orderIds,
                total: sessionRow.amount || 0
              }).catch(e => console.error('[admin/offline-update] Error background comprador:', e))
            );
          }

          // Notificar a vendedores
          emailPromises.push(
            notifyPaymentApprovedSellers({
              admin: admin,
              orderIds: orderIds
            }).catch(e => console.error('[admin/offline-update] Error background vendedores:', e))
          );

          // Log cuando terminen (si el runtime lo permite)
          Promise.allSettled(emailPromises).then(() => {
            console.log('[admin/offline-update] Notificaciones background finalizadas.');
          });

          // ── AUTO-GENERATE T1 LABELS (AWAITED) ──
          // Must be awaited — Vercel kills background IIFEs after response
          try {
            const { data: t1Orders } = await admin
              .from('orders')
              .select('id,seller_id,buyer_id,shipping_method,shipping_carrier,t1_quote_token,shipping_full_name,shipping_phone,shipping_address')
              .in('id', orderIds)
              .eq('shipping_method', 'gopocket_premium');

            const t1Rows = (t1Orders as any[]) ?? [];
            if (t1Rows.length > 0) {
              console.log(`[admin/offline-update] 🚀 ${t1Rows.length} T1 Premium orders detected, generating labels...`);

              const { generateT1Label } = await import('@/lib/shipping/t1-api');

              for (const order of t1Rows) {
                const token = order.t1_quote_token;
                if (!token) {
                  console.warn(`[admin/offline-update] T1 order ${order.id} has no quote token, skipping label generation`);
                  continue;
                }

                try {
                  // Get seller profile for origin address
                  const { data: sellerProfile } = await admin
                    .from('profiles')
                    .select('full_name,first_name,last_name,email,phone,address_street,ext_number,int_number,neighborhood,cross_streets,city,state,zip_code')
                    .eq('id', order.seller_id)
                    .maybeSingle();
                  const sp = sellerProfile as any;

                  // Get buyer profile for destination address
                  const { data: buyerProfile } = await admin
                    .from('profiles')
                    .select('full_name,first_name,last_name,email,phone,address_street,ext_number,int_number,neighborhood,cross_streets,city,state,zip_code')
                    .eq('id', order.buyer_id)
                    .maybeSingle();
                  const bp = buyerProfile as any;

                  const sellerName = sp?.full_name || [sp?.first_name, sp?.last_name].filter(Boolean).join(' ') || 'Vendedor';
                  const buyerName = order.shipping_full_name || bp?.full_name || [bp?.first_name, bp?.last_name].filter(Boolean).join(' ') || 'Comprador';

                  // Build seller origin street from profile fields
                  const originStreet = sp?.address_street
                    ? `${sp.address_street} #${sp.ext_number || 'SN'} Int ${sp.int_number || 'SN'}`
                    : 'Sin dirección';

                  // Use shipping_address JSON for buyer address when available
                  const shippingAddr = typeof order.shipping_address === 'object' && order.shipping_address ? order.shipping_address : {};
                  const destStreet = shippingAddr.address_street
                    ? `${shippingAddr.address_street} #${shippingAddr.ext_number || 'SN'} Int ${shippingAddr.int_number || 'SN'}`
                    : (bp?.address_street ? `${bp.address_street} #${bp.ext_number || 'SN'} Int ${bp.int_number || 'SN'}` : 'Sin dirección');

                  const labelResult = await generateT1Label({
                    quote_token: token,
                    origin_name: sellerName,
                    origin_email: sp?.email || 'vendedor@gopocket.com',
                    origin_phone: sp?.phone || '0000000000',
                    origin_street: originStreet,
                    origin_colonia: sp?.neighborhood || sp?.city || '',
                    origin_city: sp?.city || '',
                    origin_state: sp?.state || '',
                    origin_zip: sp?.zip_code || '',
                    origin_references: sp?.cross_streets || '',
                    dest_name: buyerName,
                    dest_email: bp?.email || 'comprador@gopocket.com',
                    dest_phone: order.shipping_phone || bp?.phone || '0000000000',
                    dest_street: destStreet,
                    dest_colonia: shippingAddr.neighborhood || bp?.neighborhood || bp?.city || '',
                    dest_city: shippingAddr.city || bp?.city || '',
                    dest_state: shippingAddr.state || bp?.state || '',
                    dest_zip: shippingAddr.zip_code || bp?.zip_code || '',
                    dest_references: shippingAddr.references || shippingAddr.cross_streets || bp?.cross_streets || '',
                    content_description: 'Paquete GoVendy',
                  });

                  console.log(`[admin/offline-update] ✅ T1 Label generated for order ${order.id}:`, {
                    tracking: labelResult.tracking_number,
                    labelUrl: labelResult.label_url,
                    carrier: labelResult.carrier,
                  });

                  await admin.from('orders').update({
                    tracking_number: labelResult.tracking_number,
                    shipping_label_url: labelResult.label_url,
                  }).eq('id', order.id);

                  console.log(`[admin/offline-update] ✅ Label saved to order ${order.id}`);

                } catch (labelErr: any) {
                  console.error(`[admin/offline-update] ❌ Error generating T1 label for order ${order.id}:`, labelErr?.message || labelErr);
                }
              }
            }
          } catch (t1Err: any) {
            console.error('[admin/offline-update] Error in T1 label generation flow:', t1Err?.message || t1Err);
          }
        }
      }
    } else if (orderIds.length > 0 && action === 'mark_unpaid') {
      // Revertir a pending_payment
      await admin.from('orders').update({ status: 'pending_payment', paid_at: null }).in('id', orderIds);
    } else if (orderIds.length > 0 && action === 'cancel') {
      // Cancelar órdenes
      await admin.from('orders').update({ status: 'cancelled' }).in('id', orderIds);
    } else {
      console.warn('[admin/offline-update] No hay order_ids para actualizar.');
    }

    // Registrar actividad
    if (action !== 'sync_orders') {
      await logActivity({
        event_type: `payment_${action}`,
        entity_type: 'checkout_session',
        entity_id: checkoutId,
        admin_id: requesterId || null,
        severity: 'info',
        details: {
          action,
          updated_orders: updatedOrders,
          order_ids: orderIds,
          payment_method: sessionRow.payment_method
        }
      });
    }

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      updatedOrders,
      orderUpdateError,
      message: action === 'sync_orders'
        ? `Sincronización completada. ${updatedOrders} órdenes actualizadas.`
        : 'Actualización exitosa'
    });

  } catch (error: any) {
    console.error('[admin/offline-update] Error no controlado:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
