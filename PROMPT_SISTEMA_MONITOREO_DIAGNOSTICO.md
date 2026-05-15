# PROMPT: Sistema de Monitoreo y Diagnóstico Automático - GoPocket

## OBJETIVO PRINCIPAL

Implementar un **bot de monitoreo automático** que:
1. **Revise todas las operaciones** de la aplicación periódicamente
2. **Diagnostique fallas** y problemas en el sistema
3. **Genere alertas automáticas** para administradores
4. **Proporcione links directos** a donde está la falla
5. **Todo integrado dentro de la app** en un panel de administración

---

## ARQUITECTURA ACTUAL (Base Existente)

### Componentes Existentes:
- ✅ Tabla `orders` con estados: `pending_payment`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`, `disputed`
- ✅ Tabla `checkout_sessions` para pagos offline
- ✅ Tabla `disputes` con estados: `open`, `resolved`, `closed`
- ✅ Tabla `notifications` para notificaciones del sistema
- ✅ Panel de administración en `/admin`
- ✅ API `/api/admin/dashboard/summary` para resumen operativo
- ✅ Sistema de notificaciones existente

### Operaciones Principales a Monitorear:
1. **Órdenes** - Estados, tiempos de procesamiento, inconsistencias
2. **Pagos** - Pagos offline pendientes, webhooks fallidos
3. **Envíos** - Órdenes pagadas sin envío, guías faltantes
4. **Disputas** - Disputas abiertas sin resolución, tiempos excedidos
5. **Preguntas** - Preguntas sin responder por mucho tiempo
6. **Notificaciones** - Notificaciones atoradas o duplicadas
7. **Datos** - Inconsistencias en base de datos, referencias rotas

---

## REQUERIMIENTOS ESPECÍFICOS

### 1. TABLA DE ALERTAS DEL SISTEMA

**Crear tabla `system_alerts` para almacenar alertas generadas:**

```sql
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo y severidad
  alert_type TEXT NOT NULL, -- 'order_stuck', 'payment_pending', 'dispute_unresolved', 'data_inconsistency', etc.
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'error', 'critical'
  
  -- Información de la alerta
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb, -- Información adicional estructurada
  
  -- Links y referencias
  entity_type TEXT NOT NULL, -- 'order', 'payment', 'dispute', 'listing', 'user', etc.
  entity_id UUID NULL, -- ID del registro relacionado
  action_url TEXT NOT NULL, -- URL directa para resolver (ej: '/admin/pagos?id=xxx')
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
  acknowledged_by UUID NULL REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE NULL,
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Metadatos
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS system_alerts_status_idx ON public.system_alerts (status, detected_at DESC);
CREATE INDEX IF NOT EXISTS system_alerts_type_idx ON public.system_alerts (alert_type, status);
CREATE INDEX IF NOT EXISTS system_alerts_entity_idx ON public.system_alerts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS system_alerts_severity_idx ON public.system_alerts (severity, status);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver alertas
DROP POLICY IF EXISTS "Admins can read system alerts" ON public.system_alerts;
CREATE POLICY "Admins can read system alerts"
  ON public.system_alerts
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Solo el sistema puede crear alertas (via supabaseAdmin)
-- Los admins pueden actualizar (acknowledge, resolve, dismiss)
DROP POLICY IF EXISTS "Admins can update system alerts" ON public.system_alerts;
CREATE POLICY "Admins can update system alerts"
  ON public.system_alerts
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
```

---

## 2. TIPOS DE ALERTAS A DETECTAR

### A. ALERTAS DE ÓRDENES

#### 1. Orden Pagada Sin Envío (Crítico)
- **Tipo:** `order_paid_no_shipment`
- **Severidad:** `error`
- **Condición:** Orden con `status = 'paid'` y `shipped_at IS NULL` por más de 3 días
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} pagada hace {días} días sin envío"

#### 2. Orden Enviada Sin Guía (Advertencia)
- **Tipo:** `order_shipped_no_label`
- **Severidad:** `warning`
- **Condición:** Orden con `status = 'shipped'` y `shipping_label_url IS NULL`
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} marcada como enviada pero sin guía de envío"

#### 3. Orden Con Estado Inconsistente (Error)
- **Tipo:** `order_status_inconsistent`
- **Severidad:** `error`
- **Condición:** 
  - Orden con `status = 'delivered'` pero `delivered_at IS NULL`
  - Orden con `status = 'shipped'` pero `shipped_at IS NULL`
  - Orden con `status = 'paid'` pero `paid_at IS NULL`
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} tiene estado inconsistente: {status} sin fecha correspondiente"

#### 4. Orden Pagada Sin Items (Crítico)
- **Tipo:** `order_no_items`
- **Severidad:** `critical`
- **Condición:** Orden sin `order_items` asociados
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} no tiene items asociados"

#### 5. Orden Con Buyer/Seller Inválido (Error)
- **Tipo:** `order_invalid_users`
- **Severidad:** `error`
- **Condición:** Orden con `buyer_id` o `seller_id` que no existen en `auth.users`
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} tiene buyer_id o seller_id inválido"

### B. ALERTAS DE PAGOS

#### 1. Pago Offline Pendiente Por Mucho Tiempo (Advertencia)
- **Tipo:** `payment_offline_stuck`
- **Severidad:** `warning`
- **Condición:** `checkout_sessions` con `status = 'pending'` y `payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')` por más de 7 días
- **Link:** `/admin/pagos?session_id={session_id}`
- **Mensaje:** "Pago offline #{session_id} pendiente desde hace {días} días"

