# 📋 Paso a Paso: Ejecutar SQL en Supabase

## ⚠️ IMPORTANTE
**Sin ejecutar este SQL, las notificaciones NO funcionarán.** El trigger de base de datos es el que crea automáticamente las notificaciones cuando respondes una pregunta.

---

## 🎯 Pasos Detallados

### Paso 1: Abrir Supabase Dashboard
1. Ve a https://supabase.com/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto (el que usas para Pocket App)

### Paso 2: Abrir SQL Editor
1. En el menú lateral izquierdo, busca **"SQL Editor"** (icono de terminal/código)
2. Haz clic en **"SQL Editor"**
3. Verás una pantalla con un editor de código SQL

### Paso 3: Abrir el Archivo SQL
1. En tu proyecto local, abre el archivo **`FIX_NOTIFICACIONES_PREGUNTAS.sql`**
2. Selecciona TODO el contenido (Ctrl+A)
3. Copia todo (Ctrl+C)

### Paso 4: Pegar y Ejecutar
1. En Supabase SQL Editor, haz clic en el área de texto grande
2. Pega el contenido (Ctrl+V)
3. Verifica que se vea el código SQL completo
4. Haz clic en el botón **"Run"** (o presiona `Ctrl+Enter`)

### Paso 5: Verificar Resultado
Deberías ver mensajes como:
```
✅ Trigger trg_notify_asker_on_question_answer está activo
✅ Función notify_asker_on_question_answer existe
```

Si ves errores, compártelos y los revisamos.

---

## 🔍 Verificar que Funcionó

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Verificar que el trigger existe
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'trg_notify_asker_on_question_answer';
```

**Deberías ver 1 fila** con el nombre del trigger. Si no ves nada, el trigger NO está activo.

---

## ❓ ¿Problemas?

### Error: "relation does not exist"
- Ejecuta primero `supabase_notifications.sql` y `supabase_listing_questions.sql`
- O ejecuta `TODOS_LOS_SQL_CONSOLIDADOS.sql` completo

### Error: "permission denied"
- Asegúrate de estar usando el SQL Editor (no el Table Editor)
- El SQL Editor tiene permisos de administrador

### No veo los mensajes de éxito
- Revisa la pestaña "Results" debajo del editor
- Busca mensajes que empiecen con `NOTICE:`

---

## ✅ Después de Ejecutar

1. **Recarga la página** de preguntas en tu app
2. **Responde una pregunta**
3. **Abre la consola del navegador** (F12) y busca:
   - `[ANSWER API] ✅ Notificación creada directamente`
4. **Como comprador**, deberías ver el punto rosa parpadeante

---

## 📸 Capturas de Pantalla (Referencia)

**SQL Editor en Supabase:**
- Menú lateral → "SQL Editor"
- Editor grande en el centro
- Botón "Run" arriba a la derecha

**Después de ejecutar:**
- Pestaña "Results" muestra los mensajes
- Deberías ver `NOTICE: ✅ Trigger...`
