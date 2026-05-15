# 📋 Referencias Completas al Sistema de Notificaciones

Este documento identifica **todas las partes del código** que hacen referencia al sistema de notificaciones en Pocket App.

---

## 📁 1. Archivos de Utilidades (lib/)

### `lib/notifications/insertBestEffort.ts`
- **Función principal**: `insertNotificationBestEffort()`
- **Propósito**: Inserta notificaciones con manejo robusto de errores y compatibilidad con diferentes schemas
- **Características**:
  - Maneja errores de ENUM inválido
  - Fallbacks para columnas faltantes
  - Compatibilidad con `body` vs `message`
  - Guarda `type` también en `data.kind` para compatibilidad

### `lib/notifications/getNotificationLink.ts`
- **Función principal**: `getNotificationLink()`
- **Propósito**: Genera enlaces de destino para notificaciones según su tipo
- **Tipos soportados**:
  - `listing_question`, `listing_answer`
  - `order_message`, `order_status`
  - `payment`, `new_sale`, `sale_paid`
  - `support`
  - `auction`
  - `dispute`, `dispute_resolved`
  - `rating`, `review`

---

## 🎨 2. Componentes Frontend

### `components/AccountTopMenu.tsx`
- **Líneas clave**: 84-574
- **Funcionalidades**:
  - Muestra contador de notificaciones no leídas (punto rosa parpadeante)
  - Dropdown de alertas con resumen por categoría
  - Escucha eventos `notifications-updated` para actualización en tiempo real
  - Suscripción a cambios en tiempo real de la tabla `notifications`
  - Polling cada 5 segundos como fallback
  - Elimina notificaciones al hacer clic en alertas
  - Llama a `/api/alerts/summary` para obtener resumen

### `app/dashboard/notificaciones/page.tsx`
- **Líneas clave**: 32-600
- **Funcionalidades**:
  - Página completa de gestión de notificaciones
  - Lista todas las notificaciones del usuario
  - Marcar como leídas (individual y todas)
  - Eliminar notificaciones (individual)
  - Modo debug (`?debug=1`)
  - Usa `getNotificationLink()` para generar enlaces
  - Escucha eventos `notifications-updated`
  - Llama a `/api/notifications/list`

---

## 🔌 3. APIs de Notificaciones (app/api/notifications/)

### `app/api/notifications/list/route.ts`
- **Método**: `GET`
- **Funcionalidad**: Lista notificaciones del usuario
- **Query params**: `limit` (default: 50, max: 200)
- **Retorna**:
  - `rows`: Array de notificaciones
  - `unread_count`: Contador de no leídas
  - `sales_unread_count`: Contador de ventas no leídas
  - Maneja schemas antiguos (compatibilidad con `body`/`message`)

### `app/api/notifications/delete/route.ts`
- **Método**: `POST`
- **Body**: `{ ids: string[] }` o `{ all: boolean }`
- **Funcionalidad**: Elimina notificaciones permanentemente
- **Características**:
  - Usa `supabaseAdmin()` para bypass RLS
  - Eliminación en batches de 40
  - Verificación post-eliminación
  - Fallback a funciones RPC si falla DELETE directo

### `app/api/notifications/mark-read/route.ts`
- **Método**: `POST`
- **Body**: `{ ids: string[] }` o `{ all: boolean }`
- **Funcionalidad**: Marca notificaciones como leídas
- **Actualiza**: Campo `is_read = true`

### `app/api/notifications/refresh/route.ts`
- **Método**: `POST`
- **Funcionalidad**: Refresca el contador de notificaciones no leídas
- **Uso**: Llamado después de marcar/eliminar para actualizar contadores

### `app/api/notifications/test/route.ts`
- **Método**: `POST`
- **Funcionalidad**: Crea una notificación de prueba para debugging
- **Uso**: Solo para desarrollo/testing

---

## 📊 4. API de Alertas (Resumen)

