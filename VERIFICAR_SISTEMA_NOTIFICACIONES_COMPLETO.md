# ✅ Verificación Completa: Sistema de Notificaciones

## 📋 Checklist de Verificación

### 1. Base de Datos ✅

#### Ejecutar Script SQL

**Paso 1:** Ejecuta el script completo en Supabase SQL Editor:

```sql
-- Ejecuta este archivo:
EJECUTAR_SISTEMA_NOTIFICACIONES_COMPLETO.sql
```

**Paso 2:** Verifica que se creó correctamente:

```sql
-- Verificar estructura de tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Deberías ver estas columnas:
-- id, user_id, type, title, body, link_to, data, is_read, created_at
```

**Paso 3:** Verificar índices:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notifications';

-- Deberías ver al menos:
-- notifications_user_created_idx
-- notifications_user_unread_idx
```

**Paso 4:** Verificar RLS:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'notifications';

-- Deberías ver:
-- "Users can read own notifications" (SELECT)
-- "Users can update own notifications" (UPDATE)
```

**Paso 5:** Habilitar Realtime (desde Supabase Dashboard):

1. Ve a **Database → Replication**
2. Busca la tabla `notifications`
3. Habilita **Realtime** para esta tabla
4. Guarda los cambios

---

### 2. Funciones Backend ✅

#### Verificar `insertNotificationBestEffort()`

**Ubicación:** `lib/notifications/insertBestEffort.ts`

**Funcionalidades verificadas:**
- ✅ Maneja errores de columnas faltantes
- ✅ Soporta compatibilidad `body`/`message`
- ✅ Guarda `type` en `data.kind` para compatibilidad
- ✅ Logging detallado de intentos y errores

#### Verificar `getNotificationLink()`

**Ubicación:** `lib/notifications/getNotificationLink.ts`

**Tipos soportados verificados:**
- ✅ `new_sale` → `/dashboard/ventas?order={orderId}`
- ✅ `sale_paid` → `/dashboard/ventas?order={orderId}`
- ✅ `payment_approved` → `/dashboard/compras?order={orderId}`
- ✅ `payment_rejected` → `/pago/{checkoutId}`
- ✅ `order_shipped` → `/dashboard/compras?order={orderId}`
- ✅ `order_completed` → `/dashboard/compras?order={orderId}`
- ✅ `listing_question` → `/listings/{listingId}`
- ✅ `listing_answer` → `/listings/{listingId}`
- ✅ `dispute_opened` → `/dashboard/compras?order={orderId}`
- ✅ Y más...

#### Verificar API `/api/notifications/list`

**Ubicación:** `app/api/notifications/list/route.ts`

**Funcionalidades verificadas:**
- ✅ Retorna notificaciones del usuario autenticado
- ✅ Respeta el límite (default 50, max 200)
- ✅ Calcula correctamente `unread_count`
- ✅ Calcula correctamente `sales_unread_count`
- ✅ Maneja errores de tabla faltante
- ✅ Maneja errores de columnas faltantes (fallback)

#### Verificar API `/api/notifications/mark-read`

**Ubicación:** `app/api/notifications/mark-read/route.ts`

**Funcionalidades verificadas:**
- ✅ Marca notificaciones individuales como leídas (`{ ids: [...] }`)
- ✅ Marca todas como leídas (`{ all: true }`)
- ✅ Solo permite marcar notificaciones del usuario autenticado
- ✅ Retorna éxito/error correctamente

---

### 3. Flujos Críticos - Verificación de Notificaciones

#### ✅ Compra y Venta

**Flujo esperado:**
1. Usuario A compra producto de Usuario B
2. **Verificar:** Usuario B recibe `new_sale`
3. Usuario A paga (MercadoPago o offline)
4. **Verificar:**
   - Usuario A recibe `payment_approved`
   - Usuario B recibe `sale_paid`
5. Usuario B marca como enviado
6. **Verificar:** Usuario A recibe `order_shipped`
7. Usuario A confirma recepción
8. **Verificar:** Ambos reciben `order_completed`

**Archivos a verificar:**
- `app/api/checkout/create/route.ts` - Crea `new_sale` para vendedor
- `app/api/mercadopago/webhook/route.ts` - Crea `payment_approved` y `sale_paid`
- `app/api/admin/payments/offline/update/route.ts` - Crea `payment_approved` y `sale_paid`
- `app/api/orders/mark-shipped/route.ts` - Crea `order_shipped`
- `app/api/orders/confirm-received/route.ts` - Crea `order_completed`

