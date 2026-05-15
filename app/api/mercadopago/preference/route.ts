import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateMercadoPagoFee } from '@/lib/fees';

type Body = {
  orderIds: string[];
  // Nota: `amount` puede llegar desde el cliente por compatibilidad,
  // pero NO se usa como fuente de verdad (se recalcula desde la BD).
  amount?: number;
};

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const body = (await req.json()) as Body;
    const orderIds = body?.orderIds ?? [];
    let amount = body?.amount;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing MERCADOPAGO_ACCESS_TOKEN env var' },
        { status: 500 },
      );
    }

    const admin = supabaseAdmin();

    let step = 'init';

    try {
      // Si el frontend no envió el monto (por seguridad), lo calculamos aquí desde la base de datos
      if (typeof amount !== 'number' || amount <= 0) {
          step = 'calculate_amount';
          const { data: ordersData, error: ordersError } = await admin
            .from('orders')
            .select('total')
            .in('id', orderIds);
            
           if (ordersError) {
              throw new Error(`Error fetching orders for amount calculation: ${ordersError.message}`);
           }
           
           if (ordersData) {
              amount = ordersData.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
           }
      }

      step = 'health_check';
      // Verificación rápida de permisos de admin (Service Role)
      const { error: healthCheckError } = await admin.from('checkout_sessions').select('id').limit(1);
      if (healthCheckError) {
         throw new Error(`Service Role Health Check Failed: ${healthCheckError.message}`);
      }

      step = 'import_validation';
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gopocket.com.mx';
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';
    const notificationUrl = webhookSecret
      ? `${origin}/api/mercadopago/webhook?token=${encodeURIComponent(webhookSecret)}`
      : `${origin}/api/mercadopago/webhook`;

      // Validación robusta con módulo centralizado
      const { validatePayment } = await import('@/lib/payments/validation');
      
      step = 'exec_validation';
      const validation = await validatePayment(admin, {
        buyerId: userData.user.id,
        orderIds,
        amount: Number(amount) || 0, // El validador recalculará el total real de las órdenes y comparará
        paymentMethod: 'mercadopago',
      });

      if (!validation.valid) {
        console.error('[MP PREFERENCE] Validación fallida:', JSON.stringify(validation, null, 2));
        return NextResponse.json(
          { 
            error: 'Validación de pago fallida', 
            details: validation.errors,
            warnings: validation.warnings 
          }, 
          { status: 400 }
        );
      }
      
      // Si hay warnings, los logueamos pero permitimos continuar (o podríamos detener si es estricto)
      if (validation.warnings.length > 0) {
        console.warn('[MP PREFERENCE] Warnings en validación:', validation.warnings);
      }

      step = 'create_session';
      // Crear checkout_session (server-side)
      const { data: sessionRow, error: sessionErr } = await admin
        .from('checkout_sessions')
        .insert([
          {
            buyer_id: userData.user.id,
            order_ids: orderIds,
            payment_method: 'mercadopago',
            status: 'pending',
            amount,
          },
        ])
        .select('id')
        .single();

      if (sessionErr) {
        step = 'session_error';
        throw new Error(sessionErr.message);
      }

      const checkoutId = (sessionRow as any).id as string;

      // Calcular comisiones de MercadoPago
      // Nota: 'amount' es el subtotal de los productos + envío (base)
      // 'finalAmount' es lo que paga el usuario (base + comisiones)
      const { fee, total: finalAmount } = calculateMercadoPagoFee(Number(amount) || 0);

      step = 'create_mp_preference';
      try {
          // Reemplazamos SDK con fetch directo para evitar conflictos de dependencias y errores raros de Supabase
          const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              items: [
                {
                  id: checkoutId,
                  title: fee > 0 ? 'GoVendy - Compra (+ Comisión)' : 'GoVendy - Compra',
                  quantity: 1,
                  currency_id: 'MXN',
                  unit_price: finalAmount,
                },
              ],
              statement_descriptor: 'GOPOCKET',
              external_reference: checkoutId,
              notification_url: notificationUrl,
              back_urls: {
                success: `${origin}/compra-exitosa?checkoutId=${encodeURIComponent(checkoutId)}`,
                pending: `${origin}/compra-pendiente?checkoutId=${encodeURIComponent(checkoutId)}`,
                failure: `${origin}/compra-error?checkoutId=${encodeURIComponent(checkoutId)}`,
              },
              auto_return: 'approved',
              metadata: { 
                checkoutId, 
                // Convertimos array a string para asegurar compatibilidad con metadata
                orderIds: Array.isArray(orderIds) ? orderIds.join(',') : String(orderIds) 
              },
            })
          });

          if (!mpResponse.ok) {
             const errorBody = await mpResponse.text();
             throw new Error(`MercadoPago API Error (${mpResponse.status}): ${errorBody}`);
          }

          const result = await mpResponse.json();

          const prefId = (result as any)?.id as string | undefined;
          const initPoint = (result as any)?.init_point as string | undefined;
          const sandboxInitPoint = (result as any)?.sandbox_init_point as string | undefined;

          step = 'update_session';
          if (prefId) {
            const { error: updateErr } = await admin.from('checkout_sessions').update({ mp_preference_id: prefId }).eq('id', checkoutId);
            if (updateErr) {
                 throw new Error(`DB Update Failed: ${updateErr.message}`);
            }
          }

          return NextResponse.json({ checkoutId, preferenceId: prefId, init_point: initPoint, sandbox_init_point: sandboxInitPoint });
      } catch (mpErr: any) {
          if (step === 'create_mp_preference') {
               console.error('[MP DIRECT FETCH ERROR]', mpErr);
               throw new Error(`MercadoPago Connection Error: ${mpErr.message || JSON.stringify(mpErr)}`);
          }
          throw mpErr;
      }
    } catch (e: any) {
      console.error('[MP PREFERENCE ERROR]', JSON.stringify(e, null, 2));
      
      // Intentar extraer mensaje de error de objetos no-Error (común en SDKs)
      let errorMessage = 'Unexpected error creating preference';
      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === 'object' && e !== null) {
        errorMessage = e.message || e.error || JSON.stringify(e);
      } else if (typeof e === 'string') {
        errorMessage = e;
      }

      // Añadir paso al error
      const stepPrefix = `[${step}]`;
      if (!errorMessage.includes(stepPrefix)) {
        errorMessage = `${stepPrefix} ${errorMessage}`;
      }

      console.error(`[MP PREFERENCE] Error en paso ${step}:`, errorMessage);

      // DIAGNÓSTICO DE LLAVE (SOLO PARA DEPURACIÓN)
    let keyDebug = 'N/A';
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (key) {
        const parts = key.split('.');
        if (parts.length === 3) {
           const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
           const pad = base64.length % 4;
           const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
           const payload = JSON.parse(Buffer.from(paddedBase64, 'base64').toString('utf-8'));
           keyDebug = `Role: ${payload.role}, Iss: ${payload.iss}`;
        } else {
           keyDebug = 'Invalid JWT format';
        }
      } else {
        keyDebug = 'Missing Key';
      }
    } catch (err) {
      keyDebug = 'Parse Error';
    }

    // Si el error es de permisos, agregamos la info de depuración
    if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('policy')) {
       errorMessage += ` [DEBUG: ${keyDebug}]`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  } // End of inner catch
  } catch (outerErr: any) { // End of outer try
    console.error('[MP PREFERENCE CRITICAL]', outerErr);
    return NextResponse.json(
      { error: outerErr instanceof Error ? outerErr.message : 'Critical Server Error' },
      { status: 500 }
    );
  }
}

