# PROMPT: Sistema Completo de Notificaciones Integrado - GoPocket

## OBJETIVO PRINCIPAL

Crear un sistema de notificaciones completamente integrado que conecte:
1. **MI PANEL** → Sección de notificaciones (`/dashboard/notificaciones`)
2. **Campanita de notificaciones** → Componente `NotificationCenter` en el header
3. **Todas las operaciones, menús y submenús** de la aplicación
4. **Sistema de email** con formato profesional y logo de GoPocket
5. **Sistema de borrado automático** al ver notificaciones
6. **Sincronización en tiempo real** entre todos los componentes

---

## ARQUITECTURA ACTUAL (Base Existente)

### Componentes Existentes:
- ✅ Tabla `notifications` en Supabase (con `user_id`, `type`, `title`, `body`, `link_to`, `data`, `is_read`, `created_at`)
- ✅ `lib/notifications/service.ts` - Servicio principal `notify()`
- ✅ `lib/notifications/hooks.ts` - Hooks para push/email (actualmente stubs)
- ✅ `components/NotificationCenter.tsx` - Campanita en header
- ✅ `app/dashboard/notificaciones/page.tsx` - Página "Ver todas" en MI PANEL
- ✅ `components/NotificationsPanel.tsx` - Panel de notificaciones en dashboard
- ✅ `lib/email/send.ts` - Servicio de envío de emails transaccionales
- ✅ `lib/email/notify.ts` - Funciones de notificación por email
- ✅ API endpoints: `/api/notifications/list`, `/api/notifications/mark-read`, `/api/notifications/delete`

### Estructura de Datos:
```typescript
type NotificationPayload = {
  user_id: string;
  type: string; // Tipo de evento
  title: string;
  body: string;
  link_to?: string; // Ruta en la app
  data?: Record<string, any>; // Metadatos adicionales
};
```

---

## REQUERIMIENTOS ESPECÍFICOS

### 1. NOTIFICACIONES POR EVENTO

#### A. Subastas y Pujas
- **Cuando pierdes una puja** (`outbid`):
  - Tipo: `auction_outbid`
  - Destinatario: Usuario que fue superado
  - Mensaje: "Tu puja de $X fue superada. ¡Haz una nueva puja para ganar!"
  - Link: `/subastas/[auction_id]`
  - Email: "Tu puja fue superada - GoPocket"

- **Cuando está por finalizar una subasta** (`auction_ending_soon`):
  - Tipo: `auction_ending_soon`
  - Destinatario: Todos los pujadores activos
  - Mensaje: "La subasta '[título]' finaliza en [X] minutos. ¡No pierdas tu oportunidad!"
  - Link: `/subastas/[auction_id]`
  - Email: "Subasta finalizando pronto - GoPocket"
  - Trigger: 30 minutos antes, 15 minutos antes, 5 minutos antes

- **Cuando ganas una subasta** (`auction_won`):
  - Tipo: `auction_won`
  - Destinatario: Ganador
  - Mensaje: "¡Felicidades! Ganaste la subasta '[título]' por $X. Procede al pago."
  - Link: `/dashboard/compras?order=[order_id]`
  - Email: "¡Ganaste una subasta! - GoPocket"

- **Cuando pierdes una subasta** (`auction_lost`):
  - Tipo: `auction_lost`
  - Destinatario: Perdedores
  - Mensaje: "La subasta '[título]' finalizó. Otro usuario ganó con $X."
  - Link: `/subastas/[auction_id]`
  - Email: "Subasta finalizada - GoPocket"

#### B. Compras y Ventas
- **Cuando un usuario compra** (`purchase_made`):
  - Tipo: `purchase_made`
  - Destinatario: Comprador
  - Mensaje: "Compra realizada: '[producto]' por $X. Revisa los detalles de tu pedido."
  - Link: `/dashboard/compras?order=[order_id]`
  - Email: "Compra confirmada - GoPocket"

