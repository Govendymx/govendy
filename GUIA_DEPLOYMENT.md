# 🚀 Guía de Deployment - Pocket App

Esta guía te ayudará a subir tu aplicación a un hosting y hacerla funcionar en producción.

---

## ✅ ¿Se puede subir a hosting?

**SÍ**, tu aplicación está lista para producción. Es una aplicación **Next.js 14** que se puede desplegar fácilmente en varios servicios de hosting.

---

## 🎯 Mejores opciones de hosting para Next.js

### 1. **Vercel** (⭐ RECOMENDADO - Más fácil)
- ✅ Gratis para proyectos personales
- ✅ Despliegue automático desde GitHub
- ✅ Optimizado específicamente para Next.js
- ✅ SSL automático
- ✅ CDN global incluido
- ✅ Variables de entorno fáciles de configurar

**URL**: https://vercel.com

### 2. **Netlify**
- ✅ Gratis para proyectos personales
- ✅ Despliegue automático desde GitHub
- ✅ SSL automático
- ✅ CDN global

**URL**: https://netlify.com

### 3. **Railway**
- ✅ Muy fácil de usar
- ✅ Plan gratuito disponible
- ✅ Variables de entorno simples

**URL**: https://railway.app

### 4. **Render**
- ✅ Gratis con limitaciones
- ✅ SSL automático
- ✅ Fácil configuración

**URL**: https://render.com

---

## 📋 Checklist antes de desplegar

### ✅ Requisitos que ya tienes:
- [x] Next.js 14 configurado
- [x] TypeScript configurado
- [x] Scripts de build (`npm run build`)
- [x] Variables de entorno documentadas

### ⚠️ Lo que necesitas configurar:

1. **Variables de entorno en el hosting**
2. **Base de datos Supabase** (ya configurada, solo necesitas las credenciales)
3. **Cloudinary** (ya configurado, solo necesitas las credenciales)
4. **MercadoPago** (opcional, solo si usas pagos)

---

## 🚀 Guía paso a paso: Vercel (Recomendado)

### Paso 1: Preparar el proyecto

1. **Asegúrate de que el proyecto compile:**
   ```bash
   npm run build
   ```
   
   Si hay errores, corrígelos antes de continuar.

2. **Sube tu código a GitHub** (si aún no lo has hecho):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git push -u origin main
   ```

### Paso 2: Crear cuenta en Vercel

1. Ve a https://vercel.com
2. Crea una cuenta (puedes usar GitHub)
3. Haz clic en "Add New Project"
4. Conecta tu repositorio de GitHub

### Paso 3: Configurar el proyecto en Vercel

1. **Framework Preset**: Vercel detectará automáticamente "Next.js"
2. **Root Directory**: Deja en blanco (o `./` si tu proyecto está en una subcarpeta)
3. **Build Command**: `npm run build` (automático)
4. **Output Directory**: `.next` (automático)
5. **Install Command**: `npm install` (automático)

### Paso 4: Configurar variables de entorno

En Vercel, ve a **Settings → Environment Variables** y agrega:

```env
# Supabase (OBLIGATORIO)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Cloudinary (OBLIGATORIO si usas imágenes)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret

# MercadoPago (OPCIONAL)
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=tu-public-key
MERCADOPAGO_ACCESS_TOKEN=tu-access-token

# URL del sitio (IMPORTANTE)
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
```

**⚠️ IMPORTANTE**: 
- Reemplaza `tu-dominio.vercel.app` con la URL que Vercel te asigne después del primer despliegue
- O usa tu dominio personalizado si lo configuras

### Paso 5: Desplegar

1. Haz clic en **"Deploy"**
2. Espera a que termine el build (2-5 minutos)
3. ¡Listo! Tu app estará en `https://tu-proyecto.vercel.app`

---

## 🔧 Configuración adicional necesaria

### 1. Actualizar URL en Supabase

Después de desplegar, necesitas actualizar la URL permitida en Supabase:

