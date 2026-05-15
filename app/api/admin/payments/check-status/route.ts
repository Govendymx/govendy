import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/admin/activity-logger';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const admin = supabaseAdmin();
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);

  if (userErr || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, user };
}

// ============================
// Funciones HTTP directas a la API de MercadoPago (sin SDK)
// El SDK de MP tiene problemas con ciertos tokens para buscar pagos.
// ============================

async function mpGetPayment(accessToken: string, paymentId: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      console.warn(`[CHECK-STATUS] HTTP GET payment ${paymentId}: status=${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.error(`[CHECK-STATUS] HTTP GET payment ${paymentId} error:`, e?.message);
    return null;
  }
}

async function mpSearchPayments(accessToken: string, params: Record<string, string>): Promise<any[]> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${qs}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      console.warn(`[CHECK-STATUS] HTTP search payments: status=${res.status}, params=${JSON.stringify(params)}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (e: any) {
    console.error(`[CHECK-STATUS] HTTP search error:`, e?.message);
    return [];
  }
}

async function mpGetPreference(accessToken: string, preferenceId: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/checkout/preferences/${preferenceId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, user } = guard;

    const body = await req.json();
    const { paymentId, checkoutId, type = 'order' } = body;

    if (!paymentId && !checkoutId) {
      return NextResponse.json({ error: 'Se requiere paymentId o checkoutId' }, { status: 400 });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'Servidor no configurado con MP Access Token' }, { status: 500 });
    }

    let mpPayment: any = null;

    console.log(`[CHECK-STATUS] Inicio: paymentId=${paymentId}, checkoutId=${checkoutId}, type=${type}`);

    // 1. Buscar por ID explícito de MP si se proporcionó (HTTP directo)
    if (paymentId) {
      mpPayment = await mpGetPayment(accessToken, String(paymentId));
      if (mpPayment) {
        console.log(`[CHECK-STATUS] Paso 1 OK: Pago ${mpPayment.id}, status=${mpPayment.status}`);
      } else {
        console.warn(`[CHECK-STATUS] Paso 1 FAIL: No se encontró pago con ID=${paymentId}`);
      }
    }

    // 2. Buscar en BD el mp_payment_id y mp_preference_id del checkout_session
    let resolvedCheckoutSessionId: string | null = null;
    let preferenceId: string | null = null;

    if (!mpPayment && checkoutId) {
      let dbPaymentId: string | null = null;

      if (type === 'order') {
        const { data: session, error: sessErr } = await admin
          .from('checkout_sessions')
          .select('id, mp_payment_id, mp_preference_id, status, payment_method')
          .eq('id', checkoutId)
          .maybeSingle();

        if (sessErr) {
          console.error(`[CHECK-STATUS] Paso 2a ERROR BD:`, sessErr.message);
        }

        if (session) {
          resolvedCheckoutSessionId = session.id;
          dbPaymentId = session.mp_payment_id || null;
          preferenceId = session.mp_preference_id || null;
          console.log(`[CHECK-STATUS] Paso 2a: Session encontrada: id=${session.id}, mp_payment_id=${dbPaymentId}, mp_preference_id=${preferenceId}`);
        } else {
          console.log(`[CHECK-STATUS] Paso 2a: No session con id=${checkoutId}, buscando por order_ids...`);
          const { data: sessions } = await admin
            .from('checkout_sessions')
            .select('id, mp_payment_id, mp_preference_id')
            .contains('order_ids', [checkoutId])
            .order('created_at', { ascending: false })
            .limit(1);

          if (sessions && sessions.length > 0) {
            resolvedCheckoutSessionId = sessions[0].id;
            dbPaymentId = sessions[0].mp_payment_id || null;
            preferenceId = sessions[0].mp_preference_id || null;
            console.log(`[CHECK-STATUS] Paso 2b: Order ${checkoutId} → session ${resolvedCheckoutSessionId}`);
          }
        }
      } else if (type === 'topup') {
        const { data: topup } = await admin.from('wallet_topups').select('mercadopago_preference_id').eq('id', checkoutId).maybeSingle();
        preferenceId = topup?.mercadopago_preference_id || null;
      }

      // Buscar pago por mp_payment_id de la BD (HTTP directo)
      if (dbPaymentId) {
        mpPayment = await mpGetPayment(accessToken, dbPaymentId);
        if (mpPayment) {
          console.log(`[CHECK-STATUS] Paso 2 OK: Pago por mp_payment_id=${dbPaymentId}, status=${mpPayment.status}`);
        }
      }
    }

    // 3. Buscar en MercadoPago por external_reference (HTTP directo)
    if (!mpPayment && checkoutId) {
      const refToSearch = resolvedCheckoutSessionId || checkoutId;
      const refsToTry: string[] = [];
      if (type === 'topup') {
        refsToTry.push(`wallet_topup_${checkoutId}`);
      } else {
        refsToTry.push(refToSearch);
        if (refToSearch !== checkoutId) refsToTry.push(checkoutId);
      }

      console.log(`[CHECK-STATUS] Paso 3: Buscando por external_reference: ${JSON.stringify(refsToTry)}`);

      for (const ref of refsToTry) {
        if (mpPayment) break;
        const results = await mpSearchPayments(accessToken, {
          external_reference: ref,
          limit: '5',
          sort: 'date_created',
          criteria: 'desc'
        });
        console.log(`[CHECK-STATUS] Paso 3: ref=${ref} → ${results.length} resultados`);
        if (results.length > 0) {
          mpPayment = results.find((r: any) => r.status === 'approved') || results[0];
          console.log(`[CHECK-STATUS] Paso 3 OK: Pago ${mpPayment.id}, status=${mpPayment.status}`);
        }
      }
    }

    // 4. Buscar usando la preferencia (HTTP directo)
    if (!mpPayment && preferenceId) {
      console.log(`[CHECK-STATUS] Paso 4: Buscando por preference_id=${preferenceId}`);
      const prefData = await mpGetPreference(accessToken, preferenceId);
      if (prefData?.external_reference) {
        const results = await mpSearchPayments(accessToken, {
          external_reference: prefData.external_reference,
          limit: '10',
          sort: 'date_created',
          criteria: 'desc'
        });
        console.log(`[CHECK-STATUS] Paso 4: ext_ref=${prefData.external_reference} → ${results.length} resultados`);
        if (results.length > 0) {
          mpPayment = results.find((r: any) => r.status === 'approved') || results[0];
          console.log(`[CHECK-STATUS] Paso 4 OK: Pago ${mpPayment.id}, status=${mpPayment.status}`);
        }
      }
    }

    // 5. ÚLTIMO RECURSO: Buscar los pagos más recientes y ver si alguno coincide por monto
    if (!mpPayment && checkoutId) {
      console.log(`[CHECK-STATUS] Paso 5: Buscando pagos recientes en toda la cuenta...`);
      const results = await mpSearchPayments(accessToken, {
        sort: 'date_created',
        criteria: 'desc',
        limit: '20'
      });
      console.log(`[CHECK-STATUS] Paso 5: ${results.length} pagos recientes encontrados`);

      // Si la session tiene un monto, intentar match por monto y fecha cercana
      if (results.length > 0 && resolvedCheckoutSessionId) {
        const { data: sess } = await admin
          .from('checkout_sessions')
          .select('amount, created_at')
          .eq('id', resolvedCheckoutSessionId)
          .maybeSingle();

        if (sess?.amount) {
          const sessionAmount = Number(sess.amount);
          // Buscar pago con monto cercano (dentro de ±$1 por comisiones)
          const match = results.find((r: any) => {
            const diff = Math.abs(Number(r.transaction_amount) - sessionAmount);
            return diff < 1 && r.status === 'approved';
          });
          if (match) {
            console.log(`[CHECK-STATUS] Paso 5 OK: Match por monto! Pago ${match.id}, $${match.transaction_amount}, status=${match.status}`);
            mpPayment = match;
          }
        }
      }
    }

    if (!mpPayment) {
      console.log(`[CHECK-STATUS] RESULTADO: Pago NO encontrado. checkoutId=${checkoutId}, session=${resolvedCheckoutSessionId}, preference=${preferenceId}`);
      return NextResponse.json({
        ok: false,
        message: `Pago no encontrado en MercadoPago. Session: ${resolvedCheckoutSessionId || checkoutId}, Preference: ${preferenceId || 'N/A'}`,
        status: 'not_found',
        debug: { checkoutId, resolvedCheckoutSessionId, preferenceId }
      }, { status: 404 });
    }

    const mpStatus = mpPayment.status;
    const mpStatusDetail = mpPayment.status_detail;
    const externalReference = mpPayment.external_reference;

    // Actualizar BD — usar el checkout session ID resuelto
    const targetId = resolvedCheckoutSessionId || externalReference || checkoutId;

    if (targetId) {
      // 1. Actualizar Checkout Session
      const nextSessionStatus =
        mpStatus === 'approved' ? 'paid' :
          mpStatus === 'rejected' || mpStatus === 'cancelled' ? 'failed' :
            'pending';

      await admin
        .from('checkout_sessions')
        .update({
          mp_payment_id: String(mpPayment.id),
          mp_status: mpStatus,
          status: nextSessionStatus
        })
        .eq('id', targetId);

      // 2. Si está aprobado, actualizar órdenes
      if (mpStatus === 'approved') {
        const { data: session } = await admin
          .from('checkout_sessions')
          .select('order_ids, buyer_id')
          .eq('id', targetId)
          .single();

        if (session && session.order_ids && session.order_ids.length > 0) {
          const now = new Date().toISOString();
          const { data: orders } = await admin.from('orders').select('status').in('id', session.order_ids);
          const allPaid = orders?.every(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered' || o.status === 'completed');

          if (!allPaid) {
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
                throw new Error(`Stock insuficiente para ${base}${sizeTxt}.`);
              }
            };

            const { data: ordRows } = await admin.from('orders').select('id,status').in('id', session.order_ids);
            const safeToDecrement = ((ordRows as any[]) ?? [])
              .filter((o) => {
                const st = String(o?.status ?? '').toLowerCase();
                return st === 'pending' || st === 'pending_payment';
              })
              .map((o) => String(o?.id ?? '').trim())
              .filter(Boolean);

            try {
              if (safeToDecrement.length > 0) {
                await decrementStockForOrders(safeToDecrement);
              }
            } catch (stockErr: any) {
              await admin
                .from('checkout_sessions')
                .update({
                  status: 'fulfillment_failed',
                  mp_status: `Stock Error: ${typeof stockErr?.message === 'string' ? stockErr.message : 'Stock insuficiente'}`,
                } as any)
                .eq('id', targetId);
              return NextResponse.json({ error: typeof stockErr?.message === 'string' ? stockErr.message : 'Stock insuficiente.' }, { status: 409 });
            }

            await admin
              .from('orders')
              .update({
                status: 'paid',
                paid_at: now,
                payment_method: 'mercadopago'
              })
              .in('id', session.order_ids);

            // Vaciar carrito
            if (session.buyer_id) {
              const { data: items } = await admin.from('order_items').select('listing_id').in('order_id', session.order_ids);
              const listingIds = items?.map(i => i.listing_id).filter(Boolean) || [];
              if (listingIds.length > 0) {
                await admin.from('cart_items').delete().eq('user_id', session.buyer_id).in('listing_id', listingIds);
              }
            }

            await logActivity({
              event_type: 'payment_synced_manual',
              entity_type: 'checkout_session',
              entity_id: targetId,
              user_id: user.id,
              severity: 'info',
              details: {
                mp_id: mpPayment.id,
                mp_status: mpStatus,
                message: 'Sincronización manual de pago MP exitosa (aprobado)'
              }
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      status: mpStatus,
      status_detail: mpStatusDetail,
      id: mpPayment.id,
      date_created: mpPayment.date_created,
      payment_method_id: mpPayment.payment_method_id,
      transaction_amount: mpPayment.transaction_amount
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