- **Cuando un usuario vende** (`sale_made`):
  - Tipo: `sale_made`
  - Destinatario: Vendedor
  - Mensaje: "¡Venta realizada! '[producto]' vendido por $X. Prepara el envío."
  - Link: `/dashboard/ventas?order=[order_id]`
  - Email: "Nueva venta - GoPocket"

#### C. Pagos
- **Cuando se acredita un pago** (`payment_credited`):
  - Tipo: `payment_credited`
  - Destinatarios: Comprador Y Vendedor
  - Mensaje Comprador: "Pago acreditado: Tu compra de '[producto]' está confirmada. El vendedor preparará el envío."
  - Mensaje Vendedor: "Pago recibido: $X acreditado por la venta de '[producto]'. Procede con el envío."
  - Link Comprador: `/dashboard/compras?order=[order_id]`
  - Link Vendedor: `/dashboard/ventas?order=[order_id]`
  - Email: "Pago acreditado - GoPocket"

- **Cuando un pago es rechazado** (`payment_rejected`):
  - Tipo: `payment_rejected`
  - Destinatario: Comprador
  - Mensaje: "Pago rechazado: Tu pago de $X fue rechazado. Revisa tu método de pago."
  - Link: `/dashboard/compras?order=[order_id]`
  - Email: "Pago rechazado - GoPocket"

#### D. Preguntas y Respuestas
- **Cuando un usuario hace una pregunta** (`listing_question`):
  - Tipo: `listing_question`
  - Destinatario: Vendedor
  - Mensaje: "[Usuario] preguntó sobre '[producto]': '[pregunta]'"
  - Link: `/dashboard/ventas?listing=[listing_id]&question=[question_id]`
  - Email: "Nueva pregunta en tu publicación - GoPocket"

- **Cuando el vendedor responde** (`listing_answer`):
  - Tipo: `listing_answer`
  - Destinatario: Comprador (quien hizo la pregunta)
  - Mensaje: "El vendedor respondió tu pregunta sobre '[producto]': '[respuesta]'"
  - Link: `/productos/[listing_id]`
  - Email: "Respuesta a tu pregunta - GoPocket"

#### E. Disputas
- **Cuando se abre una disputa** (`dispute_opened`):
  - Tipo: `dispute_opened`
  - Destinatarios: Comprador Y Vendedor
  - Mensaje Comprador: "Disputa abierta: Tu disputa sobre '[producto]' está en revisión."
  - Mensaje Vendedor: "Disputa recibida: Un comprador abrió una disputa sobre '[producto]'."
  - Link: `/dashboard/disputas?dispute=[dispute_id]`
  - Email: "Disputa abierta - GoPocket"

- **Cuando se resuelve una disputa** (`dispute_resolved`):
  - Tipo: `dispute_resolved`
  - Destinatarios: Comprador Y Vendedor
  - Mensaje: "Disputa resuelta: La disputa sobre '[producto]' ha sido resuelta. [Resultado]"
  - Link: `/dashboard/disputas?dispute=[dispute_id]`
  - Email: "Disputa resuelta - GoPocket"

- **Nuevo mensaje en disputa** (`dispute_message`):
  - Tipo: `dispute_message`
  - Destinatario: Parte contraria
  - Mensaje: "Nuevo mensaje en disputa sobre '[producto]'"
  - Link: `/dashboard/disputas?dispute=[dispute_id]`
  - Email: "Nuevo mensaje en disputa - GoPocket"

#### F. Envíos y Logística
- **Cuando se marca como enviado** (`order_shipped`):
  - Tipo: `order_shipped`
  - Destinatario: Comprador
  - Mensaje: "¡Tu pedido '[producto]' ha sido enviado! Código de rastreo: [tracking]"
  - Link: `/dashboard/compras?order=[order_id]`
  - Email: "Tu pedido ha sido enviado - GoPocket"

