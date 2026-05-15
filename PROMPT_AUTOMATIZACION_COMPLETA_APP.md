# 🚀 PROMPT: Automatización Completa y Segura de la Aplicación

## 🎯 Objetivo Principal

Transformar la aplicación en un sistema completamente automatizado, seguro y robusto que:
- **Elimine todos los errores en pagos** mediante validaciones exhaustivas y manejo de errores profesional
- **Envíe notificaciones automáticas** tanto por correo electrónico como en el panel de usuario
- **Garantice seguridad total** en todas las operaciones financieras y de datos
- **Proporcione control administrativo completo** para gestionar usuarios (eliminar, bloquear, suspender)
- **Implemente las mejores prácticas** de desarrollo web con arquitectura escalable y mantenible

---

## 👨‍💻 Contexto del Desarrollador

**Actúa como:** Un desarrollador senior con 999,999 años de experiencia en:
- Desarrollo de aplicaciones web modernas (Next.js, React, TypeScript)
- Diseño de sistemas de pago seguros y robustos
- Arquitectura de software escalable y mantenible
- Diseño gráfico y UX/UI profesional
- Seguridad de aplicaciones web
- Automatización de procesos empresariales
- Gestión de bases de datos y sistemas distribuidos

**Filosofía de trabajo:**
- **Código limpio y mantenible**: Cada línea debe ser clara, documentada y fácil de entender
- **Seguridad primero**: Todas las operaciones deben validarse y protegerse
- **Experiencia de usuario excepcional**: Interfaces intuitivas y respuestas inmediatas
- **Automatización inteligente**: Reducir intervención manual al mínimo
- **Manejo robusto de errores**: Nunca fallar silenciosamente, siempre informar y recuperar
- **Escalabilidad**: Diseñar para crecer sin problemas

---

## 📋 Contexto de la Aplicación Actual

### Stack Tecnológico
- **Frontend**: Next.js 14.2.35, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Pagos**: MercadoPago (webhooks), Pagos offline (transferencias, OXXO, depósitos)
- **Notificaciones**: Sistema propio con Supabase Realtime
- **Email**: Resend API + Nodemailer (buzones configurables)
- **Autenticación**: Supabase Auth

### Estructura de Paneles
- **Panel Admin** (`/app/admin/`): 18+ secciones de administración
- **Panel Usuario** (`/app/dashboard/`): 12+ secciones de usuario
- **APIs**: 50+ endpoints para operaciones diversas

### Sistema de Pagos Actual
- **MercadoPago**: Webhook en `/api/mercadopago/webhook/route.ts`
- **Pagos Offline**: Creación y confirmación en `/api/offline-payment/` y `/api/admin/payments/offline/`
- **Estafeta**: Pagos de guías de envío
- **Publicidad**: Pagos de campañas
- **Verificación**: Pagos para verificación de usuarios

---

## 🔒 1. SISTEMA DE VALIDACIÓN Y SEGURIDAD DE PAGOS

### 1.1 Validaciones Pre-Pago

