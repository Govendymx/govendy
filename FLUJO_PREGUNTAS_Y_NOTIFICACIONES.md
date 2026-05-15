# Flujo de Preguntas y Notificaciones - Documentación Completa

## 📋 Resumen del Sistema

Este documento explica cómo funciona el sistema de preguntas y notificaciones en Pocket App.

## 🔄 Flujo Completo

### 1. Usuario hace una pregunta

**Archivo:** `app/listings/[id]/page.tsx`
- Usuario escribe una pregunta en un listing
- Se llama a `/api/questions/ask` (POST)

**Archivo:** `app/api/questions/ask/route.ts`
- Valida el token del usuario
- Obtiene el `listing` y extrae el `seller_id`
- Inserta la pregunta en `listing_questions` con:
  - `listing_id`: ID del producto
  - `seller_id`: ID del vendedor
  - `asker_id`: ID del usuario que pregunta
  - `question_text`: La pregunta
  - `is_deleted`: false
- Crea una notificación para el vendedor usando `insertNotificationBestEffort`
- **Trigger de BD:** `trg_notify_seller_on_new_question` también crea una notificación automáticamente

### 2. Vendedor ve las preguntas

**Archivo:** `app/dashboard/preguntas/page.tsx`
- Carga preguntas usando `/api/questions/list?sellerId=...` (GET)
- Muestra solo preguntas sin respuesta (`answer_text IS NULL`)

**Archivo:** `app/api/questions/list/route.ts`
- Valida que el usuario sea el vendedor
- Consulta `listing_questions` donde `seller_id = userId` y `answer_text IS NULL`
- Retorna las preguntas

### 3. Vendedor responde una pregunta

**Archivo:** `app/dashboard/preguntas/page.tsx`
- Usuario escribe respuesta y hace clic en "Enviar respuesta"
- Se llama a `answer(questionId)` que hace POST a `/api/questions/answer`

**Archivo:** `app/api/questions/answer/route.ts`
- Valida el token y que el usuario sea el vendedor
- Actualiza `listing_questions`:
  - `answer_text`: La respuesta
  - `answered_at`: Timestamp actual
- **Trigger de BD:** `trg_notify_asker_on_question_answer` crea automáticamente una notificación para el que preguntó
- También intenta crear notificación manualmente usando `insertNotificationBestEffort` (redundante pero seguro)

### 4. Usuario recibe notificación de respuesta

**Archivo:** `components/AccountTopMenu.tsx`
- Tiene un sistema de realtime + polling:
  - **Realtime:** Suscripción a cambios en `notifications` para el usuario
  - **Polling:** Actualiza cada 15 segundos
- El contador `unreadCount` se actualiza cuando hay notificaciones con `is_read = false`
- El punto rosa aparece cuando `hasAlerts = unreadCount > 0 || unansweredQuestionsCount > 0 || salesNotifCount > 0`

**Archivo:** `app/api/notifications/list/route.ts`
- Cuenta notificaciones con `is_read = false` para el usuario
- Retorna `unread_count`

## 🔍 Problemas Identificados

### Problema 1: Las preguntas no se pueden responder
**Posibles causas:**
- Error en la API `/api/questions/answer`
- El estado no se actualiza correctamente
- La pregunta no desaparece porque la recarga falla

### Problema 2: Las notificaciones no aparecen (punto rosa)
**Posibles causas:**
- El trigger de BD no está funcionando
- `insertNotificationBestEffort` está fallando
- El realtime no está detectando cambios
- El polling es muy lento (15 segundos)
- El contador no se actualiza correctamente

## 🛠️ Soluciones Implementadas

1. **Logging mejorado:** Agregado logging en cada paso para diagnosticar
2. **Polling más frecuente:** Reducido de 60 a 15 segundos
3. **Actualización optimista:** La pregunta desaparece inmediatamente
4. **Validación mejorada:** Verifica que la respuesta se guardó correctamente
5. **Doble notificación:** Tanto trigger como API crean notificaciones (redundancia)

## 📝 Archivos Clave

- `app/api/questions/ask/route.ts` - Crear pregunta
- `app/api/questions/answer/route.ts` - Responder pregunta
- `app/api/questions/list/route.ts` - Listar preguntas del vendedor
- `app/dashboard/preguntas/page.tsx` - UI del vendedor
- `components/AccountTopMenu.tsx` - Contador de notificaciones
- `app/api/notifications/list/route.ts` - Listar notificaciones
- `supabase_notifications_triggers.sql` - Triggers automáticos de BD
- `lib/notifications/insertBestEffort.ts` - Crear notificaciones manualmente