- **Cuando el pedido es entregado** (`order_delivered`):
  - Tipo: `order_delivered`
  - Destinatario: Comprador
  - Mensaje: "¡Tu pedido '[producto]' ha sido entregado! Califica tu experiencia."
  - Link: `/dashboard/compras?order=[order_id]`
  - Email: "Pedido entregado - GoPocket"

#### G. Panel de Administración
- **Notificaciones para administradores**:
  - Tipo: `admin_alert`
  - Destinatario: Administradores
  - Eventos: Nuevas disputas, pagos pendientes, usuarios reportados, etc.
  - Link: `/admin/[seccion]`
  - Email: "Alerta de administración - GoPocket"

---

## 2. INTEGRACIÓN CON COMPONENTES

### A. NotificationCenter (Campanita)
**Archivo:** `components/NotificationCenter.tsx`

**Mejoras requeridas:**
1. ✅ Ya existe y funciona
2. **Agregar sincronización en tiempo real** con Supabase Realtime:
   ```typescript
   // Suscripción a cambios en tiempo real
   const channel = supabase
     .channel('notifications')
     .on('postgres_changes', {
       event: '*',
       schema: 'public',
       table: 'notifications',
       filter: `user_id=eq.${userId}`
     }, (payload) => {
       // Actualizar lista y contador
       load(userId);
       // Disparar evento global
       window.dispatchEvent(new CustomEvent('notifications-updated', { 
         detail: { source: 'realtime' } 
       }));
     })
     .subscribe();
   ```

3. **Al hacer clic en notificación:**
   - Marcar como leída automáticamente
   - Navegar al `link_to` si existe
   - Cerrar el dropdown

4. **Agregar botón "Marcar todas como leídas"** en el dropdown

### B. Página de Notificaciones en MI PANEL
**Archivo:** `app/dashboard/notificaciones/page.tsx`

**Mejoras requeridas:**
1. ✅ Ya existe y funciona
2. **Agregar filtros por tipo:**
   - Todas
   - Compras
   - Ventas
   - Subastas
   - Preguntas
   - Disputas
   - Pagos
   - Envíos

3. **Agregar botón de borrado:**
   - "Borrar todas las leídas"
   - "Borrar todas"
   - Botón individual de borrado en cada notificación

4. **Sincronización en tiempo real** (igual que NotificationCenter)

5. **Agregar paginación** para notificaciones antiguas

### C. NotificationsPanel (Panel en Dashboard)
**Archivo:** `components/NotificationsPanel.tsx`

**Mejoras requeridas:**
1. ✅ Ya existe y funciona
2. **Sincronización en tiempo real**
3. **Auto-refresh** cada 30 segundos
4. **Link directo** a la página completa de notificaciones

---

## 3. SISTEMA DE EMAIL

### A. Template de Email con Logo GoPocket
**Archivo:** `lib/email/templates/notification.ts`

