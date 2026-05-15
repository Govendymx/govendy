# 🔍 Instrucciones para Debug: No se pueden responder preguntas

## Paso 1: Verificar en la Consola del Navegador

1. **Abre `/dashboard/preguntas`** en tu navegador
2. **Abre la consola del navegador** (F12 → pestaña "Console")
3. **Intenta responder una pregunta** (escribe algo y haz clic en "Enviar respuesta")
4. **Observa los logs** que empiezan con:
   - `[ANSWER]` - Logs del frontend
   - `[ANSWER API]` - Logs del backend (si aparecen)

## Paso 2: Verificar tu User ID

1. En la consola del navegador, ejecuta:
```javascript
// Obtener tu user_id actual
const { data } = await supabase.auth.getUser();
console.log('Mi user_id:', data.user?.id);
```

2. **Copia tu `user_id`**

## Paso 3: Verificar en Supabase

Ejecuta este SQL en Supabase → SQL Editor:

```sql
-- Reemplaza 'TU_USER_ID' con el user_id que copiaste arriba
SELECT 
  id,
  seller_id,
  CASE 
    WHEN seller_id = 'TU_USER_ID' THEN '✅ ES TU PREGUNTA - PUEDES RESPONDER'
    ELSE '❌ NO ES TU PREGUNTA - NO PUEDES RESPONDER'
  END as puedo_responder,
  LEFT(question_text, 50) as pregunta,
  answer_text,
  created_at
FROM listing_questions
WHERE is_deleted = false
  AND (answer_text IS NULL OR answer_text = '')
ORDER BY created_at DESC
LIMIT 5;
```

**Si todas las preguntas muestran "❌ NO ES TU PREGUNTA":**
- Esas preguntas son de otros vendedores
- Necesitas crear una pregunta nueva como comprador para que aparezca en tu dashboard

## Paso 4: Verificar Errores Específicos

### Error: "No autorizado" o "403"
**Causa:** El `seller_id` de la pregunta no coincide con tu `user_id`
**Solución:** Solo puedes responder preguntas donde `seller_id = tu user_id`

### Error: "42501" o "permission" o "policy"
**Causa:** Problema con las políticas RLS
**Solución:** Ejecuta `FIX_RLS_RESPONDER_PREGUNTAS.sql` de nuevo

### Error: "Missing Authorization Bearer token" o "401"
**Causa:** No estás autenticado o la sesión expiró
**Solución:** Cierra sesión y vuelve a iniciar sesión

### No aparece ningún error, pero no funciona
**Causa:** Puede ser un problema del frontend
**Solución:** 
1. Recarga la página (Ctrl+F5 para limpiar caché)
2. Verifica que el botón "Enviar respuesta" esté habilitado
3. Verifica que hayas escrito algo en el campo de respuesta

## Paso 5: Probar con una Pregunta Nueva

Si las preguntas existentes no son tuyas:

1. **Abre otra ventana del navegador** (o incógnito)
2. **Inicia sesión como OTRO usuario** (comprador)
3. **Ve a una publicación tuya** (como vendedor)
4. **Haz una pregunta** desde el perfil del comprador
5. **Vuelve a tu ventana original** (como vendedor)
6. **Ve a `/dashboard/preguntas`**
7. **Deberías ver la pregunta nueva**
8. **Intenta responderla**

## 📝 Compartir Información

Si aún no funciona, comparte:

1. **Tu `user_id`** (del paso 2)
2. **El `seller_id` de una pregunta** que quieres responder
3. **Los logs de la consola** (especialmente los que empiezan con `[ANSWER]`)
4. **Cualquier error en rojo** que aparezca

Con esta información podré identificar exactamente qué está fallando.