#### 2. Pago Offline Sin Comprobante (Advertencia)
- **Tipo:** `payment_offline_no_proof`
- **Severidad:** `warning`
- **Condición:** `checkout_sessions` con `status = 'pending'` y `payment_proof_url IS NULL` por más de 2 días
- **Link:** `/admin/pagos?session_id={session_id}`
- **Mensaje:** "Pago offline #{session_id} sin comprobante después de 2 días"

#### 3. Webhook de MercadoPago Fallido (Error)
- **Tipo:** `payment_webhook_failed`
- **Severidad:** `error`
- **Condición:** Orden con `payment_method = 'mercadopago'` y `status = 'pending_payment'` pero tiene `mp_payment_id` (webhook procesado pero orden no actualizada)
- **Link:** `/admin/pagos?order_id={order_id}`
- **Mensaje:** "Posible fallo en webhook de MercadoPago para orden #{order_id}"

### C. ALERTAS DE DISPUTAS

#### 1. Disputa Abierta Sin Resolución (Advertencia)
- **Tipo:** `dispute_unresolved`
- **Severidad:** `warning`
- **Condición:** Disputa con `status = 'open'` por más de 5 días sin mensajes nuevos
- **Link:** `/admin/disputas?dispute_id={dispute_id}`
- **Mensaje:** "Disputa #{dispute_id} abierta hace {días} días sin actividad"

#### 2. Disputa Sin Mensajes (Error)
- **Tipo:** `dispute_no_messages`
- **Severidad:** `error`
- **Condición:** Disputa con `status = 'open'` sin `dispute_messages`
- **Link:** `/admin/disputas?dispute_id={dispute_id}`
- **Mensaje:** "Disputa #{dispute_id} abierta pero sin mensajes"

#### 3. Disputa Con Orden Inválida (Error)
- **Tipo:** `dispute_invalid_order`
- **Severidad:** `error`
- **Condición:** Disputa con `order_id` que no existe en `orders`
- **Link:** `/admin/disputas?dispute_id={dispute_id}`
- **Mensaje:** "Disputa #{dispute_id} referencia orden inexistente"

### D. ALERTAS DE ENVÍOS

#### 1. Orden Con Guía Pero Sin Tracking (Advertencia)
- **Tipo:** `shipment_no_tracking`
- **Severidad:** `warning`
- **Condición:** Orden con `shipping_label_url IS NOT NULL` pero `tracking_number IS NULL`
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} tiene guía pero sin número de rastreo"

#### 2. Orden Enviada Sin Carrier (Info)
- **Tipo:** `shipment_no_carrier`
- **Severidad:** `info`
- **Condición:** Orden con `status = 'shipped'` pero `shipping_carrier IS NULL`
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Orden #{order_id} enviada sin especificar paquetería"

### E. ALERTAS DE DATOS

#### 1. Listing Sin Vendedor (Error)
- **Tipo:** `listing_no_seller`
- **Severidad:** `error`
- **Condición:** `listings` con `seller_id` que no existe en `auth.users`
- **Link:** `/admin/listings?listing_id={listing_id}`
- **Mensaje:** "Publicación #{listing_id} tiene seller_id inválido"

#### 2. Orden Item Sin Listing (Error)
- **Tipo:** `order_item_no_listing`
- **Severidad:** `error`
- **Condición:** `order_items` con `listing_id` que no existe en `listings`
- **Link:** `/admin/logistica?order_id={order_id}`
- **Mensaje:** "Item de orden referencia listing inexistente"

#### 3. Notificación Sin Usuario (Advertencia)
- **Tipo:** `notification_no_user`
- **Severidad:** `warning`
- **Condición:** `notifications` con `user_id` que no existe en `auth.users`
- **Link:** `/admin/alertas?type=notification_no_user`
- **Mensaje:** "Notificaciones huérfanas encontradas: {count}"

### F. ALERTAS DE PREGUNTAS

#### 1. Pregunta Sin Responder Por Mucho Tiempo (Advertencia)
- **Tipo:** `question_unanswered`
- **Severidad:** `warning`
- **Condición:** `listing_questions` con `answer_text IS NULL` por más de 7 días
- **Link:** `/dashboard/preguntas?question_id={question_id}`
- **Mensaje:** "Pregunta #{question_id} sin responder hace {días} días"

### G. ALERTAS DE SISTEMA

#### 1. Múltiples Alertas del Mismo Tipo (Info)
- **Tipo:** `multiple_same_alerts`
- **Severidad:** `info`
- **Condición:** Más de 10 alertas activas del mismo tipo
- **Link:** `/admin/alertas?type={alert_type}`
- **Mensaje:** "Se detectaron {count} alertas de tipo {alert_type}"

