# 🚀 Guía SIMPLE de Deployment - Pocket App

**Esta guía te ayudará a desplegar tu app sin errores en Vercel, Netlify o Railway.**

---

## ⚠️ ANTES DE EMPEZAR

### 1. Verifica que tu app compile localmente:

```bash
# Limpiar cache
Remove-Item -Recurse -Force .next-dev, .next -ErrorAction SilentlyContinue

# Instalar dependencias
npm install --legacy-peer-deps

# Compilar
npm run build
```

**Si hay errores, corrígelos ANTES de desplegar.**

---

## 🎯 OPCIÓN 1: VERCEL (⭐ MÁS FÁCIL)

### Paso 1: Sube tu código a GitHub

```bash
git add .
git commit -m "Preparado para deployment"
git push
```

### Paso 2: Crea cuenta en Vercel

1. Ve a https://vercel.com
2. Inicia sesión con GitHub
3. Haz clic en **"Add New Project"**
4. Selecciona tu repositorio

### Paso 3: Configuración en Vercel

**Deja todo por defecto** (Vercel detecta Next.js automáticamente):
- Framework Preset: **Next.js** (automático)
- Root Directory: **./** (vacío)
- Build Command: **npm run build** (automático)
- Output Directory: **.next** (automático)

### Paso 4: Variables de Entorno

En Vercel, ve a **Settings → Environment Variables** y agrega TODAS estas variables:

```env
# SUPABASE (OBLIGATORIO)
NEXT_PUBLIC_SUPABASE_URL=https://xlnxdzocwgrzqoznmarc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# CLOUDINARY (OBLIGATORIO)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# RESEND (si usas email)
RESEND_API_KEY=re_tu-api-key
EMAIL_FROM=contacto@gopocket.com.mx
EMAIL_FROM_NAME=GoPocket

# URL DEL SITIO (actualizar después del primer despliegue)
NEXT_PUBLIC_SITE_URL=https://tu-proyecto.vercel.app
```

**⚠️ IMPORTANTE:**
- Reemplaza los valores con tus credenciales reales
- Después del primer despliegue, actualiza `NEXT_PUBLIC_SITE_URL` con la URL que Vercel te asigne

### Paso 5: Desplegar

1. Haz clic en **"Deploy"**
2. Espera 2-5 minutos
3. ¡Listo! Tu app estará en `https://tu-proyecto.vercel.app`

### Paso 6: Configurar Supabase (después del despliegue)

1. Ve a tu proyecto en Supabase
2. **Settings → Authentication → URL Configuration**
3. Agrega en **"Site URL"** y **"Redirect URLs"**:
   ```
   https://tu-proyecto.vercel.app
   ```

---

## 🎯 OPCIÓN 2: NETLIFY

### Paso 1: Sube tu código a GitHub (igual que Vercel)

### Paso 2: Crea cuenta en Netlify

1. Ve a https://netlify.com
2. Inicia sesión con GitHub
3. Haz clic en **"Add new site" → "Import an existing project"**
4. Selecciona tu repositorio

### Paso 3: Configuración en Netlify

**Build settings:**
- Build command: `npm run build`
- Publish directory: `.next`
- Node version: `20`

### Paso 4: Variables de Entorno

En Netlify, ve a **Site settings → Environment variables** y agrega las mismas variables que en Vercel.

### Paso 5: Desplegar

1. Haz clic en **"Deploy site"**
2. Espera a que termine
3. ¡Listo!

---

## 🎯 OPCIÓN 3: RAILWAY

### Paso 1: Sube tu código a GitHub

### Paso 2: Crea cuenta en Railway

1. Ve a https://railway.app
2. Inicia sesión con GitHub
3. Haz clic en **"New Project" → "Deploy from GitHub repo"**
4. Selecciona tu repositorio

### Paso 3: Configuración

Railway detecta Next.js automáticamente. Solo necesitas:

1. **Variables de Entorno**: Ve a **Variables** y agrega todas las variables (igual que Vercel)
2. **Build Command**: `npm run build` (automático)
3. **Start Command**: `npm start` (automático)

### Paso 4: Desplegar

Railway despliega automáticamente. Solo espera.

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de desplegar, verifica:

- [ ] `npm run build` funciona sin errores localmente
- [ ] Todas las variables de entorno están configuradas en el hosting
- [ ] El código está en GitHub
- [ ] Supabase está configurado con las URLs correctas (después del despliegue)

---

## 🐛 ERRORES COMUNES Y SOLUCIONES

### Error: "Build failed"

**Solución:**
1. Prueba localmente: `npm run build`
2. Revisa los logs en el hosting
3. Asegúrate de que todas las dependencias estén en `package.json`

### Error: "Missing environment variables"

**Solución:**
1. Verifica que TODAS las variables estén en el hosting
2. Las variables que empiezan con `NEXT_PUBLIC_` son públicas (van al cliente)
3. Las demás son privadas (solo servidor)

### Error: "Supabase connection failed"

**Solución:**
1. Verifica que las variables de Supabase estén correctas
2. Verifica que la URL de tu app esté en Supabase → Settings → Authentication → URL Configuration

### La app funciona pero las imágenes no cargan

**Solución:**
1. Verifica las variables de Cloudinary
2. Verifica que Cloudinary esté configurado correctamente

---

## 📝 RESUMEN RÁPIDO

1. ✅ Compila localmente: `npm run build`
2. ✅ Sube a GitHub
3. ✅ Crea cuenta en Vercel/Netlify/Railway
4. ✅ Configura TODAS las variables de entorno
5. ✅ Despliega
6. ✅ Configura Supabase con la URL de producción

---

## 💰 COSTOS

**Plan gratuito es suficiente para empezar:**
- Vercel: Gratis (hasta 100GB/mes)
- Netlify: Gratis (hasta 100GB/mes)
- Railway: $5 crédito gratis/mes
- Supabase: Gratis (hasta 500MB)
- Cloudinary: Gratis (hasta 25GB)

---

¿Necesitas ayuda? Revisa los logs de build en tu plataforma de hosting para ver errores específicos.