**Crear template HTML profesional:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <!-- Header con logo -->
    <div style="background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%); padding: 30px; text-align: center;">
      <img src="[LOGO_URL]" alt="GoPocket" style="max-width: 200px; height: auto;">
    </div>
    
    <!-- Contenido -->
    <div style="padding: 30px;">
      <h1 style="color: #111827; font-size: 24px; margin: 0 0 20px 0;">{{title}}</h1>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">{{body}}</p>
      
      <!-- Botón CTA -->
      {{#if link_to}}
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{link_to}}" style="display: inline-block; background-color: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver detalles</a>
      </div>
      {{/if}}
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        © 2025 GoPocket. Todos los derechos reservados.<br>
        <a href="{{unsubscribe_link}}" style="color: #ec4899;">Gestionar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>
```

### B. Integración con Hooks de Notificaciones
**Archivo:** `lib/notifications/hooks.ts`

**Reemplazar stubEmail con implementación real:**
```typescript
import { sendTransactionalEmail } from '@/lib/email/send';
import { renderNotificationEmail } from '@/lib/email/templates/notification';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function sendNotificationEmail(event: NotificationEvent) {
  try {
    // Obtener email del usuario
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(event.user_id);
    if (!user?.user?.email) {
      console.warn('[notifications] No email for user', event.user_id);
      return;
    }

    // Renderizar template
    const html = renderNotificationEmail({
      title: event.title,
      body: event.body,
      link_to: event.link_to,
      logo_url: process.env.NEXT_PUBLIC_APP_URL + '/logo-gopocket.png',
      unsubscribe_link: process.env.NEXT_PUBLIC_APP_URL + '/dashboard/configuracion?tab=notificaciones'
    });

    // Enviar email
    await sendTransactionalEmail({
      to: user.user.email,
      subject: event.title,
      html,
      text: event.body // Versión texto plano
    });

    console.log('[notifications] Email sent', { user_id: event.user_id, type: event.type });
  } catch (e) {
    console.error('[notifications] Email error', e);
  }
}

export function registerDefaultNotificationHooks() {
  setNotificationHooks({
    onPush: stubPush, // TODO: Implementar push notifications
    onEmail: sendNotificationEmail, // ✅ Implementado
  });
}
```

### C. Template Renderer
**Archivo:** `lib/email/templates/notification.ts`

```typescript
export function renderNotificationEmail(data: {
  title: string;
  body: string;
  link_to?: string;
  logo_url: string;
  unsubscribe_link: string;
}): string {
  // Implementar renderizado del template HTML
  // Usar replace o una librería de templates
}
```

---

## 4. SISTEMA DE BORRADO AUTOMÁTICO

### A. Marcar como Leída = Borrar después de X días
**Estrategia:**
- Cuando una notificación se marca como leída, agregar timestamp `read_at`
- Crear job/cron que elimine notificaciones leídas después de 30 días
- O eliminar inmediatamente si el usuario lo prefiere (configuración)

### B. API de Borrado
**Archivo:** `app/api/notifications/delete/route.ts`

**Ya existe, mejorar:**
1. ✅ Borrado individual
2. ✅ Borrado masivo
3. **Agregar:** Borrado automático al marcar como leída (opcional, configurable)

### C. Sincronización de Borrado
Cuando se borra una notificación:
1. Actualizar contador en NotificationCenter
2. Actualizar lista en página de notificaciones
3. Actualizar NotificationsPanel
4. Disparar evento global: `window.dispatchEvent(new CustomEvent('notifications-updated'))`

---

## 5. INTEGRACIÓN CON OPERACIONES DE LA APP

### A. Puntos de Integración Requeridos

#### 1. **API de Órdenes** (`app/api/orders/*`)
- ✅ Ya existe integración en webhook de MercadoPago
- **Agregar notificaciones en:**
  - Creación de orden → `purchase_made` (comprador) + `sale_made` (vendedor)
  - Pago acreditado → `payment_credited` (ambos)
  - Pago rechazado → `payment_rejected` (comprador)
  - Orden cancelada → `order_cancelled` (ambos)

#### 2. **API de Preguntas** (`app/api/questions/*`)
- ✅ Ya existe en `app/api/questions/answer/route.ts`
- **Agregar notificaciones en:**
  - Nueva pregunta → `listing_question` (vendedor)
  - Respuesta → `listing_answer` (comprador)

#### 3. **API de Subastas** (`app/api/auctions/*`, `app/api/bids/*`)
- **Crear/mejorar notificaciones en:**
  - Nueva puja → `bid_placed` (vendedor)
  - Puja superada → `auction_outbid` (pujador anterior)
  - Subasta finalizando → `auction_ending_soon` (todos los pujadores)
  - Subasta finalizada → `auction_won` (ganador) + `auction_lost` (perdedores)

#### 4. **API de Disputas** (`app/api/disputes/*`)
- **Agregar notificaciones en:**
  - Disputa abierta → `dispute_opened` (ambos)
  - Nuevo mensaje → `dispute_message` (parte contraria)
  - Disputa resuelta → `dispute_resolved` (ambos)

#### 5. **API de Envíos** (`app/api/orders/mark-shipped`)
- ✅ Ya existe
- **Mejorar notificaciones:**
  - Envío marcado → `order_shipped` (comprador)
  - Pedido entregado → `order_delivered` (comprador)

#### 6. **Panel de Administración**
- **Agregar notificaciones para admins:**
  - Nueva disputa → `admin_dispute_new`
  - Pago pendiente → `admin_payment_pending`
  - Usuario reportado → `admin_user_reported`

---

## 6. SINCRONIZACIÓN EN TIEMPO REAL

### A. Supabase Realtime
**Implementar en todos los componentes:**

```typescript
useEffect(() => {
  if (!userId) return;
  
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      console.log('[Realtime] Notification change', payload);
      // Recargar notificaciones
      loadNotifications();
      // Disparar evento global
      window.dispatchEvent(new CustomEvent('notifications-updated', {
        detail: { source: 'realtime', event: payload.eventType }
      }));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);
```

### B. Eventos Globales
**Sistema de eventos para sincronización:**

```typescript
// Cuando se marca como leída
window.dispatchEvent(new CustomEvent('notifications-updated', {
  detail: { source: 'mark-read', ids: [id] }
}));

// Cuando se borra
window.dispatchEvent(new CustomEvent('notifications-updated', {
  detail: { source: 'delete', ids: [id] }
}));

// Escuchar en todos los componentes
window.addEventListener('notifications-updated', (e) => {
  const { source } = (e as CustomEvent).detail;
  if (source !== 'this-component') {
    reloadNotifications();
  }
});
```

---

## 7. CONFIGURACIÓN DE USUARIO

### A. Preferencias de Notificaciones
**Agregar en perfil/configuración:**
- Activar/desactivar notificaciones por email
- Activar/desactivar notificaciones push
- Activar/desactivar por tipo (compras, ventas, subastas, etc.)
- Borrado automático: inmediato, 7 días, 30 días, nunca

### B. Tabla de Preferencias
```sql
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  email_types JSONB DEFAULT '{}', -- { "purchase_made": true, "sale_made": true, ... }
  auto_delete_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. NOTIFICACIONES ADICIONALES ÚTILES

### A. Recordatorios
- **Recordatorio de calificación:** "Califica tu compra de '[producto]'"
- **Recordatorio de envío:** "Recuerda enviar '[producto]' antes de [fecha]"
- **Recordatorio de pago:** "Completa el pago de tu compra antes de [fecha]"

### B. Promociones y Ofertas
- **Oferta especial:** "¡Oferta especial en '[categoría]'!"
- **Producto en favoritos:** "El precio de '[producto]' bajó $X"
- **Nuevo producto del vendedor:** "Nuevo producto de [vendedor]"

### C. Seguridad
- **Login desde nuevo dispositivo**
- **Cambio de contraseña**
- **Verificación de email completada**

---

## 9. IMPLEMENTACIÓN PASO A PASO

### Fase 1: Base de Datos y Servicio
1. ✅ Verificar tabla `notifications` (ya existe)
2. Crear tabla `user_notification_preferences`
3. Mejorar `lib/notifications/service.ts` si es necesario
4. Implementar hook de email real en `lib/notifications/hooks.ts`

### Fase 2: Templates de Email
1. Crear `lib/email/templates/notification.ts`
2. Agregar logo de GoPocket a `/public/logo-gopocket.png`
3. Probar envío de emails de prueba

### Fase 3: Integración con Operaciones
1. Agregar notificaciones en API de órdenes
2. Agregar notificaciones en API de subastas/pujas
3. Agregar notificaciones en API de preguntas (ya existe, verificar)
4. Agregar notificaciones en API de disputas
5. Agregar notificaciones en API de envíos

### Fase 4: UI y Sincronización
1. Mejorar `NotificationCenter` con Realtime
2. Mejorar página de notificaciones con filtros y borrado
3. Mejorar `NotificationsPanel` con Realtime
4. Implementar eventos globales de sincronización

### Fase 5: Configuración y Preferencias
1. Crear página de configuración de notificaciones
2. Implementar preferencias de usuario
3. Agregar borrado automático configurable

### Fase 6: Testing y Optimización
1. Probar todas las notificaciones
2. Probar envío de emails
3. Probar sincronización en tiempo real
4. Optimizar rendimiento

---

## 10. ARCHIVOS A CREAR/MODIFICAR

### Nuevos Archivos:
1. `lib/email/templates/notification.ts` - Template de email
2. `app/dashboard/configuracion/page.tsx` (o mejorar existente) - Configuración de notificaciones
3. `lib/notifications/preferences.ts` - Gestión de preferencias
4. `app/api/notifications/preferences/route.ts` - API de preferencias

### Archivos a Modificar:
1. `lib/notifications/hooks.ts` - Implementar email real
2. `components/NotificationCenter.tsx` - Agregar Realtime
3. `app/dashboard/notificaciones/page.tsx` - Agregar filtros y borrado
4. `components/NotificationsPanel.tsx` - Agregar Realtime
5. `app/api/orders/*` - Agregar notificaciones
6. `app/api/auctions/*` - Agregar notificaciones
7. `app/api/bids/*` - Agregar notificaciones
8. `app/api/disputes/*` - Agregar notificaciones
9. `app/api/questions/answer/route.ts` - Verificar/mejorar notificaciones

---

## 11. SQL ADICIONAL REQUERIDO

```sql
-- Tabla de preferencias de notificaciones
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_types JSONB NOT NULL DEFAULT '{}',
  auto_delete_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS user_notification_preferences_user_id_idx 
  ON user_notification_preferences(user_id);

-- RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own preferences" ON user_notification_preferences;
CREATE POLICY "Users can manage own preferences"
  ON user_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Agregar columna read_at a notifications (opcional, para borrado diferido)
ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Función para limpiar notificaciones leídas antiguas
CREATE OR REPLACE FUNCTION cleanup_old_read_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
    AND read_at IS NOT NULL
    AND read_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

---

## 12. CHECKLIST DE IMPLEMENTACIÓN

### Backend:
- [ ] Implementar hook de email real
- [ ] Crear template de email con logo
- [ ] Agregar notificaciones en API de órdenes
- [ ] Agregar notificaciones en API de subastas
- [ ] Agregar notificaciones en API de pujas
- [ ] Agregar notificaciones en API de disputas
- [ ] Agregar notificaciones en API de preguntas (verificar)
- [ ] Agregar notificaciones en API de envíos
- [ ] Crear tabla de preferencias
- [ ] Crear API de preferencias

### Frontend:
- [ ] Mejorar NotificationCenter con Realtime
- [ ] Agregar filtros en página de notificaciones
- [ ] Agregar borrado en página de notificaciones
- [ ] Mejorar NotificationsPanel con Realtime
- [ ] Implementar eventos globales
- [ ] Crear página de configuración

### Testing:
- [ ] Probar todas las notificaciones
- [ ] Probar envío de emails
- [ ] Probar sincronización en tiempo real
- [ ] Probar borrado automático
- [ ] Probar preferencias de usuario

---

## NOTAS FINALES

- **Prioridad:** Implementar primero las notificaciones críticas (compras, ventas, pagos)
- **Email:** Usar el servicio existente `lib/email/send.ts` que ya está configurado
- **Realtime:** Usar Supabase Realtime para sincronización automática
- **Performance:** Implementar paginación y límites en las consultas
- **UX:** Las notificaciones deben ser claras, accionables y con links directos

---

**Este prompt debe ser ejecutado por un agente de IA o desarrollador para implementar el sistema completo de notificaciones integrado.**