#### ✅ Preguntas y Respuestas

**Flujo esperado:**
1. Usuario A hace pregunta en producto de Usuario B
2. **Verificar:** Usuario B recibe `listing_question`
3. Usuario B responde
4. **Verificar:** Usuario A recibe `listing_answer`

**Archivos a verificar:**
- `app/api/questions/ask/route.ts` - Crea `listing_question`
- `app/api/questions/answer/route.ts` - Crea `listing_answer`

#### ✅ Disputas

**Flujo esperado:**
1. Usuario A abre disputa
2. **Verificar:**
   - Usuario A recibe confirmación
   - Usuario B recibe `dispute_opened`
   - Admins reciben notificación (si está implementado)
3. Se envía mensaje en disputa
4. **Verificar:** Ambos usuarios reciben `dispute_message`

**Archivos a verificar:**
- `app/api/disputes/open/route.ts` - Crea `dispute_opened`
- `app/api/disputes/messages/route.ts` - Crea `dispute_message`

---

### 4. Frontend - Componentes

#### ✅ NotificationCenter

**Ubicación:** `components/NotificationCenter.tsx`

**Funcionalidades verificadas:**
- ✅ Muestra contador de notificaciones no leídas (badge rosa)
- ✅ Abre/cierra dropdown correctamente
- ✅ Muestra notificaciones no leídas
- ✅ Marca como leída al hacer click
- ✅ Redirige correctamente al hacer click
- ✅ Se actualiza en tiempo real (Supabase Realtime)
- ✅ Hace polling cada 15 segundos como respaldo
- ✅ Maneja errores correctamente

**Verificar en el código:**
- Línea 137-146: Suscripción Realtime configurada
- Línea 141: Polling de respaldo cada 15 segundos
- Línea 167-182: Función `markRead` implementada
- Línea 184-199: Función `markAllRead` implementada
- Línea 201-214: Función `onItemClick` con redirección

#### ✅ Página `/dashboard/notificaciones`

**Ubicación:** `app/dashboard/notificaciones/page.tsx`

**Funcionalidades a verificar:**
- ✅ Muestra todas las notificaciones (no solo no leídas)
- ✅ Permite marcar como leídas
- ✅ Permite marcar todas como leídas
- ✅ Muestra tiempo relativo correctamente
- ✅ Maneja estados de carga y error

---

### 5. Pruebas de Flujo Completo

#### Prueba 1: Compra y Venta Completa

**Pasos:**
1. Como Usuario A, agrega productos al carrito
2. Completa checkout (puede ser pago offline para prueba rápida)
3. **Verificar en Supabase:**
   ```sql
   SELECT * FROM notifications 
   WHERE user_id = 'USER_B_ID' 
   AND type = 'new_sale'
   ORDER BY created_at DESC LIMIT 1;
   ```
4. Como Admin, confirma pago offline (si aplica)
5. **Verificar en Supabase:**
   ```sql
   SELECT * FROM notifications 
   WHERE user_id IN ('USER_A_ID', 'USER_B_ID')
   AND type IN ('payment_approved', 'sale_paid')
   ORDER BY created_at DESC;
   ```
6. Como Usuario B, marca como enviado
7. **Verificar:** Usuario A recibe `order_shipped` en su panel

**Verificar en Frontend:**
- Abrir `/dashboard/ventas` como Usuario B → Debería ver la venta
- Abrir `/dashboard/compras` como Usuario A → Debería ver la compra
- Abrir NotificationCenter → Debería ver notificaciones

#### Prueba 2: Tiempo Real

**Pasos:**
1. Abrir dos navegadores con diferentes usuarios
2. En un navegador, crear una notificación para el otro usuario (usando API de test o haciendo una acción)
3. **Verificar:** La notificación aparece automáticamente en el otro navegador (sin refrescar)

**API de Test:**
```bash
# POST /api/notifications/test
# Body: { userId: "user-id", title: "Test", body: "Mensaje de prueba" }
```

#### Prueba 3: Contador de No Leídas

**Pasos:**
1. Crear varias notificaciones para un usuario
2. **Verificar:** El contador muestra el número correcto
3. Marcar una como leída
4. **Verificar:** El contador disminuye
5. Marcar todas como leídas
6. **Verificar:** El contador muestra 0

---

## 🔧 Solución de Problemas

### Problema 1: "Tabla notifications no existe"