### `app/api/alerts/summary/route.ts`
- **Método**: `GET`
- **Funcionalidad**: Genera resumen de alertas para el menú superior
- **Tipos de alertas**:
  - `sales`: Ventas nuevas/pagadas (`new_sale`, `sale_paid`)
  - `support`: Mensajes de soporte
  - `lost_bid`: Pujas perdidas (`outbid`)
  - `rated_buyer`: Calificaciones como comprador
  - `rated_seller`: Calificaciones como vendedor
  - `other_notifications`: Otras notificaciones
  - `responses`: Respuestas a preguntas (desde `listing_questions`)
  - `questions`: Preguntas sin responder (desde `listing_questions`)
  - `auction_ending`: Subastas en favoritos que terminan en <24h

---

## 🔔 5. Lugares donde se CREAN Notificaciones

### Pagos y Órdenes

#### `app/api/mercadopago/webhook/route.ts`
- **Líneas**: 70, 173, 182, 215
- **Notificaciones creadas**:
  - `payment_approved`: Cuando MercadoPago confirma pago
  - `sale_paid`: Para el vendedor cuando se acredita pago
  - `new_sale`: Para el vendedor cuando hay nueva venta

#### `app/api/checkout/create/route.ts`
- **Línea**: 329
- **Notificación**: `new_sale` para el vendedor cuando se crea una orden

#### `app/api/orders/confirm-received/route.ts`
- **Líneas**: 194, 215, 226
- **Notificaciones**:
  - Para comprador: confirmación de recepción
  - Para vendedor: comprador confirmó recepción

#### `app/api/orders/mark-shipped/route.ts`
- **Línea**: 155
- **Notificación**: Para comprador cuando vendedor marca como enviado

#### `app/api/admin/payments/offline/update/route.ts`
- **Líneas**: 155, 169, 178, 187
- **Notificaciones**:
  - Para comprador: pago offline confirmado
  - Para vendedor: pago offline recibido

### Preguntas y Respuestas

#### `app/api/questions/ask/route.ts`
- **Línea**: 208
- **Notificación**: `listing_question` para el vendedor cuando alguien hace una pregunta

#### `app/api/questions/answer/route.ts`
- **Línea**: 525
- **Notificación**: `listing_answer` para el que hizo la pregunta cuando el vendedor responde

### Disputas

#### `app/api/disputes/open/route.ts`
- **Líneas**: 143, 161, 176
- **Notificaciones**:
  - Para vendedor: disputa abierta
  - Para comprador: confirmación de disputa abierta

#### `app/api/disputes/messages/route.ts`
- **Líneas**: 273, 290
- **Notificaciones**: Mensajes nuevos en disputa

#### `app/api/admin/disputes/resolve/route.ts`
- **Líneas**: 294, 304
- **Notificaciones**: Disputa resuelta (para ambas partes)

### Subastas

#### `app/api/bids/place/route.ts`
- **Líneas**: 111, 126, 139
- **Notificaciones**:
  - `outbid`: Para el vendedor cuando alguien puja más alto
  - `bid_received`: Para el vendedor cuando recibe una puja

#### `app/api/auctions/settle/route.ts`
- **Líneas**: 57, 69
- **Notificaciones**: Subasta finalizada (ganador y vendedor)

### Soporte

#### `app/api/support/messages/route.ts`
- **Línea**: 267
- **Notificación**: `support_message` cuando hay nuevo mensaje de soporte

#### `app/api/admin/support/messages/route.ts`
- **Línea**: 258
- **Notificación**: Respuesta de admin en soporte

### Calificaciones

#### `app/api/orders/rate-buyer/route.ts`
- **Líneas**: 175, 196, 207
- **Notificaciones**:
  - `rating_received`: Para el comprador cuando es calificado
  - `ratings_complete`: Para el vendedor cuando se completa la calificación

### Administración

#### `app/api/admin/announcements/send/route.ts`
- **Línea**: 148
- **Notificación**: `admin_announcement` para todos los usuarios

#### `app/api/admin/estafeta/upload-guide/route.ts`
- **Línea**: 98
- **Notificación**: Guía de Estafeta subida

#### `app/api/admin/logistica/label/upload/route.ts`
- **Líneas**: 145, 153
- **Notificación**: Etiqueta de envío subida

### Recordatorios

#### `app/api/cart/reminders/route.ts`
- **Línea**: 49
- **Notificación**: `cart_reminder` para recordar productos en carrito

