# 🔍 Debug: Fernanda no puede responder preguntas

## 📋 Pasos para Diagnosticar

### Paso 1: Obtener el user_id de Fernanda

1. **Abre la consola del navegador** (F12 → Console)
2. **Ejecuta:**
```javascript
const { data } = await supabase.auth.getUser();
console.log('Mi user_id:', data.user?.id);
console.log('Mi email:', data.user?.email);
console.log('Mi nombre:', data.user?.user_metadata?.full_name);
```

3. **Copia el `user_id` de Fernanda**

### Paso 2: Verificar en Supabase

Ejecuta este SQL en Supabase (reemplaza `'USER_ID_DE_FERNANDA'` con el user_id copiado):

```sql
-- Ver preguntas pendientes de Fernanda
SELECT 
  lq.id as pregunta_id,
  lq.seller_id,
  CASE 
    WHEN lq.seller_id = 'USER_ID_DE_FERNANDA' THEN '✅ ES SU PREGUNTA'
    ELSE '❌ NO ES SU PREGUNTA'
  END as es_suya,
  lq.question_text,
  lq.answer_text,
  l.title as producto
FROM listing_questions lq
LEFT JOIN listings l ON l.id = lq.listing_id
WHERE lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
  AND lq.seller_id = 'USER_ID_DE_FERNANDA'
ORDER BY lq.created_at DESC;
```

### Paso 3: Intentar Responder y Ver Logs

1. **Ve a `/dashboard/preguntas`** (como Fernanda)
2. **Abre la consola del navegador** (F12 → Console)
3. **Escribe una respuesta** en uno de los campos
4. **Haz clic en "Enviar respuesta"**
5. **Observa los logs** que empiezan con:
   - `[ANSWER]` - Logs del frontend
   - `[ANSWER API]` - Logs del backend

### Paso 4: Verificar Errores Específicos

#### Error: "No autorizado" o "403"
**Causa:** El `seller_id` de la pregunta no coincide con el `user_id` de Fernanda
**Solución:** Verifica que el `seller_id` de la pregunta sea igual al `user_id` de Fernanda

#### Error: "42501" o "permission" o "policy"
**Causa:** Problema con las políticas RLS
**Solución:** Ejecuta `FIX_RLS_RESPONDER_PREGUNTAS.sql` de nuevo

#### Error: "Missing Authorization Bearer token" o "401"
**Causa:** La sesión expiró
**Solución:** Cierra sesión y vuelve a iniciar sesión

#### No aparece ningún error, pero no funciona
**Causa:** Puede ser un problema del frontend
**Solución:** 
1. Recarga la página (Ctrl+F5 para limpiar caché)
2. Verifica que el botón "Enviar respuesta" esté habilitado
3. Verifica que hayas escrito algo en el campo de respuesta (más de 1 carácter)

## 📝 Compartir Información

Si aún no funciona, comparte:

1. **El `user_id` de Fernanda** (del paso 1)
2. **El `seller_id` de una pregunta** que quiere responder (del paso 2)
3. **Los logs de la consola** (especialmente los que empiezan con `[ANSWER]` o `[ANSWER API]`)
4. **Cualquier error en rojo** que aparezca

Con esta información podré identificar exactamente qué está fallando.