**Solución:**
1. Ejecuta `EJECUTAR_SISTEMA_NOTIFICACIONES_COMPLETO.sql` en Supabase SQL Editor
2. Verifica que se creó: `SELECT * FROM notifications LIMIT 1;`

### Problema 2: "Notificaciones no aparecen en tiempo real"

**Solución:**
1. Verifica que Realtime está habilitado en Supabase Dashboard
2. Verifica que la suscripción se crea correctamente (consola del navegador)
3. Verifica que no hay errores en la consola
4. Verifica que el polling de respaldo funciona (cada 15 segundos)

### Problema 3: "El contador muestra 0 pero hay notificaciones"

**Solución:**
1. Verifica que `is_read` está en `false` en la base de datos:
   ```sql
   SELECT id, is_read FROM notifications WHERE user_id = 'USER_ID' LIMIT 10;
   ```
2. Verifica que el cálculo de `unread_count` en la API es correcto
3. Verifica que el frontend usa el `unread_count` de la API

### Problema 4: "Links no funcionan"

**Solución:**
1. Verifica que `getNotificationLink()` tiene casos para todos los tipos
2. Verifica que `data` contiene los IDs necesarios (orderId, listingId, etc.)
3. Verifica que `link_to` está guardado en la base de datos:
   ```sql
   SELECT id, type, link_to, data FROM notifications WHERE link_to IS NOT NULL LIMIT 10;
   ```

### Problema 5: "Notificaciones duplicadas"

**Solución:**
1. Verifica que no se están creando múltiples veces en el mismo evento
2. Revisa los logs en Vercel para ver dónde se crean
3. Considera agregar verificación antes de insertar

---

## 📊 Queries SQL de Verificación

### Verificar estructura completa

```sql
-- Ver todas las columnas
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
ORDER BY ordinal_position;
```

### Verificar notificaciones recientes

```sql
-- Ver últimas 10 notificaciones
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  link_to,
  is_read,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;
```

### Verificar contador de no leídas

```sql
-- Contar notificaciones no leídas por usuario
SELECT 
  user_id,
  COUNT(*) as unread_count
FROM notifications
WHERE is_read = false
GROUP BY user_id
ORDER BY unread_count DESC;
```

### Verificar tipos de notificaciones

```sql
-- Contar notificaciones por tipo
SELECT 
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as unread
FROM notifications
GROUP BY type
ORDER BY total DESC;
```

---

## ✅ Checklist Final

Antes de considerar el sistema completo, verificar:

- [ ] Tabla `notifications` existe con todas las columnas (incluyendo `link_to`)
- [ ] Índices creados correctamente
- [ ] RLS configurado correctamente
- [ ] Realtime habilitado en Supabase Dashboard
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

## 🚀 Próximos Pasos

1. **Ejecutar SQL:**
   - Ejecuta `EJECUTAR_SISTEMA_NOTIFICACIONES_COMPLETO.sql` en Supabase

2. **Habilitar Realtime:**
   - Ve a Supabase Dashboard → Database → Replication
   - Habilita Realtime para tabla `notifications`

3. **Probar Flujos:**
   - Haz una compra de prueba
   - Verifica que aparecen notificaciones
   - Verifica que el contador funciona
   - Verifica que los links funcionan

4. **Monitorear:**
   - Revisa logs en Vercel para ver si hay errores
   - Revisa la consola del navegador para errores de Realtime
   - Verifica que las notificaciones se crean correctamente

---

## 📝 Notas Técnicas

- El sistema usa `insertNotificationBestEffort()` que maneja errores de columnas faltantes automáticamente
- El sistema soporta compatibilidad entre `body` y `message`
- El sistema guarda `type` en `data.kind` para compatibilidad con ENUMs
- El sistema hace polling cada 15 segundos como respaldo si Realtime falla
- El sistema usa `supabaseAdmin()` para insertar notificaciones (bypass RLS)
- Los usuarios solo pueden leer y actualizar sus propias notificaciones (RLS)

---

## 🔗 Archivos Relacionados

- `EJECUTAR_SISTEMA_NOTIFICACIONES_COMPLETO.sql` - Script SQL completo
- `lib/notifications/insertBestEffort.ts` - Función de inserción
- `lib/notifications/getNotificationLink.ts` - Generación de links
- `app/api/notifications/list/route.ts` - API de listado
- `app/api/notifications/mark-read/route.ts` - API de marcar leídas
- `components/NotificationCenter.tsx` - Componente principal
- `app/dashboard/notificaciones/page.tsx` - Página de notificaciones