#### Crear Módulo Centralizado de Validación
```typescript
// lib/payments/validation.ts

export type PaymentValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type PaymentContext = {
  orderIds?: string[];
  buyerId: string;
  amount: number;
  paymentMethod: 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo';
  checkoutId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Valida un pago antes de procesarlo
 * Verifica: órdenes, montos, estados, usuarios, límites
 */
export async function validatePayment(
  admin: SupabaseClient,
  context: PaymentContext
): Promise<PaymentValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validar usuario
  if (!context.buyerId || typeof context.buyerId !== 'string') {
    errors.push('ID de comprador inválido');
    return { valid: false, errors, warnings };
  }

  // Verificar que el usuario existe y está activo
  const { data: userState } = await admin
    .from('user_admin_states')
    .select('status, suspended_until')
    .eq('user_id', context.buyerId)
    .maybeSingle();

  if (userState) {
    if (userState.status === 'banned') {
      errors.push('Usuario baneado. No puede realizar pagos.');
    } else if (userState.status === 'suspended') {
      const suspendedUntil = userState.suspended_until 
        ? new Date(userState.suspended_until) 
        : null;
      if (suspendedUntil && suspendedUntil > new Date()) {
        errors.push(`Usuario suspendido hasta ${suspendedUntil.toLocaleDateString()}`);
      }
    }
  }

  // 2. Validar órdenes (si aplica)
  if (context.orderIds && context.orderIds.length > 0) {
    const { data: orders, error: ordersError } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id, status, total, payment_method, paid_at')
      .in('id', context.orderIds);

    if (ordersError) {
      errors.push(`Error al validar órdenes: ${ordersError.message}`);
      return { valid: false, errors, warnings };
    }

    if (!orders || orders.length !== context.orderIds.length) {
      errors.push('Una o más órdenes no existen');
      return { valid: false, errors, warnings };
    }

    // Validar que todas las órdenes pertenecen al comprador
    const invalidOwnership = orders.some(
      (o) => String(o.buyer_id || '') !== context.buyerId
    );
    if (invalidOwnership) {
      errors.push('Una o más órdenes no pertenecen al comprador');
    }

    // Validar estados de órdenes
    const blockedStatuses = new Set(['paid', 'completed', 'shipped', 'delivered', 'cancelled', 'refunded']);
    const invalidStatuses = orders.filter((o) => 
      blockedStatuses.has(String(o.status || '').trim())
    );
    if (invalidStatuses.length > 0) {
      errors.push(
        `${invalidStatuses.length} orden(es) ya están pagadas o no pueden ser pagadas (estados: ${Array.from(new Set(invalidStatuses.map(o => o.status))).join(', ')})`
      );
    }

    // Validar que no hay órdenes ya pagadas
    const alreadyPaid = orders.filter((o) => o.paid_at !== null);
    if (alreadyPaid.length > 0) {
      errors.push(
        `${alreadyPaid.length} orden(es) ya tienen fecha de pago registrada`
      );
    }

    // Validar monto total
    const calculatedTotal = orders.reduce(
      (sum, o) => sum + (Number(o.total || 0) || 0),
      0
    );
    if (Math.abs(calculatedTotal - context.amount) > 0.01) {
      errors.push(
        `Monto no coincide: esperado ${calculatedTotal.toFixed(2)}, recibido ${context.amount.toFixed(2)}`
      );
    }

    // Verificar que no hay disputas abiertas
    const { data: disputes } = await admin
      .from('disputes')
      .select('order_id')
      .in('order_id', context.orderIds)
      .eq('status', 'open');
    
    if (disputes && disputes.length > 0) {
      warnings.push(
        `${disputes.length} orden(es) tienen disputas abiertas. Revisar antes de procesar pago.`
      );
    }
  }

  // 3. Validar monto
  if (!Number.isFinite(context.amount) || context.amount <= 0) {
    errors.push('Monto inválido (debe ser mayor a 0)');
  }

  // Validar límites de pago
  const maxPaymentAmount = 100000; // $100,000 MXN
  if (context.amount > maxPaymentAmount) {
    errors.push(`Monto excede el límite máximo de ${maxPaymentAmount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`);
  }

  // 4. Validar método de pago
  const validMethods = ['mercadopago', 'bank_transfer', 'bank_deposit', 'oxxo'];
  if (!validMethods.includes(context.paymentMethod)) {
    errors.push(`Método de pago inválido: ${context.paymentMethod}`);
  }

  // 5. Validar checkout session (si aplica)
  if (context.checkoutId) {
    const { data: session } = await admin
      .from('checkout_sessions')
      .select('id, status, buyer_id, order_ids')
      .eq('id', context.checkoutId)
      .maybeSingle();

    if (!session) {
      errors.push('Sesión de checkout no encontrada');
    } else {
      if (session.status === 'paid') {
        errors.push('Esta sesión de checkout ya fue pagada');
      }
      if (String(session.buyer_id || '') !== context.buyerId) {
        errors.push('La sesión de checkout no pertenece al comprador');
      }
    }
  }

  // 6. Validar duplicados (prevenir pagos duplicados)
  if (context.checkoutId) {
    const { data: existingPayment } = await admin
      .from('checkout_sessions')
      .select('mp_payment_id, status')
      .eq('id', context.checkoutId)
      .maybeSingle();

    if (existingPayment?.mp_payment_id && existingPayment.status === 'paid') {
      errors.push('Este pago ya fue procesado anteriormente');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### 1.2 Manejo Robusto de Errores en Webhooks

#### Mejorar Webhook de MercadoPago
```typescript
// app/api/mercadopago/webhook/route.ts

import { validatePayment } from '@/lib/payments/validation';
import { logPaymentError, logPaymentSuccess } from '@/lib/payments/logging';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let paymentId: string | null = null;
  let externalReference: string | null = null;

  try {
    // 1. Validar autorización
    if (!isAuthorized(req)) {
      console.error('[WEBHOOK] No autorizado');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parsear body de forma segura
    const body = await req.json().catch((e) => {
      console.error('[WEBHOOK] Error parseando body:', e);
      return {};
    });

    paymentId = 
      (body?.data?.id as string | number | undefined) ??
      (body?.id as string | number | undefined) ??
      req.nextUrl.searchParams.get('id') ??
      null;

    if (!paymentId) {
      console.warn('[WEBHOOK] No payment ID provided');
      return NextResponse.json({ ok: true, message: 'No payment ID' });
    }

    // 3. Obtener información del pago de MercadoPago
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) {
      console.error('[WEBHOOK] Missing MERCADOPAGO_ACCESS_TOKEN');
      return NextResponse.json(
        { ok: false, error: 'Missing MERCADOPAGO_ACCESS_TOKEN' },
        { status: 500 }
      );
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    
    let paymentInfo: any;
    try {
      paymentInfo = await payment.get({ id: String(paymentId) });
    } catch (mpError: unknown) {
      console.error('[WEBHOOK] Error obteniendo pago de MP:', mpError);
      // Si MP falla, registrar pero no fallar el webhook
      await logPaymentError({
        paymentId: String(paymentId),
        error: mpError instanceof Error ? mpError.message : 'Unknown MP error',
        stage: 'fetch_payment_info',
      });
      return NextResponse.json({ ok: true }); // Responder OK para que MP no reintente
    }

    const status = (paymentInfo as any)?.status as string | undefined;
    const externalRef = (paymentInfo as any)?.external_reference as string | undefined;
    const metadata = (paymentInfo as any)?.metadata as any;

    externalReference = externalRef || null;

    if (!externalReference) {
      console.warn('[WEBHOOK] No external_reference in payment');
      return NextResponse.json({ ok: true, message: 'No external_reference' });
    }

    const admin = supabaseAdmin();

    // 4. Determinar tipo de pago y procesar
    const isEstafetaPayment = externalReference.startsWith('estafeta_quote_') || metadata?.type === 'estafeta_guide';
    const isAdCampaignPayment = externalReference.startsWith('ad_campaign_') || metadata?.type === 'ad_campaign';
    const isVerificationPayment = externalReference.startsWith('verification_') || metadata?.type === 'verification';

    // Procesar según tipo (mantener lógica existente pero con mejor manejo de errores)
    if (isEstafetaPayment) {
      return await processEstafetaPayment(admin, externalReference, paymentId, status);
    }

    if (isAdCampaignPayment) {
      return await processAdCampaignPayment(admin, externalReference, paymentId, status);
    }

    if (isVerificationPayment) {
      return await processVerificationPayment(admin, externalReference, paymentId, status);
    }

    // 5. Procesar pago de checkout normal
    return await processCheckoutPayment(admin, externalReference, paymentId, status, paymentInfo);

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error('Unknown error');
    console.error('[WEBHOOK] Error general:', error);

    // Registrar error para análisis
    await logPaymentError({
      paymentId: paymentId || 'unknown',
      externalReference: externalReference || 'unknown',
      error: error.message,
      stage: 'general',
      stack: error.stack,
    });

    // Responder OK para que MP no reintente infinitamente
    // Pero registrar el error para seguimiento
    return NextResponse.json({ ok: true, error: 'Processed with errors' });
  }
}

/**
 * Procesa pago de checkout con validaciones exhaustivas
 */
async function processCheckoutPayment(
  admin: SupabaseClient,
  externalReference: string,
  paymentId: string,
  status: string | undefined,
  paymentInfo: any
): Promise<NextResponse> {
  // 1. Leer estado previo (idempotencia)
  const { data: prevSession } = await admin
    .from('checkout_sessions')
    .select('id, status, mp_payment_id, buyer_id, order_ids')
    .eq('id', externalReference)
    .maybeSingle();

  // Si ya está pagado y es el mismo pago, retornar OK (idempotencia)
  if (prevSession?.status === 'paid' && prevSession.mp_payment_id === String(paymentId)) {
    console.log('[WEBHOOK] Pago ya procesado (idempotencia)');
    return NextResponse.json({ ok: true, message: 'Already processed' });
  }

  // 2. Validar pago antes de procesar
  if (!prevSession) {
    console.error('[WEBHOOK] Checkout session no encontrada:', externalReference);
    return NextResponse.json({ ok: true, error: 'Session not found' });
  }

  const buyerId = String(prevSession.buyer_id || '').trim();
  const orderIds = ((prevSession.order_ids as string[]) || []).map(String).filter(Boolean);

  if (!buyerId) {
    console.error('[WEBHOOK] No buyer_id en sesión');
    return NextResponse.json({ ok: true, error: 'No buyer_id' });
  }

  // 3. Validar pago usando módulo centralizado
  const validation = await validatePayment(admin, {
    buyerId,
    amount: 0, // Se calculará desde órdenes
    paymentMethod: 'mercadopago',
    checkoutId: externalReference,
    orderIds: orderIds.length > 0 ? orderIds : undefined,
  });

  if (!validation.valid) {
    console.error('[WEBHOOK] Validación falló:', validation.errors);
    
    // Registrar error pero no fallar el webhook
    await logPaymentError({
      paymentId: String(paymentId),
      externalReference,
      error: validation.errors.join('; '),
      stage: 'validation',
    });

    // Si hay errores críticos, no procesar
    return NextResponse.json({ 
      ok: false, 
      error: 'Validation failed',
      details: validation.errors 
    });
  }

  // 4. Procesar según estado
  const nextSessionStatus =
    status === 'approved' ? 'paid' :
    status === 'rejected' || status === 'cancelled' ? 'failed' :
    'pending';

  // 5. Actualizar sesión (idempotente)
  const { error: updateError } = await admin
    .from('checkout_sessions')
    .update({
      mp_payment_id: String(paymentId),
      mp_status: status ?? null,
      status: nextSessionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', externalReference);

  if (updateError) {
    console.error('[WEBHOOK] Error actualizando sesión:', updateError);
    // Continuar, no es crítico
  }

  // 6. Si aprobado, procesar órdenes
  if (status === 'approved' && orderIds.length > 0) {
    await processApprovedPayment(admin, orderIds, buyerId, externalReference, paymentId);
  }

  // 7. Enviar notificaciones (best-effort)
  if (shouldNotify(prevSession, nextSessionStatus, String(paymentId))) {
    await sendPaymentNotifications(admin, buyerId, orderIds, nextSessionStatus, externalReference, paymentId);
  }

  await logPaymentSuccess({
    paymentId: String(paymentId),
    externalReference,
    status: nextSessionStatus,
    processingTime: Date.now() - startTime,
  });

  return NextResponse.json({ ok: true });
}
```

### 1.3 Sistema de Logging de Pagos

```typescript
// lib/payments/logging.ts

export type PaymentLog = {
  payment_id: string;
  external_reference?: string;
  status: 'success' | 'error';
  stage: string;
  error?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

/**
 * Registra un error de pago para análisis
 */
export async function logPaymentError(log: Omit<PaymentLog, 'created_at' | 'status'>): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from('payment_logs').insert([{
      ...log,
      status: 'error',
      created_at: new Date().toISOString(),
    }]);
  } catch (e) {
    // No fallar si el logging falla
    console.error('[PAYMENT LOG] Error logging payment error:', e);
  }
}

/**
 * Registra un pago exitoso
 */
export async function logPaymentSuccess(log: Omit<PaymentLog, 'created_at' | 'status'>): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from('payment_logs').insert([{
      ...log,
      status: 'success',
      created_at: new Date().toISOString(),
    }]);
  } catch (e) {
    console.error('[PAYMENT LOG] Error logging payment success:', e);
  }
}
```

### 1.4 Tabla de Logs de Pagos

```sql
-- supabase_payment_logs.sql
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  external_reference TEXT,
  status TEXT NOT NULL, -- 'success' | 'error'
  stage TEXT NOT NULL, -- 'validation', 'processing', 'notification', etc.
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_logs_payment_id ON public.payment_logs(payment_id);
CREATE INDEX idx_payment_logs_external_ref ON public.payment_logs(external_reference);
CREATE INDEX idx_payment_logs_status ON public.payment_logs(status);
CREATE INDEX idx_payment_logs_created ON public.payment_logs(created_at DESC);
```

---

## 📧 2. SISTEMA DE NOTIFICACIONES DUAL (EMAIL + PANEL)

### 2.1 Servicio Unificado de Notificaciones

```typescript
// lib/notifications/unified.ts

