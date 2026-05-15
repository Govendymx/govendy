# 🧪 Instrucciones para Prueba Final

Después de ejecutar `TODOS_LOS_SQL_CONSOLIDADOS.sql`, sigue estos pasos para verificar que todo funciona:

## ✅ Paso 1: Verificar Configuración en Supabase

Ejecuta este SQL en Supabase → SQL Editor:

**Archivo:** `VERIFICAR_CONFIGURACION_COMPLETA.sql`

Esto verificará que:
- ✅ Todas las tablas existen
- ✅ Los triggers están activos
- ✅ Las funciones existen
- ✅ Las columnas necesarias existen
- ✅ Las políticas RLS están activas

**Resultado esperado:** Todos los elementos deben mostrar `✅ EXISTE` o `✅ ACTIVO`

## 🧪 Paso 2: Probar Sistema de Preguntas y Notificaciones

### 2.1 Preparar el Test

1. **Abrir dos navegadores diferentes** (o una ventana normal y una incógnita):
   - **Navegador 1:** Inicia sesión como **VENDEDOR**
   - **Navegador 2:** Inicia sesión como **COMPRADOR** (otro usuario)

### 2.2 Crear una Pregunta

**En Navegador 2 (COMPRADOR):**
1. Ve a cualquier publicación (listing)
2. Haz una pregunta nueva
3. Verifica que se guardó

**En Navegador 1 (VENDEDOR):**
1. Ve a `/dashboard/preguntas`
2. Deberías ver la pregunta nueva
3. Abre la consola del navegador (F12)

### 2.3 Responder la Pregunta

**En Navegador 1 (VENDEDOR):**
1. Escribe una respuesta (más de 1 carácter, por ejemplo: "Sí, está disponible")
2. Haz clic en "Enviar respuesta"
3. **Observa la consola** - Deberías ver estos logs:
   ```
   [ANSWER] Enviando respuesta para pregunta: [ID]
   [ANSWER API] Ejecutando UPDATE en listing_questions...
   [ANSWER API] ✅ UPDATE ejecutado sin errores
   [ANSWER] ✅ Respuesta guardada exitosamente
   [ANSWER] Pregunta removida de la lista
   ```
4. **Verifica que la pregunta desaparece inmediatamente** de la lista
5. **Recarga la página** - La pregunta NO debe reaparecer

### 2.4 Verificar Notificación al Comprador

**En Navegador 2 (COMPRADOR):**
1. **Verifica el punto rosa** en el menú superior (debe aparecer/parpadear)
2. Haz clic en el punto rosa o en el menú de notificaciones
3. Deberías ver una notificación: **"El vendedor respondió tu pregunta"**
4. Haz clic en la notificación - Debe llevarte a la publicación

## 🔍 Paso 3: Verificar en Base de Datos

Ejecuta este SQL en Supabase para verificar que se creó la notificación:

```sql
-- Ver notificaciones recientes de respuestas
SELECT 
  id,
  user_id,
  title,
  body,
  is_read,
  created_at,
  data->>'questionId' as question_id,
  data->>'listingId' as listing_id
FROM notifications
WHERE data->>'kind' = 'listing_answer'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:** Deberías ver la notificación que se creó cuando respondiste la pregunta.

## ✅ Paso 4: Checklist Final

Verifica que:

- [ ] ✅ La pregunta desaparece inmediatamente al responderla
- [ ] ✅ La pregunta NO reaparece al recargar la página
- [ ] ✅ El comprador ve el punto rosa parpadeante
- [ ] ✅ El comprador recibe la notificación
- [ ] ✅ La notificación tiene el link correcto a la publicación
- [ ] ✅ No hay errores en la consola del navegador
- [ ] ✅ No hay errores en la terminal del servidor

## 🐛 Si Algo No Funciona

### Problema: La pregunta reaparece

**Solución:**
1. Verifica que `localStorage` está funcionando (F12 → Application → Local Storage)
2. Busca la clave `pocket_answered_questions_v1`
3. Debe contener el ID de la pregunta respondida

### Problema: No llega la notificación

**Solución:**
1. Ejecuta `VERIFICAR_TRIGGER_ACTIVO.sql` para verificar que el trigger está activo
2. Verifica que la pregunta tiene `asker_id`:
   ```sql
   SELECT id, asker_id, answer_text 
   FROM listing_questions 
   WHERE answer_text IS NOT NULL 
   ORDER BY answered_at DESC 
   LIMIT 1;
   ```
3. Si `asker_id` es NULL, ese es el problema - la pregunta no tiene el ID del comprador

### Problema: El punto rosa no aparece

**Solución:**
1. Verifica que el usuario está autenticado
2. Visita `/dashboard/notificaciones?debug=1` para ver información de debug
3. Verifica que `AccountTopMenu` no está oculto (debe estar visible en `/dashboard`)

## 📝 Notas

- Los logs en la consola son muy útiles para diagnosticar problemas
- Si ves errores, compártelos para poder ayudarte mejor
- El sistema usa `localStorage` para persistir preguntas respondidas, así que funciona incluso si hay problemas de sincronización con la BD

---

**¡Si todo funciona, el sistema está completamente configurado! 🎉**