---

## 3. SERVICIO DE DIAGNÓSTICO

### A. Archivo: `lib/monitoring/diagnostic.ts`

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';

export type AlertType = 
  | 'order_paid_no_shipment'
  | 'order_shipped_no_label'
  | 'order_status_inconsistent'
  | 'order_no_items'
  | 'order_invalid_users'
  | 'payment_offline_stuck'
  | 'payment_offline_no_proof'
  | 'payment_webhook_failed'
  | 'dispute_unresolved'
  | 'dispute_no_messages'
  | 'dispute_invalid_order'
  | 'shipment_no_tracking'
  | 'shipment_no_carrier'
  | 'listing_no_seller'
  | 'order_item_no_listing'
  | 'notification_no_user'
  | 'question_unanswered'
  | 'multiple_same_alerts';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertDetails {
  entity_type: string;
  entity_id?: string;
  action_url: string;
  [key: string]: any;
}

export interface SystemAlert {
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  details: AlertDetails;
}

export class DiagnosticService {
  private admin = supabaseAdmin();

  /**
   * Ejecuta todas las verificaciones de diagnóstico
   */
  async runFullDiagnostic(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    // Ejecutar todas las verificaciones en paralelo
    const results = await Promise.allSettled([
      this.checkOrdersPaidNoShipment(),
      this.checkOrdersShippedNoLabel(),
      this.checkOrderStatusInconsistencies(),
      this.checkOrdersNoItems(),
      this.checkOrdersInvalidUsers(),
      this.checkPaymentsOfflineStuck(),
      this.checkPaymentsOfflineNoProof(),
      this.checkPaymentWebhookFailures(),
      this.checkDisputesUnresolved(),
      this.checkDisputesNoMessages(),
      this.checkDisputesInvalidOrder(),
      this.checkShipmentsNoTracking(),
      this.checkShipmentsNoCarrier(),
      this.checkListingsNoSeller(),
      this.checkOrderItemsNoListing(),
      this.checkNotificationsNoUser(),
      this.checkQuestionsUnanswered(),
    ]);

    // Recolectar alertas de todas las verificaciones
    for (const result of results) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        alerts.push(...result.value);
      } else if (result.status === 'rejected') {
        console.error('[Diagnostic] Error en verificación:', result.reason);
      }
    }

    return alerts;
  }

  /**
   * Guarda alertas en la base de datos
   */
  async saveAlerts(alerts: SystemAlert[]): Promise<void> {
    if (alerts.length === 0) return;

    const now = new Date().toISOString();
    const alertsToInsert = alerts.map(alert => ({
      alert_type: alert.alert_type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      details: alert.details,
      entity_type: alert.details.entity_type,
      entity_id: alert.details.entity_id || null,
      action_url: alert.details.action_url,
      status: 'active',
      detected_at: now,
      last_checked_at: now,
    }));

    // Insertar alertas (usar upsert para evitar duplicados)
    const { error } = await this.admin
      .from('system_alerts')
      .upsert(alertsToInsert, {
        onConflict: 'alert_type,entity_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('[Diagnostic] Error guardando alertas:', error);
      throw error;
    }
  }

  /**
   * Actualiza alertas existentes o crea nuevas
   */
  async updateOrCreateAlert(alert: SystemAlert): Promise<void> {
    const now = new Date().toISOString();
    
    const { data: existing } = await this.admin
      .from('system_alerts')
      .select('id, status')
      .eq('alert_type', alert.alert_type)
      .eq('entity_id', alert.details.entity_id || '')
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      // Actualizar alerta existente
      await this.admin
        .from('system_alerts')
        .update({
          description: alert.description,
          details: alert.details,
          last_checked_at: now,
          updated_at: now,
        })
        .eq('id', existing.id);
    } else {
      // Crear nueva alerta
      await this.saveAlerts([alert]);
    }
  }

  /**
   * Marca alertas como resueltas si ya no aplican
   */
  async resolveStaleAlerts(activeAlertTypes: Set<string>): Promise<void> {
    const { data: allActive } = await this.admin
      .from('system_alerts')
      .select('id, alert_type, entity_id')
      .eq('status', 'active');

    if (!allActive) return;

    const alertsToResolve = allActive.filter(alert => {
      const key = `${alert.alert_type}:${alert.entity_id || ''}`;
      return !activeAlertTypes.has(key);
    });

    if (alertsToResolve.length > 0) {
      await this.admin
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .in('id', alertsToResolve.map(a => a.id));
    }
  }

  // ========== VERIFICACIONES ESPECÍFICAS ==========

  async checkOrdersPaidNoShipment(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: orders } = await this.admin
      .from('orders')
      .select('id, status, created_at')
      .eq('status', 'paid')
      .is('shipped_at', null)
      .lt('created_at', threeDaysAgo.toISOString());

    if (!orders) return alerts;

    for (const order of orders) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        alert_type: 'order_paid_no_shipment',
        severity: 'error',
        title: `Orden pagada sin envío`,
        description: `Orden ${order.id.slice(0, 8)}... pagada hace ${daysAgo} días sin envío`,
        details: {
          entity_type: 'order',
          entity_id: order.id,
          action_url: `/admin/logistica?order_id=${order.id}`,
          days_ago: daysAgo,
        },
      });
    }

    return alerts;
  }

  async checkOrdersShippedNoLabel(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: orders } = await this.admin
      .from('orders')
      .select('id, status')
      .eq('status', 'shipped')
      .is('shipping_label_url', null);

    if (!orders) return alerts;

    for (const order of orders) {
      alerts.push({
        alert_type: 'order_shipped_no_label',
        severity: 'warning',
        title: `Orden enviada sin guía`,
        description: `Orden ${order.id.slice(0, 8)}... marcada como enviada pero sin guía de envío`,
        details: {
          entity_type: 'order',
          entity_id: order.id,
          action_url: `/admin/logistica?order_id=${order.id}`,
        },
      });
    }

    return alerts;
  }

  async checkOrderStatusInconsistencies(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    // Ordenes con status 'delivered' pero sin delivered_at
    const { data: deliveredNoDate } = await this.admin
      .from('orders')
      .select('id, status')
      .eq('status', 'delivered')
      .is('delivered_at', null);

    // Ordenes con status 'shipped' pero sin shipped_at
    const { data: shippedNoDate } = await this.admin
      .from('orders')
      .select('id, status')
      .eq('status', 'shipped')
      .is('shipped_at', null);

    // Ordenes con status 'paid' pero sin paid_at (si existe columna)
    // Nota: Verificar si existe columna paid_at primero

    if (deliveredNoDate) {
      for (const order of deliveredNoDate) {
        alerts.push({
          alert_type: 'order_status_inconsistent',
          severity: 'error',
          title: `Estado inconsistente: Entregada sin fecha`,
          description: `Orden ${order.id.slice(0, 8)}... tiene status 'delivered' pero delivered_at es NULL`,
          details: {
            entity_type: 'order',
            entity_id: order.id,
            action_url: `/admin/logistica?order_id=${order.id}`,
            issue: 'delivered_no_date',
          },
        });
      }
    }

    if (shippedNoDate) {
      for (const order of shippedNoDate) {
        alerts.push({
          alert_type: 'order_status_inconsistent',
          severity: 'error',
          title: `Estado inconsistente: Enviada sin fecha`,
          description: `Orden ${order.id.slice(0, 8)}... tiene status 'shipped' pero shipped_at es NULL`,
          details: {
            entity_type: 'order',
            entity_id: order.id,
            action_url: `/admin/logistica?order_id=${order.id}`,
            issue: 'shipped_no_date',
          },
        });
      }
    }

    return alerts;
  }

  async checkOrdersNoItems(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: orders } = await this.admin
      .from('orders')
      .select('id');

    if (!orders) return alerts;

    for (const order of orders) {
      const { data: items } = await this.admin
        .from('order_items')
        .select('id')
        .eq('order_id', order.id)
        .limit(1);

      if (!items || items.length === 0) {
        alerts.push({
          alert_type: 'order_no_items',
          severity: 'critical',
          title: `Orden sin items`,
          description: `Orden ${order.id.slice(0, 8)}... no tiene items asociados`,
          details: {
            entity_type: 'order',
            entity_id: order.id,
            action_url: `/admin/logistica?order_id=${order.id}`,
          },
        });
      }
    }

    return alerts;
  }

  async checkOrdersInvalidUsers(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    // Obtener todos los buyer_id y seller_id únicos
    const { data: orders } = await this.admin
      .from('orders')
      .select('id, buyer_id, seller_id');

    if (!orders) return alerts;

    const userIds = new Set<string>();
    orders.forEach(o => {
      userIds.add(o.buyer_id);
      userIds.add(o.seller_id);
    });

    // Verificar que todos existan en auth.users
    // Nota: Esto requiere acceso a auth.users, que puede no estar disponible directamente
    // Alternativa: Verificar en profiles o usar función de Supabase

    // Por ahora, verificamos en profiles
    const { data: profiles } = await this.admin
      .from('profiles')
      .select('id')
      .in('id', Array.from(userIds));

    const validUserIds = new Set((profiles || []).map(p => p.id));

    for (const order of orders) {
      if (!validUserIds.has(order.buyer_id) || !validUserIds.has(order.seller_id)) {
        alerts.push({
          alert_type: 'order_invalid_users',
          severity: 'error',
          title: `Orden con usuarios inválidos`,
          description: `Orden ${order.id.slice(0, 8)}... tiene buyer_id o seller_id inválido`,
          details: {
            entity_type: 'order',
            entity_id: order.id,
            action_url: `/admin/logistica?order_id=${order.id}`,
          },
        });
      }
    }

    return alerts;
  }

  async checkPaymentsOfflineStuck(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: sessions } = await this.admin
      .from('checkout_sessions')
      .select('id, status, payment_method, created_at')
      .eq('status', 'pending')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
      .lt('created_at', sevenDaysAgo.toISOString());

    if (!sessions) return alerts;

    for (const session of sessions) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        alert_type: 'payment_offline_stuck',
        severity: 'warning',
        title: `Pago offline pendiente`,
        description: `Pago offline ${session.id.slice(0, 8)}... pendiente desde hace ${daysAgo} días`,
        details: {
          entity_type: 'payment',
          entity_id: session.id,
          action_url: `/admin/pagos?session_id=${session.id}`,
          days_ago: daysAgo,
        },
      });
    }

    return alerts;
  }

  async checkPaymentsOfflineNoProof(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: sessions } = await this.admin
      .from('checkout_sessions')
      .select('id, status, payment_proof_url, created_at')
      .eq('status', 'pending')
      .in('payment_method', ['bank_transfer', 'bank_deposit', 'oxxo'])
      .is('payment_proof_url', null)
      .lt('created_at', twoDaysAgo.toISOString());

    if (!sessions) return alerts;

    for (const session of sessions) {
      alerts.push({
        alert_type: 'payment_offline_no_proof',
        severity: 'warning',
        title: `Pago offline sin comprobante`,
        description: `Pago offline ${session.id.slice(0, 8)}... sin comprobante después de 2 días`,
        details: {
          entity_type: 'payment',
          entity_id: session.id,
          action_url: `/admin/pagos?session_id=${session.id}`,
        },
      });
    }

    return alerts;
  }

  async checkPaymentWebhookFailures(): Promise<SystemAlert[]> {
    // Esta verificación requiere lógica específica según implementación
    // Por ahora, placeholder
    return [];
  }

  async checkDisputesUnresolved(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const { data: disputes } = await this.admin
      .from('disputes')
      .select('id, status, last_message_at, created_at')
      .eq('status', 'open')
      .lt('last_message_at', fiveDaysAgo.toISOString());

    if (!disputes) return alerts;

    for (const dispute of disputes) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(dispute.last_message_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        alert_type: 'dispute_unresolved',
        severity: 'warning',
        title: `Disputa sin resolver`,
        description: `Disputa ${dispute.id.slice(0, 8)}... abierta hace ${daysAgo} días sin actividad`,
        details: {
          entity_type: 'dispute',
          entity_id: dispute.id,
          action_url: `/admin/disputas?dispute_id=${dispute.id}`,
          days_ago: daysAgo,
        },
      });
    }

    return alerts;
  }

  async checkDisputesNoMessages(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: disputes } = await this.admin
      .from('disputes')
      .select('id, status')
      .eq('status', 'open');

    if (!disputes) return alerts;

    for (const dispute of disputes) {
      const { data: messages } = await this.admin
        .from('dispute_messages')
        .select('id')
        .eq('dispute_id', dispute.id)
        .limit(1);

      if (!messages || messages.length === 0) {
        alerts.push({
          alert_type: 'dispute_no_messages',
          severity: 'error',
          title: `Disputa sin mensajes`,
          description: `Disputa ${dispute.id.slice(0, 8)}... abierta pero sin mensajes`,
          details: {
            entity_type: 'dispute',
            entity_id: dispute.id,
            action_url: `/admin/disputas?dispute_id=${dispute.id}`,
          },
        });
      }
    }

    return alerts;
  }

  async checkDisputesInvalidOrder(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: disputes } = await this.admin
      .from('disputes')
      .select('id, order_id');

    if (!disputes) return alerts;

    const orderIds = disputes.map(d => d.order_id);
    const { data: orders } = await this.admin
      .from('orders')
      .select('id')
      .in('id', orderIds);

    const validOrderIds = new Set((orders || []).map(o => o.id));

    for (const dispute of disputes) {
      if (!validOrderIds.has(dispute.order_id)) {
        alerts.push({
          alert_type: 'dispute_invalid_order',
          severity: 'error',
          title: `Disputa con orden inválida`,
          description: `Disputa ${dispute.id.slice(0, 8)}... referencia orden inexistente`,
          details: {
            entity_type: 'dispute',
            entity_id: dispute.id,
            action_url: `/admin/disputas?dispute_id=${dispute.id}`,
          },
        });
      }
    }

    return alerts;
  }

  async checkShipmentsNoTracking(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: orders } = await this.admin
      .from('orders')
      .select('id, shipping_label_url, tracking_number')
      .not('shipping_label_url', 'is', null)
      .is('tracking_number', null);

    if (!orders) return alerts;

    for (const order of orders) {
      alerts.push({
        alert_type: 'shipment_no_tracking',
        severity: 'warning',
        title: `Envío sin número de rastreo`,
        description: `Orden ${order.id.slice(0, 8)}... tiene guía pero sin número de rastreo`,
        details: {
          entity_type: 'order',
          entity_id: order.id,
          action_url: `/admin/logistica?order_id=${order.id}`,
        },
      });
    }

    return alerts;
  }

  async checkShipmentsNoCarrier(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: orders } = await this.admin
      .from('orders')
      .select('id, status, shipping_carrier')
      .eq('status', 'shipped')
      .is('shipping_carrier', null);

    if (!orders) return alerts;

    for (const order of orders) {
      alerts.push({
        alert_type: 'shipment_no_carrier',
        severity: 'info',
        title: `Envío sin paquetería`,
        description: `Orden ${order.id.slice(0, 8)}... enviada sin especificar paquetería`,
        details: {
          entity_type: 'order',
          entity_id: order.id,
          action_url: `/admin/logistica?order_id=${order.id}`,
        },
      });
    }

    return alerts;
  }

  async checkListingsNoSeller(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: listings } = await this.admin
      .from('listings')
      .select('id, seller_id');

    if (!listings) return alerts;

    const sellerIds = new Set(listings.map(l => l.seller_id));
    const { data: profiles } = await this.admin
      .from('profiles')
      .select('id')
      .in('id', Array.from(sellerIds));

    const validSellerIds = new Set((profiles || []).map(p => p.id));

    for (const listing of listings) {
      if (!validSellerIds.has(listing.seller_id)) {
        alerts.push({
          alert_type: 'listing_no_seller',
          severity: 'error',
          title: `Publicación sin vendedor`,
          description: `Publicación ${listing.id.slice(0, 8)}... tiene seller_id inválido`,
          details: {
            entity_type: 'listing',
            entity_id: listing.id,
            action_url: `/admin/listings?listing_id=${listing.id}`,
          },
        });
      }
    }

    return alerts;
  }

  async checkOrderItemsNoListing(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: items } = await this.admin
      .from('order_items')
      .select('id, listing_id, order_id');

    if (!items) return alerts;

    const listingIds = new Set(items.map(i => i.listing_id));
    const { data: listings } = await this.admin
      .from('listings')
      .select('id')
      .in('id', Array.from(listingIds));

    const validListingIds = new Set((listings || []).map(l => l.id));

    for (const item of items) {
      if (!validListingIds.has(item.listing_id)) {
        alerts.push({
          alert_type: 'order_item_no_listing',
          severity: 'error',
          title: `Item de orden sin publicación`,
          description: `Item de orden referencia listing inexistente (order: ${item.order_id.slice(0, 8)}...)`,
          details: {
            entity_type: 'order_item',
            entity_id: item.id,
            action_url: `/admin/logistica?order_id=${item.order_id}`,
            listing_id: item.listing_id,
          },
        });
      }
    }

    return alerts;
  }

  async checkNotificationsNoUser(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    const { data: notifications } = await this.admin
      .from('notifications')
      .select('id, user_id')
      .limit(1000); // Limitar para no sobrecargar

    if (!notifications) return alerts;

    const userIds = new Set(notifications.map(n => n.user_id));
    const { data: profiles } = await this.admin
      .from('profiles')
      .select('id')
      .in('id', Array.from(userIds));

    const validUserIds = new Set((profiles || []).map(p => p.id));
    const orphaned = notifications.filter(n => !validUserIds.has(n.user_id));

    if (orphaned.length > 0) {
      alerts.push({
        alert_type: 'notification_no_user',
        severity: 'warning',
        title: `Notificaciones huérfanas`,
        description: `Se encontraron ${orphaned.length} notificaciones sin usuario válido`,
        details: {
          entity_type: 'notification',
          action_url: `/admin/alertas?type=notification_no_user`,
          count: orphaned.length,
        },
      });
    }

    return alerts;
  }

  async checkQuestionsUnanswered(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: questions } = await this.admin
      .from('listing_questions')
      .select('id, answer_text, created_at')
      .is('answer_text', null)
      .lt('created_at', sevenDaysAgo.toISOString());

    if (!questions) return alerts;

    for (const question of questions) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(question.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      alerts.push({
        alert_type: 'question_unanswered',
        severity: 'warning',
        title: `Pregunta sin responder`,
        description: `Pregunta ${question.id.slice(0, 8)}... sin responder hace ${daysAgo} días`,
        details: {
          entity_type: 'question',
          entity_id: question.id,
          action_url: `/dashboard/preguntas?question_id=${question.id}`,
          days_ago: daysAgo,
        },
      });
    }

    return alerts;
  }
}
```

---

## 4. API ENDPOINT PARA EJECUTAR DIAGNÓSTICO

### Archivo: `app/api/admin/monitoring/run/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DiagnosticService } from '@/lib/monitoring/diagnostic';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Verificar que es admin
    const admin = supabaseAdmin();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: adminUser } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Ejecutar diagnóstico
    const diagnostic = new DiagnosticService();
    const alerts = await diagnostic.runFullDiagnostic();
    
    // Guardar alertas
    await diagnostic.saveAlerts(alerts);

    // Resolver alertas que ya no aplican
    const activeAlertKeys = new Set(
      alerts.map(a => `${a.alert_type}:${a.details.entity_id || ''}`)
    );
    await diagnostic.resolveStaleAlerts(activeAlertKeys);

    return NextResponse.json({
      ok: true,
      alerts_found: alerts.length,
      alerts: alerts.map(a => ({
        type: a.alert_type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        action_url: a.details.action_url,
      })),
    });
  } catch (error: any) {
    console.error('[Monitoring] Error ejecutando diagnóstico:', error);
    return NextResponse.json(
      { error: error.message || 'Error ejecutando diagnóstico' },
      { status: 500 }
    );
  }
}

