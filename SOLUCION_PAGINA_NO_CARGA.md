# 🔧 Solución: Página /admin/usuarios No Carga

## 🚨 Problema
La página `/admin/usuarios` muestra una pantalla en blanco en localhost.

---

## ✅ Soluciones Rápidas

### 1. **Verificar que el servidor esté corriendo**

```bash
# En la terminal, verifica que veas algo como:
# ▲ Next.js 14.2.35
# - Local:        http://localhost:3000
```

**Si no está corriendo:**
```bash
npm run dev
# o
yarn dev
```

---

### 2. **Limpiar caché y reiniciar**

```bash
# Detén el servidor (Ctrl + C)
# Luego:
rm -rf .next
npm run dev
```

**En Windows PowerShell:**
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

---

### 3. **Verificar errores en la consola del navegador**

1. Abre DevTools: `F12` o `Ctrl + Shift + I`
2. Ve a la pestaña **Console**
3. Busca errores en rojo
4. Comparte los errores que veas

**Errores comunes:**
- `Cannot read property 'X' of undefined`
- `Module not found`
- `SyntaxError`

---

### 4. **Verificar errores en la terminal del servidor**

En la terminal donde corre `npm run dev`, busca:
- Errores en rojo
- Mensajes de "Error" o "Failed"
- Stack traces

---

### 5. **Verificar autenticación**

La página requiere:
- ✅ Estar autenticado
- ✅ Tener permisos de administrador

**Si no estás autenticado:**
- La página debería redirigirte a `/login`
- Si no redirige, hay un problema con el código

---

### 6. **Verificar variables de entorno**

Asegúrate de tener un archivo `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

---

## 🔍 Diagnóstico Detallado

### Paso 1: Verificar que el componente se renderiza

Abre `app/admin/usuarios/page.tsx` y verifica que:
- ✅ No hay errores de sintaxis
- ✅ Todos los imports están correctos
- ✅ El componente exporta correctamente

### Paso 2: Verificar la API

La página hace una llamada a `/api/admin/users/search` al cargar.

**Prueba manualmente:**
1. Abre: `http://localhost:3000/api/admin/users/search?limit=100`
2. Deberías ver un JSON (o un error de autenticación)

**Si la API falla:**
- La página no podrá cargar usuarios
- Revisa los logs del servidor

### Paso 3: Verificar permisos de admin

La página verifica si eres admin en el `useEffect` inicial.

**Verifica en la consola del navegador:**
```javascript
// Abre la consola y ejecuta:
localStorage.getItem('supabase.auth.token')
```

**O verifica en Supabase:**
- Ve a tu tabla `admin_users`
- Confirma que tu `user_id` está en la lista

---

## 🛠️ Soluciones Específicas

### Si ves "Cannot read property 'X' of undefined"

**Problema:** Alguna propiedad no existe en el objeto.

**Solución:** Agrega validaciones defensivas:

```typescript
// En lugar de:
user.admin_state.status

// Usa:
user?.admin_state?.status || 'active'
```

### Si ves "Module not found"

**Problema:** Falta una dependencia o un import está mal.

**Solución:**
```bash
npm install
# o
yarn install
```

### Si la página carga pero está en blanco

**Problema:** El componente no está renderizando nada.

**Solución:** Verifica que el `return` del componente tenga contenido.

---

## 📋 Checklist de Verificación

- [ ] El servidor de desarrollo está corriendo
- [ ] No hay errores en la consola del navegador
- [ ] No hay errores en la terminal del servidor
- [ ] Estás autenticado
- [ ] Tienes permisos de administrador
- [ ] Las variables de entorno están configuradas
- [ ] La API `/api/admin/users/search` responde
- [ ] El componente tiene un `return` válido

---

## 🚀 Solución Rápida (Última Opción)

Si nada funciona, intenta:

1. **Cerrar completamente el servidor**
2. **Eliminar `.next` y `node_modules/.cache`**
3. **Reinstalar dependencias:**
   ```bash
   rm -rf node_modules .next
   npm install
   npm run dev
   ```

---

## 📞 Información para Reportar el Problema

Si el problema persiste, comparte:

1. **Errores de la consola del navegador** (F12 → Console)
2. **Errores de la terminal del servidor**
3. **URL exacta** que estás visitando
4. **Pasos para reproducir** el problema

---

## ✅ Verificación Final

Después de aplicar las soluciones:

1. Recarga la página: `Ctrl + F5` (forzar recarga)
2. Abre DevTools: `F12`
3. Ve a la pestaña **Network**
4. Recarga la página
5. Verifica que todas las peticiones tengan status `200` o `304`

Si alguna petición falla (status `4xx` o `5xx`), ese es el problema.

---

¿Qué error específico ves en la consola del navegador? 🔍
