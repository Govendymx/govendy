# 🔔 Solución Completa: Notificaciones y Preguntas

## Problema
- Las notificaciones no llegan al comprador cuando respondes una pregunta
- Las preguntas desaparecen pero vuelven a aparecer al recargar

## Solución (3 pasos)

### ✅ Paso 1: Ejecutar SQL en Supabase (OBLIGATORIO)

**IMPORTANTE:** Si cambiaste de computadora, el trigger de SQL puede no estar activo.

1. Ve a tu proyecto en **Supabase Dashboard**
2. Abre **SQL Editor**
3. Copia y pega el contenido completo del archivo **`FIX_NOTIFICACIONES_PREGUNTAS.sql`**
4. Haz clic en **"Run"** o presiona `Ctrl+Enter`
5. Deberías ver mensajes como:
   - `✅ Trigger trg_notify_asker_on_question_answer está activo`
   - `✅ Función notify_asker_on_question_answer existe`

**Si no ves estos mensajes, el trigger NO está activo y las notificaciones NO funcionarán.**

### ✅ Paso 2: Verificar que el Trigger Funciona

Ejecuta el script **`VERIFICAR_TRIGGER.sql`** en Supabase SQL Editor para diagnosticar:

```sql
-- Verificar que el trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'trg_notify_asker_on_question_answer';

-- Verificar preguntas respondidas sin notificación
SELECT 
  q.id as question_id,
  q.asker_id,
  q.answer_text IS NOT NULL as has_answer,
  CASE 
    WHEN n.id IS NULL THEN 'SIN NOTIFICACIÓN ❌'
    ELSE 'CON NOTIFICACIÓN ✅'
  END as status
FROM listing_questions q
LEFT JOIN notifications n ON (
  n.user_id = q.asker_id 
  AND n.data->>'questionId' = q.id::text
)
WHERE q.answer_text IS NOT NULL
ORDER BY q.answered_at DESC NULLS LAST
LIMIT 10;
```

### ✅ Paso 3: Probar el Flujo Completo

1. **Como vendedor:**
   - Ve a `/dashboard/preguntas`
   - Responde una pregunta
   - La pregunta debe desaparecer INMEDIATAMENTE
   - Deberías ver: `✅ Respuesta enviada correctamente. El comprador será notificado.`

2. **Como comprador (en otra sesión/navegador):**
   - Abre la aplicación
   - Deberías ver el **punto rosa parpadeante** en el menú superior
   - Haz clic en el punto rosa → deberías ver la notificación

3. **Verificar en consola del navegador (F12):**
   - Busca logs que digan:
     - `[ANSWER API] ✅ Notificación creada directamente`
     - `[AccountTopMenu] 🔔 ¡Nueva notificación detectada!`

## Si Aún No Funciona

### Verificar Variables de Entorno

Asegúrate de que `.env.local` tenga:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Verificar en Supabase

1. Ve a **Supabase Dashboard** → **Table Editor** → `listing_questions`
2. Busca una pregunta que hayas respondido
3. Verifica que tenga:
   - `asker_id` (no NULL) ✅
   - `answer_text` (no NULL) ✅
   - `is_deleted` = false ✅

4. Ve a **Table Editor** → `notifications`
5. Busca notificaciones recientes para el `asker_id` de la pregunta
6. Deberías ver una notificación con:
   - `type` = 'listing_answer' o 'listing_question'
   - `data->>'questionId'` = ID de la pregunta
   - `is_read` = false

### Limpiar Caché de Preguntas Respondidas

Si las preguntas siguen reapareciendo, limpia el localStorage:

1. Abre la consola del navegador (F12)
2. Ejecuta:
   ```javascript
   localStorage.removeItem('pocket_answered_questions_v1');
   location.reload();
   ```

## Cambios Realizados

✅ **Persistencia en localStorage:** Las preguntas respondidas ahora se guardan en localStorage y no reaparecen al recargar

✅ **Mejor detección de asker_id:** El código ahora busca `asker_id` en múltiples lugares para asegurar que se encuentre

✅ **Múltiples intentos de notificación:** El código intenta crear la notificación de varias formas para asegurar que se cree

✅ **Logs detallados:** Se agregaron logs extensos para facilitar el diagnóstico

## Archivos Modificados

- `app/dashboard/preguntas/page.tsx` - Agregada persistencia en localStorage
- `app/api/questions/answer/route.ts` - Mejorada detección de asker_id y creación de notificaciones
- `FIX_NOTIFICACIONES_PREGUNTAS.sql` - Script SQL para crear/verificar triggers
- `VERIFICAR_TRIGGER.sql` - Script de diagnóstico