1. Ve a tu proyecto en Supabase
2. **Settings → Authentication → URL Configuration**
3. Agrega tu URL de producción en **"Site URL"** y **"Redirect URLs"**:
   ```
   https://tu-proyecto.vercel.app
   ```

### 2. Configurar webhooks de MercadoPago (si usas pagos)

1. Ve a tu cuenta de MercadoPago
2. **Webhooks → Configurar**
3. Agrega la URL de tu webhook:
   ```
   https://tu-proyecto.vercel.app/api/mercadopago/webhook
   ```

### 3. Configurar dominio personalizado (opcional)

1. En Vercel, ve a **Settings → Domains**
2. Agrega tu dominio (ej: `tudominio.com`)
3. Sigue las instrucciones para configurar DNS
4. Actualiza `NEXT_PUBLIC_SITE_URL` con tu dominio personalizado

---

## 🐛 Solución de problemas comunes

### Error: "Missing environment variables"

**Solución**: Asegúrate de haber agregado todas las variables de entorno en Vercel (Settings → Environment Variables) y haz un nuevo despliegue.

### Error: "Build failed"

**Solución**: 
1. Revisa los logs de build en Vercel
2. Prueba localmente: `npm run build`
3. Corrige los errores antes de desplegar

### Error: "Supabase connection failed"

**Solución**: 
1. Verifica que las variables de entorno de Supabase estén correctas
2. Verifica que la URL de Supabase esté en la lista de URLs permitidas
3. Verifica que el proyecto de Supabase esté activo

### La app funciona pero las imágenes no cargan

**Solución**: 
1. Verifica las variables de entorno de Cloudinary
2. Verifica que Cloudinary esté configurado correctamente
3. Revisa los logs de la consola del navegador

---

## 📊 Rendimiento y optimización

### Lo que Vercel hace automáticamente:

- ✅ **CDN global**: Tu app se sirve desde servidores cercanos a tus usuarios
- ✅ **Optimización de imágenes**: Next.js optimiza imágenes automáticamente
- ✅ **Caché inteligente**: Páginas estáticas se cachean automáticamente
- ✅ **SSL/HTTPS**: Certificado SSL automático y gratuito

### Optimizaciones adicionales que puedes hacer:

1. **Habilitar ISR (Incremental Static Regeneration)** para páginas que cambian poco
2. **Usar `next/image`** para todas las imágenes (ya lo estás haciendo)
3. **Lazy loading** de componentes pesados (ya implementado en algunos lugares)

---

## 💰 Costos estimados

### Plan gratuito (suficiente para empezar):

- **Vercel**: Gratis (hasta 100GB de ancho de banda/mes)
- **Supabase**: Gratis (hasta 500MB de base de datos)
- **Cloudinary**: Gratis (hasta 25GB de almacenamiento)
- **MercadoPago**: Solo pagas comisiones por transacciones

### Si creces:

- **Vercel Pro**: $20/mes (más ancho de banda y funciones)
- **Supabase Pro**: $25/mes (más almacenamiento y funciones)
- **Cloudinary**: Planes desde $89/mes (más almacenamiento)

---

## 🎯 Resumen rápido

1. ✅ Tu app **SÍ se puede subir a hosting**
2. ✅ **Vercel es la opción más fácil** para Next.js
3. ✅ Necesitas configurar **variables de entorno** en el hosting
4. ✅ El proceso toma **~10-15 minutos**
5. ✅ **Gratis para empezar** (planes gratuitos disponibles)

---

## 📞 Siguiente paso

1. **Prueba localmente primero**: `npm run build` debe funcionar sin errores
2. **Sube a GitHub** (si aún no lo has hecho)
3. **Crea cuenta en Vercel** y conecta tu repositorio
4. **Configura variables de entorno** en Vercel
5. **Despliega** y ¡listo!

¿Necesitas ayuda con algún paso específico? Puedo ayudarte a configurar cualquier parte del proceso.