---

## 🗄️ 6. Scripts SQL

### Scripts de Creación/Migración

#### `supabase_notifications.sql`
- Crea tabla `notifications`
- Define columnas: `id`, `user_id`, `type`, `title`, `body`, `data`, `is_read`, `created_at`
- Crea índices
- Configura RLS (Row Level Security)

#### `supabase_notifications_enum_extend.sql`
- Extiende ENUM `notification_type` con nuevos tipos

#### `supabase_notifications_triggers.sql`
- Crea triggers automáticos para generar notificaciones
- Triggers en: `orders`, `listing_questions`, `disputes`, etc.

#### `supabase_notifications_delete_policy.sql`
- Política RLS para DELETE

#### `supabase_notifications_backfill.sql`
- Backfill de notificaciones históricas

### Scripts de Corrección

#### `CREAR_TODO_NOTIFICACIONES.sql`
- Script completo para crear todo el sistema

#### `RECONSTRUIR_SISTEMA_NOTIFICACIONES.sql`
- Reconstrucción completa del sistema

#### `FIX_NOTIFICACIONES_PREGUNTAS.sql`
- Corrección específica para notificaciones de preguntas

#### `FIX_ELIMINAR_NOTIFICACIONES.sql`
- Corrección para eliminación de notificaciones

#### `FIX_DELETE_NOTIFICACIONES_COMPLETO.sql`
- Fix completo para DELETE

#### `SOLUCION_DEFINITIVA_ELIMINAR_NOTIFICACIONES.sql`
- Solución definitiva para eliminación

#### `SOLUCION_COMPLETA_PREGUNTAS_Y_NOTIFICACIONES.sql`
- Solución completa para preguntas y notificaciones

#### `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql`
- Configuración completa

---

## 📝 7. Documentación

### Archivos de Documentación

- `ANALISIS_SQL_NOTIFICACIONES.md`
- `FLUJO_PREGUNTAS_Y_NOTIFICACIONES.md`
- `SOLUCION_NOTIFICACIONES.md`
- `RESUMEN_SOLUCION_FINAL.md`
- `DIAGNOSTICO_COMPLETO.md`
- `SOLUCION_FINAL_PREGUNTAS.md`
- `NUEVO_SISTEMA_PREGUNTAS.md`

---

## 🔄 8. Eventos y Comunicación

### Eventos del Navegador

#### `notifications-updated`
- **Disparado en**:
  - `app/dashboard/notificaciones/page.tsx` (línea 285)
  - `components/AccountTopMenu.tsx` (línea 228)
- **Escuchado en**:
  - `components/AccountTopMenu.tsx` (línea 357)
  - `app/dashboard/notificaciones/page.tsx` (líneas 118, 133)
- **Propósito**: Actualizar contadores y listas cuando se eliminan/marcan notificaciones

### Suscripciones en Tiempo Real (Supabase)

#### `components/AccountTopMenu.tsx`
- **Líneas**: 299-338
- **Canales**:
  - `notifs-${userId}`: Cambios en tabla `notifications`
  - `questions-seller-${userId}`: Cambios en `listing_questions` como vendedor
  - `questions-asker-${userId}`: Cambios en `listing_questions` como comprador
- **Polling**: Cada 5 segundos como fallback

---

## 📊 9. Estructura de la Tabla `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT,
  title TEXT,
  body TEXT,
  message TEXT,  -- Compatibilidad con schemas antiguos
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tipos de Notificaciones (`type` o `data.kind`)

- `admin_announcement`: Anuncios del administrador
- `listing_question`: Pregunta en un producto
- `listing_answer`: Respuesta a pregunta
- `new_sale`: Nueva venta
- `sale_paid`: Venta pagada
- `payment_approved`: Pago aprobado
- `payment_rejected`: Pago rechazado
- `order_completed`: Orden completada
- `order_message`: Mensaje en orden
- `order_status`: Cambio de estado de orden
- `support_message`: Mensaje de soporte
- `support_reply`: Respuesta de soporte
- `bid_received`: Puja recibida
- `outbid`: Te ganaron una puja
- `auction_ended`: Subasta finalizada
- `cart_reminder`: Recordatorio de carrito
- `shipped`: Producto enviado
- `rating_received`: Calificación recibida
- `ratings_complete`: Calificaciones completadas
- `dispute_opened`: Disputa abierta
- `dispute_message`: Mensaje en disputa
- `dispute_resolved`: Disputa resuelta
- `test`: Notificación de prueba

