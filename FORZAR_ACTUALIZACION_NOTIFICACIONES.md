# 🔄 Forzar Actualización de Notificaciones

## 🐛 Problema

Después de eliminar notificaciones en SQL, el contador sigue mostrando números en el frontend.

---

## ✅ Solución: Forzar Actualización Completa

### Paso 1: Eliminar TODAS las Notificaciones en SQL

**Ejecuta en Supabase → SQL Editor:**

```sql
-- Archivo: ELIMINAR_TODO_AGRESIVO.sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email
DELETE FROM public.notifications 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1);
```

### Paso 2: Limpiar Caché del Navegador

1. **Abre Herramientas de desarrollador** (F12)
2. **Ve a la pestaña Application** (o Almacenamiento)
3. **Clic en "Clear storage"** (Limpiar almacenamiento)
4. **Marca todas las opciones**
5. **Clic en "Clear site data"** (Limpiar datos del sitio)

### Paso 3: Forzar Actualización en la Aplicación

**Abre la consola del navegador (F12) y ejecuta:**

```javascript
// Forzar actualización del contador
window.dispatchEvent(new CustomEvent('notifications-updated', { 
  detail: { forceRefresh: true } 
}));

// Limpiar estado local
localStorage.clear();
sessionStorage.clear();

// Recargar página sin caché
location.reload(true);
```

### Paso 4: Verificar en la Consola

**Abre Herramientas de desarrollador (F12) → Network:**

1. Recarga la página (Ctrl + Shift + R)
2. Busca la petición a `/api/alerts/summary`
3. Haz clic y ve a la pestaña **Response**
4. Verifica que `totalAlerts` es `0`

---

## 🛠️ Si Aún Persiste

### Opción 1: Reiniciar Servidor de Desarrollo

```bash
# Detener servidor (Ctrl + C)
# Eliminar caché
rm -rf .next
# Reiniciar
npm run dev
```

### Opción 2: Verificar en Modo Incógnito

1. Abre una ventana de incógnito (Ctrl + Shift + N)
2. Inicia sesión en la aplicación
3. Verifica si el contador aparece

Si NO aparece en incógnito, el problema es caché del navegador.

### Opción 3: Verificar Estado de la BD

Ejecuta este SQL para verificar:

```sql
-- Reemplaza el email
SELECT COUNT(*) as total
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1)
AND is_read = false;
```

Si muestra `0`, las notificaciones están eliminadas. El problema es caché del frontend.

---

## 📋 Checklist

- [ ] Ejecutar `ELIMINAR_TODO_AGRESIVO.sql` en Supabase
- [ ] Verificar en SQL que total = 0
- [ ] Limpiar caché del navegador (Application → Clear storage)
- [ ] Ejecutar JavaScript en consola para forzar actualización
- [ ] Recargar página sin caché (Ctrl + Shift + R)
- [ ] Verificar en Network tab que `totalAlerts = 0`
- [ ] Probar en modo incógnito
- [ ] Si persiste, reiniciar servidor de desarrollo

---

**Última actualización**: Enero 2026
