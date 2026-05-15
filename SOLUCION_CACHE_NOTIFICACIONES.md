# 🔧 Solución: Notificaciones que Vuelven por Caché

## 🐛 Problema

Las notificaciones se eliminan de la base de datos pero siguen apareciendo en la aplicación. Esto puede deberse a caché en múltiples niveles.

---

## ✅ Solución Completa: Limpiar Caché en Todos los Niveles

### Paso 1: Verificar que se Eliminaron de la BD

**Ejecuta en Supabase → SQL Editor:**

```sql
-- Reemplaza 'tu-email@ejemplo.com' con tu email
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);
```

Si el resultado muestra `no_leidas = 0`, las notificaciones están eliminadas de la BD. El problema es caché.

---

### Paso 2: Limpiar Caché del Navegador

1. **Abre las herramientas de desarrollador** (F12)
2. **Clic derecho en el botón de recargar** (junto a la barra de direcciones)
3. **Selecciona "Vaciar caché y volver a cargar de forma forzada"** (o "Hard Reload")
4. O usa **Ctrl + Shift + R** (Windows) o **Cmd + Shift + R** (Mac)

**Alternativa:**
1. Abre **Configuración del navegador**
2. Ve a **Privacidad y seguridad** → **Borrar datos de navegación**
3. Selecciona **"Caché e imágenes almacenadas"**
4. Haz clic en **"Borrar datos"**

---

### Paso 3: Reiniciar el Servidor de Desarrollo

**Si estás ejecutando el servidor localmente:**

1. **Detén el servidor** (Ctrl + C en la terminal)
2. **Elimina la carpeta `.next`** (caché de Next.js):
   ```bash
   # En Windows PowerShell:
   Remove-Item -Recurse -Force .next
   
   # O en CMD:
   rmdir /s /q .next
   ```
3. **Reinicia el servidor**:
   ```bash
   npm run dev
   # o
   yarn dev
   ```

---

### Paso 4: Limpiar Caché de Next.js

**Ejecuta en la terminal (en la raíz del proyecto):**

```bash
# Eliminar carpeta .next (caché de Next.js)
rm -rf .next

# O en Windows:
rmdir /s /q .next

# Luego reinstalar dependencias (opcional pero recomendado)
npm install
# o
yarn install

# Reiniciar servidor
npm run dev
```

---

### Paso 5: Verificar Caché de Supabase

**En Supabase Dashboard:**

1. Ve a **Settings** → **API**
2. Verifica que no hay caché configurado
3. Si usas **Edge Functions**, verifica su caché también

---

### Paso 6: Forzar Actualización desde la Aplicación

**Después de limpiar caché:**

1. **Cierra completamente el navegador**
2. **Abre el navegador de nuevo**
3. **Abre la aplicación en modo incógnito** (Ctrl + Shift + N)
4. **Inicia sesión de nuevo**
5. **Verifica que las notificaciones no aparecen**

---

## 🔍 Verificar que Funcionó

### 1. Verificar en la BD (SQL):

```sql
-- Debe mostrar 0 notificaciones no leídas
SELECT COUNT(*) as no_leidas
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1)
AND is_read = false;
```

### 2. Verificar en la Aplicación:

1. Recarga la página con **Ctrl + Shift + R**
2. El punto rosa **NO debe aparecer**
3. Abre el dropdown de notificaciones
4. **NO debe mostrar "6 nuevas"** o cualquier número

### 3. Verificar en la Consola del Navegador:

1. Abre **Herramientas de desarrollador** (F12)
2. Ve a la pestaña **Network** (Red)
3. Recarga la página
4. Busca la petición a `/api/alerts/summary`
5. Verifica que el `totalAlerts` es `0`

---

## 🛠️ Script de Limpieza Completa

**Ejecuta estos comandos en la terminal (en la raíz del proyecto):**

```bash
# 1. Detener el servidor (si está corriendo)
# Ctrl + C

# 2. Eliminar caché de Next.js
rm -rf .next
# O en Windows: rmdir /s /q .next

# 3. Eliminar node_modules (opcional, pero recomendado si persiste)
rm -rf node_modules
# O en Windows: rmdir /s /q node_modules

# 4. Reinstalar dependencias
npm install
# o yarn install

# 5. Reiniciar servidor
npm run dev
# o yarn dev
```

---

## 📋 Checklist Completo

- [ ] Verificar en SQL que las notificaciones están eliminadas (debe mostrar 0)
- [ ] Limpiar caché del navegador (Ctrl + Shift + R)
- [ ] Eliminar carpeta `.next`
- [ ] Reiniciar servidor de desarrollo
- [ ] Cerrar y abrir navegador de nuevo
- [ ] Probar en modo incógnito
- [ ] Verificar en la consola del navegador (Network tab)
- [ ] Verificar que el punto rosa no aparece

---

## 🚨 Si Aún Persiste

1. **Verifica que realmente se eliminaron de la BD:**
   - Ejecuta el SQL de verificación
   - Si muestra 0, el problema es definitivamente caché

2. **Prueba en otro navegador:**
   - Chrome, Firefox, Edge
   - O en modo incógnito

3. **Verifica la configuración de caché en Next.js:**
   - Revisa `next.config.js`
   - Verifica headers de caché en las APIs

4. **Revisa logs del servidor:**
   - Verifica que las peticiones a `/api/alerts/summary` retornan `totalAlerts: 0`

---

**Última actualización**: Enero 2026  
**Estado**: ✅ Solución completa para problemas de caché
