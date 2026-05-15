# 🔍 Diagnóstico Completo: Notificaciones y Preguntas

## ✅ Lo que SÍ está funcionando (según tu captura)

1. **Las notificaciones SE CREAN en la BD** ✅
   - Tu captura muestra `notification_stat: "CON NOTIFICACIÓN"`
   - Esto significa que el trigger o el código API está funcionando

## ❌ Problemas Posibles

### Problema 1: El comprador no ve el punto rosa

**Causas posibles:**
1. El `user_id` de la notificación no coincide con el `asker_id` de la pregunta
2. El realtime de Supabase no está funcionando
3. El polling no está detectando las notificaciones

**Solución:**
1. Abre la consola del navegador (F12) como **comprador**
2. Busca estos logs:
   - `[AccountTopMenu] ✅ Suscrito a cambios de notificaciones en tiempo real`
   - `[AccountTopMenu] 🔔 ¡Nueva notificación detectada en tiempo real!`
   - `[AccountTopMenu] 🔔 ¡Nueva notificación detectada! Contador: X → Y`

3. Si NO ves estos logs, ejecuta este SQL en Supabase para verificar:

```sql
-- Verificar que las notificaciones tienen el user_id correcto
SELECT 
  n.id,
  n.user_id as notification_user_id,
  n.is_read,
  n.title,
  n.created_at,
  q.asker_id as question_asker_id,
  q.id as question_id,
  CASE 
    WHEN n.user_id = q.asker_id THEN '✅ CORRECTO'
    ELSE '❌ INCORRECTO - user_id no coincide'
  END as status
FROM notifications n
JOIN listing_questions q ON (n.data->>'questionId' = q.id::text)
WHERE n.data->>'kind' = 'listing_answer'
ORDER BY n.created_at DESC
LIMIT 10;
```

### Problema 2: Las preguntas reaparecen

**Causas posibles:**
1. El localStorage se está limpiando
2. El API está trayendo preguntas respondidas (aunque debería filtrarlas)

**Solución:**
1. Abre la consola del navegador (F12) como **vendedor**
2. Responde una pregunta
3. Busca estos logs:
   - `[ANSWER] ✅ Respuesta guardada exitosamente`
   - `[ANSWER] Pregunta removida de la lista`
   - `[PREGUNTAS PAGE] Preguntas sin respuesta después de filtrar`

4. Si la pregunta reaparece, verifica en localStorage:
   ```javascript
   // En la consola del navegador:
   JSON.parse(localStorage.getItem('pocket_answered_questions_v1'))
   ```
   
   Deberías ver un array con los IDs de las preguntas respondidas.

## 🧪 Prueba Rápida

### Como Vendedor:
1. Ve a `/dashboard/preguntas`
2. Abre la consola (F12)
3. Responde una pregunta
4. Verifica que veas:
   - `[ANSWER] ✅ Respuesta guardada exitosamente`
   - La pregunta desaparece inmediatamente

### Como Comprador (en otra sesión/navegador):
1. Abre la aplicación
2. Abre la consola (F12)
3. Busca:
   - `[AccountTopMenu] ✅ Suscrito a cambios de notificaciones en tiempo real`
4. Espera 10-15 segundos
5. Deberías ver:
   - `[AccountTopMenu] 🔔 ¡Nueva notificación detectada!`
   - El punto rosa parpadeante en el menú

## 🔧 Si Aún No Funciona

### Verificar Realtime de Supabase

1. Ve a Supabase Dashboard → **Settings** → **API**
2. Verifica que **Realtime** esté habilitado
3. Ve a **Database** → **Replication**
4. Verifica que la tabla `notifications` tenga **Replication** habilitada

### Verificar Políticas RLS

Ejecuta este SQL en Supabase:

```sql
-- Verificar políticas RLS de notifications
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'notifications';
```

Deberías ver al menos una política que permita a los usuarios leer sus propias notificaciones.

### Limpiar y Reiniciar

1. **Limpiar localStorage:**
   ```javascript
   // En la consola del navegador:
   localStorage.removeItem('pocket_answered_questions_v1');
   location.reload();
   ```

2. **Limpiar caché de Next.js:**
   ```bash
   # Detener el servidor (Ctrl+C)
   # Eliminar .next
   Remove-Item -Recurse -Force .next
   # Reiniciar
   npm run dev
   ```

3. **Recargar la página con caché limpio:**
   - `Ctrl+Shift+R` (Windows/Linux)
   - `Cmd+Shift+R` (Mac)