// GET para ejecutar diagnóstico manualmente desde el panel
export async function GET(req: NextRequest) {
  return POST(req);
}
```

---

## 5. API ENDPOINT PARA LISTAR ALERTAS

### Archivo: `app/api/admin/monitoring/alerts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Verificar que es admin
    const admin = supabaseAdmin();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: adminUser } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parámetros de consulta
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || 'active';
    const severity = searchParams.get('severity');
    const alertType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = admin
      .from('system_alerts')
      .select('*')
      .eq('status', status)
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data: alerts, error } = await query;

    if (error) {
      throw error;
    }

    // Contar totales
    const { count: totalCount } = await admin
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    const { count: criticalCount } = await admin
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('severity', 'critical');

    const { count: errorCount } = await admin
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('severity', 'error');

    const { count: warningCount } = await admin
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('severity', 'warning');

    return NextResponse.json({
      ok: true,
      alerts: alerts || [],
      totals: {
        active: totalCount || 0,
        critical: criticalCount || 0,
        error: errorCount || 0,
        warning: warningCount || 0,
      },
    });
  } catch (error: any) {
    console.error('[Monitoring] Error listando alertas:', error);
    return NextResponse.json(
      { error: error.message || 'Error listando alertas' },
      { status: 500 }
    );
  }
}
```

---

## 6. API ENDPOINT PARA ACTUALIZAR ALERTAS

### Archivo: `app/api/admin/monitoring/alerts/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    // Verificar que es admin
    const admin = supabaseAdmin();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data: adminUser } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !['acknowledged', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'acknowledged') {
      updateData.acknowledged_by = user.id;
      updateData.acknowledged_at = new Date().toISOString();
    } else if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await admin
      .from('system_alerts')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, alert: data });
  } catch (error: any) {
    console.error('[Monitoring] Error actualizando alerta:', error);
    return NextResponse.json(
      { error: error.message || 'Error actualizando alerta' },
      { status: 500 }
    );
  }
}
```

---

## 7. PANEL DE ALERTAS EN ADMIN

### Archivo: `app/admin/alertas/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type Alert = {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  details: any;
  action_url: string;
  status: string;
  detected_at: string;
  created_at: string;
};

