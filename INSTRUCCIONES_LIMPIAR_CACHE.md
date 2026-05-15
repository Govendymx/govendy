# 🧹 Instrucciones: Limpiar Caché Completo

## 🐛 Problema

Las notificaciones se eliminan de la BD pero siguen apareciendo en la aplicación debido a caché.

---

## ✅ Solución Rápida (Windows)

### Opción 1: Script Automático

1. **Ejecuta el archivo:** `LIMPIAR_CACHE_COMPLETO.bat`
2. **Espera a que termine**
3. **Ejecuta:** `npm run dev`

### Opción 2: Manual

**Abre PowerShell o CMD en la raíz del proyecto y ejecuta:**

```powershell
# 1. Detener servidor (si está corriendo)
# Presiona Ctrl+C en la terminal donde corre el servidor

# 2. Eliminar caché de Next.js
Remove-Item -Recurse -Force .next

# 3. (Opcional) Eliminar node_modules
Remove-Item -Recurse -Force node_modules

# 4. Reinstalar dependencias
npm install

# 5. Reiniciar servidor
npm run dev
```

---

## ✅ Solución Rápida (Mac/Linux)

### Opción 1: Script Automático

1. **Haz el script ejecutable:**
   ```bash
   chmod +x LIMPIAR_CACHE_COMPLETO.sh
   ```

2. **Ejecuta el script:**
   ```bash
   ./LIMPIAR_CACHE_COMPLETO.sh
   ```

3. **Ejecuta:** `npm run dev`

### Opción 2: Manual

```bash
# 1. Detener servidor (si está corriendo)
# Presiona Ctrl+C en la terminal donde corre el servidor

# 2. Eliminar caché de Next.js
rm -rf .next

# 3. (Opcional) Eliminar node_modules
rm -rf node_modules

# 4. Reinstalar dependencias
npm install

# 5. Reiniciar servidor
npm run dev
```

---

## 🧹 Limpiar Caché del Navegador

### Chrome/Edge:

1. **Abre las herramientas de desarrollador** (F12)
2. **Clic derecho en el botón de recargar** (junto a la barra de direcciones)
3. **Selecciona "Vaciar caché y volver a cargar de forma forzada"**

**O:**

1. **Presiona:** `Ctrl + Shift + Delete` (Windows) o `Cmd + Shift + Delete` (Mac)
2. **Selecciona:** "Caché e imágenes almacenadas"
3. **Período:** "Última hora" o "Todo el tiempo"
4. **Haz clic en:** "Borrar datos"

### Firefox:

1. **Presiona:** `Ctrl + Shift + Delete`
2. **Selecciona:** "Caché"
3. **Haz clic en:** "Limpiar ahora"

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

1. **Cierra completamente el navegador**
2. **Abre el navegador de nuevo**
3. **Abre la aplicación en modo incógnito** (Ctrl + Shift + N)
4. **Inicia sesión de nuevo**
5. **Verifica que el punto rosa NO aparece**

### 3. Verificar en la Consola del Navegador:

1. **Abre Herramientas de desarrollador** (F12)
2. **Ve a la pestaña Network** (Red)
3. **Recarga la página** (Ctrl + Shift + R)
4. **Busca la petición a** `/api/alerts/summary`
5. **Verifica que el `totalAlerts` es `0`**

---

## 📋 Checklist Completo

- [ ] Detener servidor de desarrollo (Ctrl + C)
- [ ] Eliminar carpeta `.next`
- [ ] (Opcional) Eliminar `node_modules` y reinstalar
- [ ] Reiniciar servidor (`npm run dev`)
- [ ] Limpiar caché del navegador (Ctrl + Shift + R)
- [ ] Cerrar y abrir navegador de nuevo
- [ ] Probar en modo incógnito
- [ ] Verificar en la consola (Network tab) que `totalAlerts = 0`

---

## 🚨 Si Aún Persiste

1. **Verifica que realmente se eliminaron de la BD:**
   - Ejecuta el SQL de verificación
   - Si muestra 0, el problema es definitivamente caché

2. **Prueba en otro navegador:**
   - Chrome, Firefox, Edge
   - O en modo incógnito

3. **Revisa logs del servidor:**
   - Verifica que las peticiones a `/api/alerts/summary` retornan `totalAlerts: 0`

4. **Reinicia completamente:**
   - Cierra todas las ventanas del navegador
   - Cierra todas las terminales
   - Reinicia la computadora (último recurso)

---

**Última actualización**: Enero 2026