---

## 🎯 10. Resumen de Flujos

### Flujo de Creación de Notificación

1. **Evento ocurre** (pago, pregunta, mensaje, etc.)
2. **API Route** llama a `insertNotificationBestEffort()`
3. **Función** intenta insertar en tabla `notifications`
4. **Si falla**: Intenta fallbacks (sin `type`, sin columnas opcionales, etc.)
5. **Éxito**: Notificación creada

### Flujo de Visualización

1. **Usuario carga página**: `AccountTopMenu` se monta
2. **Carga inicial**: Llama a `/api/alerts/summary`
3. **Suscripción realtime**: Se suscribe a cambios en `notifications`
4. **Polling**: Cada 5 segundos actualiza
5. **Evento**: Si se elimina/marca, dispara `notifications-updated`
6. **Actualización**: Componentes se actualizan automáticamente

### Flujo de Eliminación

1. **Usuario hace clic** en eliminar
2. **Frontend**: Llama a `/api/notifications/delete`
3. **Backend**: Usa `supabaseAdmin()` para bypass RLS
4. **Eliminación**: DELETE directo o función RPC
5. **Verificación**: Confirma que se eliminaron
6. **Evento**: Dispara `notifications-updated`
7. **Actualización**: Contadores y listas se actualizan

---

## 📌 11. Archivos que Importan `insertNotificationBestEffort`

1. `app/api/mercadopago/webhook/route.ts`
2. `app/api/checkout/create/route.ts`
3. `app/api/orders/confirm-received/route.ts`
4. `app/api/orders/mark-shipped/route.ts`
5. `app/api/orders/rate-buyer/route.ts`
6. `app/api/questions/ask/route.ts`
7. `app/api/questions/answer/route.ts`
8. `app/api/disputes/open/route.ts`
9. `app/api/disputes/messages/route.ts`
10. `app/api/admin/disputes/resolve/route.ts`
11. `app/api/bids/place/route.ts`
12. `app/api/auctions/settle/route.ts`
13. `app/api/support/messages/route.ts`
14. `app/api/admin/support/messages/route.ts`
15. `app/api/admin/payments/offline/update/route.ts`
16. `app/api/admin/announcements/send/route.ts`
17. `app/api/admin/estafeta/upload-guide/route.ts`
18. `app/api/cart/reminders/route.ts`
19. `app/api/notifications/test/route.ts`

---

## 🔍 12. Archivos con Funciones Locales de Notificaciones

Algunos archivos tienen funciones locales `insertNotificationBestEffort` (duplicadas):

- `app/api/orders/confirm-received/route.ts` (línea 33)
- `app/api/orders/rate-buyer/route.ts` (línea 33)
- `app/api/orders/mark-shipped/route.ts` (línea 48)
- `app/api/chat/messages/route.ts` (línea 63)

**Recomendación**: Reemplazar estas funciones locales por la importación de `lib/notifications/insertBestEffort.ts` para mantener consistencia.

---

## ✅ 13. Checklist de Verificación

Para verificar que el sistema de notificaciones está completo:

- [ ] Tabla `notifications` existe en Supabase
- [ ] Políticas RLS están configuradas
- [ ] `insertNotificationBestEffort` funciona correctamente
- [ ] `AccountTopMenu` muestra contador correcto
- [ ] Página `/dashboard/notificaciones` carga correctamente
- [ ] Eventos `notifications-updated` se disparan
- [ ] Suscripciones realtime funcionan
- [ ] Polling funciona como fallback
- [ ] Eliminación de notificaciones funciona
- [ ] Marcado como leído funciona
- [ ] Enlaces de notificaciones funcionan (`getNotificationLink`)

---

**Última actualización**: Enero 2026  
**Total de archivos relacionados**: ~50+ archivos  
**Total de APIs que crean notificaciones**: 19 endpoints
