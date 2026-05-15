# 🔧 Guía de Reconfiguración - Pocket App

## Problema
Después de cambiar de computadora, las notificaciones no funcionan cuando respondes preguntas.

## Solución Rápida

### Paso 1: Ejecutar SQL en Supabase

1. Ve a tu proyecto en **Supabase Dashboard**
2. Abre **SQL Editor**
3. Copia y pega el contenido completo del archivo **`FIX_NOTIFICACIONES_PREGUNTAS.sql`**
4. Haz clic en **"Run"** o presiona `Ctrl+Enter`
5. Deberías ver mensajes como:
   - `✅ Trigger trg_notify_asker_on_question_answer está activo`
   - `✅ Función notify_asker_on_question_answer existe`

### Paso 2: Verificar Variables de Entorno

Asegúrate de que tu archivo `.env.local` tenga:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Paso 3: Reiniciar el Servidor

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
npm run dev
```

## Verificación

1. Responde una pregunta desde `/dashboard/preguntas`
2. Abre la consola del navegador (F12)
3. Busca logs que digan:
   - `[ANSWER API] ✅ Notificación creada directamente`
   - `[AccountTopMenu] 🔔 ¡Nueva notificación detectada en tiempo real!`
4. El comprador debería ver el punto rosa parpadeante

## Si Aún No Funciona

### Verificar en Supabase SQL Editor:

```sql
-- Verificar que el trigger existe
SELECT * FROM pg_trigger WHERE tgname = 'trg_notify_asker_on_question_answer';

-- Verificar que la función existe
SELECT * FROM pg_proc WHERE proname = 'notify_asker_on_question_answer';

-- Verificar que hay preguntas con asker_id
SELECT id, asker_id, seller_id, answer_text 
FROM listing_questions 
WHERE answer_text IS NOT NULL 
LIMIT 5;

-- Verificar notificaciones recientes
SELECT id, user_id, title, is_read, created_at 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;
```

## Scripts SQL Importantes

Si necesitas ejecutar todos los scripts SQL en orden:

1. `supabase_notifications.sql` - Crea la tabla de notificaciones
2. `supabase_listing_questions.sql` - Crea la tabla de preguntas
3. `supabase_notifications_triggers.sql` - Crea los triggers (o usa `FIX_NOTIFICACIONES_PREGUNTAS.sql`)
4. `supabase_listing_questions_rls_fix.sql` - Ajusta políticas RLS

O ejecuta `TODOS_LOS_SQL_CONSOLIDADOS.sql` que tiene todo en uno.