type AlertTotals = {
  active: number;
  critical: number;
  error: number;
  warning: number;
};

export default function AdminAlertasPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [totals, setTotals] = useState<AlertTotals>({
    active: 0,
    critical: 0,
    error: 0,
    warning: 0,
  });
  const [filterStatus, setFilterStatus] = useState<'active' | 'acknowledged' | 'resolved' | 'dismissed'>('active');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  const loadAlerts = async () => {
    try {
      setError(null);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        window.location.href = '/login?returnTo=/admin/alertas';
        return;
      }

      const params = new URLSearchParams({
        status: filterStatus,
        limit: '100',
      });
      if (filterSeverity) params.set('severity', filterSeverity);

      const res = await fetch(`/api/admin/monitoring/alerts?${params}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'No se pudieron cargar alertas');

      setAlerts(json.alerts || []);
      setTotals(json.totals || totals);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error cargando alertas');
    } finally {
      setIsBooting(false);
    }
  };

  const runDiagnostic = async () => {
    try {
      setIsRunningDiagnostic(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/monitoring/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Error ejecutando diagnóstico');

      alert(`Diagnóstico completado. Se encontraron ${json.alerts_found} alertas.`);
      await loadAlerts();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const updateAlertStatus = async (alertId: string, status: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/admin/monitoring/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Error actualizando alerta');

      await loadAlerts();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  useEffect(() => {
    loadAlerts();
    // Ejecutar diagnóstico automáticamente cada 5 minutos
    const interval = setInterval(() => {
      runDiagnostic();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [filterStatus, filterSeverity]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'error': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const labels: Record<string, string> = {
      critical: 'Crítico',
      error: 'Error',
      warning: 'Advertencia',
      info: 'Info',
    };
    return labels[severity] || severity;
  };

  if (isBooting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand-pink border-t-transparent"></div>
          <p className="text-sm text-gray-600">Cargando alertas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sistema de Alertas</h1>
            <p className="mt-1 text-sm text-gray-600">Monitoreo y diagnóstico automático</p>
          </div>
          <button
            onClick={runDiagnostic}
            disabled={isRunningDiagnostic}
            className="rounded-xl bg-brand-pink px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {isRunningDiagnostic ? 'Ejecutando...' : 'Ejecutar Diagnóstico'}
          </button>
        </div>

        {/* Totals */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Activas</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{totals.active}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Críticas</div>
            <div className="mt-1 text-2xl font-bold text-red-600">{totals.critical}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Errores</div>
            <div className="mt-1 text-2xl font-bold text-red-500">{totals.error}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm text-gray-600">Advertencias</div>
            <div className="mt-1 text-2xl font-bold text-yellow-500">{totals.warning}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-pink"
          >
            <option value="active">Activas</option>
            <option value="acknowledged">Reconocidas</option>
            <option value="resolved">Resueltas</option>
            <option value="dismissed">Descartadas</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-pink"
          >
            <option value="">Todas las severidades</option>
            <option value="critical">Crítico</option>
            <option value="error">Error</option>
            <option value="warning">Advertencia</option>
            <option value="info">Info</option>
          </select>
        </div>

        {/* Alerts List */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
              <p className="text-gray-600">No hay alertas {filterStatus === 'active' ? 'activas' : 'con este filtro'}.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getSeverityColor(alert.severity)}`}>
                        {getSeverityBadge(alert.severity)}
                      </span>
                      <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{alert.description}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <Link
                        href={alert.action_url}
                        className="text-sm font-medium text-brand-pink hover:underline"
                      >
                        Ver detalles →
                      </Link>
                      <span className="text-xs text-gray-500">
                        Detectada: {new Date(alert.detected_at).toLocaleString('es-MX')}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    {alert.status === 'active' && (
                      <>
                        <button
                          onClick={() => updateAlertStatus(alert.id, 'acknowledged')}
                          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Reconocer
                        </button>
                        <button
                          onClick={() => updateAlertStatus(alert.id, 'resolved')}
                          className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          Resolver
                        </button>
                        <button
                          onClick={() => updateAlertStatus(alert.id, 'dismissed')}
                          className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Descartar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 8. INTEGRACIÓN CON DASHBOARD PRINCIPAL

### Modificar: `app/admin/page.tsx`

Agregar card de alertas en el dashboard:

```typescript
// En el array de kpis o cards
{
  label: 'Alertas del Sistema',
  value: totals?.system_alerts_active ?? '—',
  href: '/admin/alertas',
  alert: (totals?.system_alerts_critical ?? 0) > 0,
  highlight: (totals?.system_alerts_critical ?? 0) > 0,
}
```

---

## 9. CRON JOB / TAREA PROGRAMADA

### Opción A: API Route con Cron (Vercel Cron)

**Archivo: `app/api/cron/diagnostic/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { DiagnosticService } from '@/lib/monitoring/diagnostic';

export async function GET(req: NextRequest) {
  // Verificar que viene de Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const diagnostic = new DiagnosticService();
    const alerts = await diagnostic.runFullDiagnostic();
    await diagnostic.saveAlerts(alerts);

    const activeAlertKeys = new Set(
      alerts.map(a => `${a.alert_type}:${a.details.entity_id || ''}`)
    );
    await diagnostic.resolveStaleAlerts(activeAlertKeys);

    return NextResponse.json({
      ok: true,
      alerts_found: alerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Error en diagnóstico:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Archivo: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/diagnostic",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Opción B: Ejecución Manual desde Panel

Ya implementado en el panel de alertas con botón "Ejecutar Diagnóstico".

---

## 10. CHECKLIST DE IMPLEMENTACIÓN

### Base de Datos:
- [ ] Crear tabla `system_alerts` con todas las columnas
- [ ] Crear índices necesarios
- [ ] Configurar RLS policies

### Backend:
- [ ] Crear `lib/monitoring/diagnostic.ts` con todas las verificaciones
- [ ] Crear `app/api/admin/monitoring/run/route.ts`
- [ ] Crear `app/api/admin/monitoring/alerts/route.ts`
- [ ] Crear `app/api/admin/monitoring/alerts/[id]/route.ts`
- [ ] Crear `app/api/cron/diagnostic/route.ts` (opcional)

### Frontend:
- [ ] Crear `app/admin/alertas/page.tsx` con panel completo
- [ ] Agregar card de alertas en `app/admin/page.tsx`
- [ ] Agregar link en `components/admin/AdminTopMenu.tsx`

### Testing:
- [ ] Probar ejecución manual de diagnóstico
- [ ] Probar creación de alertas
- [ ] Probar actualización de estado de alertas
- [ ] Probar links a secciones específicas
- [ ] Probar resolución automática de alertas obsoletas

---

## 11. MEJORAS FUTURAS

### A. Notificaciones en Tiempo Real
- Usar Supabase Realtime para actualizar panel automáticamente
- Enviar notificaciones push cuando se detecten alertas críticas

### B. Historial de Alertas
- Mantener historial de alertas resueltas
- Gráficas de tendencias de alertas

### C. Alertas Personalizables
- Permitir a admins configurar umbrales (ej: días para considerar "stuck")
- Permitir deshabilitar ciertos tipos de alertas

### D. Acciones Automáticas
- Auto-resolver alertas cuando se corrige el problema manualmente
- Auto-marcar como "acknowledged" cuando admin visita el link

---

**Este prompt debe ser ejecutado por un agente de IA o desarrollador para implementar el sistema completo de monitoreo y diagnóstico automático.**
