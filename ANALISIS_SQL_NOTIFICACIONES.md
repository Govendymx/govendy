# 📋 Análisis de Archivos SQL - Notificaciones y Preguntas

## 📁 Archivos SQL Relacionados

### 1. `supabase_notifications.sql`
**Propósito:** Crea la tabla base de notificaciones
- ✅ Crea tabla `notifications` con columnas: `id`, `user_id`, `type`, `title`, `body`, `data`, `is_read`, `created_at`
- ✅ Crea índice para búsquedas rápidas por usuario
- ✅ Habilita RLS (Row Level Security)
- ✅ Crea políticas para que usuarios solo vean sus propias notificaciones

**Cuándo ejecutar:** PRIMERO, antes que los triggers

---

### 2. `supabase_listing_questions.sql`
**Propósito:** Crea la tabla de preguntas
- ✅ Crea tabla `listing_questions` con: `id`, `listing_id`, `seller_id`, `asker_id`, `question_text`, `answer_text`, `created_at`, `answered_at`, `is_deleted`
- ✅ Crea índices para búsquedas rápidas
- ✅ Habilita RLS
- ✅ Políticas: público puede leer, autenticados pueden preguntar, vendedor puede responder

**Cuándo ejecutar:** ANTES de los triggers (los triggers dependen de esta tabla)

---

### 3. `supabase_notifications_triggers.sql`
**Propósito:** Crea los triggers automáticos para notificaciones
- ✅ **Trigger 1:** `trg_notify_seller_on_new_question` - Notifica al vendedor cuando hay una nueva pregunta
- ✅ **Trigger 2:** `trg_notify_asker_on_question_answer` - **ESTE ES EL IMPORTANTE** - Notifica al comprador cuando se responde su pregunta
- ✅ **Trigger 3:** `trg_notify_seller_on_new_order` - Notifica al vendedor cuando hay una nueva orden
- ✅ **Trigger 4:** `trg_notify_seller_on_order_paid` - Notifica al vendedor cuando se paga una orden

**Función clave:** `notify_asker_on_question_answer()`
- Se ejecuta cuando `answer_text` cambia de NULL a NOT NULL
- Crea una notificación para el `asker_id` (el que hizo la pregunta)
- Intenta usar `type = 'listing_answer'`, si falla usa `'listing_question'` como fallback

**Cuándo ejecutar:** DESPUÉS de `supabase_notifications.sql` y `supabase_listing_questions.sql`

---

### 4. `FIX_NOTIFICACIONES_PREGUNTAS.sql`
**Propósito:** Script consolidado que hace TODO lo anterior + verificaciones
- ✅ Crea tabla `notifications` si no existe
- ✅ Crea función `notify_asker_on_question_answer()` (versión mejorada con más fallbacks)
- ✅ Crea trigger `trg_notify_asker_on_question_answer`
- ✅ **Verifica** que el trigger y la función existan (muestra mensajes de éxito/error)

**Cuándo ejecutar:** Si solo quieres arreglar las notificaciones de preguntas, ejecuta ESTE

---

## 🔍 Problemas Identificados

### Problema 1: El trigger puede no estar activo
**Síntoma:** Las notificaciones no se crean automáticamente
**Causa:** El trigger no fue ejecutado o fue deshabilitado
**Solución:** Ejecutar `FIX_NOTIFICACIONES_PREGUNTAS.sql`

### Problema 2: La función tiene menos fallbacks
**Diferencia entre archivos:**
- `supabase_notifications_triggers.sql` tiene 2 intentos (listing_answer → listing_question)
- `FIX_NOTIFICACIONES_PREGUNTAS.sql` tiene 3 intentos (listing_answer → listing_question → sin type)

**Solución:** Usar `FIX_NOTIFICACIONES_PREGUNTAS.sql` que es más robusto

### Problema 3: Políticas RLS pueden bloquear
**Síntoma:** El trigger intenta crear notificación pero falla por permisos
**Causa:** Las políticas RLS no permiten INSERT desde el trigger
**Solución:** Los triggers usan `SECURITY DEFINER` que les da permisos de administrador

### Problema 4: `asker_id` puede ser NULL
**Síntoma:** El trigger se ejecuta pero no crea notificación
**Causa:** La pregunta no tiene `asker_id` (debería tenerlo siempre)
**Solución:** El trigger verifica `IF NEW.asker_id IS NULL THEN RETURN NEW;`

---

## ✅ Solución Recomendada

### Opción 1: Ejecutar Script Consolidado (RECOMENDADO)
```sql
-- Ejecuta FIX_NOTIFICACIONES_PREGUNTAS.sql completo
-- Este script hace TODO y verifica que funcione
```

### Opción 2: Ejecutar en Orden
1. `supabase_notifications.sql` (si no existe la tabla)
2. `supabase_listing_questions.sql` (si no existe la tabla)
3. `FIX_NOTIFICACIONES_PREGUNTAS.sql` (para crear/actualizar el trigger)

---

## 🧪 Verificación Post-Ejecución

Después de ejecutar el SQL, verifica:

```sql
-- 1. Verificar que el trigger existe y está activo
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trg_notify_asker_on_question_answer';
-- Deberías ver 1 fila con enabled = 'O' (ON)

-- 2. Verificar que la función existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'notify_asker_on_question_answer';
-- Deberías ver 1 fila con el código de la función

-- 3. Probar manualmente (simular respuesta)
-- Esto NO debería ejecutarse, solo es para verificar la lógica
-- El trigger se ejecutará automáticamente cuando respondas una pregunta
```

---

## 🐛 Debugging

Si las notificaciones NO se crean después de ejecutar el SQL:

1. **Verificar que el trigger está activo:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trg_notify_asker_on_question_answer';
   ```

2. **Verificar que las preguntas tienen `asker_id`:**
   ```sql
   SELECT id, asker_id, answer_text 
   FROM listing_questions 
   WHERE answer_text IS NOT NULL 
   LIMIT 5;
   ```

3. **Verificar que las notificaciones se están creando:**
   ```sql
   SELECT id, user_id, title, created_at 
   FROM notifications 
   WHERE data->>'kind' = 'listing_answer'
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

4. **Verificar políticas RLS:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'notifications';
   ```

---

## 📝 Notas Importantes

1. **Los triggers usan `SECURITY DEFINER`:** Esto les da permisos de administrador, así que pueden crear notificaciones incluso si las políticas RLS normalmente lo bloquearían.

2. **El trigger se ejecuta AUTOMÁTICAMENTE:** No necesitas hacer nada en el código, cuando actualizas `answer_text` en `listing_questions`, el trigger se ejecuta solo.

3. **El código API también crea notificaciones:** Además del trigger, el código en `app/api/questions/answer/route.ts` también intenta crear notificaciones manualmente como backup.

4. **Orden de ejecución importa:** Si ejecutas los scripts en orden incorrecto, pueden fallar. Usa `FIX_NOTIFICACIONES_PREGUNTAS.sql` que es más seguro.
