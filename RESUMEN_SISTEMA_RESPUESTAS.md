# 📬 Sistema de Respuestas - Resumen Completo

## ✅ Implementación Completada

Se ha reemplazado el sistema de "Notificaciones" por un nuevo sistema de "Respuestas" que muestra todas las interacciones relacionadas con preguntas y respuestas.

---

## 🎯 ¿Qué Hace Este Sistema?

El sistema de **Respuestas** muestra:

1. **Preguntas recibidas** (como vendedor)
   - Cuando alguien hace una pregunta en tu publicación
   - Aparece inmediatamente en el menú "Respuestas"
   - Puedes hacer clic para ir a responderla

2. **Respuestas recibidas** (como comprador)
   - Cuando un vendedor responde tu pregunta
   - Aparece con la pregunta y la respuesta
   - Puedes hacer clic para ver la publicación

---

## 📁 Archivos Creados/Modificados

### Nuevos Endpoints API

1. **`app/api/responses/list/route.ts`**
   - Obtiene todas las respuestas relacionadas con el usuario
   - Combina preguntas recibidas y respuestas recibidas
   - Incluye información de listings

2. **`app/api/responses/delete/route.ts`**
   - Permite eliminar respuestas
   - Verifica permisos (solo el vendedor o quien preguntó puede eliminar)

### Nueva Página

3. **`app/dashboard/respuestas/page.tsx`**
   - Página completa para ver todas las respuestas
   - Organizadas por tipo (preguntas recibidas / respuestas recibidas)
   - Permite eliminar respuestas individualmente o en lote

### Componente Actualizado

4. **`components/AccountTopMenu.tsx`**
   - Cambiado de "Notificaciones" a "Respuestas"
   - Muestra las 10 respuestas más recientes en el dropdown
   - Enlace a `/dashboard/respuestas` para ver todas

---

## 🔄 Flujo de Uso

### Como Vendedor

1. **Recibes una pregunta:**
   - Aparece en el menú "Respuestas" (punto rosa)
   - Clic en "Respuestas" → Ver "Nueva pregunta"
   - Clic en "Responder" → Te lleva a `/dashboard/preguntas`

2. **Respondes una pregunta:**
   - La pregunta aparece como "Respondida" en tu lista de respuestas
   - El comprador recibe la respuesta en su menú

### Como Comprador

1. **Haces una pregunta:**
   - La pregunta aparece en tu lista de respuestas como "Pendiente"

2. **Recibes una respuesta:**
   - Aparece en el menú "Respuestas" (punto rosa)
   - Clic en "Respuestas" → Ver "Respondieron tu pregunta"
   - Puedes hacer clic para ver la publicación

---

## 🗑️ Eliminar Respuestas

### Eliminar Individualmente

- Pasa el mouse sobre una respuesta
- Aparece un botón de eliminar (X) en la esquina superior derecha
- Clic para eliminar

### Eliminar en Lote

1. Marca los checkboxes de las respuestas que quieres eliminar
2. Aparece un botón "Eliminar seleccionadas (N)"
3. Clic para eliminar todas de una vez

**Nota:** Solo puedes eliminar tus propias preguntas o respuestas que recibiste.

---

## 🎨 Características Visuales

### En el Menú (Dropdown)

- **Preguntas recibidas:** Fondo rosa claro, indicador "Nueva pregunta"
- **Respuestas recibidas:** Fondo rosa claro, indicador "Respondieron tu pregunta"
- Muestra preview de la pregunta y respuesta
- Fecha de creación/respuesta

### En la Página Completa

- **Sección "Preguntas recibidas":**
  - Badge "Respondida" (verde) o "Pendiente" (amarillo)
  - Botón "Responder" si está pendiente
  - Muestra tu respuesta si ya respondiste

- **Sección "Respuestas recibidas":**
  - Badge "Respondieron tu pregunta"
  - Botón "Ver publicación"
  - Muestra la respuesta del vendedor

---

## 🔗 Integración con Sistema Existente

El sistema de respuestas se integra perfectamente con:

- ✅ Sistema de preguntas (`/dashboard/preguntas`)
- ✅ Sistema de notificaciones (los triggers SQL siguen funcionando)
- ✅ Sistema de listings (enlaces a publicaciones)
- ✅ Sistema de autenticación (permisos verificados)

---

## 📊 Datos Mostrados

Para cada respuesta se muestra:

- **Tipo:** Pregunta recibida o Respuesta recibida
- **Publicación:** Título del listing
- **Pregunta:** Texto completo de la pregunta
- **Respuesta:** Texto completo (si aplica)
- **Fechas:** Cuándo se hizo la pregunta y cuándo se respondió
- **Estado:** Respondida o Pendiente

---

## 🚀 Próximos Pasos

1. **Probar el sistema:**
   - Haz una pregunta desde otra cuenta
   - Responde como vendedor
   - Verifica que todo aparezca correctamente

2. **Personalizar (opcional):**
   - Ajustar límite de respuestas mostradas
   - Cambiar estilos visuales
   - Agregar filtros (por tipo, fecha, etc.)

---

## ⚠️ Notas Importantes

- El sistema usa **soft delete** (marca como `is_deleted = true`)
- Las respuestas eliminadas no aparecen en la lista
- El sistema respeta los permisos RLS de Supabase
- Las notificaciones SQL siguen funcionando normalmente

---

## 🐛 Solución de Problemas

### No aparecen respuestas

1. Verifica que tengas preguntas/respuestas en la base de datos
2. Revisa la consola del navegador para errores
3. Verifica que el endpoint `/api/responses/list` funcione

### Error al eliminar / siguen visibles al eliminar

1. **Botón Eliminar siempre visible**: El botón X aparece en cada tarjeta. Si no lo ves, recarga la página.
2. **Verifica permisos**: Solo puedes eliminar tus propias preguntas o respuestas que recibiste.
3. **Consola del navegador (F12)**: Si sale un error al hacer clic en Eliminar, revisa el mensaje.
4. **Logs del servidor**: Busca `[DELETE RESPONSE]` para ver si el UPDATE se ejecutó correctamente.
5. **Recarga**: Después de eliminar, la lista se actualiza y se vuelve a cargar desde el servidor. Si reaparecen, el UPDATE en la BD podría estar fallando (RLS, triggers, etc.).

### El menú no se actualiza

1. Recarga la página
2. Verifica que `refreshResponses` se esté llamando
3. Revisa la consola para errores de JavaScript

---

**Última actualización:** Enero 2026
