# ✅ Checklist de Verificación para Compilación y Despliegue

## 📋 Estado Actual

✅ **Sin errores de linter detectados**  
✅ **Configuración de TypeScript correcta**  
✅ **Dependencias instaladas**  
✅ **Imports correctos**  
✅ **Archivos críticos revisados**

---

## 🔧 Variables de Entorno Requeridas

Antes de compilar y desplegar, asegúrate de tener estas variables de entorno configuradas:

### Variables Públicas (NEXT_PUBLIC_*)
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

### Variables Privadas (Solo servidor)
```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_de_supabase
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_de_mercadopago
MERCADOPAGO_WEBHOOK_SECRET=tu_webhook_secret_de_mercadopago
```

**⚠️ IMPORTANTE**: 
- `SUPABASE_SERVICE_ROLE_KEY` debe ser diferente de `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No subas el archivo `.env.local` al repositorio (ya está en `.gitignore`)

---

## 🚀 Comandos para Compilar

### 1. Limpiar caché (recomendado antes de compilar)
```bash
# Windows PowerShell
Remove-Item -Recurse -Force .next, .next-dev -ErrorAction SilentlyContinue

# O manualmente elimina las carpetas .next y .next-dev
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Verificar errores de TypeScript
```bash
npm run lint
```

### 4. Compilar para producción
```bash
npm run build
```

### 5. Probar localmente (opcional)
```bash
npm start
```

---

## ✅ Verificaciones Pre-Despliegue

### 1. Base de Datos (Supabase)
- [ ] Tabla `estafeta_quotes` existe y tiene todas las columnas necesarias
- [ ] Tabla `app_settings` existe con configuración de Estafeta
- [ ] Tabla `home_banners` existe y soporta `placement: 'estafeta'`
- [ ] Tabla `notifications` existe y funciona correctamente
- [ ] Tabla `orders` existe con todas las columnas necesarias
- [ ] Tabla `listing_questions` existe
- [ ] Políticas RLS configuradas correctamente
- [ ] Triggers SQL funcionando (si aplica)

### 2. Configuración de Estafeta
- [ ] Configuración de rangos de peso en `app_settings.estafeta_config`
- [ ] Banner de Estafeta configurado (opcional)

### 3. MercadoPago
- [ ] `MERCADOPAGO_ACCESS_TOKEN` configurado
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` configurado
- [ ] Webhook configurado en MercadoPago apuntando a: `https://tu-dominio.com/api/mercadopago/webhook`

### 4. Archivos Críticos
- [ ] `next.config.mjs` configurado correctamente
- [ ] `tsconfig.json` sin errores
- [ ] `package.json` con todas las dependencias
- [ ] `.gitignore` incluye `.env*` y `.next*`

---

## 🐛 Problemas Comunes y Soluciones

### Error: "Missing Authorization Bearer token"
**Causa**: Variables de entorno no configuradas  
**Solución**: Verificar que todas las variables estén en el hosting

### Error: "SUPABASE_SERVICE_ROLE_KEY es igual a NEXT_PUBLIC_SUPABASE_ANON_KEY"
**Causa**: Se usó la anon key en lugar de la service role key  
**Solución**: Usar la key "service_role" de Supabase (Settings → API → service_role)

### Error: "Table does not exist"
**Causa**: Tablas no creadas en Supabase  
**Solución**: Ejecutar los scripts SQL necesarios en Supabase

### Error de compilación: "Cannot find module"
**Causa**: Dependencias no instaladas  
**Solución**: Ejecutar `npm install`

### Error: "Rendered more hooks than during the previous render"
**Causa**: Hooks condicionales o en orden incorrecto  
**Solución**: Verificar que todos los hooks estén al inicio del componente, antes de cualquier `return`

---

## 📦 Configuración para Hosting

### Vercel (Recomendado)
1. Conecta tu repositorio
2. Agrega las variables de entorno en Settings → Environment Variables
3. Vercel detectará automáticamente Next.js y configurará el build

### Otros Hostings (Netlify, Railway, etc.)
1. Configura el comando de build: `npm run build`
2. Configura el comando de start: `npm start`
3. Agrega todas las variables de entorno necesarias
4. Asegúrate de que Node.js 18+ esté disponible

---

## 🔍 Verificación Post-Despliegue

Después de desplegar, verifica:

1. **Página principal**: `https://tu-dominio.com`
2. **Login/Registro**: Funciona correctamente
3. **Panel de Estafeta**: `/estafeta/cotizar` carga sin errores
4. **Panel de Admin**: `/admin/estafeta` accesible para administradores
5. **Webhook de MercadoPago**: Configurado y funcionando
6. **Notificaciones**: Se crean y muestran correctamente

---

## 📝 Notas Importantes

- El proyecto usa Next.js 14 con App Router
- Requiere Node.js 18 o superior
- Las imágenes remotas están configuradas para Cloudinary y Supabase
- El sistema de notificaciones requiere triggers SQL en Supabase
- El sistema de Estafeta requiere tablas y configuración específica

---

## ✅ Estado Final

Si todos los checks pasan, el proyecto está listo para:
- ✅ Compilación local (`npm run build`)
- ✅ Despliegue en hosting
- ✅ Producción

**Última verificación**: Sin errores de linter detectados  
**Fecha**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
