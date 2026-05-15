# 🔍 Diagnóstico Rápido: Preguntas No Desaparecen

## Problema
- Las preguntas NO desaparecen después de responderlas
- Las notificaciones NO llegan al comprador

## Pasos de Diagnóstico

### 1. Abrir Consola del Navegador (F12)

### 2. Responder una Pregunta y Buscar Estos Logs:

**Cuando haces clic en "Enviar respuesta":**
- `[ANSWER] Enviando respuesta para pregunta: [ID]`
- `[ANSWER API] Actualizando pregunta: ...`
- `[ANSWER API] Resultado de update: ...`

**Si hay error:**
- `[ANSWER API] Error al actualizar: ...`
- `[ANSWER] Error completo: ...`

**Si se guarda correctamente:**
- `[ANSWER API] ✅ Pregunta actualizada correctamente`
- `[ANSWER] ✅ Respuesta guardada exitosamente en el servidor`
- `[ANSWER] Pregunta removida de la lista`

### 3. Verificar en Supabase

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Verificar que la pregunta se guardó con respuesta
SELECT 
  id,
  asker_id,
  seller_id,
  answer_text IS NOT NULL as tiene_respuesta,
  answer_text,
  answered_at,
  created_at
FROM listing_questions
WHERE seller_id = 'TU_USER_ID_AQUI'  -- Reemplaza con tu user_id
ORDER BY created_at DESC
LIMIT 10;
```

**Si `tiene_respuesta` es `false` pero escribiste una respuesta:**
- El problema es que el UPDATE no se está ejecutando
- Puede ser un error de permisos RLS

### 4. Verificar Notificaciones Creadas

```sql
-- Verificar notificaciones recientes
SELECT 
  id,
  user_id,
  type,
  title,
  is_read,
  created_at,
  data->>'questionId' as question_id,
  data->>'kind' as kind
FROM notifications
WHERE data->>'kind' = 'listing_answer'
ORDER BY created_at DESC
LIMIT 10;
```

**Si NO hay notificaciones:**
- El trigger NO está funcionando
- Ejecuta `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql`

### 5. Verificar Trigger Activo

```sql
-- Verificar que el trigger está activo
SELECT 
  tgname,
  tgenabled,
  tgrelid::regclass as tabla
FROM pg_trigger
WHERE tgname = 'trg_notify_asker_on_question_answer';
```

**Si `tgenabled` NO es 'O' (ON):**
- El trigger está deshabilitado
- Ejecuta `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql`

## Solución Rápida

1. **Ejecuta el SQL completo:**
   - `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql` en Supabase

2. **Limpia localStorage:**
   - Consola (F12): `localStorage.removeItem('pocket_answered_questions_v1'); location.reload();`

3. **Prueba responder:**
   - Escribe una respuesta (más de 1 carácter)
   - Haz clic en "Enviar respuesta"
   - Revisa la consola para ver los logs

4. **Comparte los logs:**
   - Copia todos los logs que empiecen con `[ANSWER]` o `[ANSWER API]`
   - Compártelos para diagnosticar el problema exacto
