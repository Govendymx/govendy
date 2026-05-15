# 🔍 Explicación: Por Qué el Contador Sigue Mostrando Números

## 🐛 Problema

El botón "Limpiar" elimina las notificaciones (`deleted: 0, remaining: 0`), pero el contador sigue mostrando números (ej: "6 nuevas", "33 nuevas").

---

## ✅ Explicación

El contador del punto rosa **NO solo cuenta notificaciones**. También cuenta:

### 1. Notificaciones de la tabla `notifications` ✅
- Estas SÍ se eliminan con el botón "Limpiar"
- Ejemplos: ventas, pagos, envíos, etc.

### 2. Preguntas respondidas (tabla `listing_questions`) ❌
- **NO se eliminan** con el botón "Limpiar"
- Son preguntas que hiciste y que ya tienen respuesta
- Se cuentan como "Te respondieron preguntas"

### 3. Preguntas sin responder (tabla `listing_questions`) ❌
- **NO se eliminan** con el botón "Limpiar"
- Son preguntas que te hicieron como vendedor y aún no respondes
- Se cuentan como "Tienes preguntas sin responder"

### 4. Subastas que terminan pronto (tabla `listings` + `favorites`) ❌
- **NO se eliminan** con el botón "Limpiar"
- Son subastas en tus favoritos que terminan en menos de 24 horas
- Se cuentan como "Subastas que sigues por terminar"

---

## 🔍 Cómo Verificar Qué Está Causando el Contador

### Opción 1: Ver en la Consola del Navegador

1. Abre **Herramientas de desarrollador** (F12)
2. Ve a la pestaña **Network** (Red)
3. Recarga la página
4. Busca la petición a `/api/alerts/summary`
5. Haz clic en ella y ve a la pestaña **Response**
6. Verás algo como:

```json
{
  "alerts": [
    { "id": "sales", "label": "Tienes ventas para revisar", "count": 1 },
    { "id": "responses", "label": "Te respondieron preguntas", "count": 5 },
    { "id": "questions", "label": "Tienes preguntas sin responder", "count": 10 },
    { "id": "other_notifications", "label": "Tienes notificaciones importantes", "count": 33 }
  ],
  "totalAlerts": 49
}
```

Esto te mostrará **exactamente** qué está causando el contador.

---

## ✅ Soluciones

### Solución 1: Marcar Preguntas como Leídas

Si el contador muestra "Te respondieron preguntas" o "Tienes preguntas sin responder":

1. Ve a `/dashboard/preguntas` o `/dashboard/respuestas`
2. Lee/Responde las preguntas
3. El contador debería disminuir

### Solución 2: Eliminar Notificaciones "Otras"

Si el contador muestra "Tienes notificaciones importantes" (33 nuevas):

1. Ve a `/dashboard/notificaciones`
2. Elimina las notificaciones manualmente
3. O ejecuta el SQL para eliminarlas directamente

### Solución 3: Verificar en SQL

Ejecuta este SQL para ver qué notificaciones tienes:

```sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email
SELECT 
  'NOTIFICACIONES' as tipo,
  COUNT(*) as cantidad
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1)
AND is_read = false

UNION ALL

SELECT 
  'PREGUNTAS RESPONDIDAS' as tipo,
  COUNT(*) as cantidad
FROM public.listing_questions
WHERE asker_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1)
AND is_deleted = false
AND answer_text IS NOT NULL

UNION ALL

SELECT 
  'PREGUNTAS SIN RESPONDER' as tipo,
  COUNT(*) as cantidad
FROM public.listing_questions
WHERE seller_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1)
AND is_deleted = false
AND answer_text IS NULL;
```

Esto te mostrará **exactamente** qué está causando el contador.

---

## 📋 Resumen

- ✅ **Notificaciones** → Se eliminan con "Limpiar"
- ❌ **Preguntas respondidas** → NO se eliminan con "Limpiar" (ve a `/dashboard/respuestas`)
- ❌ **Preguntas sin responder** → NO se eliminan con "Limpiar" (ve a `/dashboard/preguntas`)
- ❌ **Subastas que terminan** → NO se eliminan con "Limpiar" (son alertas informativas)

El botón "Limpiar" **solo elimina notificaciones**, no preguntas ni subastas.

---

**Última actualización**: Enero 2026
