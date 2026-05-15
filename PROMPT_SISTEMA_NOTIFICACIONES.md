# Prompt: Hacer que el Sistema de Notificaciones Funcione Completamente

## 🎯 Objetivo

Implementar y verificar que el sistema de notificaciones funcione completamente en la aplicación, asegurando que:
1. Las notificaciones se crean correctamente en la base de datos
2. Se muestran en tiempo real a los usuarios
3. Los usuarios pueden marcarlas como leídas
4. Las notificaciones redirigen correctamente
5. El contador de notificaciones no leídas funciona
6. El sistema funciona en todos los flujos críticos (compras, ventas, pagos, disputas, etc.)

---

## 📋 Checklist de Verificación

### 1. Base de Datos

- [ ] **Tabla `notifications` existe y tiene todas las columnas necesarias:**
  ```sql
  -- Verificar estructura
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications'
  ORDER BY ordinal_position;
  ```
  
  **Columnas requeridas:**
  - `id` (UUID, PK)
  - `user_id` (UUID, NOT NULL)
  - `type` (TEXT)
  - `title` (TEXT)
  - `body` (TEXT) - o `message` (compatibilidad)
  - `link_to` (TEXT, nullable)
  - `data` (JSONB, nullable)
  - `is_read` (BOOLEAN, default false)
  - `created_at` (TIMESTAMPTZ, default NOW())

- [ ] **Índices creados:**
  ```sql
  -- Verificar índices
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'notifications';
  ```
  
  **Índices necesarios:**
  - `notifications_user_created_idx` en `(user_id, created_at DESC)`
  - Índice en `is_read` WHERE `is_read = false`
  - Índice en `user_id`

- [ ] **RLS (Row Level Security) configurado:**
  ```sql
  -- Verificar políticas RLS
  SELECT policyname, permissive, roles, cmd, qual
  FROM pg_policies
  WHERE tablename = 'notifications';
  ```
  
  **Políticas necesarias:**
  - SELECT: Usuarios solo pueden leer sus propias notificaciones
  - UPDATE: Usuarios solo pueden actualizar sus propias notificaciones (marcar como leídas)
  - INSERT: Solo el sistema (service_role) puede insertar

- [ ] **Realtime habilitado:**
  ```sql
  -- Verificar que Realtime está habilitado
  SELECT * FROM pg_publication_tables WHERE tablename = 'notifications';
  ```
  
  Si no está habilitado, ejecutar en Supabase Dashboard:
  - Database → Replication → Habilitar para tabla `notifications`

---

### 2. Funciones y Servicios Backend

- [ ] **`insertNotificationBestEffort()` funciona correctamente:**
  - Ubicación: `lib/notifications/insertBestEffort.ts`
  - Verificar que maneja errores de columnas faltantes
  - Verificar que soporta compatibilidad `body`/`message`
  - Verificar que guarda `type` en `data.kind` para compatibilidad

- [ ] **`getNotificationLink()` genera links correctos:**
  - Ubicación: `lib/notifications/getNotificationLink.ts`
  - Verificar que genera links para todos los tipos de notificaciones:
    - `new_sale` → `/dashboard/ventas?order={orderId}`
    - `sale_paid` → `/dashboard/ventas?order={orderId}`
    - `payment_approved` → `/dashboard/compras?order={orderId}`
    - `payment_rejected` → `/pago/{checkoutId}`
    - `order_shipped` → `/dashboard/compras?order={orderId}`
    - `order_completed` → `/dashboard/compras?order={orderId}`
    - `listing_question` → `/productos/{listingId}`
    - `listing_answer` → `/productos/{listingId}`
    - `dispute_opened` → `/dashboard/compras?order={orderId}`
    - etc.

- [ ] **API `/api/notifications/list` funciona:**
  - Ubicación: `app/api/notifications/list/route.ts`
  - Verificar que:
    - Retorna notificaciones del usuario autenticado
    - Respeta el límite (default 50, max 200)
    - Calcula correctamente `unread_count`
    - Calcula correctamente `sales_unread_count`
    - Maneja errores de tabla faltante
    - Maneja errores de columnas faltantes (fallback)

