# 🔧 Solución Final: Notificaciones Atoradas que No Se Eliminan

## 🐛 Problema

Ejecutaste el SQL para eliminar notificaciones, pero el contador sigue mostrando números (ej: 35 nuevas).

**Posibles causas:**
1. Las notificaciones están en la BD pero con `is_read` en un estado incorrecto
2. Caché del navegador o del servidor
3. Las notificaciones se están recreando automáticamente
4. El contador cuenta otras cosas además de notificaciones (preguntas, subastas)

---

## ✅ Solución Paso a Paso

### Paso 1: Verificar en SQL qué Tienes Realmente

**Ejecuta en Supabase → SQL Editor:**

```sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE is_read IS NULL) as is_read_null
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1);
```

**Si muestra `no_leidas = 0`**, las notificaciones están eliminadas. El problema es caché o el contador cuenta otras cosas.

### Paso 2: Eliminar TODAS las Notificaciones (Opción Nuclear)

**Ejecuta en Supabase → SQL Editor:**

```sql
-- Archivo: ELIMINAR_TODO_AGRESIVO.sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email
DELETE FROM public.notifications 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1);
```

### Paso 3: Verificar qué Retorna la API

**Abre la consola del navegador (F12) y ejecuta:**

```javascript
// Obtener token
const token = (await (await fetch('/api/auth/session')).json()).access_token;

// Llamar a la API directamente
const res = await fetch('/api/alerts/summary', {
  headers: { authorization: `Bearer ${token}` }
});
const data = await res.json();
console.log('Alertas desde API:', data);
```

Esto te mostrará **exactamente** qué está retornando la API.

### Paso 4: Forzar Actualización del Frontend

**Abre la consola del navegador (F12) y ejecuta:**

```javascript
// Forzar actualización completa
window.dispatchEvent(new CustomEvent('notifications-updated', { 
  detail: { forceRefresh: true } 
}));

// Limpiar estado local
localStorage.clear();
sessionStorage.clear();

// Recargar sin caché
location.reload(true);
```

### Paso 5: Limpiar Caché del Navegador

1. **Abre Herramientas de desarrollador** (F12)
2. **Ve a Application** → **Storage** → **Clear site data**
3. **Marca todas las opciones**
4. **Clic en "Clear"**

### Paso 6: Verificar en Modo Incógnito

1. Abre una ventana de incógnito (Ctrl + Shift + N)
2. Inicia sesión en la aplicación
3. Verifica si el contador aparece

**Si NO aparece en incógnito**, el problema es caché del navegador.

---

## 🔍 Diagnóstico Avanzado

### Ver qué Retorna la API `/api/alerts/summary`

**Abre Herramientas de desarrollador (F12) → Network:**

1. Recarga la página (Ctrl + Shift + R)
2. Busca la petición a `/api/alerts/summary`
3. Haz clic y ve a la pestaña **Response**
4. Verás algo como:

```json
{
  "alerts": [
    { "id": "sales", "count": 1 },
    { "id": "rated_buyer", "count": 1 },
    { "id": "other_notifications", "count": 33 }
  ],
  "totalAlerts": 35
}
```

Esto te mostrará **exactamente** qué está causando el contador.

---

## 🛠️ Si el Contador Muestra "33 nuevas" en "Tienes notificaciones importantes"

Esto significa que hay **33 notificaciones** en la tabla `notifications` con tipos que no son:
- `new_sale`, `sale_paid` (ventas)
- `support_*` (soporte)
- `outbid` (pujas)
- `rating_received`, `ratings_complete` (calificaciones)

**Solución:**

```sql
-- Eliminar notificaciones "otras" específicamente
DELETE FROM public.notifications 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1)
AND is_read = false
AND NOT (
  LOWER(COALESCE(data->>'kind', type::text, '')) IN ('new_sale', 'sale_paid', 'outbid', 'rating_received', 'ratings_complete')
  OR LOWER(COALESCE(data->>'kind', type::text, '')) LIKE 'support%'
);
```

---

## 📋 Checklist Completo

- [ ] Ejecutar SQL para verificar cuántas notificaciones hay
- [ ] Si hay notificaciones, ejecutar `ELIMINAR_TODO_AGRESIVO.sql`
- [ ] Verificar en SQL que total = 0
- [ ] Abrir consola del navegador y ver qué retorna `/api/alerts/summary`
- [ ] Ejecutar JavaScript para forzar actualización
- [ ] Limpiar caché del navegador (Application → Clear storage)
- [ ] Recargar página sin caché (Ctrl + Shift + R)
- [ ] Probar en modo incógnito
- [ ] Si persiste, reiniciar servidor de desarrollo

---

**Última actualización**: Enero 2026