export type NotificationChannel = 'panel' | 'email' | 'both';

export type UnifiedNotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  linkTo?: string;
  channels?: NotificationChannel[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  emailTemplate?: string;
  emailSubject?: string;
};

/**
 * Envía notificación tanto al panel como por email
 * Garantiza que al menos una llegue, incluso si la otra falla
 */
export async function sendUnifiedNotification(
  admin: SupabaseClient,
  payload: UnifiedNotificationPayload
): Promise<{
  panel: { ok: boolean; error?: string };
  email: { ok: boolean; error?: string };
}> {
  const channels = payload.channels || ['both'];
  const results = {
    panel: { ok: false, error: undefined as string | undefined },
    email: { ok: false, error: undefined as string | undefined },
  };

  // 1. Notificación al panel (siempre intentar)
  if (channels.includes('panel') || channels.includes('both')) {
    try {
      const panelResult = await insertNotificationBestEffort(admin, {
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        link_to: payload.linkTo,
        is_read: false,
      });
      results.panel = { ok: panelResult.ok };
      if (!panelResult.ok) {
        results.panel.error = (panelResult as any).message || 'Unknown error';
      }
    } catch (e) {
      results.panel.error = e instanceof Error ? e.message : 'Unknown error';
      console.error('[UNIFIED NOTIFY] Error en notificación panel:', e);
    }
  } else {
    results.panel = { ok: true }; // No requerido
  }

  // 2. Notificación por email (best-effort)
  if (channels.includes('email') || channels.includes('both')) {
    try {
      // Obtener email del usuario
      const { data: profile } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', payload.userId)
        .maybeSingle();

      if (!profile?.email) {
        results.email.error = 'No email found for user';
      } else {
        const emailResult = await sendNotificationEmail({
          to: profile.email,
          toName: profile.full_name || 'Usuario',
          type: payload.type,
          title: payload.title || payload.emailSubject,
          body: payload.body,
          data: payload.data,
          linkTo: payload.linkTo,
          template: payload.emailTemplate,
        });
        results.email = emailResult;
      }
    } catch (e) {
      results.email.error = e instanceof Error ? e.message : 'Unknown error';
      console.error('[UNIFIED NOTIFY] Error en notificación email:', e);
    }
  } else {
    results.email = { ok: true }; // No requerido
  }

  // 3. Log del resultado
  if (!results.panel.ok || !results.email.ok) {
    console.warn('[UNIFIED NOTIFY] Algunas notificaciones fallaron:', {
      userId: payload.userId,
      type: payload.type,
      results,
    });
  }

  return results;
}
```

### 2.2 Plantillas de Email Automáticas

```typescript
// lib/email/templates.ts