- [ ] **API `/api/notifications/mark-read` funciona:**
  - Ubicación: `app/api/notifications/mark-read/route.ts`
  - Verificar que:
    - Marca notificaciones individuales como leídas (`{ ids: [...] }`)
    - Marca todas como leídas (`{ all: true }`)
    - Solo permite marcar notificaciones del usuario autenticado
    - Retorna éxito/error correctamente

- [ ] **Notificaciones se crean en todos los flujos críticos:**
  
  **Compras/Ventas:**
  - [ ] `new_sale` cuando se crea una orden (`/api/checkout/create`)
  - [ ] `sale_paid` cuando se confirma un pago (`/api/mercadopago/webhook`, `/api/admin/payments/offline/update`)
  - [ ] `payment_approved` cuando se aprueba un pago
  - [ ] `payment_rejected` cuando se rechaza un pago
  - [ ] `order_shipped` cuando se marca como enviado (`/api/orders/mark-shipped`)
  - [ ] `order_completed` cuando se completa una orden

  **Preguntas/Respuestas:**
  - [ ] `listing_question` cuando se hace una pregunta (`/api/questions/ask`)
  - [ ] `listing_answer` cuando se responde (`/api/questions/answer`)

  **Disputas:**
  - [ ] `dispute_opened` cuando se abre una disputa (`/api/disputes/open`)
  - [ ] `dispute_message` cuando hay mensajes en disputa

  **Admin:**
  - [ ] Notificaciones a admins sobre eventos importantes (`lib/notifications/admin.ts`)

---

### 3. Frontend - Componentes

- [ ] **`NotificationCenter` funciona:**
  - Ubicación: `components/NotificationCenter.tsx`
  - Verificar que:
    - Muestra el contador de notificaciones no leídas (badge rosa)
    - Abre/cierra el dropdown correctamente
    - Muestra las notificaciones no leídas
    - Marca como leída al hacer click
    - Redirige correctamente al hacer click
    - Se actualiza en tiempo real (Supabase Realtime)
    - Hace polling cada 15 segundos como respaldo
    - Maneja errores correctamente

- [ ] **`AccountTopMenu` muestra notificaciones:**
  - Ubicación: `components/AccountTopMenu.tsx`
  - Verificar que:
    - Muestra el contador en el menú
    - Muestra notificaciones en el dropdown
    - Marca como leídas correctamente
    - Redirige correctamente

- [ ] **Página `/dashboard/notificaciones` funciona:**
  - Ubicación: `app/dashboard/notificaciones/page.tsx`
  - Verificar que:
    - Muestra todas las notificaciones (no solo no leídas)
    - Permite marcar como leídas
    - Permite marcar todas como leídas
    - Muestra el tiempo relativo correctamente
    - Maneja estados de carga y error

- [ ] **`NotificationsPanel` funciona (si existe):**
  - Ubicación: `components/NotificationsPanel.tsx`
  - Verificar que muestra notificaciones recientes en el dashboard

---

### 4. Tiempo Real (Realtime)

