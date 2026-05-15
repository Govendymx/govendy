# 📊 Resumen: Cómo Funciona el Contador del Punto Rosa

## 🔍 Explicación Completa

El contador del punto rosa **NO solo cuenta notificaciones**. Cuenta **TODOS los tipos de alertas**:

### 1. ✅ Notificaciones (Tabla `notifications`)
- **Ventas**: `new_sale`, `sale_paid`
- **Soporte**: `support_message`, `support_reply`, `support_new_message`
- **Pujas perdidas**: `outbid`
- **Calificaciones**: `rating_received`, `ratings_complete`
- **Otras notificaciones**: Cualquier otra que no entre en las categorías anteriores

**Estas SÍ se eliminan con el botón "Limpiar"**

### 2. ❌ Preguntas Respondidas (Tabla `listing_questions`)
- Son preguntas que **tú hiciste** y que **ya tienen respuesta**
- Se muestran como "Te respondieron preguntas"
- **NO se eliminan con el botón "Limpiar"**
- Para eliminarlas: Ve a `/dashboard/respuestas` y léelas

### 3. ❌ Preguntas Sin Responder (Tabla `listing_questions`)
- Son preguntas que **te hicieron como vendedor** y **aún no respondes**
- Se muestran como "Tienes preguntas sin responder"
- **NO se eliminan con el botón "Limpiar"**
- Para eliminarlas: Ve a `/dashboard/preguntas` y respóndelas

### 4. ❌ Subastas que Terminan Pronto (Tablas `listings` + `favorites`)
- Son subastas en tus **favoritos** que terminan en **menos de 24 horas**
- Se muestran como "Subastas que sigues por terminar"
- **NO se eliminan con el botón "Limpiar"**
- Son alertas informativas (no se pueden "eliminar")

---

## 🔍 Cómo Verificar Qué Está Causando el Contador

### Opción 1: Ver en la Consola del Navegador

1. Abre **Herramientas de desarrollador** (F12)
2. Ve a la pestaña **Network** (Red)
3. Recarga la página (Ctrl + Shift + R)
4. Busca la petición a `/api/alerts/summary`
5. Haz clic y ve a la pestaña **Response**
6. Verás el desglose completo:

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

### Opción 2: Ejecutar SQL

Ejecuta `VERIFICAR_QUE_CAUSA_EL_CONTADOR.sql` en Supabase para ver el desglose completo.

---

## ✅ Soluciones por Tipo de Alerta

### Si el contador muestra "Tienes notificaciones importantes" (33 nuevas):
- **Solución**: Ejecuta el SQL para eliminar notificaciones
- **O**: Ve a `/dashboard/notificaciones` y elimínalas manualmente

### Si el contador muestra "Te respondieron preguntas":
- **Solución**: Ve a `/dashboard/respuestas` y léelas
- **O**: Estas se eliminan automáticamente cuando las lees

### Si el contador muestra "Tienes preguntas sin responder":
- **Solución**: Ve a `/dashboard/preguntas` y respóndelas
- **O**: Estas se eliminan cuando respondes

### Si el contador muestra "Subastas que sigues por terminar":
- **Solución**: Estas son alertas informativas, no se pueden eliminar
- **O**: Quita las subastas de tus favoritos si no quieres verlas

---

## 📋 Resumen

| Tipo de Alerta | Se Elimina con "Limpiar" | Cómo Eliminarla |
|----------------|-------------------------|-----------------|
| Notificaciones | ✅ SÍ | Botón "Limpiar" o SQL |
| Preguntas Respondidas | ❌ NO | Leer en `/dashboard/respuestas` |
| Preguntas Sin Responder | ❌ NO | Responder en `/dashboard/preguntas` |
| Subastas Terminando | ❌ NO | Quitar de favoritos |

---

**Última actualización**: Enero 2026