export type EmailTemplate = {
  subject: string;
  html: (data: Record<string, unknown>) => string;
  text: (data: Record<string, unknown>) => string;
};

const templates: Record<string, EmailTemplate> = {
  payment_approved: {
    subject: '✅ Pago Acreditado - GoPocket',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Pago Acreditado!</h1>
          </div>
          <div class="content">
            <p>Hola,</p>
            <p>Tu pago ha sido acreditado exitosamente.</p>
            ${data.orderIds ? `<p><strong>Órdenes:</strong> ${Array.isArray(data.orderIds) ? data.orderIds.join(', ') : data.orderIds}</p>` : ''}
            ${data.amount ? `<p><strong>Monto:</strong> ${Number(data.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>` : ''}
            <p>Ya puedes dar seguimiento a tu compra desde tu panel.</p>
            ${data.linkTo ? `<a href="${data.linkTo}" class="button">Ver Mis Compras</a>` : ''}
          </div>
          <div class="footer">
            <p>GoPocket - Tu marketplace de confianza</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `
      ¡Pago Acreditado!
      
      Tu pago ha sido acreditado exitosamente.
      ${data.orderIds ? `Órdenes: ${Array.isArray(data.orderIds) ? data.orderIds.join(', ') : data.orderIds}` : ''}
      ${data.amount ? `Monto: ${Number(data.amount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}` : ''}
      
      Ya puedes dar seguimiento a tu compra desde tu panel.
      ${data.linkTo ? `Ver: ${data.linkTo}` : ''}
    `,
  },
  
  payment_rejected: {
    subject: '⚠️ Pago Rechazado - GoPocket',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Pago Rechazado</h1>
          </div>
          <div class="content">
            <p>Hola,</p>
            <p>Tu pago fue rechazado. Por favor intenta de nuevo o elige otro método de pago.</p>
            ${data.linkTo ? `<a href="${data.linkTo}" class="button">Intentar de Nuevo</a>` : ''}
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `
      Pago Rechazado
      
      Tu pago fue rechazado. Por favor intenta de nuevo o elige otro método de pago.
      ${data.linkTo ? `Intentar: ${data.linkTo}` : ''}
    `,
  },

  order_shipped: {
    subject: '📦 Tu Pedido Fue Enviado - GoPocket',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .tracking { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Tu Pedido Fue Enviado</h1>
          </div>
          <div class="content">
            <p>Hola,</p>
            <p>Tu pedido ha sido enviado y está en camino.</p>
            ${data.trackingNumber ? `
              <div class="tracking">
                <p><strong>Número de rastreo:</strong> ${data.trackingNumber}</p>
                ${data.carrier ? `<p><strong>Transportista:</strong> ${data.carrier}</p>` : ''}
              </div>
            ` : ''}
            ${data.linkTo ? `<a href="${data.linkTo}" class="button">Rastrear Pedido</a>` : ''}
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data) => `
      Tu Pedido Fue Enviado
      
      Tu pedido ha sido enviado y está en camino.
      ${data.trackingNumber ? `Número de rastreo: ${data.trackingNumber}` : ''}
      ${data.carrier ? `Transportista: ${data.carrier}` : ''}
      ${data.linkTo ? `Rastrear: ${data.linkTo}` : ''}
    `,
  },

  // Agregar más plantillas según necesidad
};

export function getEmailTemplate(type: string): EmailTemplate | null {
  return templates[type] || null;
}
```

### 2.3 Función de Envío de Email de Notificación

```typescript
// lib/email/notification.ts

import { sendTransactionalEmail } from './send';
import { getEmailTemplate } from './templates';

export async function sendNotificationEmail(opts: {
  to: string;
  toName: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  linkTo?: string;
  template?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const templateType = opts.template || opts.type;
  const template = getEmailTemplate(templateType);

  const subject = template?.subject || opts.title || 'Notificación - GoPocket';
  const html = template?.html({ ...opts.data, linkTo: opts.linkTo }) || `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${opts.title}</h2>
        <p>${opts.body}</p>
        ${opts.linkTo ? `<a href="${opts.linkTo}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Ver más</a>` : ''}
      </div>
    </body>
    </html>
  `;
  const text = template?.text({ ...opts.data, linkTo: opts.linkTo }) || opts.body;

  return await sendTransactionalEmail({
    to: opts.to,
    subject,
    html,
    text,
    from: 'contacto@gopocket.com.mx',
    fromName: 'GoPocket',
  });
}
```

---

## 🛡️ 3. CONTROL ADMINISTRATIVO COMPLETO

### 3.1 Sistema de Estados de Usuario Mejorado

```typescript
// lib/admin/userManagement.ts

export type UserAction = 'activate' | 'suspend' | 'ban' | 'delete';

export type UserActionResult = {
  ok: boolean;
  error?: string;
  affectedOrders?: number;
  affectedListings?: number;
  warnings?: string[];
};

/**
 * Ejecuta una acción administrativa sobre un usuario
 * Con validaciones exhaustivas y logging completo
 */
export async function executeUserAction(
  admin: SupabaseClient,
  adminId: string,
  userId: string,
  action: UserAction,
  options?: {
    days?: number;
    notes?: string;
    reason?: string;
  }
): Promise<UserActionResult> {
  const warnings: string[] = [];
  
  // 1. Validar que el usuario existe
  const { data: user, error: userError } = await admin
    .from('profiles')
    .select('id, email, full_name, username')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    return { ok: false, error: 'Usuario no encontrado' };
  }

  // 2. Validar que no es un admin intentando modificar a otro admin
  const { data: targetIsAdmin } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (targetIsAdmin && action !== 'activate') {
    return { 
      ok: false, 
      error: 'No se puede suspender, bloquear o eliminar a otro administrador' 
    };
  }

  // 3. Ejecutar acción según tipo
  switch (action) {
    case 'activate':
      return await activateUser(admin, userId, adminId, options);
    
    case 'suspend':
      return await suspendUser(admin, userId, adminId, options);
    
    case 'ban':
      return await banUser(admin, userId, adminId, options);
    
    case 'delete':
      return await deleteUser(admin, userId, adminId, options);
    
    default:
      return { ok: false, error: 'Acción inválida' };
  }
}

async function suspendUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { days?: number; notes?: string }
): Promise<UserActionResult> {
  const days = Number.isFinite(options?.days) && options?.days! > 0 
    ? Math.min(365, Math.floor(options!.days!)) 
    : 7;

  const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // 1. Actualizar estado
  const { error: stateError } = await admin
    .from('user_admin_states')
    .upsert([{
      user_id: userId,
      status: 'suspended',
      suspended_until: suspendedUntil,
      notes: options?.notes || '',
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }], { onConflict: 'user_id' });

  if (stateError) {
    return { ok: false, error: `Error actualizando estado: ${stateError.message}` };
  }

  // 2. Pausar publicaciones activas
  const { data: pausedListings } = await admin
    .from('listings')
    .update({ status: 'paused' })
    .eq('seller_id', userId)
    .eq('status', 'active')
    .select('id');

  // 3. Cancelar órdenes pendientes (opcional, según política)
  const { data: pendingOrders } = await admin
    .from('orders')
    .select('id')
    .eq('buyer_id', userId)
    .in('status', ['pending', 'paid']);

  if (pendingOrders && pendingOrders.length > 0) {
    warnings.push(`${pendingOrders.length} orden(es) pendiente(s) del usuario`);
  }

  // 4. Notificar al usuario
  await sendUnifiedNotification(admin, {
    userId,
    type: 'user_suspended',
    title: 'Cuenta Suspendida',
    body: `Tu cuenta ha sido suspendida hasta ${new Date(suspendedUntil).toLocaleDateString('es-MX')}. ${options?.notes || ''}`,
    channels: ['both'],
    priority: 'high',
  });

  return {
    ok: true,
    affectedListings: pausedListings?.length || 0,
    warnings,
  };
}

async function banUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { notes?: string }
): Promise<UserActionResult> {
  // 1. Actualizar estado
  const { error: stateError } = await admin
    .from('user_admin_states')
    .upsert([{
      user_id: userId,
      status: 'banned',
      suspended_until: null,
      notes: options?.notes || '',
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }], { onConflict: 'user_id' });

  if (stateError) {
    return { ok: false, error: `Error actualizando estado: ${stateError.message}` };
  }

  // 2. Bloquear todas las publicaciones
  const { data: blockedListings } = await admin
    .from('listings')
    .update({ status: 'blocked' })
    .eq('seller_id', userId)
    .select('id');

  // 3. Cancelar órdenes pendientes
  const { data: cancelledOrders } = await admin
    .from('orders')
    .update({ status: 'cancelled' })
    .in('id', 
      (await admin
        .from('orders')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .in('status', ['pending', 'paid']))
        .data?.map(o => o.id) || []
    )
    .select('id');

  // 4. Notificar al usuario
  await sendUnifiedNotification(admin, {
    userId,
    type: 'user_banned',
    title: 'Cuenta Bloqueada Permanentemente',
    body: `Tu cuenta ha sido bloqueada permanentemente. ${options?.notes || ''}`,
    channels: ['both'],
    priority: 'urgent',
  });

  return {
    ok: true,
    affectedListings: blockedListings?.length || 0,
    affectedOrders: cancelledOrders?.length || 0,
  };
}

async function deleteUser(
  admin: SupabaseClient,
  userId: string,
  adminId: string,
  options?: { notes?: string }
): Promise<UserActionResult> {
  // ADVERTENCIA: Esta acción es IRREVERSIBLE
  
  // 1. Verificar que no tiene órdenes activas
  const { data: activeOrders } = await admin
    .from('orders')
    .select('id')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in('status', ['paid', 'shipped', 'delivered']);

  if (activeOrders && activeOrders.length > 0) {
    return {
      ok: false,
      error: `No se puede eliminar usuario con ${activeOrders.length} orden(es) activa(s)`,
    };
  }

  // 2. Eliminar en cascada (en orden correcto para evitar violaciones de FK)
  // - Favoritos
  await admin.from('favorites').delete().eq('user_id', userId);
  
  // - Cupones del usuario
  await admin.from('user_coupons').delete().eq('user_id', userId);
  
  // - Preguntas y respuestas
  await admin.from('listing_questions').delete().or(`asked_by.eq.${userId},answered_by.eq.${userId}`);
  
  // - Notificaciones
  await admin.from('notifications').delete().eq('user_id', userId);
  
  // - Carrito
  await admin.from('cart_items').delete().eq('user_id', userId);
  
  // - Publicaciones (soft delete primero)
  await admin.from('listings').update({ status: 'archived' }).eq('seller_id', userId);
  
  // - Órdenes (cancellar las pendientes)
  await admin.from('orders').update({ status: 'cancelled' })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in('status', ['pending']);
  
  // - Estado admin
  await admin.from('user_admin_states').delete().eq('user_id', userId);
  
  // - Perfil (último)
  const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
  
  if (profileError) {
    return { ok: false, error: `Error eliminando perfil: ${profileError.message}` };
  }

  // 3. Log de la eliminación
  await admin.from('admin_action_logs').insert([{
    admin_id: adminId,
    action: 'delete_user',
    target_user_id: userId,
    notes: options?.notes || 'Usuario eliminado',
    created_at: new Date().toISOString(),
  }]);

  return { ok: true };
}
```

### 3.2 Tabla de Logs de Acciones Admin

```sql
-- supabase_admin_action_logs.sql
CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'suspend_user', 'ban_user', 'delete_user', 'approve_payment', etc.
  target_user_id UUID,
  target_entity_type TEXT, -- 'user', 'order', 'listing', etc.
  target_entity_id TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin ON public.admin_action_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON public.admin_action_logs(action);
CREATE INDEX idx_admin_logs_target ON public.admin_action_logs(target_user_id);
CREATE INDEX idx_admin_logs_created ON public.admin_action_logs(created_at DESC);
```

---

## 🔄 4. AUTOMATIZACIÓN DE PROCESOS

### 4.1 Jobs Automáticos (Cron-like)

```typescript
// lib/automation/jobs.ts

/**
 * Ejecuta jobs automáticos periódicos
 * Llamar desde un cron job o Vercel Cron
 */
export async function runAutomatedJobs(): Promise<void> {
  const admin = supabaseAdmin();
  
  // 1. Verificar suspensiones expiradas
  await checkExpiredSuspensions(admin);
  
  // 2. Limpiar sesiones de checkout expiradas
  await cleanupExpiredCheckouts(admin);
  
  // 3. Enviar recordatorios de pagos pendientes
  await sendPaymentReminders(admin);
  
  // 4. Actualizar estados de órdenes (shipped -> delivered después de X días)
  await updateOrderStatuses(admin);
  
  // 5. Limpiar logs antiguos
  await cleanupOldLogs(admin);
}

async function checkExpiredSuspensions(admin: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  
  const { data: expired } = await admin
    .from('user_admin_states')
    .select('user_id')
    .eq('status', 'suspended')
    .lte('suspended_until', now);

  if (expired && expired.length > 0) {
    for (const user of expired) {
      await admin
        .from('user_admin_states')
        .update({ status: 'active', suspended_until: null })
        .eq('user_id', user.user_id);

      await sendUnifiedNotification(admin, {
        userId: user.user_id,
        type: 'user_reactivated',
        title: 'Cuenta Reactivada',
        body: 'Tu suspensión ha expirado y tu cuenta ha sido reactivada.',
        channels: ['both'],
      });
    }
  }
}
```

### 4.2 API Endpoint para Jobs

```typescript
// app/api/cron/jobs/route.ts

import { runAutomatedJobs } from '@/lib/automation/jobs';

export async function GET(req: NextRequest) {
  // Validar secret para seguridad
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runAutomatedJobs();
    return NextResponse.json({ ok: true, message: 'Jobs executed' });
  } catch (e) {
    console.error('[CRON] Error ejecutando jobs:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## 📊 5. DASHBOARD DE MONITOREO Y ALERTAS

### 5.1 Panel de Salud del Sistema

```typescript
// app/admin/salud/page.tsx

export default function AdminSaludPage() {
  const [health, setHealth] = useState({
    payments: { status: 'unknown', last24h: 0, errors: 0 },
    notifications: { status: 'unknown', sent: 0, failed: 0 },
    users: { active: 0, suspended: 0, banned: 0 },
    orders: { pending: 0, paid: 0, shipped: 0 },
  });

  // Cargar métricas de salud
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/admin/health');
      const data = await res.json();
      setHealth(data);
    };
    load();
    const interval = setInterval(load, 30000); // Cada 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Salud del Sistema</h1>
      {/* Mostrar métricas y alertas */}
    </div>
  );
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Validaciones y Seguridad de Pagos
- [ ] Crear módulo de validación de pagos
- [ ] Implementar logging de pagos
- [ ] Mejorar webhook de MercadoPago con validaciones
- [ ] Agregar tabla de logs de pagos
- [ ] Implementar idempotencia en todos los pagos

### Fase 2: Sistema de Notificaciones Dual
- [ ] Crear servicio unificado de notificaciones
- [ ] Implementar plantillas de email
- [ ] Integrar envío automático de emails
- [ ] Probar notificaciones en todos los flujos

### Fase 3: Control Administrativo
- [ ] Mejorar sistema de gestión de usuarios
- [ ] Implementar eliminación segura de usuarios
- [ ] Agregar logging de acciones admin
- [ ] Crear tabla de logs de acciones

### Fase 4: Automatización
- [ ] Implementar jobs automáticos
- [ ] Configurar cron jobs (Vercel Cron)
- [ ] Probar automatizaciones

### Fase 5: Monitoreo
- [ ] Crear dashboard de salud
- [ ] Implementar alertas automáticas
- [ ] Configurar notificaciones de errores críticos

---

## 🎨 MEJORAS DE UX/UI

### Diseño Profesional
- **Colores consistentes**: Usar paleta de marca en toda la app
- **Tipografía clara**: Fuentes legibles y jerarquía visual clara
- **Espaciado adecuado**: Respiración visual en todos los componentes
- **Iconografía**: Iconos consistentes y significativos
- **Animaciones sutiles**: Transiciones suaves para mejor UX

### Feedback Visual
- **Estados de carga**: Spinners y skeletons apropiados
- **Mensajes de error**: Claros, accionables y no técnicos
- **Confirmaciones**: Modales de confirmación para acciones críticas
- **Notificaciones toast**: Feedback inmediato de acciones

---

## 🔐 SEGURIDAD ADICIONAL

1. **Rate Limiting**: Implementar en todas las APIs críticas
2. **Validación de entrada**: Sanitizar todos los inputs
3. **CORS**: Configurar correctamente
4. **Secrets**: Nunca exponer en frontend
5. **Auditoría**: Log de todas las acciones sensibles

---

**Este prompt debe implementarse de forma incremental, priorizando seguridad y estabilidad en cada paso.**