- [ ] **Suscripción a cambios funciona:**
  ```typescript
  // En NotificationCenter.tsx
  supabase
    .channel(`notification-center-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, () => {
      // Recargar notificaciones
    })
    .subscribe();
  ```
  
  Verificar que:
  - Se suscribe correctamente cuando el usuario está autenticado
  - Se desuscribe cuando el componente se desmonta
  - Recarga las notificaciones cuando hay cambios
  - No causa memory leaks

- [ ] **Polling de respaldo funciona:**
  - Verificar que hace polling cada 15 segundos si Realtime falla
  - Verificar que no hace polling si Realtime funciona

---

### 5. Pruebas de Flujo Completo

#### Prueba 1: Compra y Venta
1. Usuario A compra un producto de Usuario B
2. Verificar que Usuario B recibe notificación `new_sale`
3. Usuario A paga (MercadoPago o offline)
4. Verificar que:
   - Usuario A recibe `payment_approved`
   - Usuario B recibe `sale_paid`
5. Usuario B marca como enviado
6. Verificar que Usuario A recibe `order_shipped`
7. Usuario A confirma recepción
8. Verificar que ambos reciben `order_completed`

#### Prueba 2: Preguntas y Respuestas
1. Usuario A hace una pregunta en un producto de Usuario B
2. Verificar que Usuario B recibe `listing_question`
3. Usuario B responde
4. Verificar que Usuario A recibe `listing_answer`

#### Prueba 3: Disputas
1. Usuario A abre una disputa
2. Verificar que:
   - Usuario A recibe confirmación
   - Admins reciben notificación (si está implementado)
3. Se envía un mensaje en la disputa
4. Verificar que ambos usuarios reciben `dispute_message`

#### Prueba 4: Tiempo Real
1. Abrir dos navegadores con diferentes usuarios
2. En un navegador, crear una notificación para el otro usuario
3. Verificar que la notificación aparece automáticamente en el otro navegador (sin refrescar)

---

## 🔧 Tareas de Implementación

### Si la tabla no existe o está incompleta:

1. **Ejecutar script SQL de creación:**
   ```sql
   -- Ver archivo: supabase_notifications.sql
   -- O ejecutar: CREAR_TODO_NOTIFICACIONES.sql
   ```

2. **Verificar estructura:**
   ```sql
   SELECT * FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'notifications';
   ```

3. **Crear índices si faltan:**
   ```sql
   CREATE INDEX IF NOT EXISTS notifications_user_created_idx
     ON public.notifications (user_id, created_at DESC);
   
   CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
     ON public.notifications (user_id)
     WHERE is_read = false;
   ```

4. **Configurar RLS:**
   ```sql
   ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
   
   -- Política de lectura
   CREATE POLICY "Users can read own notifications"
     ON public.notifications
     FOR SELECT
     TO authenticated
     USING (user_id = auth.uid());
   
   -- Política de actualización
   CREATE POLICY "Users can update own notifications"
     ON public.notifications
     FOR UPDATE
     TO authenticated
     USING (user_id = auth.uid())
     WITH CHECK (user_id = auth.uid());
   ```

5. **Habilitar Realtime:**
   - En Supabase Dashboard: Database → Replication
   - Habilitar para tabla `notifications`

### Si las notificaciones no se crean:

1. **Verificar que `insertNotificationBestEffort()` se llama:**
   - Buscar en el código donde deberían crearse notificaciones
   - Verificar que se está llamando con los parámetros correctos
   - Revisar logs en Vercel para ver errores

2. **Agregar logging:**
   ```typescript
   console.log('[NOTIFICATIONS] Intentando crear notificación:', {
     user_id: payload.user_id,
     type: payload.type,
     title: payload.title,
     body: payload.body,
   });
   ```

3. **Verificar permisos:**
   - Asegurar que se usa `supabaseAdmin()` para insertar
   - O que el usuario tiene permisos para insertar (si se usa RLS)

### Si las notificaciones no aparecen en el frontend:

1. **Verificar que el componente se renderiza:**
   - Verificar que `NotificationCenter` está en el layout
   - Verificar que el usuario está autenticado

2. **Verificar la API:**
   - Abrir DevTools → Network
   - Verificar que `/api/notifications/list` retorna datos
   - Verificar que no hay errores en la respuesta

3. **Verificar Realtime:**
   - Abrir DevTools → Console
   - Verificar que no hay errores de suscripción
   - Verificar que se reciben eventos `postgres_changes`

4. **Verificar estado del componente:**
   - Agregar `console.log` en `NotificationCenter` para ver el estado
   - Verificar que `rows` tiene datos
   - Verificar que `unreadCount` se calcula correctamente

### Si el contador no funciona:

1. **Verificar cálculo en backend:**
   ```typescript
   // En /api/notifications/list
   const unreadCount = await db
     .from('notifications')
     .select('id', { count: 'exact', head: true })
     .eq('user_id', uid)
     .eq('is_read', false);
   ```

2. **Verificar cálculo en frontend:**
   ```typescript
   // En NotificationCenter
   const unreadRows = rows.filter((r) => r.is_read === false);
   const badgeCount = unreadRows.length === 0 ? 0 : unreadCount;
   ```

3. **Verificar que se actualiza:**
   - Verificar que se actualiza cuando se marca como leída
   - Verificar que se actualiza cuando llega una nueva notificación

### Si los links no funcionan:

1. **Verificar `getNotificationLink()`:**
   - Revisar que todos los tipos tienen un caso
   - Verificar que extrae correctamente los IDs de `data`

2. **Probar links manualmente:**
   - Crear una notificación de prueba
   - Verificar que el link generado es correcto
   - Probar el link en el navegador

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Tabla notifications no existe"
**Solución:**
1. Ejecutar `supabase_notifications.sql` en Supabase SQL Editor
2. Verificar que la tabla se creó: `SELECT * FROM notifications LIMIT 1;`

### Problema 2: "Notificaciones no aparecen en tiempo real"
**Solución:**
1. Verificar que Realtime está habilitado en Supabase Dashboard
2. Verificar que la suscripción se crea correctamente
3. Verificar que no hay errores en la consola del navegador
4. Verificar que el polling de respaldo funciona (cada 15 segundos)

### Problema 3: "El contador muestra 0 pero hay notificaciones"
**Solución:**
1. Verificar que `is_read` está en `false` en la base de datos
2. Verificar que el cálculo de `unread_count` en la API es correcto
3. Verificar que el frontend usa el `unread_count` de la API, no solo cuenta las filas

### Problema 4: "Notificaciones duplicadas"
**Solución:**
1. Verificar que no se están creando múltiples veces en el mismo evento
2. Agregar logging para ver dónde se crean
3. Considerar agregar un índice único o verificación antes de insertar

### Problema 5: "Links no funcionan"
**Solución:**
1. Verificar que `getNotificationLink()` tiene casos para todos los tipos
2. Verificar que `data` contiene los IDs necesarios (orderId, listingId, etc.)
3. Probar los links manualmente

---

## ✅ Checklist Final

Antes de considerar el sistema completo, verificar:

- [ ] Tabla `notifications` existe con todas las columnas
- [ ] Índices creados correctamente
- [ ] RLS configurado correctamente
- [ ] Realtime habilitado
- [ ] `insertNotificationBestEffort()` funciona
- [ ] `getNotificationLink()` genera links correctos
- [ ] API `/api/notifications/list` funciona
- [ ] API `/api/notifications/mark-read` funciona
- [ ] Notificaciones se crean en todos los flujos críticos
- [ ] `NotificationCenter` muestra notificaciones
- [ ] Contador de no leídas funciona
- [ ] Tiempo real funciona (aparecen automáticamente)
- [ ] Marcar como leída funciona
- [ ] Links redirigen correctamente
- [ ] Pruebas de flujo completo pasan

---

## 📝 Notas Adicionales

- El sistema usa `insertNotificationBestEffort()` que maneja errores de columnas faltantes automáticamente
- El sistema soporta compatibilidad entre `body` y `message`
- El sistema guarda `type` en `data.kind` para compatibilidad con ENUMs
- El sistema hace polling cada 15 segundos como respaldo si Realtime falla
- El sistema usa `supabaseAdmin()` para insertar notificaciones (bypass RLS)
- Los usuarios solo pueden leer y actualizar sus propias notificaciones (RLS)

---

## 🚀 Siguiente Paso

Una vez que todo esté funcionando, considerar:
1. Agregar notificaciones push (FCM, OneSignal, etc.)
2. Agregar notificaciones por email
3. Agregar preferencias de notificaciones por usuario
4. Agregar agrupación de notificaciones similares
5. Agregar sonidos/vibración para notificaciones importantes
